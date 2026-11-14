"""The working definition of a bluff for live rooms. Needs team sign-off before real use.

A postflop bet or raise is a bluff when, at the moment it was made, the bettor's
best hand was weaker than a pair that uses at least one of their hole cards, and
they were not on a flush draw or an open-ended straight draw (a semi-bluff with
real equity counts as a value bet here). Preflop bets are not labelled.
"""

from collections import Counter

from app.services.poker.cards import rank_value
from app.services.poker.hand_eval import PAIR, best_hand

BOARD_SIZE = {"flop": 3, "turn": 4, "river": 5}


def _has_flush_draw(hole: list[str], cards: list[str]) -> bool:
    counts = Counter(c[1] for c in cards)
    return any(counts[c[1]] == 4 for c in hole)


def _has_open_ended_draw(cards: list[str]) -> bool:
    values = {rank_value(c) for c in cards}
    return any(all(v in values for v in range(low, low + 4)) for low in range(2, 11))


def was_bluff(hole: list[str], board_at_bet: list[str], street: str) -> bool | None:
    """True/False for postflop bets, None when the bet should not be labelled."""
    if street not in BOARD_SIZE or len(board_at_bet) != BOARD_SIZE[street]:
        return None
    cards = hole + board_at_bet
    rank = best_hand(cards)
    if rank[0] > PAIR:
        return False  # Two pair or better.
    if rank[0] == PAIR:
        paired = rank[1]
        if paired in {rank_value(c) for c in hole}:
            return False  # A pair that uses a hole card.
    if street != "river" and (_has_flush_draw(hole, cards) or _has_open_ended_draw(cards)):
        return False
    return True


__all__ = ["was_bluff"]
