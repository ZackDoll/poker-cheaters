import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field

SignalStatus = Literal["ok", "stub", "unavailable", "failed"]

_MAX_LOG_ODDS = 30.0


def sigmoid(log_odds: float) -> float:
    clamped = max(-_MAX_LOG_ODDS, min(_MAX_LOG_ODDS, log_odds))
    return 1.0 / (1.0 + math.exp(-clamped))


def logit(probability: float) -> float:
    return math.log(probability / (1.0 - probability))


class Evidence(BaseModel):
    """One reason from a signal model. Positive log_odds points toward a bluff."""

    code: str
    description: str
    log_odds: float = Field(allow_inf_nan=False)


class SignalOutput(BaseModel):
    """The result every signal model returns."""

    model_config = ConfigDict(protected_namespaces=())

    model_name: str
    model_version: str
    status: SignalStatus
    confidence: float = Field(default=0.0, ge=0, le=1, allow_inf_nan=False)
    evidence: list[Evidence] = []

    @computed_field
    @property
    def score(self) -> float | None:
        """This model's own bluff estimate, or None if it produced no real signal."""
        if self.status != "ok":
            return None
        return sigmoid(sum(item.log_odds for item in self.evidence))
