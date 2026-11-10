import { getLikelihoodTone } from '../helpers/liveSampleData.js'
import './OpponentCard.css'

function OpponentCard({ opponent, selected, onSelect }) {
  const tone = getLikelihoodTone(opponent.likelihood)

  return (
    <button
      type="button"
      className={`opponent-card ${selected ? 'opponent-card-selected' : ''}`}
      onClick={() => onSelect(opponent.id)}
      aria-pressed={selected}
    >
      <span className="opponent-info">
        <span className="opponent-name">{opponent.name}</span>
        <span className="opponent-verdict">{opponent.verdict}</span>
      </span>
      <span className={`opponent-likelihood opponent-tone-${tone}`}>
        {opponent.likelihood}%
      </span>
    </button>
  )
}

export default OpponentCard
