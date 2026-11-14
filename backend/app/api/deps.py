from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.ml.registry import ModelRegistry


def get_registry(request: Request) -> ModelRegistry:
    return request.app.state.registry


DbSession = Annotated[Session, Depends(get_db)]
Registry = Annotated[ModelRegistry, Depends(get_registry)]
