"""A real hand through the real prediction pipeline and database, then read back over HTTP."""

import asyncio
import random
import time
from uuid import uuid4

from app.services.room_token import sign_token
from app.services.rooms.persistence import DatabasePersistence
from app.services.rooms.room import Room, RoomSettings, RoomTiming
from tests.test_rooms import actor, check_or_call, seat

TIMING = RoomTiming(recap_seconds=60)


def auth(sub: str, name: str) -> dict:
    token = sign_token("test-room-secret", {"sub": sub, "name": name, "exp": time.time() + 60})
    return {"Authorization": f"Bearer {token}"}


async def play_one_hand(persistence, a: str, b: str) -> None:
    room = Room("HIST23", a, RoomSettings(), persistence, TIMING)
    room.table.rng = random.Random(11)
    await seat(room, a, b)
    await room.handle(a, {"type": "start_game"})
    for _ in range(3):  # The server keeps at most one face sample per player per 0.2 seconds.
        for sub in (a, b):
            await room.handle(
                sub, {"type": "face", "score": 7.0, "top": [{"name": "browDownLeft", "z": 3.2}]}
            )
        await asyncio.sleep(0.25)
    await check_or_call(room)
    await check_or_call(room)
    await room.handle(actor(room), {"type": "action", "kind": "raise", "amount": 20})
    while room.table.hand_active:
        await check_or_call(room)
    await room.close()


def test_a_played_hand_appears_in_sessions_and_profiles(client):
    a, b, stranger = (f"user-{uuid4().hex[:8]}" for _ in range(3))
    persistence = DatabasePersistence(client.app.state.registry)
    asyncio.run(play_one_hand(persistence, a, b))

    sessions = client.get("/api/sessions", headers=auth(a, "Ada")).json()
    assert len(sessions) == 1
    summary = sessions[0]
    assert summary["hands"] == 1 and summary["judged_bets"] == 1 and len(summary["players"]) == 2
    assert summary["ended_at"] is not None
    assert summary["labeled_bets"] == 1  # The flop bet is labelled from the dealt cards.
    assert summary["read_accuracy"] in (0.0, 1.0)

    detail = client.get(f"/api/sessions/{summary['id']}", headers=auth(a, "Ada")).json()
    hand = detail["hand_list"][0]
    assert len(hand["board"]) == 5 and hand["winners"]
    decision = hand["decisions"][0]
    assert decision["street"] == "flop" and 0 < decision["probability"] < 1
    assert decision["calibrated"] is False and decision["reasons"]
    assert isinstance(decision["was_bluff"], bool)

    mine = client.get("/api/players/me", headers=auth(a, "Ada")).json()
    assert mine["is_me"] and mine["sessions"] == 1 and mine["judged_bets"] in (0, 1)
    everyone = client.get("/api/players", headers=auth(a, "Ada")).json()
    assert len(everyone) == 2 and everyone[0]["is_me"]

    bettor = next(p for p in everyone if p["judged_bets"] == 1)
    assert bettor["labeled_bets"] == 1
    assert any(t["code"] == "tell:browDownLeft" for t in bettor["top_tells"])
    assert bettor["average_read"] == decision["probability"]

    # Someone who never sat at the table sees nothing of it.
    assert client.get("/api/sessions", headers=auth(stranger, "Eve")).json() == []
    assert (
        client.get(f"/api/sessions/{summary['id']}", headers=auth(stranger, "Eve")).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/players/{bettor['player']['id']}", headers=auth(stranger, "Eve")
        ).status_code
        == 404
    )
    assert client.get("/api/sessions").status_code == 401
