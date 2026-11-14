import { formatChips } from './cards.js'

const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' }

export function cardText(code) {
  return `${code[0] === 'T' ? '10' : code[0]}${SUIT_SYMBOL[code[1]]}`
}

const ACTION_TEXT = {
  fold: () => 'folds',
  check: () => 'checks',
  call: (event) => `calls ${formatChips(event.amount)}`,
  bet: (event) => `bets ${formatChips(event.amount)}`,
  raise: (event) => `raises to ${formatChips(event.amount)}`,
}

let nextId = 0

// Turns a server event into a hand-log line, or null for events with nothing to say.
// nameOf maps a player id to a display name.
export function describeEvent(event, nameOf) {
  const line = (text, tone = 'plain') => ({ id: nextId++, text, tone })
  switch (event.type) {
    case 'hand_start':
      return line(`Hand ${event.hand} · ${event.players.length} players dealt in`, 'head')
    case 'blind':
      return line(`${nameOf(event.player)} posts the ${event.kind === 'small_blind' ? 'small' : 'big'} blind ${formatChips(event.amount)}`)
    case 'action': {
      const text = `${nameOf(event.player)} ${ACTION_TEXT[event.action](event)}${event.all_in ? ' and is all in' : ''}`
      return line(text, event.action === 'fold' ? 'dim' : 'plain')
    }
    case 'street':
      return line(`${event.street[0].toUpperCase()}${event.street.slice(1)}: ${event.cards.map(cardText).join(' ')}`, 'head')
    case 'showdown':
      return line(event.hands.map((hand) => `${nameOf(hand.player)} shows ${hand.label}`).join(' · '), 'plain')
    case 'pot_awarded':
      return line(`${nameOf(event.player)} wins ${formatChips(event.amount)}${event.hand ? ` with ${event.hand}` : ''}`, 'win')
    default:
      return null
  }
}

export function describeRead(read, nameOf) {
  const text = read.sealed
    ? `Read on ${nameOf(read.player)} is sealed until the hand ends`
    : `Read on ${nameOf(read.player)}: ${Math.round(read.probability * 100)}% bluff`
  return { id: nextId++, text, tone: 'read' }
}
