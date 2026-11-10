import logging

from fastapi import APIRouter, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import DbSession, Registry

router = APIRouter(tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/health")
def health(db: DbSession, registry: Registry, response: Response) -> dict:
    try:
        db.execute(text("SELECT 1"))
        database = "up"
    except SQLAlchemyError:
        logger.exception("Database health check failed")
        database = "down"
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ok" if database == "up" else "degraded",
        "database": database,
        "models": [
            {
                "name": model.name,
                "version": model.version,
                "status": "loaded" if registry.is_loaded(model) else "load_failed",
            }
            for model in registry.signal_models
        ],
        "decision_model": registry.decision_model.version,
    }
