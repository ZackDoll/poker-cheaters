// Cards are two-character strings such as "As" or "Td": rank then suit.

export const RANKS = '23456789TJQKA'
export const SUITS = 'shdc'
export const STREETS = ['preflop', 'flop', 'turn', 'river']
// How many board cards are showing on each street.
export const BOARD_SIZE = { preflop: 0, flop: 3, turn: 4, river: 5 }

export function isCard(code) {
  return typeof code === 'string' && code.length === 2 && RANKS.includes(code[0]) && SUITS.includes(code[1])
}

// 2 for a deuce up to 14 for an ace.
export function rankValue(card) {
  return RANKS.indexOf(card[0]) + 2
}

// True when `list` is an array of at most `max` valid cards, with no repeats.
export function isCardList(list, max) {
  return Array.isArray(list) && list.length <= max && list.every(isCard) && new Set(list).size === list.length
}
