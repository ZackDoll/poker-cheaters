from collections import Counter

from app.ml.base import DecisionContext, SignalModel
from app.schemas.game import GameState
from app.schemas.signals import Evidence, SignalOutput

RANKS = "23456789TJQKA"
LARGE_BET_RATIO = 0.75
OVERBET_RATIO = 1.25
SMALL_BET_RATIO = 0.33

PREFLOP_CONFIDENCE = 0.5
POSTFLOP_CONFIDENCE = 0.8


def _rank(card: str) -> int:
    return RANKS.index(card[0])


def _suit(card: str) -> str:
    return card[1]


def _straight_possible(ranks: list[int]) -> bool:
    """Three board cards within a five-rank window let two hole cards make a straight."""
    values = set(ranks)
    if RANKS.index("A") in values:
        values.add(-1)  # The ace also plays low.
    return any(sum(start <= v < start + 5 for v in values) >= 3 for start in range(-1, 9))


def _is_dry(board: list[str]) -> bool:
    """Unpaired, with no flush or straight possible."""
    ranks = [_rank(card) for card in board]
    unpaired = len(set(ranks)) == len(ranks)
    max_suited = max(Counter(_suit(card) for card in board).values())
    return unpaired and max_suited <= 2 and not _straight_possible(ranks)


def _missed_flush_draw(board: list[str]) -> bool:
    """A flush draw was possible on the turn, and the river didn't complete it."""
    turn_suits = Counter(_suit(card) for card in board[:4])
    return max(turn_suits.values()) == 2 and turn_suits[_suit(board[4])] < 2


class StatisticsModel(SignalModel):
    """Rule-based read of the bet and the board.

    The log-odds values are poker heuristics chosen by hand. Replace them with
    fitted values once there is enough labelled data.
    """

    name = "statistics"
    version = "rules-0.1"

    def predict(self, ctx: DecisionContext) -> SignalOutput:
        state = ctx.state
        ratio = state.bet_size / state.pot_size
        evidence = [
            *self._bet_size_evidence(state, ratio),
            *self._table_evidence(state),
            *self._line_evidence(state, ratio),
            *self._blocker_evidence(state),
        ]
        confidence = PREFLOP_CONFIDENCE if state.street == "preflop" else POSTFLOP_CONFIDENCE
        return self.output("ok", confidence, evidence)

    def _bet_size_evidence(self, state: GameState, ratio: float) -> list[Evidence]:
        evidence = []
        if ratio >= OVERBET_RATIO:
            evidence.append(
                Evidence(
                    code="overbet",
                    description=f"Bet is {ratio:.1f}x the pot, a size often used to force folds",
                    log_odds=0.6,
                )
            )
        elif ratio <= SMALL_BET_RATIO:
            evidence.append(
                Evidence(
                    code="small_bet",
                    description=f"Bet is only {ratio:.0%} of the pot, which pressures few hands",
                    log_odds=-0.3,
                )
            )

        if state.street != "preflop" and ratio >= LARGE_BET_RATIO and _is_dry(state.board):
            evidence.append(
                Evidence(
                    code="large_bet_on_dry_board",
                    description="Large bet on a dry board, where few strong hands are likely",
                    log_odds=0.5,
                )
            )
        if state.street == "river" and ratio >= LARGE_BET_RATIO and _missed_flush_draw(state.board):
            evidence.append(
                Evidence(
                    code="missed_flush_draw",
                    description="Large river bet after a flush draw missed",
                    log_odds=0.4,
                )
            )
        return evidence

    def _table_evidence(self, state: GameState) -> list[Evidence]:
        evidence = []
        if state.num_active_players >= 3:
            evidence.append(
                Evidence(
                    code="multiway_pot",
                    description=(
                        f"{state.num_active_players} players are still in, and bluffs "
                        "rarely work against several opponents"
                    ),
                    log_odds=-0.5,
                )
            )
        if state.street == "preflop":
            if state.target_position == "late":
                evidence.append(
                    Evidence(
                        code="late_position_raise",
                        description="Raise from late position, a common spot to steal the blinds",
                        log_odds=0.4,
                    )
                )
            elif state.target_position == "early":
                evidence.append(
                    Evidence(
                        code="early_position_raise",
                        description="Raise from early position, which usually shows a strong range",
                        log_odds=-0.5,
                    )
                )
        return evidence

    def _line_evidence(self, state: GameState, ratio: float) -> list[Evidence]:
        postflop = [a for a in state.target_prior_actions if a.street != "preflop"]
        if not postflop or ratio < LARGE_BET_RATIO:
            return []
        if all(action.action in ("check", "call") for action in postflop):
            return [
                Evidence(
                    code="sudden_aggression",
                    description="Large bet after only checking or calling on earlier streets",
                    log_odds=0.3,
                )
            ]
        if all(action.action in ("bet", "raise") for action in postflop):
            return [
                Evidence(
                    code="consistent_aggression",
                    description="Has bet or raised on every earlier street, a consistent story",
                    log_odds=-0.2,
                )
            ]
        return []

    def _blocker_evidence(self, state: GameState) -> list[Evidence]:
        if not state.observer_hole_cards or not state.board:
            return []
        suit, count = Counter(_suit(card) for card in state.board).most_common(1)[0]
        if count >= 3 and f"A{suit}" in state.observer_hole_cards:
            return [
                Evidence(
                    code="observer_blocks_nut_flush",
                    description="You hold the flush suit's ace, so they can't have the nut flush",
                    log_odds=0.35,
                )
            ]
        return []
