"""The contract every model builds against. Change it only as a team."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

from app.schemas.game import GameState
from app.schemas.prediction import Reason
from app.schemas.signals import Evidence, SignalOutput, SignalStatus


@dataclass(frozen=True)
class DecisionContext:
    """Everything a signal model can see for one decision.

    The clip paths stop existing once the request ends, so read them during
    predict() and don't keep them.
    """

    state: GameState
    video_path: Path | None = None
    audio_path: Path | None = None


class SignalModel(ABC):
    """One specialist model, such as facial, speech or statistics."""

    name: str
    version: str

    def load(self) -> None:  # noqa: B027 - models without weights have nothing to load
        """Runs once at startup. Import heavy libraries and load weights here."""

    @abstractmethod
    def predict(self, ctx: DecisionContext) -> SignalOutput:
        """Runs in a worker thread. Exceptions and timeouts become status="failed"."""

    def output(
        self,
        status: SignalStatus,
        confidence: float = 0.0,
        evidence: list[Evidence] | None = None,
    ) -> SignalOutput:
        return SignalOutput(
            model_name=self.name,
            model_version=self.version,
            status=status,
            confidence=confidence,
            evidence=evidence or [],
        )


@dataclass(frozen=True)
class FusionResult:
    bluff_probability: float
    reasons: list[Reason]
    calibrated: bool
    version: str


class DecisionModel(ABC):
    """Combines the signal outputs into one percentage and its top reasons."""

    version: str

    @abstractmethod
    def fuse(self, outputs: list[SignalOutput]) -> FusionResult: ...
