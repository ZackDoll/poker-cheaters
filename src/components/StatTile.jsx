import './StatTile.css'

// tone colors the value: 'up' (green), 'down' (coral) or nothing.
function StatTile({ label, value, tone, hint }) {
  return (
    <div className="stattile">
      <span className="stattile-label">{label}</span>
      <strong className={`stattile-value ${tone ? `stattile-${tone}` : ''}`}>{value}</strong>
      {hint && <span className="stattile-hint">{hint}</span>}
    </div>
  )
}

export default StatTile
