from fastapi import APIRouter, status

from app.api.deps import DbSession
from app.db.models import GameSession
from app.schemas.prediction import SessionCreate, SessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(body: SessionCreate, db: DbSession) -> GameSession:
    session = GameSession(label=body.label)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
