import { useState } from 'react'
import CameraPanel from '../components/CameraPanel.jsx'
import PlayingCard from '../components/PlayingCard.jsx'
import OpponentCard from '../components/OpponentCard.jsx'
import ReadPanel from '../components/ReadPanel.jsx'
import { SAMPLE_HAND, SAMPLE_OPPONENTS } from '../helpers/liveSampleData.js'
import './LivePage.css'

// UI only: uses sample data, no camera or API yet.
function LivePage() {
  const [sessionActive, setSessionActive] = useState(false)
  const [selectedId, setSelectedId] = useState(SAMPLE_OPPONENTS[1].id)
  const selected = SAMPLE_OPPONENTS.find((opponent) => opponent.id === selectedId)

  return (
    <div className="live-page">
      <header className="live-header">
        <div className="live-eyebrow">LIVE</div>
        <h1 className="live-title">Read the table.</h1>
      </header>

      <div className="live-layout">
        <div className="live-main">
          <CameraPanel
            active={sessionActive}
            onToggle={() => setSessionActive((current) => !current)}
          />

          <div className="live-hand">
            <div className="live-hand-header">
              <span>{SAMPLE_HAND.street.toUpperCase()} · FACING BET</span>
              <span>SAMPLE DATA</span>
            </div>
            <div className="live-board">
              {SAMPLE_HAND.board.map((card) => (
                <PlayingCard key={card.rank + card.suit} {...card} />
              ))}
            </div>
            <div className="live-hand-stats">
              <div className="live-hand-stat">
                <span className="live-hand-label">Pot</span>
                <span className="live-hand-value">{SAMPLE_HAND.pot}</span>
              </div>
              <div className="live-hand-stat">
                <span className="live-hand-label">Facing</span>
                <span className="live-hand-value">{SAMPLE_HAND.facingBet}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="live-side">
          <div className="live-opponents">
            <div className="live-opponents-title">OPPONENTS</div>
            {SAMPLE_OPPONENTS.map((opponent) => (
              <OpponentCard
                key={opponent.id}
                opponent={opponent}
                selected={opponent.id === selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>
          <ReadPanel key={selected.id} opponent={selected} />
        </div>
      </div>
    </div>
  )
}

export default LivePage
