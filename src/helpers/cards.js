const SUITS = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' }

// Server cards look like "As" or "Td". Returns the { rank, suit } PlayingCard expects.
export function parseCard(code) {
  if (!code) return null
  return { rank: code[0] === 'T' ? '10' : code[0], suit: SUITS[code[1]] }
}

export function formatChips(amount) {
  return Number(amount || 0).toLocaleString('en-US')
}
