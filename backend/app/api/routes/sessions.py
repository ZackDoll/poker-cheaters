from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentClaims, DbSession
from app.db.models import GameSession
from app.schemas.live import SessionDetail, SessionSummary
from app.schemas.prediction import SessionCreate, SessionResponse
from app.services import stats_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(body: SessionCreate, db: DbSession) -> GameSession:
    session = GameSession(label=body.label)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[SessionSummary])
def list_my_sessions(db: DbSession, claims: CurrentClaims) -> list[SessionSummary]:
    """Live-room sessions the caller sat in, newest first."""
    me = stats_service.find_player(db, claims.sub)
    return stats_service.sessions_for(db, me) if me else []


@router.get("/{session_id}", response_model=SessionDetail)
def get_my_session(session_id: UUID, db: DbSession, claims: CurrentClaims) -> SessionDetail:
    me = stats_service.find_player(db, claims.sub)
    detail = stats_service.session_detail(db, session_id, me) if me else None
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Session not found")
    return detail
