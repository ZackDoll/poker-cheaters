"""Keeps every open room in memory. One process only: see the note in AGENTS.md."""

import asyncio
import logging
import secrets
import time

from app.services.rooms.persistence import Persistence
from app.services.rooms.room import Room, RoomSettings, RoomTiming

logger = logging.getLogger(__name__)

# No 0/O or 1/I/L, so a code read aloud over video is hard to get wrong.
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
MAX_ROOMS = 200
MAX_ROOMS_PER_HOST = 3
EMPTY_ROOM_TTL_SECONDS = 600
SWEEP_INTERVAL_SECONDS = 30


class RoomLimitError(Exception):
    pass


class RoomManager:
    def __init__(self, persistence: Persistence, timing: RoomTiming | None = None) -> None:
        self.persistence = persistence
        self.timing = timing
        self.rooms: dict[str, Room] = {}
        self._sweeper: asyncio.Task | None = None

    def create(self, host_sub: str, settings: RoomSettings) -> Room:
        if len(self.rooms) >= MAX_ROOMS:
            raise RoomLimitError("The server has too many open rooms. Try again later.")
        hosted = sum(1 for r in self.rooms.values() if r.host_sub == host_sub)
        if hosted >= MAX_ROOMS_PER_HOST:
            raise RoomLimitError("You already have the maximum number of open rooms.")
        code = self._new_code()
        room = Room(code, host_sub, settings, self.persistence, self.timing)
        self.rooms[code] = room
        return room

    def _new_code(self) -> str:
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if code not in self.rooms:
                return code

    def get(self, code: str) -> Room | None:
        return self.rooms.get(code.strip().upper())

    async def remove(self, code: str) -> None:
        room = self.rooms.pop(code, None)
        if room is not None:
            await room.close()

    def start(self) -> None:
        self._sweeper = asyncio.create_task(self._sweep_forever())

    async def stop(self) -> None:
        if self._sweeper:
            self._sweeper.cancel()
        for code in list(self.rooms):
            await self.remove(code)

    async def sweep(self, now: float | None = None) -> None:
        now = time.monotonic() if now is None else now
        for code, room in list(self.rooms.items()):
            if room.empty_since is not None and now - room.empty_since > EMPTY_ROOM_TTL_SECONDS:
                await self.remove(code)

    async def _sweep_forever(self) -> None:
        while True:
            await asyncio.sleep(SWEEP_INTERVAL_SECONDS)
            try:
                await self.sweep()
            except Exception:
                logger.exception("Room sweep failed")
