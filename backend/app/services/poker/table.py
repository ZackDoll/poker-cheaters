"""No-limit Texas Hold'em table. Pure state machine: no I/O, no clocks, no sockets.

Every mutating method returns a list of event dicts, in order, which the room
layer broadcasts and the UI animates. Hole cards never appear in events except
at showdown, and then only for hands that are actually shown.
"""

import random
from dataclasses import dataclass, field

from app.services.poker.cards import shuffled_deck
from app.services.poker.hand_eval import best_hand, describe

STREETS = ("preflop", "flop", "turn", "river")
BOARD_CARDS_ADDED = {"flop": 3, "turn": 1, "river": 1}
MAX_SEATS = 6


class IllegalAction(Exception):
    pass


@dataclass
class Seat:
    player_id: str
    name: str
    stack: int
    hole: list[str] = field(default_factory=list)
    bet: int = 0  # chips put in on the current street
    total: int = 0  # chips put in this hand
    in_hand: bool = False
    folded: bool = False
    all_in: bool = False
    acted: bool = False
    raise_closed: bool = False
    sitting_out: bool = False  # away (disconnected or busted): dealt out of new hands
    left: bool = False  # left mid-hand: seat is freed when the hand ends

    @property
    def can_act(self) -> bool:
        return self.in_hand and not self.folded and not self.all_in


@dataclass
class ActionRecord:
    """One betting action, kept so a bet can be judged in the context of the hand."""

    street: str
    player_id: str
    action: str  # fold | check | call | bet | raise
    amount: int  # the player's total bet on that street after the action
    pot_before: int


class PokerTable:
    def __init__(self, small_blind: int, big_blind: int, rng: random.Random | None = None):
        if not 0 < small_blind <= big_blind:
            raise ValueError("blinds must satisfy 0 < small <= big")
        self.small_blind = small_blind
        self.big_blind = big_blind
        self.rng = rng
        self.seats: list[Seat | None] = [None] * MAX_SEATS
        self.button = -1
        self.hand_number = 0
        self.phase = "waiting"  # waiting | preflop | flop | turn | river
        self.board: list[str] = []
        self.deck: list[str] = []
        self.current_bet = 0
        self.last_raise = big_blind
        self.actor: int | None = None
        self.sb_index: int | None = None
        self.bb_index: int | None = None
        self.log: list[ActionRecord] = []

    # ---- seating -------------------------------------------------------

    def seat_of(self, player_id: str) -> int | None:
        for index, seat in enumerate(self.seats):
            if seat and seat.player_id == player_id:
                return index
        return None

    def add_player(
        self, player_id: str, name: str, stack: int, order: tuple[int, ...] | None = None
    ) -> int:
        """Seat a player in the first free seat of `order` (default: seat 0 upward)."""
        if self.seat_of(player_id) is not None:
            raise IllegalAction("Already seated")
        for index in order or range(MAX_SEATS):
            if self.seats[index] is None:
                self.seats[index] = Seat(player_id, name, stack)
                return index
        raise IllegalAction("Table is full")

    def remove_player(self, player_id: str) -> list[dict]:
        """Take a player off the table. Mid-hand, they fold first."""
        index = self.seat_of(player_id)
        if index is None:
            return []
        events: list[dict] = []
        seat = self.seats[index]
        if self.hand_active and seat.in_hand and not seat.folded:
            events = self.act(player_id, "fold", force=True)
        if not self.hand_active or not seat.in_hand:
            self.seats[index] = None
        else:
            seat.left = True  # Chips already in the pot stay there; seat is freed after the hand.
        return events

    def set_away(self, player_id: str, away: bool) -> None:
        index = self.seat_of(player_id)
        if index is not None:
            self.seats[index].sitting_out = away

    def players(self) -> list[Seat]:
        return [s for s in self.seats if s]

    @property
    def hand_active(self) -> bool:
        return self.phase != "waiting"

    def _eligible(self) -> list[int]:
        return [i for i, s in enumerate(self.seats) if s and s.stack > 0 and not s.sitting_out]

    def can_start(self) -> bool:
        return not self.hand_active and len(self._eligible()) >= 2

    # ---- hand lifecycle -------------------------------------------------

    def start_hand(self) -> list[dict]:
        if self.hand_active:
            raise IllegalAction("A hand is already in progress")
        eligible = self._eligible()
        if len(eligible) < 2:
            raise IllegalAction("Need at least two players with chips")

        for index, seat in enumerate(self.seats):
            if seat:
                seat.hole, seat.bet, seat.total = [], 0, 0
                seat.folded = seat.all_in = seat.acted = seat.raise_closed = False
                seat.in_hand = index in eligible

        self.hand_number += 1
        self.deck = shuffled_deck(self.rng)
        self.board = []
        self.log = []
        self.button = self._next_in(self.button, eligible)
        if len(eligible) == 2:
            self.sb_index = self.button
            self.bb_index = self._next_in(self.button, eligible)
        else:
            self.sb_index = self._next_in(self.button, eligible)
            self.bb_index = self._next_in(self.sb_index, eligible)

        events: list[dict] = [
            {
                "type": "hand_start",
                "hand": self.hand_number,
                "button": self.button,
                "sb": self.sb_index,
                "bb": self.bb_index,
                "players": [self.seats[i].player_id for i in eligible],
            }
        ]
        for _ in range(2):
            for index in self._order_from(self.sb_index, eligible):
                self.seats[index].hole.append(self.deck.pop())
        events.append({"type": "deal", "seats": eligible})

        self.phase = "preflop"
        self.current_bet = 0
        self.last_raise = self.big_blind
        events.append(self._post(self.sb_index, self.small_blind, "small_blind"))
        events.append(self._post(self.bb_index, self.big_blind, "big_blind"))
        self.current_bet = max(self.seats[self.sb_index].bet, self.seats[self.bb_index].bet)

        self.actor = self._next_to_act(self.bb_index)
        if self.actor is None:
            events += self._end_street()
        return events

    def _post(self, index: int, amount: int, kind: str) -> dict:
        seat = self.seats[index]
        paid = min(amount, seat.stack)
        self._commit(seat, paid)
        return {
            "type": "blind",
            "kind": kind,
            "seat": index,
            "player": seat.player_id,
            "amount": paid,
        }

    def _commit(self, seat: Seat, amount: int) -> None:
        seat.stack -= amount
        seat.bet += amount
        seat.total += amount
        if seat.stack == 0:
            seat.all_in = True

    def _next_in(self, after: int, indices: list[int]) -> int:
        for index in self._order_from(after, indices):
            return index
        raise IllegalAction("No players")

    def _order_from(self, after: int, indices: list[int]) -> list[int]:
        """`indices` in clockwise order, starting with the first seat after `after`."""
        return sorted(indices, key=lambda i: (i - after - 1) % MAX_SEATS)

    def pot(self) -> int:
        return sum(s.total for s in self.players())

    # ---- betting ---------------------------------------------------------

    def _needs_action(self, seat: Seat) -> bool:
        return seat.can_act and (not seat.acted or seat.bet < self.current_bet)

    def _next_to_act(self, after: int) -> int | None:
        in_hand = [i for i, s in enumerate(self.seats) if s and s.in_hand]
        for index in self._order_from(after, in_hand):
            if self._needs_action(self.seats[index]):
                return index
        return None

    def legal_actions(self, player_id: str) -> dict | None:
        """What the player on the clock may do, or None if it isn't their turn."""
        index = self.seat_of(player_id)
        if index is None or index != self.actor:
            return None
        seat = self.seats[index]
        to_call = min(self.current_bet - seat.bet, seat.stack)
        max_to = seat.bet + seat.stack
        min_to = min(self.current_bet + self.last_raise, max_to)
        can_raise = not seat.raise_closed and seat.stack > to_call
        return {
            "to_call": to_call,
            "can_check": to_call == 0,
            "can_raise": can_raise,
            "min_raise_to": min_to if can_raise else None,
            "max_raise_to": max_to if can_raise else None,
        }

    def act(self, player_id: str, kind: str, amount: int | None = None, *, force: bool = False):
        index = self.seat_of(player_id)
        if index is None:
            raise IllegalAction("You are not at this table")
        seat = self.seats[index]
        if force:
            if not (seat.in_hand and not seat.folded):
                return []
        elif index != self.actor:
            raise IllegalAction("It is not your turn")

        pot_before = self.pot()
        out_of_turn = index != self.actor  # Only a forced fold, such as a player leaving.
        to_call = min(self.current_bet - seat.bet, seat.stack)
        recorded = kind
        opening = self.current_bet == 0

        if kind == "fold":
            seat.folded = True
        elif kind == "check":
            if to_call:
                raise IllegalAction("You cannot check; there is a bet to call")
        elif kind == "call":
            if not to_call:
                raise IllegalAction("There is nothing to call")
            self._commit(seat, to_call)
        elif kind == "raise":
            self._raise(seat, amount)
            recorded = "bet" if opening else "raise"
        else:
            raise IllegalAction(f"Unknown action {kind!r}")

        seat.acted = True
        record = ActionRecord(self.phase, player_id, recorded, seat.bet, pot_before)
        self.log.append(record)
        events = [
            {
                "type": "action",
                "seat": index,
                "player": player_id,
                "action": recorded,
                "amount": seat.bet,
                "all_in": seat.all_in,
                "stack": seat.stack,
                "pot": self.pot(),
                "street": self.phase,
            }
        ]
        return events + self._advance(index, keep_actor=out_of_turn)

    def _raise(self, seat: Seat, amount: int | None) -> None:
        if amount is None:
            raise IllegalAction("A raise needs an amount")
        max_to = seat.bet + seat.stack
        if seat.raise_closed:
            raise IllegalAction("The betting was not reopened to you")
        if amount <= self.current_bet:
            raise IllegalAction("A raise must be larger than the current bet")
        if amount > max_to:
            raise IllegalAction("You do not have enough chips")
        min_to = self.current_bet + self.last_raise
        if amount < min_to and amount != max_to:
            raise IllegalAction(f"The minimum raise is to {min_to}")
        raise_size = amount - self.current_bet
        self._commit(seat, amount - seat.bet)
        self.current_bet = amount
        if raise_size >= self.last_raise:
            self.last_raise = raise_size
            for other in self.players():
                if other is not seat and other.can_act:
                    other.acted = False
                    other.raise_closed = False
        else:
            for other in self.players():
                if other is not seat and other.can_act and other.acted:
                    other.raise_closed = True

    def _live(self) -> list[int]:
        return [i for i, s in enumerate(self.seats) if s and s.in_hand and not s.folded]

    def _advance(self, from_index: int, keep_actor: bool = False) -> list[dict]:
        live = self._live()
        if len(live) == 1:
            return self._award_uncontested(live[0])
        if keep_actor:
            return []  # Someone else is still on the clock, so the round cannot be over.
        self.actor = self._next_to_act(from_index)
        if self.actor is None:
            return self._end_street()
        return []

    def _end_street(self) -> list[dict]:
        """Betting is closed: deal the next street, or run the board out and show down."""
        events: list[dict] = []
        while True:
            self.actor = None
            for seat in self.players():
                seat.bet = 0
                seat.acted = False
                seat.raise_closed = False
            self.current_bet = 0
            self.last_raise = self.big_blind

            if self.phase == "river":
                return events + self._showdown()
            self.phase = STREETS[STREETS.index(self.phase) + 1]
            self.deck.pop()  # burn
            new_cards = [self.deck.pop() for _ in range(BOARD_CARDS_ADDED[self.phase])]
            self.board += new_cards
            events.append(
                {"type": "street", "street": self.phase, "cards": new_cards, "pot": self.pot()}
            )
            able = [i for i in self._live() if self.seats[i].can_act]
            if len(able) >= 2:
                self.actor = self._next_to_act(self.button)
                return events
            # Everyone left is all-in (or all but one is): run the board out.

    # ---- settlement ---------------------------------------------------------

    def _award_uncontested(self, index: int) -> list[dict]:
        seat = self.seats[index]
        amount = self.pot()
        seat.stack += amount
        events = [
            {
                "type": "pot_awarded",
                "player": seat.player_id,
                "seat": index,
                "amount": amount,
                "pot": 0,
                "hand": None,
            }
        ]
        return events + self._finish([{"player": seat.player_id, "amount": amount}], shown=[])

    def side_pots(self) -> list[dict]:
        """Split everything committed into a main pot and side pots."""
        contributors = [s for s in self.players() if s.total > 0]
        levels = sorted({s.total for s in contributors if not s.folded})
        pots, previous = [], 0
        for level in levels:
            amount = sum(min(s.total, level) - min(s.total, previous) for s in contributors)
            eligible = [
                i
                for i, s in enumerate(self.seats)
                if s and s.in_hand and not s.folded and s.total >= level
            ]
            if amount:
                pots.append({"amount": amount, "eligible": eligible})
            previous = level
        # Chips from folded players above the highest live level go to the last pot.
        leftover = sum(max(0, s.total - previous) for s in contributors)
        if leftover and pots:
            pots[-1]["amount"] += leftover
        return pots

    def _showdown(self) -> list[dict]:
        live = self._live()
        ranks = {i: best_hand(self.seats[i].hole + self.board) for i in live}
        shown = [
            {
                "seat": i,
                "player": self.seats[i].player_id,
                "hole": self.seats[i].hole,
                "label": describe(ranks[i]),
            }
            for i in live
        ]
        events: list[dict] = [{"type": "showdown", "hands": shown}]
        winnings: dict[str, int] = {}
        for number, pot in enumerate(self.side_pots()):
            best = max(ranks[i] for i in pot["eligible"])
            winners = [i for i in pot["eligible"] if ranks[i] == best]
            winners = self._order_from(self.button, winners)
            share, odd = divmod(pot["amount"], len(winners))
            for position, index in enumerate(winners):
                amount = share + (1 if position < odd else 0)
                seat = self.seats[index]
                seat.stack += amount
                winnings[seat.player_id] = winnings.get(seat.player_id, 0) + amount
                events.append(
                    {
                        "type": "pot_awarded",
                        "player": seat.player_id,
                        "seat": index,
                        "amount": amount,
                        "pot": number,
                        "hand": describe(ranks[index]),
                    }
                )
        results = [{"player": p, "amount": a} for p, a in winnings.items()]
        return events + self._finish(results, shown=shown)

    def _finish(self, winners: list[dict], shown: list[dict]) -> list[dict]:
        final_board = list(self.board)
        holes = {s.player_id: list(s.hole) for s in self.players() if s.in_hand}
        self.phase = "waiting"
        self.actor = None
        self.current_bet = 0
        for index, seat in enumerate(self.seats):
            if seat:
                seat.bet = seat.total = 0
            if seat and seat.left:
                self.seats[index] = None
            elif seat and seat.stack == 0:
                seat.sitting_out = True
        return [
            {
                "type": "hand_end",
                "hand": self.hand_number,
                "board": final_board,
                "winners": winners,
                "shown": [s["player"] for s in shown],
                "holes": holes,  # Server-side only: used for labelling, never broadcast as-is.
            }
        ]

    # ---- views ----------------------------------------------------------------

    def position_of(self, index: int) -> str:
        """Seat position as the prediction schema names it."""
        if index in (self.sb_index, self.bb_index):
            return "blinds"
        in_hand = [i for i, s in enumerate(self.seats) if s and s.in_hand]
        order = [
            i
            for i in self._order_from(self.bb_index, in_hand)
            if i not in (self.sb_index, self.bb_index)
        ]
        if index not in order:
            return "middle"
        place, count = order.index(index), len(order)
        if place >= count - 2:
            return "late"
        return "early" if place < max(1, (count - 2) // 2) else "middle"

    def snapshot(
        self, viewer: str | None = None, reveal: dict[str, list[str]] | None = None
    ) -> dict:
        """Table state for one viewer. Only the viewer's own hole cards are included."""
        reveal = reveal or {}
        seats = []
        for seat in self.seats:
            if seat is None:
                seats.append(None)
                continue
            if seat.player_id == viewer:
                hole = seat.hole
            elif seat.player_id in reveal:
                hole = reveal[seat.player_id]
            else:
                hole = None
            seats.append(
                {
                    "player": seat.player_id,
                    "name": seat.name,
                    "stack": seat.stack,
                    "bet": seat.bet,
                    "folded": seat.folded,
                    "all_in": seat.all_in,
                    "in_hand": seat.in_hand,
                    "sitting_out": seat.sitting_out,
                    "has_cards": bool(seat.hole) and not seat.folded,
                    "hole": hole,
                }
            )
        actor_id = self.seats[self.actor].player_id if self.actor is not None else None
        return {
            "phase": self.phase,
            "hand": self.hand_number,
            "button": self.button if self.button >= 0 else None,
            "board": list(self.board),
            "pot": self.pot(),
            "current_bet": self.current_bet,
            "actor": actor_id,
            "legal": self.legal_actions(viewer) if viewer else None,
            "blinds": [self.small_blind, self.big_blind],
            "seats": seats,
        }
