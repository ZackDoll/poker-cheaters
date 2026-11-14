"""Everything a live room writes to the database. All methods are blocking.

Rooms call them through asyncio.to_thread. Tests swap in a fake with the same methods.
"""

from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.db.models import Decision, GameSession, Hand, SessionPlayer
from app.db.session import SessionLocal
from app.ml.base import DecisionContext
from app.ml.registry import ModelRegistry
from app.schemas.game import GameState
from app.schemas.signals import LiveFaceFeatures
from app.services import prediction_service, stats_service
from app.services.room_token import TokenClaims


class Persistence(Protocol):
    def upsert_player(self, claims: TokenClaims) -> UUID: ...
    def start_session(self, code: str, host_player_id: UUID, settings: dict) -> UUID: ...
    def add_session_player(self, session_id: UUID, player_id: UUID, chips: int) -> None: ...
    def start_hand(self, session_id: UUID, number: int) -> UUID: ...
    def judge(
        self,
        session_id: UUID,
        hand_id: UUID,
        player_id: UUID,
        state: GameState,
        live_face: LiveFaceFeatures | None,
    ) -> dict: ...
    def label(self, decision_id: UUID, was_bluff: bool, hole_cards: list[str]) -> None: ...
    def end_hand(
        self,
        session_id: UUID,
        hand_id: UUID,
        board: list[str],
        pot: int,
        winners: list[dict],
        shown: list[dict],
        stacks: dict[UUID, int],
        played: list[UUID],
    ) -> None: ...
    def end_session(self, session_id: UUID) -> None: ...


class DatabasePersistence:
    def __init__(self, registry: ModelRegistry) -> None:
        self.registry = registry

    def upsert_player(self, claims: TokenClaims) -> UUID:
        with SessionLocal() as db:
            return stats_service.upsert_player(db, claims).id

    def start_session(self, code: str, host_player_id: UUID, settings: dict) -> UUID:
        with SessionLocal() as db:
            session = GameSession(
                label=f"Room {code}",
                kind="live_room",
                room_code=code,
                host_player_id=host_player_id,
                settings=settings,
            )
            db.add(session)
            db.commit()
            return session.id

    def add_session_player(self, session_id: UUID, player_id: UUID, chips: int) -> None:
        with SessionLocal() as db:
            statement = (
                insert(SessionPlayer)
                .values(session_id=session_id, player_id=player_id, starting_chips=chips)
                .on_conflict_do_nothing(constraint="uq_session_players_session_player")
            )
            db.execute(statement)
            db.commit()

    def start_hand(self, session_id: UUID, number: int) -> UUID:
        with SessionLocal() as db:
            hand = Hand(session_id=session_id, number=number, board=[], winners=[])
            db.add(hand)
            db.commit()
            return hand.id

    def judge(
        self,
        session_id: UUID,
        hand_id: UUID,
        player_id: UUID,
        state: GameState,
        live_face: LiveFaceFeatures | None,
    ) -> dict:
        with SessionLocal() as db:
            ctx = DecisionContext(state=state, live_face=live_face)
            decision = prediction_service.predict_and_save(
                db, self.registry, session_id, ctx, player_id=player_id, hand_id=hand_id
            )
            return {
                "decision_id": decision.id,
                "probability": decision.bluff_probability,
                "calibrated": decision.calibrated,
                "reasons": list(decision.reasons),
            }

    def label(self, decision_id: UUID, was_bluff: bool, hole_cards: list[str]) -> None:
        with SessionLocal() as db:
            decision = db.get(Decision, decision_id)
            if decision is None:
                return
            decision.was_bluff = was_bluff
            decision.outcome_source = "dealt"
            decision.revealed_target_cards = hole_cards
            decision.labeled_at = datetime.now(UTC)
            db.commit()

    def end_hand(
        self,
        session_id: UUID,
        hand_id: UUID,
        board: list[str],
        pot: int,
        winners: list[dict],
        shown: list[dict],
        stacks: dict[UUID, int],
        played: list[UUID],
    ) -> None:
        with SessionLocal() as db:
            hand = db.get(Hand, hand_id)
            if hand is not None:
                hand.board, hand.pot, hand.winners = board, pot, winners
                hand.shown = {"hands": shown}
                hand.ended_at = datetime.now(UTC)
            rows = db.scalars(select(SessionPlayer).where(SessionPlayer.session_id == session_id))
            for row in rows:
                if row.player_id in stacks:
                    row.final_chips = stacks[row.player_id]
                if row.player_id in played:
                    row.hands_played += 1
            db.commit()

    def end_session(self, session_id: UUID) -> None:
        with SessionLocal() as db:
            session = db.get(GameSession, session_id)
            if session is not None and session.ended_at is None:
                session.ended_at = datetime.now(UTC)
                db.commit()
