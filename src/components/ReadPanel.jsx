import { useState } from 'react'
import SignalBar from './SignalBar.jsx'
import { getLikelihoodTone } from '../helpers/liveSampleData.js'
import './ReadPanel.css'

function ReadPanel({ opponent }) {
  const [showWhy, setShowWhy] = useState(true)
  const tone = getLikelihoodTone(opponent.likelihood)

  return (
    <div className="read-panel">
      <div className="read-header">
        <span>READ · {opponent.name.toUpperCase()}</span>
        <span>SAMPLE OUTPUT</span>
      </div>

      <div className="read-result">
        <div className="read-result-top">
          <span className="read-result-label">Bluff likelihood</span>
          <span className={`read-result-value read-tone-${tone}`}>
            {opponent.likelihood}%
          </span>
        </div>
        <div className="read-meter">
          <div
            className={`read-meter-fill read-meter-fill-${tone}`}
            style={{ width: `${opponent.likelihood}%` }}
          ></div>
        </div>
        <span className={`read-verdict read-tone-${tone}`}>{opponent.verdict}</span>
      </div>

      <div className="read-signals">
        {opponent.signals.map((signal) => (
          <SignalBar key={signal.label} {...signal} />
        ))}
      </div>

      <button
        className="read-why-toggle"
        type="button"
        onClick={() => setShowWhy((current) => !current)}
        aria-expanded={showWhy}
      >
        {showWhy ? 'Hide reasoning' : 'Show reasoning'}
      </button>
      {showWhy && (
        <ul className="read-reasons">
          {opponent.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ReadPanel
