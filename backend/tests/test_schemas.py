import pytest
from pydantic import ValidationError

from app.schemas.game import GameState
from app.schemas.prediction import OutcomeCreate
from tests.conftest import make_state


def test_valid_state_is_accepted():
    assert GameState.model_validate(make_state()).street == "river"


@pytest.mark.parametrize("field", ["target_hole_cards", "hole_cards", "target_cards"])
def test_analysed_players_cards_are_rejected_as_input(field):
    with pytest.raises(ValidationError):
        GameState.model_validate(make_state(**{field: ["As", "Ks"]}))


@pytest.mark.parametrize(
    "overrides",
    [
        {"board": ["Kd", "7c", "2h", "9s", "XX"]},
        {"board": ["Kd", "7c", "2h"]},
        {"street": "preflop"},
        {"board": ["Kd", "Kd", "2h", "9s", "3d"]},
        {"observer_hole_cards": ["Kd", "Qs"]},
        {"observer_hole_cards": ["Qs"]},
        {"pot_size": 0},
        {"bet_size": 0},
        {"num_active_players": 1},
    ],
)
def test_invalid_states_are_rejected(overrides):
    with pytest.raises(ValidationError):
        GameState.model_validate(make_state(**overrides))


def test_showdown_outcome_needs_the_cards():
    with pytest.raises(ValidationError):
        OutcomeCreate(was_bluff=True, outcome_source="showdown")
    OutcomeCreate(was_bluff=True, outcome_source="self_report")


def test_outcome_cards_must_be_two_different_cards():
    with pytest.raises(ValidationError):
        OutcomeCreate(was_bluff=True, outcome_source="showdown", target_hole_cards=["As", "As"])
