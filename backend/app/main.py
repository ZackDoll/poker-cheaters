from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import health, players, predictions, rooms, sessions
from app.config import get_settings
from app.ml.registry import build_registry
from app.services.rooms.manager import RoomManager
from app.services.rooms.persistence import DatabasePersistence

API_PREFIX = "/api"
# Room for the non-file form fields, on top of two clips at the size limit.
_FORM_OVERHEAD_BYTES = 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    registry = build_registry(get_settings())
    registry.load_all()
    app.state.registry = registry
    app.state.rooms = RoomManager(DatabasePersistence(registry))
    app.state.rooms.start()
    yield
    await app.state.rooms.stop()


def create_app() -> FastAPI:
    app = FastAPI(title="Poker Bluff Detector API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def reject_oversized_uploads(request: Request, call_next):
        # The form is parsed before the route runs, so refuse huge requests here.
        # A request without Content-Length still hits the per-file limit afterward.
        if request.method == "POST" and request.url.path == f"{API_PREFIX}/predictions":
            limit = 2 * get_settings().max_upload_bytes + _FORM_OVERHEAD_BYTES
            declared = request.headers.get("content-length", "")
            if declared.isdigit() and int(declared) > limit:
                return JSONResponse(status_code=413, content={"detail": "Upload is too large"})
        return await call_next(request)

    for module in (health, sessions, predictions, rooms, players):
        app.include_router(module.router, prefix=API_PREFIX)
    return app


app = create_app()
