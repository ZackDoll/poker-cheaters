from app.ml.base import DecisionContext
from app.ml.statistics.model import StatisticsModel
from app.schemas.game import GameState
from tests.conftest import make_state


def codes(**overrides) -> set[str]:
    state = GameState.model_validate(make_state(**overrides))
    return {item.code for item in StatisticsModel().predict(DecisionContext(state)).evidence}


def test_overbet_on_dry_board():
    assert {"overbet", "large_bet_on_dry_board"} <= codes()


def test_small_bet_points_away_from_bluff():
    found = codes(bet_size=25)
    assert "small_bet" in found
    assert "overbet" not in found


def test_paired_board_is_not_dry():
    assert "large_bet_on_dry_board" not in codes(board=["Kd", "Kc", "2h", "9s", "3d"])


def test_connected_or_suited_boards_are_not_dry():
    assert "large_bet_on_dry_board" not in codes(board=["9d", "8c", "7h"], street="flop")
    assert "large_bet_on_dry_board" not in codes(board=["Ad", "2c", "4h"], street="flop")
    assert "large_bet_on_dry_board" not in codes(board=["Kd", "7d", "2d"], street="flop")


def test_multiway_pot():
    assert "multiway_pot" in codes(num_active_players=4)


def test_preflop_position():
    preflop = {"street": "preflop", "board": [], "bet_size": 6}
    assert "late_position_raise" in codes(**preflop)
    assert "early_position_raise" in codes(**preflop, target_position="early")


def test_missed_flush_draw():
    assert "missed_flush_draw" in codes(board=["Kh", "7h", "2c", "9s", "3d"])
    # The river completes the flush, so the draw didn't miss.
    assert "missed_flush_draw" not in codes(board=["Kd", "7d", "2c", "9s", "3d"])


def test_betting_line():
    checked = [{"street": "flop", "action": "check"}, {"street": "turn", "action": "call"}]
    barrelled = [{"street": "flop", "action": "bet", "amount": 10}]
    assert "sudden_aggression" in codes(target_prior_actions=checked)
    assert "consistent_aggression" in codes(target_prior_actions=barrelled)


def test_observer_flush_blocker():
    assert "observer_blocks_nut_flush" in codes(
        board=["Kh", "7h", "2h", "9s", "3d"], observer_hole_cards=["Ah", "Qs"]
    )


def test_works_without_observer_cards():
    assert "observer_blocks_nut_flush" not in codes(observer_hole_cards=[])
