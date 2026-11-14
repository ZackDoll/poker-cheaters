import { useEffect, useRef, useState } from 'react'
import PlayerSeat from './PlayerSeat.jsx'
import PlayingCard from './PlayingCard.jsx'
import BetChips from './BetChips.jsx'
import AnimatedNumber from './AnimatedNumber.jsx'
import { parseCard } from '../helpers/cards.js'
import './PokerTable.css'

const SEAT_COUNT = 6
const CENTER = { x: 50, y: 50 }
// Where each of the six places sits around the table, in percent. Slot 0 is you, at the bottom.
const SLOTS = [
  { x: 50, y: 86 },
  { x: 12, y: 68 },
  { x: 12, y: 26 },
  { x: 50, y: 11 },
  { x: 88, y: 26 },
  { x: 88, y: 68 },
]
const STREET_LABEL = { preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River', waiting: '' }

// Where a seat's bet rests: partway to the middle. The bottom seat's chips sit to the side,
// because its bluff read is drawn above its camera.
function toward(from, fraction) {
  const sideShift = from.y > 80 ? 13 : 0
  return {
    x: from.x + (CENTER.x - from.x) * fraction + sideShift,
    y: from.y + (CENTER.y - from.y) * fraction,
  }
}

// The felt: six seats around an oval, the board and pot in the middle, and bets on the cloth.
// children render over the middle of the table (waiting room, between-hand notices).
function PokerTable({
  table,
  members,
  mySub,
  streams,
  reads,
  winners,
  deadline,
  canKick,
  onKick,
  children,
}) {
  const [ghosts, setGhosts] = useState([])
  const previousBets = useRef({})

  const mySeat = Math.max(
    0,
    table.seats.findIndex((seat) => seat?.player === mySub),
  )
  const slotOf = (index) => SLOTS[(index - mySeat + SEAT_COUNT) % SEAT_COUNT]

  // When a street ends, the bets on the cloth sweep into the pot.
  useEffect(() => {
    const swept = []
    table.seats.forEach((seat, index) => {
      if (seat && previousBets.current[seat.player] > 0 && seat.bet === 0) {
        swept.push({ id: `${table.hand}-${seat.player}-${Date.now()}`, index, amount: previousBets.current[seat.player] })
      }
    })
    previousBets.current = Object.fromEntries(table.seats.filter(Boolean).map((seat) => [seat.player, seat.bet]))
    if (swept.length === 0) return undefined
    setGhosts((current) => [...current, ...swept])
    const timer = setTimeout(() => setGhosts((current) => current.filter((g) => !swept.includes(g))), 900)
    return () => clearTimeout(timer)
  }, [table.seats, table.hand])

  const dealOrder = (index) => (index - table.button + SEAT_COUNT) % SEAT_COUNT

  return (
    <div className="pokertable">
      <div className="pokertable-rim">
        <div className="pokertable-felt">
          <div className="pokertable-center">
            <div className="pokertable-street">{STREET_LABEL[table.phase] || ' '}</div>
            <div className="pokertable-board">
              {Array.from({ length: 5 }, (_, index) => {
                const card = parseCard(table.board[index])
                return card ? (
                  <PlayingCard key={table.board[index]} {...card} deal dealDelay={index < 3 ? index * 140 : 0} />
                ) : (
                  <div className="pokertable-slot" key={`empty-${index}`}></div>
                )
              })}
            </div>
            <div className="pokertable-pot">
              <span className="pokertable-pot-label">POT</span>
              <strong className="pokertable-pot-value">
                <AnimatedNumber value={table.pot} />
              </strong>
            </div>
          </div>
        </div>
      </div>

      {SLOTS.map((slot, index) => {
        const tableIndex = (index + mySeat) % SEAT_COUNT
        if (table.seats[tableIndex]) return null
        return (
          <div className="pokertable-empty" key={`open-${tableIndex}`} style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
            Open seat
          </div>
        )
      })}

      {table.seats.map((seat, index) => {
        const member = seat && members[seat.player]
        if (!seat || !member) return null
        const slot = slotOf(index)
        return (
          <div className="pokertable-seat" key={seat.player} style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
            <PlayerSeat
              seat={seat}
              member={member}
              stream={streams[seat.player]}
              isYou={seat.player === mySub}
              isActor={table.actor === seat.player}
              isButton={table.button === index}
              isWinner={winners.has(seat.player)}
              deadline={deadline}
              read={reads[seat.player]}
              dealKey={table.hand}
              dealOrder={dealOrder(index)}
              canKick={canKick}
              onKick={() => onKick(seat.player)}
            />
          </div>
        )
      })}

      {table.seats.map((seat, index) =>
        seat && seat.bet > 0 ? (
          <BetChips
            key={`${seat.player}-${table.hand}-${table.phase}`}
            amount={seat.bet}
            from={slotOf(index)}
            to={toward(slotOf(index), 0.5)}
            center={CENTER}
          />
        ) : null,
      )}
      {ghosts.map((ghost) => (
        <BetChips
          key={ghost.id}
          amount={ghost.amount}
          from={toward(slotOf(ghost.index), 0.5)}
          to={toward(slotOf(ghost.index), 0.5)}
          center={CENTER}
          sweeping
        />
      ))}

      {children && <div className="pokertable-overlay">{children}</div>}
    </div>
  )
}

export default PokerTable
