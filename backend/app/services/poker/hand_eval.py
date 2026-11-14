"""Texas Hold'em hand evaluation. Higher tuples beat lower ones."""

from collections import Counter
from itertools import combinations

from app.services.poker.cards import rank_value

HIGH_CARD, PAIR, TWO_PAIR, TRIPS, STRAIGHT, FLUSH, FULL_HOUSE, QUADS, STRAIGHT_FLUSH = range(9)

_NAMES = {
    2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight",
    9: "Nine", 10: "Ten", 11: "Jack", 12: "Queen", 13: "King", 14: "Ace",
}  # fmt: skip
_PLURAL = {**{v: n + "s" for v, n in _NAMES.items()}, 6: "Sixes"}


def _straight_high(values: set[int]) -> int | None:
    """Highest card of a five-card straight in `values`, counting the ace low."""
    if 14 in values:
        values = values | {1}
    for high in range(14, 4, -1):
        if all(v in values for v in range(high - 4, high + 1)):
            return high
    return None


def evaluate_five(cards: list[str]) -> tuple[int, ...]:
    values = sorted((rank_value(c) for c in cards), reverse=True)
    flush = len({c[1] for c in cards}) == 1
    straight = _straight_high(set(values)) if len(set(values)) == 5 else None
    counts = Counter(values)
    groups = sorted(counts.items(), key=lambda item: (item[1], item[0]), reverse=True)
    shape = [count for _, count in groups]
    ordered = tuple(value for value, _ in groups)

    if straight and flush:
        return (STRAIGHT_FLUSH, straight)
    if shape == [4, 1]:
        return (QUADS, *ordered)
    if shape == [3, 2]:
        return (FULL_HOUSE, *ordered)
    if flush:
        return (FLUSH, *values)
    if straight:
        return (STRAIGHT, straight)
    if shape == [3, 1, 1]:
        return (TRIPS, *ordered)
    if shape == [2, 2, 1]:
        return (TWO_PAIR, *ordered)
    if shape == [2, 1, 1, 1]:
        return (PAIR, *ordered)
    return (HIGH_CARD, *values)


def best_hand(cards: list[str]) -> tuple[int, ...]:
    """Best five-card hand from five to seven cards."""
    if len(cards) < 5:
        raise ValueError("need at least 5 cards")
    return max(evaluate_five(list(combo)) for combo in combinations(cards, 5))


def describe(rank: tuple[int, ...]) -> str:
    category, *rest = rank
    if category == STRAIGHT_FLUSH:
        return "Royal flush" if rest[0] == 14 else f"Straight flush, {_NAMES[rest[0]]} high"
    if category == QUADS:
        return f"Four of a kind, {_PLURAL[rest[0]]}"
    if category == FULL_HOUSE:
        return f"Full house, {_PLURAL[rest[0]]} full of {_PLURAL[rest[1]]}"
    if category == FLUSH:
        return f"Flush, {_NAMES[rest[0]]} high"
    if category == STRAIGHT:
        return f"Straight, {_NAMES[rest[0]]} high"
    if category == TRIPS:
        return f"Three of a kind, {_PLURAL[rest[0]]}"
    if category == TWO_PAIR:
        return f"Two pair, {_PLURAL[rest[0]]} and {_PLURAL[rest[1]]}"
    if category == PAIR:
        return f"Pair of {_PLURAL[rest[0]]}"
    return f"{_NAMES[rest[0]]} high"
