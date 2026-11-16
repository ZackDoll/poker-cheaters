export const SUIT_NAMES = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' }
export const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' }
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
export const SUITS = ['s', 'h', 'd', 'c']

// Cards look like "As" or "Td". Returns the { rank, suit } PlayingCard expects.
export function parseCard(code) {
  if (!code) return null
  return { rank: code[0] === 'T' ? '10' : code[0], suit: SUIT_NAMES[code[1]] }
}

export function cardText(code) {
  return `${code[0] === 'T' ? '10' : code[0]}${SUIT_SYMBOLS[code[1]]}`
}

export function formatChips(amount) {
  return Number(amount || 0).toLocaleString('en-US')
}

// How many board cards show on each street, and the street for a board.
export const STREET_BY_BOARD_SIZE = { 0: 'preflop', 3: 'flop', 4: 'turn', 5: 'river' }
