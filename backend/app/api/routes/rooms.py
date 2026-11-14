import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status

from app.api.deps import CurrentClaims, RoomManagerDep
from app.config import get_settings
from app.services.room_token import InvalidTokenError, verify_token
from app.services.rooms.manager import RoomLimitError
from app.services.rooms.room import MAX_MESSAGE_CHARS, RoomSettings

router = APIRouter(prefix="/rooms", tags=["rooms"])
logger = logging.getLogger(__name__)

HELLO_TIMEOUT_SECONDS = 10


@router.post("", status_code=status.HTTP_201_CREATED)
def create_room(body: RoomSettings, claims: CurrentClaims, rooms: RoomManagerDep) -> dict:
    try:
        room = rooms.create(claims.sub, body)
    except RoomLimitError as exc:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    return room.summary()


@router.get("/{code}")
def get_room(code: str, claims: CurrentClaims, rooms: RoomManagerDep) -> dict:
    room = rooms.get(code)
    if room is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No room with that code")
    return room.summary()


@router.websocket("/{code}/ws")
async def room_socket(websocket: WebSocket, code: str) -> None:
    """The first message must be {"type": "hello", "token": "..."}. Tokens never go in the URL."""
    await websocket.accept()
    room = websocket.app.state.rooms.get(code)
    if room is None:
        await websocket.send_json({"type": "error", "code": "no_room", "message": "No such room"})
        await websocket.close(code=4004)
        return

    try:
        hello = await asyncio.wait_for(websocket.receive_json(), HELLO_TIMEOUT_SECONDS)
        if not isinstance(hello, dict) or hello.get("type") != "hello":
            raise InvalidTokenError("Expected hello")
        claims = verify_token(get_settings().room_token_secret, str(hello.get("token", "")))
    except (InvalidTokenError, TimeoutError, ValueError, WebSocketDisconnect) as exc:
        if not isinstance(exc, WebSocketDisconnect):
            await websocket.send_json({"type": "error", "code": "auth", "message": "Sign in again"})
            await websocket.close(code=4001)
        return

    if not await room.join(claims, websocket):
        await websocket.close(code=4005)
        return

    try:
        while True:
            text = await websocket.receive_text()
            if len(text) > MAX_MESSAGE_CHARS:
                await websocket.close(code=1009)
                break
            try:
                message = json.loads(text)
            except ValueError:
                continue
            if isinstance(message, dict):
                await room.handle(claims.sub, message)
    except WebSocketDisconnect:
        pass
    finally:
        await room.disconnect(claims.sub, websocket)
