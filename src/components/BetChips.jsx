import { useEffect, useState } from 'react'
import { formatChips } from '../helpers/cards.js'
import './BetChips.css'

const COLORS = ['red', 'blue', 'black']

// A small stack of chips with the bet amount. It slides from the player's seat (from)
// to its resting place (to). When sweeping, it slides on to the middle of the pot and fades.
// Positions are { x, y } in percent of the table.
function BetChips({ amount, from, to, center, sweeping = false }) {
  const [placed, setPlaced] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setPlaced(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const target = sweeping ? center : to
  const position = placed ? target : from
  const count = Math.max(1, Math.min(5, Math.ceil(Math.log10(amount + 1) * 1.6)))

  return (
    <div
      className={`betchips ${sweeping ? 'betchips-sweeping' : ''}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
    >
      <div className="betchips-stack" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <span
            key={index}
            className={`betchips-chip betchips-chip-${COLORS[index % COLORS.length]}`}
            style={{ bottom: index * 4 }}
          ></span>
        ))}
      </div>
      <span className="betchips-amount">{formatChips(amount)}</span>
    </div>
  )
}

export default BetChips
