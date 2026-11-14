"""Cards are two-character strings such as "As" or "Td", matching schemas/game.py."""

import random
import secrets

RANKS = "23456789TJQKA"
SUITS = "shdc"

_SYSTEM_RNG = secrets.SystemRandom()


def new_deck() -> list[str]:
    return [rank + suit for rank in RANKS for suit in SUITS]


def shuffled_deck(rng: random.Random | None = None) -> list[str]:
    """A shuffled deck. Real hands use the OS random source; tests pass a seeded rng."""
    deck = new_deck()
    (rng or _SYSTEM_RNG).shuffle(deck)
    return deck


def rank_value(card: str) -> int:
    return RANKS.index(card[0]) + 2
