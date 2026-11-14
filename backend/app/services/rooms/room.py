"""One live poker room: members, the table, timers, bluff reads and broadcasts.

All state changes run under one asyncio lock, so a room behaves like a single
sequential actor even though sockets, timers and read tasks run concurrently.
Hole cards only ever leave this module in a viewer's own snapshot or at showdown.
"""

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError, model_validator

from app.schemas.game import GameState, PriorAction
from app.schemas.signals import FaceDeviation, LiveFaceFeatures
from app.services.poker.bluff_rule import was_bluff
from app.services.poker.table import MAX_SEATS, IllegalAction, PokerTable
from app.services.room_token import TokenClaims
from app.services.rooms.persistence import Persistence

logger = logging.getLogger(__name__)

# Spread players around the table: the second sits across from the first, and so on.
SEAT_ORDER = (0, 3, 1, 5, 2, 4)
FACE_WINDOW_SECONDS = 3.0
MIN_FACE_INTERVAL_SECONDS = 0.2
MAX_MESSAGE_CHARS = 16_000
JUDGE_WAIT_SECONDS = 20.0


@dataclass(frozen=True)
class RoomTiming:
    turn_seconds: float = 30.0
    away_turn_seconds: float = 5.0
    recap_seconds: float = 7.0
    reconnect_grace_seconds: float = 60.0


class RoomSettings(BaseModel):
    starting_stack: int = Field(default=1000, ge=100, le=1_000_000)
    small_blind: int = Field(default=5, ge=1, le=100_000)
    big_blind: int = Field(default=10, ge=2, le=200_000)
    reads: Literal["open", "hidden"] = "open"

    @model_validator(mode="after")
    def check_blinds(self) -> "RoomSettings":
        if self.small_blind > self.big_blind:
            raise ValueError("The small blind cannot be larger than the big blind")
        if self.starting_stack < 10 * self.big_blind:
            raise ValueError("The starting stack must be at least 10 big blinds")
        return self


class FaceMessage(BaseModel):
    score: float = Field(ge=0, le=10, allow_inf_nan=False)
    peak: float | None = Field(default=None, ge=0, le=10, allow_inf_nan=False)
    top: list[FaceDeviation] = Field(default=[], max_length=8)
    tracking: bool = True


@dataclass
class Member:
    sub: str
    name: str
    avatar: str | None
    db_id: UUID | None = None
    ws: Any = None
    mic: bool = True
    cam: bool = True
    calibrated: bool = False
    faces: deque = field(default_factory=lambda: deque(maxlen=40))
    last_face_at: float = 0.0
    grace_task: asyncio.Task | None = None

    @property
    def connected(self) -> bool:
        return self.ws is not None

    def face_features(self, now: float) -> LiveFaceFeatures | None:
        """Summarise the last few seconds of this player's browser-side face scores."""
        window = [s for s in self.faces if now - s["t"] <= FACE_WINDOW_SECONDS]
        tracked = [s for s in window if s["tracking"]]
        if not tracked:
            return None
        totals: dict[str, list[float]] = {}
        for sample in tracked:
            for item in sample["top"]:
                totals.setdefault(item.name, []).append(item.z)
        deviations = [FaceDeviation(name=n, z=sum(z) / len(z)) for n, z in totals.items()]
        deviations.sort(key=lambda d: -abs(d.z))
        return LiveFaceFeatures(
            mean_score=sum(s["score"] for s in tracked) / len(tracked),
            peak_score=max(s["peak"] for s in tracked),
            deviations=deviations[:6],
            tracked_ratio=len(tracked) / len(window),
            samples=len(window),
        )


@dataclass
class Read:
    """One judged bet or raise, kept until the hand ends and it can be labelled."""

    player: str
    seat: int
    street: str
    board: list[str]
    decision_id: UUID
    probability: float
    calibrated: bool
    reasons: list[dict]
    was_bluff: bool | None = None


class Room:
    def __init__(
        self,
        code: str,
        host_sub: str,
        settings: RoomSettings,
        persistence: Persistence,
        timing: RoomTiming | None = None,
    ) -> None:
        self.code = code
        self.host_sub = host_sub
        self.settings = settings
        self.persistence = persistence
        self.timing = timing or RoomTiming()
        self.members: dict[str, Member] = {}
        self.table = PokerTable(settings.small_blind, settings.big_blind)
        self.started = False
        self.session_id: UUID | None = None
        self.hand_id: UUID | None = None
        self.hand_players: list[str] = []
        self.reads: list[Read] = []
        self.judge_tasks: list[asyncio.Task] = []
        self.reveal: dict[str, list[str]] = {}
        self.deadline: float | None = None
        self.created_at = time.monotonic()
        self.empty_since: float | None = time.monotonic()
        self.closed = False
        self._lock = asyncio.Lock()
        self._timer: asyncio.Task | None = None
        self._next_hand: asyncio.Task | None = None

    # ---- joining and leaving ---------------------------------------------

    async def join(self, claims: TokenClaims, ws: Any) -> bool:
        async with self._lock:
            member = self.members.get(claims.sub)
            if member is None and len(self.members) >= MAX_SEATS:
                await self._send_ws(
                    ws, {"type": "error", "code": "full", "message": "Room is full"}
                )
                return False
            if member is None:
                member = Member(claims.sub, claims.name, claims.avatar)
                member.db_id = await asyncio.to_thread(self.persistence.upsert_player, claims)
                self.table.add_player(
                    claims.sub, claims.name, self.settings.starting_stack, SEAT_ORDER
                )
                self.members[claims.sub] = member
                if self.session_id is not None:
                    await asyncio.to_thread(
                        self.persistence.add_session_player,
                        self.session_id,
                        member.db_id,
                        self.settings.starting_stack,
                    )
            else:
                member.name, member.avatar = claims.name, claims.avatar
                old = member.ws
                if old is not None and old is not ws:
                    await self._close_ws(old, 4000)
            if member.grace_task:
                member.grace_task.cancel()
                member.grace_task = None
            member.ws = ws
            self.empty_since = None
            self.table.set_away(claims.sub, False)
            if self.host_sub not in self.members:
                self.host_sub = claims.sub

            await self._send_ws(ws, {"type": "welcome", "you": claims.sub, "code": self.code})
            await self._broadcast_state()
            self._maybe_schedule_next_hand()
            if self.table.actor is not None and self.table.seat_of(claims.sub) == self.table.actor:
                self._arm_timer()  # They were timing out as an absent player; give them a turn.
            return True

    async def disconnect(self, sub: str, ws: Any) -> None:
        async with self._lock:
            member = self.members.get(sub)
            if member is None or member.ws is not ws:
                return  # A newer connection already replaced this one.
            member.ws = None
            self.table.set_away(sub, True)
            if not any(m.connected for m in self.members.values()):
                self.empty_since = time.monotonic()
            member.grace_task = asyncio.create_task(self._grace_expired(sub))
            await self._broadcast_state()
            if self.table.actor is not None and self.table.seat_of(sub) == self.table.actor:
                self._arm_timer()

    async def _grace_expired(self, sub: str) -> None:
        await asyncio.sleep(self.timing.reconnect_grace_seconds)
        async with self._lock:
            member = self.members.get(sub)
            if member is not None and not member.connected:
                await self._remove_member(sub)

    async def leave(self, sub: str) -> None:
        async with self._lock:
            member = self.members.get(sub)
            if member is not None:
                ws = member.ws
                await self._remove_member(sub)
                if ws is not None:
                    await self._close_ws(ws, 1000)

    async def _remove_member(self, sub: str) -> None:
        member = self.members.pop(sub, None)
        if member is None:
            return
        if member.grace_task:
            member.grace_task.cancel()
        events = self.table.remove_player(sub)
        if self.host_sub == sub and self.members:
            connected = [m for m in self.members.values() if m.connected]
            self.host_sub = (connected or list(self.members.values()))[0].sub
        if not any(m.connected for m in self.members.values()):
            self.empty_since = self.empty_since or time.monotonic()
        if events:
            await self._apply(events)
        else:
            await self._broadcast_state()

    # ---- incoming messages --------------------------------------------------

    async def handle(self, sub: str, message: dict) -> None:
        kind = message.get("type")
        if kind == "face":
            self._on_face(sub, message)
            return
        async with self._lock:
            member = self.members.get(sub)
            if member is None or self.closed:
                return
            try:
                if kind == "action":
                    await self._on_action(member, message)
                elif kind == "start_game":
                    await self._on_start(member)
                elif kind == "media":
                    await self._on_media(member, message)
                elif kind == "rtc":
                    await self._on_rtc(member, message)
                elif kind == "settings":
                    await self._on_settings(member, message)
                elif kind == "kick":
                    await self._on_kick(member, message)
                elif kind == "rebuy":
                    await self._on_rebuy(member)
                elif kind == "leave":
                    ws = member.ws
                    await self._remove_member(sub)
                    if ws is not None:
                        await self._close_ws(ws, 1000)
                else:
                    await self._error(member, "unknown_message", "Unknown message type")
            except IllegalAction as exc:
                await self._error(member, "illegal_action", str(exc))

    def _on_face(self, sub: str, message: dict) -> None:
        member = self.members.get(sub)
        now = time.monotonic()
        if member is None or now - member.last_face_at < MIN_FACE_INTERVAL_SECONDS:
            return
        try:
            face = FaceMessage.model_validate(message)
        except ValidationError:
            return
        member.last_face_at = now
        member.faces.append(
            {
                "t": now,
                "score": face.score,
                "peak": face.peak if face.peak is not None else face.score,
                "top": face.top,
                "tracking": face.tracking,
            }
        )

    async def _on_media(self, member: Member, message: dict) -> None:
        for key in ("mic", "cam", "calibrated"):
            if isinstance(message.get(key), bool):
                setattr(member, key, message[key])
        await self._broadcast_state()

    async def _on_rtc(self, member: Member, message: dict) -> None:
        target = self.members.get(message.get("to"))
        data = message.get("data")
        if target is None or target.ws is None or not isinstance(data, dict):
            return
        if len(str(data)) > MAX_MESSAGE_CHARS:
            return
        await self._send(target, {"type": "rtc", "from": member.sub, "data": data})

    async def _on_settings(self, member: Member, message: dict) -> None:
        if member.sub != self.host_sub:
            return await self._error(member, "not_host", "Only the host can change settings")
        if self.started:
            return await self._error(member, "started", "Settings are locked once play starts")
        try:
            new = RoomSettings.model_validate(message.get("settings") or {})
        except ValidationError as exc:
            return await self._error(member, "bad_settings", exc.errors()[0]["msg"])
        self.settings = new
        self.table = PokerTable(new.small_blind, new.big_blind)
        for other in self.members.values():
            self.table.add_player(other.sub, other.name, new.starting_stack, SEAT_ORDER)
        await self._broadcast_state()

    async def _on_kick(self, member: Member, message: dict) -> None:
        target = message.get("player")
        if member.sub != self.host_sub or target == member.sub or target not in self.members:
            return
        ws = self.members[target].ws
        await self._remove_member(target)
        if ws is not None:
            await self._send_ws(ws, {"type": "kicked"})
            await self._close_ws(ws, 4003)

    async def _on_rebuy(self, member: Member) -> None:
        index = self.table.seat_of(member.sub)
        seat = self.table.seats[index]
        if self.table.hand_active or seat.stack > 0:
            return await self._error(
                member, "rebuy", "You can rebuy only when you are out of chips"
            )
        seat.stack = self.settings.starting_stack
        seat.sitting_out = False
        await self._broadcast_state()
        self._maybe_schedule_next_hand()

    async def _on_start(self, member: Member) -> None:
        if member.sub != self.host_sub:
            return await self._error(member, "not_host", "Only the host can start the game")
        if not self.table.can_start():
            return await self._error(member, "need_players", "Need at least two players with chips")
        self.started = True
        await self._start_hand()

    # ---- the hand -----------------------------------------------------------

    async def _ensure_session(self) -> None:
        if self.session_id is not None:
            return
        host = self.members[self.host_sub]
        self.session_id = await asyncio.to_thread(
            self.persistence.start_session, self.code, host.db_id, self.settings.model_dump()
        )
        for member in self.members.values():
            await asyncio.to_thread(
                self.persistence.add_session_player,
                self.session_id,
                member.db_id,
                self.settings.starting_stack,
            )

    async def _start_hand(self) -> None:
        if self.table.hand_active or not self.table.can_start() or self.closed:
            return
        await self._ensure_session()
        events = self.table.start_hand()
        self.hand_id = await asyncio.to_thread(
            self.persistence.start_hand, self.session_id, self.table.hand_number
        )
        self.reads, self.judge_tasks, self.reveal = [], [], {}
        self.hand_players = [s.player_id for s in self.table.players() if s.in_hand]
        await self._apply(events)

    def _maybe_schedule_next_hand(self, delay: float = 1.5) -> None:
        if not self.started or self.table.hand_active or self.closed:
            return
        if self._next_hand and not self._next_hand.done():
            return
        self._next_hand = asyncio.create_task(self._run_next_hand(delay))

    async def _run_next_hand(self, delay: float) -> None:
        await asyncio.sleep(delay)
        async with self._lock:
            self._next_hand = None  # So a hand that ends at once can schedule the next one.
            if self.table.can_start():
                await self._start_hand()
            else:
                await self._broadcast_state()

    async def _on_action(self, member: Member, message: dict) -> None:
        kind, amount = message.get("kind"), message.get("amount")
        if kind not in ("fold", "check", "call", "raise"):
            raise IllegalAction("Unknown action")
        if amount is not None and (not isinstance(amount, int) or isinstance(amount, bool)):
            raise IllegalAction("The amount must be a whole number of chips")
        await self._act(member.sub, kind, amount)

    async def _act(self, sub: str, kind: str, amount: int | None) -> None:
        index = self.table.seat_of(sub)
        before = self._bet_context(sub, index) if kind == "raise" else None
        events = self.table.act(sub, kind, amount)
        action = events[0]
        if before is not None and action["action"] in ("bet", "raise"):
            self._start_judging(sub, index, action, before)
        await self._apply(events)

    def _bet_context(self, sub: str, index: int) -> dict:
        """What was visible when a bet was made. The bettor's own cards are not included."""
        table = self.table
        return {
            "street": table.phase,
            "board": list(table.board),
            "pot_before": table.pot(),
            "position": table.position_of(index),
            "active": len(table._live()),
            "prior": [
                PriorAction(street=r.street, action=r.action, amount=r.amount)
                for r in table.log
                if r.player_id == sub and r.action != "fold"
            ],
            "face": self.members[sub].face_features(time.monotonic()),
        }

    def _start_judging(self, sub: str, index: int, action: dict, before: dict) -> None:
        member = self.members[sub]
        try:
            state = GameState(
                street=before["street"],
                pot_size=max(before["pot_before"], 1),
                bet_size=max(action["amount"], 1),
                big_blind=self.settings.big_blind,
                num_active_players=min(max(before["active"], 2), 10),
                target_position=before["position"],
                board=before["board"],
                observer_hole_cards=[],
                target_prior_actions=before["prior"],
            )
        except ValidationError:
            logger.exception("Could not build a game state for a bet")
            return
        task = asyncio.create_task(
            self._judge(member, index, state, before["face"], self.hand_id, self.session_id)
        )
        self.judge_tasks.append(task)

    async def _judge(self, member, index, state, face, hand_id, session_id) -> None:
        if member.db_id is None or session_id is None or hand_id is None:
            return
        try:
            result = await asyncio.to_thread(
                self.persistence.judge, session_id, hand_id, member.db_id, state, face
            )
        except Exception:
            logger.exception("Judging a bet failed")
            return
        read = Read(
            player=member.sub,
            seat=index,
            street=state.street,
            board=list(state.board),
            decision_id=result["decision_id"],
            probability=result["probability"],
            calibrated=result["calibrated"],
            reasons=result["reasons"],
        )
        if hand_id != self.hand_id:
            return  # The hand ended before the read finished.
        self.reads.append(read)
        if self.settings.reads == "open":
            payload = self._read_payload(read)
        else:
            payload = {"type": "read", "sealed": True, "player": read.player, "street": read.street}
        await self._broadcast({**payload, "hand": self.table.hand_number})

    def _read_payload(self, read: Read) -> dict:
        return {
            "type": "read",
            "sealed": False,
            "player": read.player,
            "street": read.street,
            "probability": read.probability,
            "calibrated": read.calibrated,
            "reasons": read.reasons,
        }

    async def _finish_hand(self, end: dict, showdown: dict | None) -> None:
        if self.judge_tasks:
            await asyncio.wait(self.judge_tasks, timeout=JUDGE_WAIT_SECONDS)
        holes = end["holes"]
        for read in self.reads:
            hole = holes.get(read.player)
            if not hole:
                continue
            read.was_bluff = was_bluff(hole, read.board, read.street)
            if read.was_bluff is not None:
                await asyncio.to_thread(
                    self.persistence.label, read.decision_id, read.was_bluff, hole
                )

        names = {sub: m.name for sub, m in self.members.items()}
        winners = [{**w, "name": names.get(w["player"], "Player")} for w in end["winners"]]
        shown = [
            {"player": h["player"], "name": names.get(h["player"], "Player"), "hole": h["hole"],
             "label": h["label"]}
            for h in (showdown["hands"] if showdown else [])
        ]  # fmt: skip
        stacks = {
            self.members[s.player_id].db_id: s.stack
            for s in self.table.players()
            if s.player_id in self.members and self.members[s.player_id].db_id
        }
        played = [
            self.members[sub].db_id
            for sub in self.hand_players
            if sub in self.members and self.members[sub].db_id
        ]
        pot = sum(w["amount"] for w in end["winners"])
        await asyncio.to_thread(
            self.persistence.end_hand,
            self.session_id,
            self.hand_id,
            end["board"],
            pot,
            end["winners"],
            shown,
            stacks,
            played,
        )
        await self._broadcast(
            {
                "type": "hand_recap",
                "hand": end["hand"],
                "board": end["board"],
                "pot": pot,
                "winners": winners,
                "shown": shown,
                "reads": [
                    {
                        **self._read_payload(r),
                        "sealed": False,
                        "name": names.get(r.player, "Player"),
                        "was_bluff": r.was_bluff,
                    }
                    for r in self.reads
                ],
            }
        )
        self.hand_id = None
        self._maybe_schedule_next_hand(self.timing.recap_seconds)

    # ---- turn timer ---------------------------------------------------------------

    def _arm_timer(self) -> None:
        if self._timer:
            self._timer.cancel()
        self._timer = None
        self.deadline = None
        index = self.table.actor
        if index is None or self.closed:
            return
        sub = self.table.seats[index].player_id
        member = self.members.get(sub)
        seconds = (
            self.timing.turn_seconds
            if member is not None and member.connected
            else self.timing.away_turn_seconds
        )
        self.deadline = time.time() + seconds
        self._timer = asyncio.create_task(self._timeout(sub, self.table.hand_number, seconds))

    async def _timeout(self, sub: str, hand: int, seconds: float) -> None:
        await asyncio.sleep(seconds)
        async with self._lock:
            self._timer = None  # So re-arming below does not cancel this running task.
            index = self.table.actor
            if index is None or self.table.hand_number != hand:
                return
            if self.table.seats[index].player_id != sub:
                return
            can_check = self.table.legal_actions(sub)["can_check"]
            try:
                await self._act(sub, "check" if can_check else "fold", None)
            except IllegalAction:
                logger.exception("Timeout action failed")

    # ---- publishing -------------------------------------------------------------------

    async def _apply(self, events: list[dict]) -> None:
        end = next((e for e in events if e["type"] == "hand_end"), None)
        showdown = next((e for e in events if e["type"] == "showdown"), None)
        if showdown:
            self.reveal = {h["player"]: h["hole"] for h in showdown["hands"]}
        public = [{k: v for k, v in e.items() if k != "holes"} for e in events]
        await self._broadcast({"type": "events", "events": public})
        if end:
            if self._timer:
                self._timer.cancel()
            self.deadline = None
            await self._broadcast_state()
            await self._finish_hand(end, showdown)
        else:
            self._arm_timer()
        await self._broadcast_state()

    def state_for(self, viewer: str) -> dict:
        return {
            "type": "state",
            "you": viewer,
            "room": {
                "code": self.code,
                "host": self.host_sub,
                "started": self.started,
                "settings": self.settings.model_dump(),
            },
            "members": [
                {
                    "sub": m.sub,
                    "name": m.name,
                    "avatar": m.avatar,
                    "connected": m.connected,
                    "mic": m.mic,
                    "cam": m.cam,
                    "calibrated": m.calibrated,
                    "seat": self.table.seat_of(m.sub),
                }
                for m in self.members.values()
            ],
            "table": self.table.snapshot(viewer, self.reveal),
            "deadline": int(self.deadline * 1000) if self.deadline else None,
            "now": int(time.time() * 1000),  # Lets clients correct for clock skew.
        }

    async def _broadcast_state(self) -> None:
        await asyncio.gather(
            *(self._send(m, self.state_for(m.sub)) for m in self.members.values() if m.connected)
        )

    async def _broadcast(self, data: dict) -> None:
        await asyncio.gather(*(self._send(m, data) for m in self.members.values() if m.connected))

    async def _send(self, member: Member, data: dict) -> None:
        if member.ws is not None:
            await self._send_ws(member.ws, data)

    @staticmethod
    async def _send_ws(ws: Any, data: dict) -> None:
        try:
            await ws.send_json(data)
        except Exception:  # A dead socket is cleaned up by its receive loop.
            logger.debug("Could not send to a socket", exc_info=True)

    @staticmethod
    async def _close_ws(ws: Any, code: int) -> None:
        try:
            await ws.close(code=code)
        except Exception:
            logger.debug("Could not close a socket", exc_info=True)

    async def _error(self, member: Member, code: str, message: str) -> None:
        await self._send(member, {"type": "error", "code": code, "message": message})

    # ---- shutdown --------------------------------------------------------------------------

    def summary(self) -> dict:
        return {
            "code": self.code,
            "players": len(self.members),
            "max": MAX_SEATS,
            "started": self.started,
            "settings": self.settings.model_dump(),
        }

    async def close(self) -> None:
        self.closed = True
        for task in (self._timer, self._next_hand, *self.judge_tasks):
            if task:
                task.cancel()
        for member in self.members.values():
            if member.grace_task:
                member.grace_task.cancel()
            if member.ws is not None:
                await self._close_ws(member.ws, 1001)
        if self.session_id is not None:
            await asyncio.to_thread(self.persistence.end_session, self.session_id)
