import logging
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, wait
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Decision, GameSession, SignalOutputRecord
from app.ml.base import DecisionContext, SignalModel
from app.ml.registry import ModelRegistry
from app.schemas.game import GameState
from app.schemas.prediction import OutcomeCreate
from app.schemas.signals import SignalOutput

logger = logging.getLogger(__name__)

VIDEO_SUFFIXES = {"video/webm": ".webm", "video/mp4": ".mp4", "video/quicktime": ".mov"}
AUDIO_SUFFIXES = {
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
}
_CHUNK_BYTES = 1024 * 1024


class NotFoundError(Exception):
    pass


class ConflictError(Exception):
    pass


class UploadError(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@dataclass(frozen=True)
class SignalRun:
    output: SignalOutput
    latency_ms: int


def _save_upload(
    upload: UploadFile | None, directory: Path, stem: str, suffixes: dict[str, str]
) -> Path | None:
    """Copy an upload to disk under a fixed name, never the client's filename."""
    if upload is None:
        return None
    content_type = (upload.content_type or "").split(";")[0].strip().lower()
    if content_type not in suffixes:
        raise UploadError(415, f"Unsupported {stem} type: {content_type or 'unknown'}")

    limit = get_settings().max_upload_bytes
    path = directory / f"{stem}{suffixes[content_type]}"
    written = 0
    with path.open("wb") as destination:
        while chunk := upload.file.read(_CHUNK_BYTES):
            written += len(chunk)
            if written > limit:
                raise UploadError(413, f"The {stem} file is larger than {limit} bytes")
            destination.write(chunk)
    if written == 0:
        raise UploadError(422, f"The {stem} file is empty")
    return path


def _timed_predict(model: SignalModel, ctx: DecisionContext) -> SignalRun:
    started = time.perf_counter()
    output = model.predict(ctx)
    # The registry's name and version are the source of truth for what gets stored.
    output = output.model_copy(update={"model_name": model.name, "model_version": model.version})
    return SignalRun(output, round((time.perf_counter() - started) * 1000))


def run_signal_models(
    registry: ModelRegistry, ctx: DecisionContext, timeout_seconds: float
) -> list[SignalRun]:
    """Run models concurrently. A broken or slow model can't take down a prediction."""
    runs: list[SignalRun] = []
    loaded = []
    for model in registry.signal_models:
        if registry.is_loaded(model):
            loaded.append(model)
        else:
            runs.append(SignalRun(model.output("unavailable"), 0))
    if not loaded:
        return runs

    executor = ThreadPoolExecutor(max_workers=len(loaded), thread_name_prefix="signal-model")
    futures = {model: executor.submit(_timed_predict, model, ctx) for model in loaded}
    wait(futures.values(), timeout=timeout_seconds)
    timeout_ms = round(timeout_seconds * 1000)

    for model, future in futures.items():
        if not future.done():
            logger.error("Signal model %r timed out after %ss", model.name, timeout_seconds)
            runs.append(SignalRun(model.output("failed"), timeout_ms))
        elif future.exception() is not None:
            logger.error("Signal model %r failed", model.name, exc_info=future.exception())
            runs.append(SignalRun(model.output("failed"), timeout_ms))
        else:
            runs.append(future.result())

    # Python can't kill a running thread, so a timed-out model finishes in the
    # background. Don't wait for it, or the timeout would achieve nothing.
    executor.shutdown(wait=False, cancel_futures=True)
    return runs


def create_prediction(
    db: Session,
    registry: ModelRegistry,
    session_id: UUID,
    state: GameState,
    video: UploadFile | None,
    audio: UploadFile | None,
) -> Decision:
    if db.get(GameSession, session_id) is None:
        raise NotFoundError(f"Session {session_id} not found")
    db.rollback()  # Release the DB connection while the models run.

    # Clips exist only inside this block. Only derived outputs are ever stored.
    with tempfile.TemporaryDirectory(prefix="poker-clip-") as directory:
        ctx = DecisionContext(
            state=state,
            video_path=_save_upload(video, Path(directory), "video", VIDEO_SUFFIXES),
            audio_path=_save_upload(audio, Path(directory), "audio", AUDIO_SUFFIXES),
        )
        runs = run_signal_models(registry, ctx, get_settings().signal_timeout_seconds)

    result = registry.decision_model.fuse([run.output for run in runs])
    decision = Decision(
        session_id=session_id,
        game_state=state.model_dump(mode="json"),
        bluff_probability=result.bluff_probability,
        calibrated=result.calibrated,
        reasons=[reason.model_dump(mode="json") for reason in result.reasons],
        decision_model_version=result.version,
        signals=[
            SignalOutputRecord(
                model_name=run.output.model_name,
                model_version=run.output.model_version,
                status=run.output.status,
                score=run.output.score,
                confidence=run.output.confidence,
                evidence=[item.model_dump(mode="json") for item in run.output.evidence],
                latency_ms=run.latency_ms,
            )
            for run in runs
        ],
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision


def get_prediction(db: Session, prediction_id: UUID) -> Decision:
    decision = db.get(Decision, prediction_id)
    if decision is None:
        raise NotFoundError(f"Prediction {prediction_id} not found")
    return decision


def record_outcome(db: Session, prediction_id: UUID, outcome: OutcomeCreate) -> Decision:
    """Store the real result. Posting again overwrites it, so mistakes can be corrected."""
    decision = get_prediction(db, prediction_id)
    if outcome.target_hole_cards:
        visible = decision.game_state["board"] + decision.game_state["observer_hole_cards"]
        duplicates = set(outcome.target_hole_cards) & set(visible)
        if duplicates:
            raise ConflictError(f"Cards already visible in this hand: {sorted(duplicates)}")

    decision.was_bluff = outcome.was_bluff
    decision.outcome_source = outcome.outcome_source
    decision.revealed_target_cards = outcome.target_hole_cards
    decision.labeled_at = datetime.now(UTC)
    db.commit()
    return decision
