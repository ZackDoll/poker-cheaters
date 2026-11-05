import { useState } from 'react'
import PlayingCard from './PlayingCard.jsx'
import './ModesSection.css'

const BOARD = [
  { rank: 'K', suit: 'spades' },
  { rank: '9', suit: 'hearts' },
  { rank: '4', suit: 'diamonds' },
  { rank: '2', suit: 'clubs' },
  { rank: '7', suit: 'spades' },
]

// tone: 'plain', 'gold', 'coral', or 'green'
const LIVE_ROWS = [
  { label: 'Board texture', value: 'Dry, few draws', tone: 'plain' },
  { label: 'Bet', value: 'Overbet', tone: 'plain' },
  { label: 'Voice', value: 'Pitch up, pace slower', tone: 'gold' },
  { label: 'Face', value: 'Tension at bet', tone: 'coral' },
]

const REVIEW_ROWS = [
  { hand: 'Hand 14 · River bluff caught', status: 'READ MATCHED', tone: 'green' },
  { hand: 'Hand 22 · Thin value bet', status: 'MIXED SIGNALS', tone: 'gold' },
  { hand: 'Hand 31 · Turn overbet', status: 'READ MISSED', tone: 'coral' },
  { hand: 'Hand 38 · Check-raise on a wet board', status: 'READ MATCHED', tone: 'green' },
]

function LivePanel() {
  return (
    <div className="modes-panel">
      <div className="modes-copy">
        <h3 className="modes-heading">Real-time reads while the action is on you.</h3>
        <p className="modes-text">
          As each street plays out, Tell updates a running read on every
          opponent in view. When you are facing a big river bet, you see how
          the face, the voice, the board and the sizing line up, within seconds.
        </p>
        <p className="modes-text">
          Built to sit quietly beside the game: glanceable signals, not a wall
          of numbers.
        </p>
      </div>
      <div className="modes-card modes-card-live">
        <div className="modes-card-header">
          <span>RIVER · FACING BET</span>
          <span>SAMPLE OUTPUT</span>
        </div>
        <div className="modes-board">
          {BOARD.map((card) => (
            <PlayingCard key={card.rank + card.suit} {...card} />
          ))}
        </div>
        <div className="modes-rows">
          {LIVE_ROWS.map((row) => (
            <div className="modes-row" key={row.label}>
              <span className="modes-row-label">{row.label}</span>
              <span className={`modes-mono modes-tone-${row.tone}`}>{row.value}</span>
            </div>
          ))}
        </div>
        <div className="modes-read">
          <span className="modes-read-label">Read</span>
          <span className="modes-mono modes-tone-coral">Leans bluff</span>
        </div>
      </div>
    </div>
  )
}

function PostGamePanel() {
  return (
    <div className="modes-panel">
      <div className="modes-copy">
        <h3 className="modes-heading">Review every hand like a coach would.</h3>
        <p className="modes-text">
          Upload a session recording and Tell breaks it into hands. See where
          the signals lined up, where they contradicted the action, and which
          reads you got right or wrong.
        </p>
        <p className="modes-text">
          Over time it builds a profile for each regular opponent, so your reads
          sharpen from session to session.
        </p>
      </div>
      <div className="modes-card modes-card-review">
        <div className="modes-card-header">
          <span>SESSION REVIEW</span>
          <span>SAMPLE OUTPUT</span>
        </div>
        {REVIEW_ROWS.map((row) => (
          <div className="modes-review-item" key={row.hand}>
            <span>{row.hand}</span>
            <span className={`modes-status modes-tone-${row.tone}`}>{row.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ModesSection() {
  const [mode, setMode] = useState('live')

  return (
    <section className="modes-section" id="modes">
      <div className="modes-intro">
        <div className="modes-eyebrow">TWO WAYS TO USE IT</div>
        <h2 className="modes-title">In the moment, and after the hand.</h2>
      </div>
      <div className="modes-tabs">
        <button
          type="button"
          className={`modes-tab ${mode === 'live' ? 'modes-tab-active' : ''}`}
          onClick={() => setMode('live')}
        >
          Live
        </button>
        <button
          type="button"
          className={`modes-tab ${mode === 'post' ? 'modes-tab-active' : ''}`}
          onClick={() => setMode('post')}
        >
          Post-game
        </button>
      </div>
      {mode === 'live' ? <LivePanel /> : <PostGamePanel />}
    </section>
  )
}

export default ModesSection
