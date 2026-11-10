import SignalBar from './SignalBar.jsx'
import './LiveReadCard.css'

const SIGNALS = [
  { label: 'Facial tension', value: 'High', percent: 78, tone: 'high' },
  { label: 'Voice pitch shift', value: 'Moderate', percent: 52, tone: 'mid' },
  { label: 'Bet size vs. board story', value: 'Mismatch', percent: 70, tone: 'high' },
]

function LiveReadCard() {
  return (
    <div className="live-read-card">
      <div className="live-read-header">
        <span className="live-read-status">
          <span className="live-read-dot"></span>
          LIVE READ · SEAT 4
        </span>
        <span>SAMPLE OUTPUT</span>
      </div>
      <div className="live-read-placeholder">
        Placeholder for view of UI working on a real game/person
      </div>
      <div className="live-read-signals">
        {SIGNALS.map((signal) => (
          <SignalBar key={signal.label} {...signal} />
        ))}
      </div>
      <div className="live-read-result">
        <span className="live-read-result-label">Bluff likelihood</span>
        <span className="live-read-result-value">ELEVATED</span>
      </div>
    </div>
  )
}

export default LiveReadCard
