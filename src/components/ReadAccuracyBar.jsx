import { formatPercent } from '../helpers/format.js'
import './ReadAccuracyBar.css'

// How often the bluff read landed on the right side of 50% (value is 0-1, or null).
function ReadAccuracyBar({ value, label = 'Read accuracy' }) {
  return (
    <div className="accuracybar">
      <div className="accuracybar-top">
        <span>{label}</span>
        <strong>{formatPercent(value)}</strong>
      </div>
      <div className="accuracybar-track">
        <div className="accuracybar-fill" style={{ width: `${Math.round((value ?? 0) * 100)}%` }}></div>
      </div>
    </div>
  )
}

export default ReadAccuracyBar
