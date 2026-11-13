from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError

from app.api.deps import DbSession, Registry
from app.db.models import Decision
from app.schemas.game import GameState
from app.schemas.prediction import OutcomeCreate, PredictionResponse
from app.services import prediction_service as service

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("", response_model=PredictionResponse, status_code=status.HTTP_201_CREATED)
def create_prediction(
    db: DbSession,
    registry: Registry,
    session_id: Annotated[UUID, Form()],
    state: Annotated[str, Form(description="GameState as a JSON string")],
    video: Annotated[UploadFile | None, File()] = None,
    audio: Annotated[UploadFile | None, File()] = None,
) -> Decision:
    try:
        game_state = GameState.model_validate_json(state)
    except ValidationError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=exc.errors(include_url=False, include_context=False, include_input=False),
        ) from exc

    try:
        return service.create_prediction(db, registry, session_id, game_state, video, audio)
    except service.NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except service.UploadError as exc:
        raise HTTPException(exc.status_code, detail=exc.detail) from exc


@router.get("/{prediction_id}", response_model=PredictionResponse)
def get_prediction(prediction_id: UUID, db: DbSession) -> Decision:
    try:
        return service.get_prediction(db, prediction_id)
    except service.NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{prediction_id}/outcome", response_model=PredictionResponse)
def record_outcome(prediction_id: UUID, body: OutcomeCreate, db: DbSession) -> Decision:
    try:
        return service.record_outcome(db, prediction_id, body)
    except service.NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except service.ConflictError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=str(exc)) from exc
