import './SignalCard.css'

function SignalCard({ icon, title, text }) {
  return (
    <div className="signal-card">
      {icon}
      <h3 className="signal-card-title">{title}</h3>
      <p className="signal-card-text">{text}</p>
    </div>
  )
}

export default SignalCard
