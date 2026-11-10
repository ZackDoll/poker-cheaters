import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy import UniqueConstraint as Unique
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GameSession(Base):
    __tablename__ = "game_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    label: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    decisions: Mapped[list["Decision"]] = relationship(back_populates="session")


class Decision(Base):
    """One judged bet or raise. With signal_outputs, this is the training data."""

    __tablename__ = "decisions"
    __table_args__ = (
        CheckConstraint("bluff_probability BETWEEN 0 AND 1", name="bluff_probability_range"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("game_sessions.id", ondelete="CASCADE"), index=True
    )
    game_state: Mapped[dict] = mapped_column(JSONB)
    bluff_probability: Mapped[float] = mapped_column(Float)
    calibrated: Mapped[bool]
    reasons: Mapped[list] = mapped_column(JSONB)
    decision_model_version: Mapped[str] = mapped_column(String(50))
    was_bluff: Mapped[bool | None]
    outcome_source: Mapped[str | None] = mapped_column(String(20))
    revealed_target_cards: Mapped[list | None] = mapped_column(JSONB(none_as_null=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    labeled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    session: Mapped[GameSession] = relationship(back_populates="decisions")
    signals: Mapped[list["SignalOutputRecord"]] = relationship(
        back_populates="decision",
        cascade="all, delete-orphan",
        order_by="SignalOutputRecord.model_name",
    )


class SignalOutputRecord(Base):
    __tablename__ = "signal_outputs"
    __table_args__ = (Unique("decision_id", "model_name", name="uq_signal_outputs_decision_model"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    decision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("decisions.id", ondelete="CASCADE"), index=True
    )
    model_name: Mapped[str] = mapped_column(String(50))
    model_version: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20))
    score: Mapped[float | None] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    evidence: Mapped[list] = mapped_column(JSONB)
    latency_ms: Mapped[int] = mapped_column(Integer)

    decision: Mapped[Decision] = relationship(back_populates="signals")
