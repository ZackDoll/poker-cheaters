from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentClaims, DbSession
from app.schemas.live import Profile
from app.services import stats_service

router = APIRouter(prefix="/players", tags=["players"])


@router.get("", response_model=list[Profile])
def list_players(db: DbSession, claims: CurrentClaims) -> list[Profile]:
    """The caller's own profile first, then everyone they have shared a table with."""
    me = stats_service.upsert_player(db, claims)
    return stats_service.profiles_for(db, me)


@router.get("/me", response_model=Profile)
def my_profile(db: DbSession, claims: CurrentClaims) -> Profile:
    me = stats_service.upsert_player(db, claims)
    return stats_service.profile(db, me, me)


@router.get("/{player_id}", response_model=Profile)
def get_player(player_id: UUID, db: DbSession, claims: CurrentClaims) -> Profile:
    me = stats_service.upsert_player(db, claims)
    found = stats_service.profile_for(db, player_id, me)
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Player not found")
    return found
