import { useEffect, useState } from 'react'
import PlayingCard from './PlayingCard.jsx'
import { formatChips, parseCard } from '../helpers/cards.js'
import { getLikelihoodTone } from '../helpers/liveSampleData.js'
import './ShowdownOverlay.css'

// The recap after each hand: who won, what was shown, and how the bluff reads held up.
// Cards flip face up a moment after it opens.
function ShowdownOverlay({ recap, onClose }) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 500)
    return () => clearTimeout(timer)
  }, [])

  const winnerIds = new Set(recap.winners.map((winner) => winner.player))

  return (
    <section className="showdown" aria-label={`Hand ${recap.hand} result`}>
      <header className="showdown-header">
        <span className="showdown-eyebrow">HAND {recap.hand} · POT {formatChips(recap.pot)}</span>
        <button className="showdown-close" type="button" onClick={onClose} aria-label="Close recap">
          ×
        </button>
      </header>

      <ul className="showdown-winners">
        {recap.winners.map((winner, index) => (
          <li className="showdown-winner" key={winner.player} style={{ animationDelay: `${index * 120}ms` }}>
            <span className="showdown-winner-name">{winner.name}</span>
            <strong className="showdown-winner-amount">+{formatChips(winner.amount)}</strong>
          </li>
        ))}
      </ul>

      {recap.shown.length > 0 && (
        <div className="showdown-hands">
          {recap.shown.map((hand) => (
            <div className="showdown-hand" key={hand.player}>
              <div className="showdown-cards">
                {hand.hole.map((code, index) => (
                  <PlayingCard
                    key={code}
                    size="sm"
                    faceDown={!revealed}
                    win={revealed && winnerIds.has(hand.player)}
                    {...parseCard(code)}
                    deal
                    dealDelay={index * 120}
                  />
                ))}
              </div>
              <span className="showdown-hand-name">{hand.name}</span>
              <span className="showdown-hand-label">{hand.label}</span>
            </div>
          ))}
        </div>
      )}

      {recap.reads.length > 0 && (
        <div className="showdown-reads">
          <span className="showdown-reads-title">BLUFF READS</span>
          {recap.reads.map((read, index) => {
            const percent = Math.round(read.probability * 100)
            const verdict = read.was_bluff === true ? 'Bluff' : read.was_bluff === false ? 'Value bet' : 'Not scored'
            const hit = read.was_bluff === null ? null : read.was_bluff === percent >= 50
            return (
              <div className="showdown-read" key={`${read.player}-${index}`} style={{ animationDelay: `${300 + index * 120}ms` }}>
                <span className="showdown-read-name">
                  {read.name} <small>{read.street}</small>
                </span>
                <span className={`showdown-read-percent showdown-tone-${getLikelihoodTone(percent)}`}>{percent}%</span>
                <span className={`showdown-read-verdict ${read.was_bluff ? 'showdown-bluff' : ''}`}>{verdict}</span>
                {hit !== null && (
                  <span className={`showdown-read-hit ${hit ? 'showdown-hit' : 'showdown-miss'}`}>
                    {hit ? 'Read held up' : 'Read missed'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default ShowdownOverlay
