import BluffReadBadge from './BluffReadBadge.jsx'
import { capitalize } from '../helpers/format.js'
import { formatChips } from '../helpers/cards.js'
import { verdictOf } from '../helpers/verdict.js'
import './ActionFeed.css'

function describe(action) {
  const size = formatChips(action.bet_size)
  switch (action.action) {
    case 'bet':
      return `bets ${size} into ${formatChips(action.pot_size)}`
    case 'raise':
      return `raises to ${size} (pot ${formatChips(action.pot_size)})`
    case 'call':
      return `calls ${size}`
    default:
      return `${action.action}s` // folds, checks
  }
}

// What has been logged in the current hand, with a bluff read on each bet and raise.
function ActionFeed({ actions, onDelete, busy }) {
  if (actions.length === 0) {
    return <p className="actionfeed-empty">Nothing logged in this hand yet.</p>
  }
  return (
    <ol className="actionfeed">
      {actions.map((action) => {
        const verdict = verdictOf(action)
        return (
          <li className="actionfeed-item" key={action.id}>
            <div className="actionfeed-main">
              <span className="actionfeed-text">
                <strong>{action.opponent_name}</strong> {describe(action)}
                <span className="actionfeed-street"> · {capitalize(action.street)}</span>
                {action.has_face && <span className="actionfeed-face"> · face read</span>}
              </span>
              {verdict && (
                <span className={`actionfeed-verdict ${verdict.hit ? 'actionfeed-hit' : 'actionfeed-miss'}`}>{verdict.text}</span>
              )}
              {action.probability !== null && action.was_bluff === null && (
                <span className="actionfeed-pending">Scored when their cards are shown</span>
              )}
            </div>
            {action.probability !== null && (
              <BluffReadBadge read={{ probability: action.probability, reasons: action.reasons, calibrated: false }} />
            )}
            <button
              className="actionfeed-delete"
              type="button"
              disabled={busy}
              onClick={() => onDelete(action)}
              aria-label={`Remove ${action.opponent_name}'s ${action.action}`}
            >
              ×
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export default ActionFeed
