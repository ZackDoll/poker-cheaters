import random

import pytest

from app.services.poker.bluff_rule import was_bluff
from app.services.poker.hand_eval import best_hand, describe, evaluate_five
from app.services.poker.table import IllegalAction, PokerTable


def rank(cards: str):
    return best_hand(cards.split())


@pytest.mark.parametrize(
    ("worse", "better"),
    [
        ("As Kd 9c 5h 3d", "Ah Ad 9c 5h 3d"),  # high card < pair
        ("Ah Ad 9c 5h 3d", "Ah Ad 9c 9h 3d"),  # pair < two pair
        ("Ah Ad 9c 9h 3d", "Ah Ad Ac 9h 3d"),  # two pair < trips
        ("Ah Ad Ac 9h 3d", "5h 6d 7c 8h 9d"),  # trips < straight
        ("5h 6d 7c 8h 9d", "2h 6h 7h 8h Kh"),  # straight < flush
        ("2h 6h 7h 8h Kh", "Ah Ad Ac 9h 9d"),  # flush < full house
        ("Ah Ad Ac 9h 9d", "Ah Ad Ac As 9d"),  # full house < quads
        ("Ah Ad Ac As 9d", "5h 6h 7h 8h 9h"),  # quads < straight flush
        ("Ah Ad 9c 5h 3d", "Ah Ad 9c 5h 4d"),  # the kicker decides
    ],
)
def test_hand_categories_and_kickers(worse, better):
    assert evaluate_five(better.split()) > evaluate_five(worse.split())


def test_wheel_is_the_lowest_straight():
    wheel = rank("Ah 2d 3c 4h 5d")
    six_high = rank("2h 3d 4c 5h 6d")
    assert wheel < six_high
    assert describe(wheel) == "Straight, Five high"


def test_best_of_seven_and_labels():
    assert describe(rank("Kh Kd 7c 7h 2d 9s 3c")) == "Two pair, Kings and Sevens"
    assert describe(rank("Ah Kh Qh Jh Th 2d 3c")) == "Royal flush"
    assert describe(rank("2h 2d 2c 9h 9d 4s 5c")) == "Full house, Twos full of Nines"


def make_table(stacks=(1000, 1000, 1000), seed=1) -> PokerTable:
    table = PokerTable(5, 10, rng=random.Random(seed))
    for index, stack in enumerate(stacks):
        table.add_player(f"p{index}", f"P{index}", stack)
    return table


def actor_id(table: PokerTable) -> str:
    return table.seats[table.actor].player_id


def total_chips(table: PokerTable) -> int:
    return sum(s.stack for s in table.players()) + table.pot()


def test_blinds_and_first_to_act_three_handed():
    table = make_table()
    table.start_hand()
    assert table.sb_index != table.bb_index
    assert table.seats[table.sb_index].bet == 5 and table.seats[table.bb_index].bet == 10
    assert table.actor == table.button  # Under the gun is the button with three players.


def test_heads_up_button_posts_small_blind_and_acts_first():
    table = make_table((1000, 1000))
    table.start_hand()
    assert table.sb_index == table.button
    assert table.actor == table.sb_index


def test_hole_cards_are_only_in_the_viewers_snapshot():
    table = make_table()
    table.start_hand()
    snap = table.snapshot(viewer="p0")
    assert snap["seats"][0]["hole"] == table.seats[0].hole
    assert snap["seats"][1]["hole"] is None and snap["seats"][2]["hole"] is None


def test_fold_around_awards_blinds_without_showdown():
    table = make_table()
    table.start_hand()
    bb = table.seats[table.bb_index]
    events = []
    while table.hand_active:
        events += table.act(actor_id(table), "fold")
    end = events[-1]
    assert end["type"] == "hand_end" and end["shown"] == []
    assert bb.stack == 1005
    assert total_chips(table) == 3000


def test_minimum_raise_rules():
    table = make_table()
    table.start_hand()
    first = actor_id(table)
    with pytest.raises(IllegalAction):
        table.act(first, "raise", 15)  # The minimum raise is to 20.
    table.act(first, "raise", 30)
    legal = table.legal_actions(actor_id(table))
    assert legal["min_raise_to"] == 50  # Raised by 20, so the next raise is by at least 20.
    with pytest.raises(IllegalAction):
        table.act(actor_id(table), "check")
    with pytest.raises(IllegalAction):
        table.act(first, "call")  # Not their turn.


def test_checks_through_to_showdown_conserves_chips():
    table = make_table((1000, 1000))
    table.start_hand()
    table.act(actor_id(table), "call")
    events = table.act(actor_id(table), "check")
    for _ in range(3):  # flop, turn, river
        table.act(actor_id(table), "check")
        events = table.act(actor_id(table), "check")
    assert events[-1]["type"] == "hand_end" and len(events[-1]["board"]) == 5
    assert total_chips(table) == 2000 and not table.hand_active


def test_all_in_side_pots_and_runout():
    table = make_table((100, 300, 1000), seed=7)
    table.start_hand()
    while table.hand_active:
        legal = table.legal_actions(actor_id(table))
        if legal["can_raise"]:
            table.act(actor_id(table), "raise", legal["max_raise_to"])
        else:
            table.act(actor_id(table), "call")
    assert sum(s.stack for s in table.players()) == 1400


def test_side_pot_amounts():
    table = make_table((100, 300, 1000))
    table.start_hand()
    for seat, total in zip(table.seats[:3], (100, 300, 300), strict=True):
        seat.total, seat.in_hand, seat.folded = total, True, False
    pots = table.side_pots()
    assert [p["amount"] for p in pots] == [300, 400]
    assert pots[0]["eligible"] == [0, 1, 2] and pots[1]["eligible"] == [1, 2]


def test_player_leaving_mid_hand_folds_and_frees_the_seat_after():
    table = make_table()
    table.start_hand()
    leaver = next(i for i, s in enumerate(table.seats) if s.player_id != actor_id(table))
    leaver_id = table.seats[leaver].player_id
    table.remove_player(leaver_id)
    assert table.seats[leaver].folded
    while table.hand_active:
        table.act(actor_id(table), "fold")
    assert table.seats[leaver] is None


def test_busted_players_sit_out_and_hands_need_two_players():
    table = make_table((30, 1000))
    table.start_hand()
    shortstack = next(s for s in table.players() if s.player_id == "p0")
    while table.hand_active:
        legal = table.legal_actions(actor_id(table))
        if actor_id(table) == "p0" and legal["can_raise"]:
            table.act("p0", "raise", legal["max_raise_to"])
        else:
            table.act(actor_id(table), "call")
    assert sum(s.stack for s in table.players()) == 1030
    if shortstack.stack == 0:
        assert shortstack.sitting_out and not table.can_start()


@pytest.mark.parametrize("seed", range(40))
def test_random_play_always_conserves_chips(seed):
    rng = random.Random(seed)
    stacks = (200, 350, 500, 80, 1000, 60)
    table = make_table(stacks, seed=seed)
    for _ in range(25):
        if not table.can_start():
            break
        table.start_hand()
        steps = 0
        while table.hand_active and steps < 300:
            steps += 1
            actor = actor_id(table)
            legal = table.legal_actions(actor)
            choice = rng.random()
            if choice < 0.15:
                table.act(actor, "fold")
            elif legal["can_raise"] and choice < 0.4:
                table.act(actor, "raise", rng.randint(legal["min_raise_to"], legal["max_raise_to"]))
            elif legal["can_check"]:
                table.act(actor, "check")
            else:
                table.act(actor, "call")
        assert not table.hand_active
        assert sum(s.stack for s in table.players()) == sum(stacks)


def test_bluff_rule():
    # Nothing on the river: a bluff.
    assert was_bluff(["Ah", "9d"], ["Kc", "7s", "4d", "2h", "Jc"], "river") is True
    # Top pair uses a hole card: not a bluff.
    assert was_bluff(["Ah", "9d"], ["Ac", "7s", "4d", "2h", "Jc"], "river") is False
    # A pair on the board only: still a bluff.
    assert was_bluff(["Ah", "9d"], ["Kc", "Ks", "4d", "2h", "Jc"], "river") is True
    # A flush draw on the flop is a semi-bluff, not labelled a bluff.
    assert was_bluff(["Ah", "9h"], ["Kh", "7h", "4d"], "flop") is False
    # Preflop bets are not labelled.
    assert was_bluff(["Ah", "9h"], [], "preflop") is None


def test_a_player_leaving_out_of_turn_does_not_move_the_action():
    for seed in range(20):
        table = make_table((1000, 1000, 1000, 1000), seed=seed)
        table.start_hand()
        on_the_clock = table.actor
        others = [s.player_id for i, s in enumerate(table.seats) if s and i != on_the_clock]
        table.remove_player(others[0])
        assert table.actor == on_the_clock
        while table.hand_active:
            table.act(
                actor_id(table),
                "call" if table.legal_actions(actor_id(table))["to_call"] else "check",
            )
