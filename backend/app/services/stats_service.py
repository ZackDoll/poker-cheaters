"""Reads for the Sessions and Profiles pages: summaries of what happened at live tables."""

from collections import Counter
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, selectinload

from app.db.models import Decision, GameSession, Hand, Player, SessionPlayer
from app.schemas.live import (
    CountedItem,
    DecisionOut,
    HandOut,
    PlayerBrief,
    Profile,
    SessionDetail,
    SessionPlayerOut,
    SessionSummary,
)
from app.services.room_token import TokenClaims

RECENT_SESSIONS = 5
TOP_ITEMS = 5
LIST_LIMIT = 50
BLUFF_THRESHOLD = 0.5


def upsert_player(db: Session, claims: TokenClaims) -> Player:
    statement = (
        insert(Player)
        .values(external_user_id=claims.sub, display_name=claims.name, avatar_url=claims.avatar)
        .on_conflict_do_update(
            index_elements=[Player.external_user_id],
            set_={
                "display_name": claims.name,
                "avatar_url": claims.avatar,
                "last_seen_at": datetime.now(UTC),
            },
        )
        .returning(Player.id)
    )
    player_id = db.execute(statement).scalar_one()
    db.commit()
    return db.get(Player, player_id)


def find_player(db: Session, external_user_id: str) -> Player | None:
    return db.scalar(select(Player).where(Player.external_user_id == external_user_id))


def brief(player: Player) -> PlayerBrief:
    return PlayerBrief(id=player.id, name=player.display_name, avatar_url=player.avatar_url)


def read_accuracy(decisions: list[Decision]) -> float | None:
    """How often the model's side of 50% matched what the hand showed. Labelled bets only."""
    labeled = [d for d in decisions if d.was_bluff is not None]
    if not labeled:
        return None
    hits = sum((d.bluff_probability >= BLUFF_THRESHOLD) == d.was_bluff for d in labeled)
    return hits / len(labeled)


def _live_decisions(db: Session, *conditions) -> list[Decision]:
    statement = (
        select(Decision)
        .where(Decision.hand_id.is_not(None), *conditions)
        .options(selectinload(Decision.signals))
        .order_by(Decision.created_at)
    )
    return list(db.scalars(statement))


def _session_players(db: Session, session_id: UUID) -> list[SessionPlayer]:
    statement = (
        select(SessionPlayer)
        .where(SessionPlayer.session_id == session_id)
        .options(selectinload(SessionPlayer.player))
        .order_by(SessionPlayer.joined_at)
    )
    return list(db.scalars(statement))


def _summary(db: Session, session: GameSession, me: Player | None) -> SessionSummary:
    rows = _session_players(db, session.id)
    decisions = _live_decisions(db, Decision.session_id == session.id)
    hands = db.scalar(select(func.count()).select_from(Hand).where(Hand.session_id == session.id))
    mine = next((r for r in rows if me and r.player_id == me.id), None)
    net = mine.final_chips - mine.starting_chips if mine and mine.final_chips is not None else None
    return SessionSummary(
        id=session.id,
        room_code=session.room_code,
        created_at=session.created_at,
        ended_at=session.ended_at,
        players=[
            SessionPlayerOut(
                **brief(r.player).model_dump(),
                starting_chips=r.starting_chips,
                final_chips=r.final_chips,
                hands_played=r.hands_played,
            )
            for r in rows
        ],
        hands=hands or 0,
        judged_bets=len(decisions),
        labeled_bets=sum(d.was_bluff is not None for d in decisions),
        read_accuracy=read_accuracy(decisions),
        my_net_chips=net,
    )


def sessions_for(db: Session, me: Player) -> list[SessionSummary]:
    statement = (
        select(GameSession)
        .join(SessionPlayer, SessionPlayer.session_id == GameSession.id)
        .where(SessionPlayer.player_id == me.id, GameSession.kind == "live_room")
        .order_by(GameSession.created_at.desc())
        .limit(LIST_LIMIT)
    )
    return [_summary(db, s, me) for s in db.scalars(statement)]


def session_detail(db: Session, session_id: UUID, me: Player) -> SessionDetail | None:
    session = db.get(GameSession, session_id)
    if session is None or session.kind != "live_room":
        return None
    rows = _session_players(db, session_id)
    if not any(r.player_id == me.id for r in rows):
        return None  # Only people who sat at the table can open its history.

    names = {r.player_id: r.player.display_name for r in rows}
    names_by_sub = {r.player.external_user_id: r.player.display_name for r in rows}
    by_hand: dict[UUID, list[Decision]] = {}
    for decision in _live_decisions(db, Decision.session_id == session_id):
        by_hand.setdefault(decision.hand_id, []).append(decision)

    hands = db.scalars(select(Hand).where(Hand.session_id == session_id).order_by(Hand.number))
    hand_list = [
        HandOut(
            number=hand.number,
            board=hand.board,
            pot=hand.pot,
            winners=[{**w, "name": names_by_sub.get(w.get("player"))} for w in hand.winners],
            shown=(hand.shown or {}).get("hands", []),
            decisions=[
                DecisionOut(
                    id=d.id,
                    player_id=d.player_id,
                    player_name=names.get(d.player_id, "Player"),
                    street=d.game_state["street"],
                    bet_size=d.game_state["bet_size"],
                    pot_size=d.game_state["pot_size"],
                    probability=d.bluff_probability,
                    calibrated=d.calibrated,
                    reasons=d.reasons,
                    was_bluff=d.was_bluff,
                    created_at=d.created_at,
                )
                for d in by_hand.get(hand.id, [])
            ],
        )
        for hand in hands
    ]
    summary = _summary(db, session, me)
    return SessionDetail(**summary.model_dump(), settings=session.settings, hand_list=hand_list)


def _counted(counter: Counter, labels: dict[str, str]) -> list[CountedItem]:
    return [
        CountedItem(code=code, label=labels.get(code, code), count=count)
        for code, count in counter.most_common(TOP_ITEMS)
    ]


def profile(db: Session, target: Player, me: Player) -> Profile:
    decisions = _live_decisions(db, Decision.player_id == target.id)
    rows = list(db.scalars(select(SessionPlayer).where(SessionPlayer.player_id == target.id)))
    labeled = [d for d in decisions if d.was_bluff is not None]
    bluffs = sum(bool(d.was_bluff) for d in labeled)

    reason_counts, reason_labels = Counter(), {}
    tell_counts, tell_labels = Counter(), {}
    for decision in decisions:
        for reason in decision.reasons:
            reason_counts[reason["code"]] += 1
            reason_labels[reason["code"]] = reason["description"]
        for signal in decision.signals:
            if signal.model_name != "live_facial":
                continue
            for item in signal.evidence:
                if item["code"].startswith("tell:"):
                    tell_counts[item["code"]] += 1
                    tell_labels[item["code"]] = item["description"]

    recent_ids = [r.session_id for r in sorted(rows, key=lambda r: r.joined_at, reverse=True)]
    recent = [db.get(GameSession, sid) for sid in recent_ids[:RECENT_SESSIONS]]
    return Profile(
        player=brief(target),
        is_me=target.id == me.id,
        sessions=len(rows),
        hands_played=sum(r.hands_played for r in rows),
        judged_bets=len(decisions),
        labeled_bets=len(labeled),
        bluffs=bluffs,
        bluff_rate=bluffs / len(labeled) if labeled else None,
        average_read=(
            sum(d.bluff_probability for d in decisions) / len(decisions) if decisions else None
        ),
        read_accuracy=read_accuracy(decisions),
        net_chips=sum(r.final_chips - r.starting_chips for r in rows if r.final_chips is not None),
        top_reasons=_counted(reason_counts, reason_labels),
        top_tells=_counted(tell_counts, tell_labels),
        recent_sessions=[_summary(db, s, me) for s in recent if s is not None],
    )


def shared_player_ids(db: Session, me: Player) -> list[UUID]:
    """Everyone who has sat at a live table with `me`, plus `me`."""
    mine = select(SessionPlayer.session_id).where(SessionPlayer.player_id == me.id)
    others = db.scalars(
        select(SessionPlayer.player_id).where(SessionPlayer.session_id.in_(mine)).distinct()
    )
    return [me.id, *[p for p in others if p != me.id]]


def profiles_for(db: Session, me: Player) -> list[Profile]:
    ids = shared_player_ids(db, me)
    players = {p.id: p for p in db.scalars(select(Player).where(Player.id.in_(ids)))}
    return [profile(db, players[pid], me) for pid in ids if pid in players]


def profile_for(db: Session, player_id: UUID, me: Player) -> Profile | None:
    if player_id not in shared_player_ids(db, me):
        return None  # Strangers' profiles are not visible.
    target = db.get(Player, player_id)
    return profile(db, target, me) if target else None
