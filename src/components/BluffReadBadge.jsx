import { useState } from 'react'
import AnimatedNumber from './AnimatedNumber.jsx'
import { getLikelihoodTone } from '../helpers/format.js'
import './BluffReadBadge.css'

// The live bluff read on a bettor. Click it to see why.
// read: { sealed } or { probability (0-1), reasons: [{ description }] }
function BluffReadBadge({ read }) {
  const [open, setOpen] = useState(false)
  if (!read) return null

  if (read.sealed) {
    return (
      <div className="bluffread bluffread-sealed" title="The read is revealed when the hand ends">
        <span className="bluffread-label">READ</span>
        <span>Sealed</span>
      </div>
    )
  }

  const percent = Math.round(read.probability * 100)
  const tone = getLikelihoodTone(percent)

  return (
    <div className={`bluffread bluffread-${tone}`}>
      <button
        className="bluffread-button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="bluffread-label">BLUFF</span>
        <strong className="bluffread-value">
          <AnimatedNumber value={percent} format={(n) => `${n}%`} />
        </strong>
      </button>
      <div className="bluffread-track">
        <div className="bluffread-fill" style={{ width: `${percent}%` }}></div>
      </div>
      {open && (
        <ul className="bluffread-reasons">
          {read.reasons.map((reason) => (
            <li key={reason.code || reason.description}>{reason.description}</li>
          ))}
          {!read.calibrated && <li className="bluffread-note">Unvalidated estimate, not a probability.</li>}
        </ul>
      )}
    </div>
  )
}

export default BluffReadBadge
