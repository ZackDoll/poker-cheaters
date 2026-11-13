from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Card = Annotated[str, StringConstraints(pattern=r"^[2-9TJQKA][shdc]$")]
Street = Literal["preflop", "flop", "turn", "river"]
Position = Literal["early", "middle", "late", "blinds"]

BOARD_SIZE_BY_STREET: dict[str, int] = {"preflop": 0, "flop": 3, "turn": 4, "river": 5}


class PriorAction(BaseModel):
    """Something the analysed player already did earlier in this hand."""

    model_config = ConfigDict(extra="forbid")

    street: Street
    action: Literal["check", "call", "bet", "raise"]
    amount: float = Field(default=0, ge=0)


class GameState(BaseModel):
    """What is visible at the moment the analysed player bets or raises.

    The analysed player's own cards are deliberately not a field, and unknown
    fields are rejected. Those cards are hidden during a live hand and would leak
    the answer into training. They are only accepted afterward, by the outcome
    endpoint.
    """

    model_config = ConfigDict(extra="forbid")

    street: Street
    pot_size: float = Field(gt=0, description="Pot before this bet")
    bet_size: float = Field(gt=0, description="Size of the bet or raise being judged")
    big_blind: float = Field(gt=0)
    num_active_players: int = Field(ge=2, le=10)
    target_position: Position
    board: list[Card] = []
    observer_hole_cards: list[Card] = Field(
        default=[], description="Cards held by the person using the app, if any"
    )
    target_prior_actions: list[PriorAction] = []

    @model_validator(mode="after")
    def check_cards(self) -> "GameState":
        expected = BOARD_SIZE_BY_STREET[self.street]
        if len(self.board) != expected:
            raise ValueError(f"{self.street} needs {expected} board cards, got {len(self.board)}")
        if len(self.observer_hole_cards) not in (0, 2):
            raise ValueError("observer_hole_cards must be empty or contain exactly 2 cards")
        visible = self.board + self.observer_hole_cards
        if len(set(visible)) != len(visible):
            raise ValueError("the same card appears more than once")
        return self
