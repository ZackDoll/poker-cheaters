from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.ml.registry import ModelRegistry
from app.services.room_token import InvalidTokenError, TokenClaims, verify_token
from app.services.rooms.manager import RoomManager


def get_registry(request: Request) -> ModelRegistry:
    return request.app.state.registry


def get_room_manager(request: Request) -> RoomManager:
    return request.app.state.rooms


def get_claims(authorization: Annotated[str | None, Header()] = None) -> TokenClaims:
    """Who is calling, from the room token the login backend signed."""
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Sign in to use live rooms")
    try:
        return verify_token(get_settings().room_token_secret, token.strip())
    except InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


DbSession = Annotated[Session, Depends(get_db)]
Registry = Annotated[ModelRegistry, Depends(get_registry)]
RoomManagerDep = Annotated[RoomManager, Depends(get_room_manager)]
CurrentClaims = Annotated[TokenClaims, Depends(get_claims)]
