from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.game import Card
from app.schemas.signals import Evidence, SignalStatus


class SessionCreate(BaseModel):
    label: str | None = Field(default=None, max_length=200)


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    label: str | None
    created_at: datetime


class Reason(BaseModel):
    source: str
    code: str
    description: str
    direction: Literal["toward_bluff", "away_from_bluff"]
    contribution: float = Field(description="Signed change in log-odds after weighting")


class SignalSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    model_name: str
    model_version: str
    status: SignalStatus
    score: float | None
    confidence: float
    evidence: list[Evidence]
    latency_ms: int


class PredictionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    bluff_probability: float
    calibrated: bool = Field(
        description="False means this is an unvalidated score, not a true probability"
    )
    reasons: list[Reason]
    signals: list[SignalSummary]
    decision_model_version: str
    was_bluff: bool | None
    outcome_source: str | None
    created_at: datetime


class OutcomeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    was_bluff: bool
    outcome_source: Literal["showdown", "self_report"]
    target_hole_cards: list[Card] | None = None

    @model_validator(mode="after")
    def check_cards(self) -> "OutcomeCreate":
        cards = self.target_hole_cards
        if cards is not None and (len(cards) != 2 or cards[0] == cards[1]):
            raise ValueError("target_hole_cards must be 2 different cards")
        if self.outcome_source == "showdown" and cards is None:
            raise ValueError("a showdown outcome needs target_hole_cards")
        return self
