"""Response shapes for the Sessions and Profiles pages of live rooms."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PlayerBrief(BaseModel):
    id: UUID
    name: str
    avatar_url: str | None


class SessionPlayerOut(PlayerBrief):
    starting_chips: int
    final_chips: int | None
    hands_played: int


class SessionSummary(BaseModel):
    id: UUID
    room_code: str | None
    created_at: datetime
    ended_at: datetime | None
    players: list[SessionPlayerOut]
    hands: int
    judged_bets: int
    labeled_bets: int
    read_accuracy: float | None
    my_net_chips: int | None


class DecisionOut(BaseModel):
    id: UUID
    player_id: UUID | None
    player_name: str
    street: str
    bet_size: float
    pot_size: float
    probability: float
    calibrated: bool
    reasons: list[dict]
    was_bluff: bool | None
    created_at: datetime


class HandOut(BaseModel):
    number: int
    board: list[str]
    pot: int
    winners: list[dict]
    shown: list[dict]
    decisions: list[DecisionOut]


class SessionDetail(SessionSummary):
    settings: dict | None
    hand_list: list[HandOut]


class CountedItem(BaseModel):
    code: str
    label: str
    count: int


class Profile(BaseModel):
    player: PlayerBrief
    is_me: bool
    sessions: int
    hands_played: int
    judged_bets: int
    labeled_bets: int
    bluffs: int
    bluff_rate: float | None
    average_read: float | None
    read_accuracy: float | None
    net_chips: int
    top_reasons: list[CountedItem]
    top_tells: list[CountedItem]
    recent_sessions: list[SessionSummary]
