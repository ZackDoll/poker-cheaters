"""Room behaviour, tested without a database or real sockets."""

import asyncio
import json
import random
import time
from uuid import NAMESPACE_URL, uuid4, uuid5

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app
from app.services.room_token import InvalidTokenError, TokenClaims, sign_token, verify_token
from app.services.rooms.manager import RoomLimitError, RoomManager
from app.services.rooms.room import Room, RoomSettings, RoomTiming

SECRET = "test-room-secret"


class FakeWS:
    def __init__(self):
        self.sent: list[dict] = []
        self.closed: int | None = None

    async def send_json(self, data):
        self.sent.append(json.loads(json.dumps(data)))  # Must be JSON-serialisable.

    async def close(self, code=1000):
        self.closed = code

    def of_type(self, kind):
        return [m for m in self.sent if m["type"] == kind]

    def dump(self) -> str:
        return json.dumps(self.sent)


class FakePersistence:
    def __init__(self):
        self.judged, self.labels, self.hands, self.sessions_ended = [], [], [], []

    def upsert_player(self, claims):
        return uuid5(NAMESPACE_URL, claims.sub)

    def start_session(self, code, host_player_id, settings):
        return uuid4()

    def add_session_player(self, session_id, player_id, chips):
        pass

    def start_hand(self, session_id, number):
        return uuid4()

    def judge(self, session_id, hand_id, player_id, state, live_face):
        self.judged.append((state, live_face))
        reasons = [{"source": "statistics", "description": "Big bet", "contribution": 0.4}]
        return {
            "decision_id": uuid4(),
            "probability": 0.62,
            "calibrated": False,
            "reasons": reasons,
        }

    def label(self, decision_id, was_bluff, hole_cards):
        self.labels.append((was_bluff, hole_cards))

    def end_hand(self, *args):
        self.hands.append(args)

    def end_session(self, session_id):
        self.sessions_ended.append(session_id)


def claims(sub: str) -> TokenClaims:
    return TokenClaims(sub=sub, name=sub.upper(), avatar=None)


FAST = RoomTiming(
    turn_seconds=30, away_turn_seconds=5, recap_seconds=60, reconnect_grace_seconds=60
)


def make_room(reads="open", timing=FAST, seed=3):
    persistence = FakePersistence()
    room = Room("ABC234", "a", RoomSettings(reads=reads), persistence, timing)
    room.table.rng = random.Random(seed)
    return room, persistence


async def seat(room, *subs):
    sockets = {}
    for sub in subs:
        sockets[sub] = FakeWS()
        assert await room.join(claims(sub), sockets[sub])
    return sockets


def actor(room) -> str:
    return room.table.seats[room.table.actor].player_id


async def check_or_call(room):
    legal = room.table.legal_actions(actor(room))
    await room.handle(
        actor(room), {"type": "action", "kind": "check" if legal["can_check"] else "call"}
    )


# ---- tokens ----------------------------------------------------------------


def test_token_round_trip_and_rejections():
    good = sign_token(
        SECRET, {"sub": "u1", "name": "Ada", "avatar": "https://x/a.png", "exp": time.time() + 60}
    )
    assert verify_token(SECRET, good).name == "Ada"
    with pytest.raises(InvalidTokenError, match="signature"):
        verify_token("other-secret", good)
    expired = sign_token(SECRET, {"sub": "u1", "name": "Ada", "exp": time.time() - 1})
    with pytest.raises(InvalidTokenError, match="expired"):
        verify_token(SECRET, expired)
    with pytest.raises(InvalidTokenError):
        verify_token(SECRET, "not-a-token")
    with pytest.raises(InvalidTokenError, match="not configured"):
        verify_token("", good)
    unsafe = sign_token(
        SECRET, {"sub": "u1", "name": "x", "avatar": "javascript:1", "exp": time.time() + 60}
    )
    assert verify_token(SECRET, unsafe).avatar is None


def test_socket_rejects_bad_tokens_and_unknown_rooms():
    with TestClient(app) as client:
        client.app.state.rooms.persistence = FakePersistence()
        room = client.app.state.rooms.create("a", RoomSettings())
        with client.websocket_connect(f"/api/rooms/{room.code}/ws") as ws:
            ws.send_json({"type": "hello", "token": "garbage"})
            assert ws.receive_json()["code"] == "auth"
            with pytest.raises(WebSocketDisconnect) as closed:
                ws.receive_json()
            assert closed.value.code == 4001
        with client.websocket_connect("/api/rooms/ZZZZZZ/ws") as ws:
            assert ws.receive_json()["code"] == "no_room"


def test_create_room_requires_a_token_and_sets_limits():
    with TestClient(app) as client:
        client.app.state.rooms.persistence = FakePersistence()
        assert client.post("/api/rooms", json={}).status_code == 401
        token = sign_token(SECRET, {"sub": "host", "name": "H", "exp": time.time() + 60})
        auth = {"Authorization": f"Bearer {token}"}
        created = client.post("/api/rooms", json={"reads": "hidden"}, headers=auth)
        assert created.status_code == 201 and len(created.json()["code"]) == 6
        assert (
            client.get(f"/api/rooms/{created.json()['code'].lower()}", headers=auth).status_code
            == 200
        )
        assert (
            client.post(
                "/api/rooms", json={"small_blind": 50, "big_blind": 10}, headers=auth
            ).status_code
            == 422
        )
        for _ in range(2):
            assert client.post("/api/rooms", json={}, headers=auth).status_code == 201
        assert client.post("/api/rooms", json={}, headers=auth).status_code == 429


def test_full_socket_flow_with_two_real_connections():
    with TestClient(app) as client:
        client.app.state.rooms.persistence = FakePersistence()
        room = client.app.state.rooms.create("a", RoomSettings())
        tokens = {
            s: sign_token(SECRET, {"sub": s, "name": s.upper(), "exp": time.time() + 60})
            for s in "ab"
        }
        with (
            client.websocket_connect(f"/api/rooms/{room.code}/ws") as a,
            client.websocket_connect(f"/api/rooms/{room.code}/ws") as b,
        ):
            a.send_json({"type": "hello", "token": tokens["a"]})
            assert a.receive_json()["type"] == "welcome"
            assert a.receive_json()["type"] == "state"
            b.send_json({"type": "hello", "token": tokens["b"]})
            assert b.receive_json()["type"] == "welcome"
            state = b.receive_json()
            assert state["type"] == "state" and len(state["members"]) == 2
            b.send_json({"type": "start_game"})  # Not the host.
            while (message := b.receive_json())["type"] != "error":
                pass
            assert message["code"] == "not_host"


# ---- rooms -------------------------------------------------------------------------


def test_hole_cards_never_reach_other_players():
    async def scenario():
        room, _ = make_room()
        sockets = await seat(room, "a", "b", "c")
        await room.handle("a", {"type": "start_game"})
        holes = {s.player_id: s.hole for s in room.table.players()}
        for sub, ws in sockets.items():
            text = ws.dump()
            for other, cards in holes.items():
                for card in cards:
                    assert (card in text) == (other == sub), (
                        f"{card} leaked to or missing for {sub}"
                    )
        await room.close()

    asyncio.run(scenario())


def test_bet_is_judged_without_the_bettors_cards_and_open_reads_are_broadcast():
    async def scenario():
        room, persistence = make_room("open")
        sockets = await seat(room, "a", "b")
        await room.handle("a", {"type": "start_game"})
        await room.handle(
            "a", {"type": "face", "score": 6.5, "top": [{"name": "browDownLeft", "z": 3.0}]}
        )
        bettor = actor(room)
        bettor_hole = list(room.table.seats[room.table.seat_of(bettor)].hole)
        await room.handle(
            bettor, {"type": "face", "score": 6.5, "top": [{"name": "browDownLeft", "z": 3.0}]}
        )
        await room.handle(bettor, {"type": "action", "kind": "raise", "amount": 30})
        await asyncio.wait(room.judge_tasks)

        state, face = persistence.judged[0]
        assert state.observer_hole_cards == []
        assert not set(bettor_hole) & set(json.loads(state.model_dump_json())["board"])
        for card in bettor_hole:
            assert card not in state.model_dump_json()
        assert state.street == "preflop" and state.bet_size == 30
        if bettor == "a":
            assert (
                face.mean_score == pytest.approx(6.5) and face.deviations[0].name == "browDownLeft"
            )
        for ws in sockets.values():
            read = ws.of_type("read")[0]
            assert read["sealed"] is False and read["probability"] == 0.62
        await room.close()

    asyncio.run(scenario())


def test_hidden_reads_are_sealed_until_the_hand_recap_with_the_true_label():
    async def scenario():
        room, persistence = make_room("hidden")
        sockets = await seat(room, "a", "b")
        await room.handle("a", {"type": "start_game"})
        await check_or_call(room)  # Complete the blind preflop.
        await check_or_call(room)
        assert room.table.phase == "flop"
        await room.handle(actor(room), {"type": "action", "kind": "raise", "amount": 20})
        await asyncio.wait(room.judge_tasks)
        for ws in sockets.values():
            sealed = ws.of_type("read")[0]
            assert sealed["sealed"] is True and "probability" not in sealed
        while room.table.hand_active:
            await check_or_call(room)

        assert len(persistence.labels) == 1
        was_bluff, cards = persistence.labels[0]
        assert isinstance(was_bluff, bool) and len(cards) == 2
        recap = sockets["a"].of_type("hand_recap")[0]
        assert (
            recap["reads"][0]["probability"] == 0.62 and recap["reads"][0]["was_bluff"] == was_bluff
        )
        assert len(persistence.hands) == 1
        await room.close()

    asyncio.run(scenario())


def test_turn_timeout_checks_or_folds_for_a_stalled_player():
    async def scenario():
        timing = RoomTiming(turn_seconds=0.05, away_turn_seconds=0.05, recap_seconds=60)
        room, _ = make_room(timing=timing)
        sockets = await seat(room, "a", "b")
        await room.handle("a", {"type": "start_game"})
        await asyncio.sleep(0.3)
        assert not room.table.hand_active  # The SB folded on time, so the blind is won.
        assert sockets["a"].of_type("hand_recap")
        await room.close()

    asyncio.run(scenario())


def test_reconnect_within_grace_keeps_the_seat_and_expiry_removes_it():
    async def scenario():
        timing = RoomTiming(recap_seconds=60, reconnect_grace_seconds=0.1)
        room, _ = make_room(timing=timing)
        sockets = await seat(room, "a", "b")
        await room.disconnect("b", sockets["b"])
        assert room.members["b"].connected is False
        again = FakeWS()
        await room.join(claims("b"), again)
        assert room.members["b"].connected and room.table.seat_of("b") is not None
        await room.disconnect("b", again)
        await asyncio.sleep(0.3)
        assert "b" not in room.members and room.table.seat_of("b") is None
        await room.close()

    asyncio.run(scenario())


def test_stale_connection_cannot_disconnect_the_new_one():
    async def scenario():
        room, _ = make_room()
        first = FakeWS()
        await room.join(claims("a"), first)
        second = FakeWS()
        await room.join(claims("a"), second)
        assert first.closed == 4000
        await room.disconnect("a", first)
        assert room.members["a"].connected
        await room.close()

    asyncio.run(scenario())


def test_host_rules_handoff_kick_and_capacity():
    async def scenario():
        room, _ = make_room()
        sockets = await seat(room, "a", "b", "c", "d", "e", "f")
        extra = FakeWS()
        assert not await room.join(claims("g"), extra)
        assert extra.of_type("error")[0]["code"] == "full"

        await room.handle("b", {"type": "start_game"})
        assert sockets["b"].of_type("error")[0]["code"] == "not_host"
        await room.handle("b", {"type": "kick", "player": "c"})
        assert "c" in room.members  # Only the host can kick.
        await room.handle("a", {"type": "kick", "player": "c"})
        assert "c" not in room.members and sockets["c"].closed == 4003

        await room.leave("a")
        assert room.host_sub == "b"
        await room.close()

    asyncio.run(scenario())


def test_manager_limits_and_sweeps_empty_rooms():
    async def scenario():
        manager = RoomManager(FakePersistence())
        for _ in range(3):
            manager.create("host", RoomSettings())
        with pytest.raises(RoomLimitError):
            manager.create("host", RoomSettings())
        room = manager.create("other", RoomSettings())
        assert manager.get(room.code.lower()) is room
        await manager.sweep(now=time.monotonic() + 601)
        assert manager.rooms == {}

    asyncio.run(scenario())


def test_settings_are_validated_and_locked_after_start():
    with pytest.raises(ValueError):
        RoomSettings(starting_stack=100, big_blind=50)

    async def scenario():
        room, _ = make_room()
        sockets = await seat(room, "a", "b")
        await room.handle(
            "a", {"type": "settings", "settings": {"reads": "hidden", "starting_stack": 2000}}
        )
        assert room.settings.reads == "hidden"
        assert room.table.seats[0].stack == 2000
        await room.handle("a", {"type": "start_game"})
        await room.handle("a", {"type": "settings", "settings": {"reads": "open"}})
        assert room.settings.reads == "hidden"
        assert sockets["a"].of_type("error")[-1]["code"] == "started"
        await room.close()

    asyncio.run(scenario())


def test_illegal_actions_are_reported_not_raised():
    async def scenario():
        room, _ = make_room()
        sockets = await seat(room, "a", "b")
        await room.handle("a", {"type": "start_game"})
        waiting = "a" if actor(room) == "b" else "b"
        await room.handle(waiting, {"type": "action", "kind": "fold"})
        assert sockets[waiting].of_type("error")[-1]["code"] == "illegal_action"
        await room.handle(actor(room), {"type": "action", "kind": "raise", "amount": "lots"})
        await room.handle(actor(room), {"type": "action", "kind": "teleport"})
        assert room.table.hand_active
        await room.close()

    asyncio.run(scenario())


def test_players_are_spread_around_the_table():
    async def scenario():
        room, _ = make_room()
        await seat(room, "a", "b", "c", "d")
        assert [room.table.seat_of(s) for s in "abcd"] == [0, 3, 1, 5]
        await room.leave("b")
        await seat(room, "e")
        assert room.table.seat_of("e") == 3  # The freed seat across the table is reused.
        await room.close()

    asyncio.run(scenario())
