import './SignalBar.css'

// tone: 'high' (coral), 'mid' (gold), or 'low' (green)
function SignalBar({ label, value, percent, tone }) {
  return (
    <div className="signal-bar">
      <div className="signal-bar-row">
        <span className="signal-bar-label">{label}</span>
        <span className={`signal-bar-value signal-bar-${tone}`}>{value}</span>
      </div>
      <div className="signal-bar-track">
        <div
          className={`signal-bar-fill signal-bar-fill-${tone}`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
    </div>
  )
}

export default SignalBar
