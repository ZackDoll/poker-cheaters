import { Link } from 'react-router'
import ReadAccuracyBar from './ReadAccuracyBar.jsx'
import { formatDateTime } from '../helpers/format.js'
import './SessionCard.css'

// One tracked session: when, who was logged, how many bets were read, and how well.
// Open sessions go back to the tracker; ended ones open the review.
function SessionCard({ session, index = 0 }) {
  const target = session.ended_at ? `/sessions/${session.id}` : `/track/${session.id}`
  return (
    <Link className="sessioncard" to={target} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="sessioncard-top">
        <span className="sessioncard-date">{formatDateTime(session.created_at)}</span>
        <span className={`sessioncard-status ${session.ended_at ? '' : 'sessioncard-open'}`}>
          {session.ended_at ? 'Ended' : 'In progress'}
        </span>
      </div>

      <div className="sessioncard-name">{session.label || 'Untitled session'}</div>

      {session.opponents.length > 0 && (
        <div className="sessioncard-players">{session.opponents.map((opponent) => opponent.name).join(' · ')}</div>
      )}

      <div className="sessioncard-stats">
        <span>
          <strong>{session.hands}</strong> {session.hands === 1 ? 'hand' : 'hands'}
        </span>
        <span>
          <strong>{session.judged_bets}</strong> bets read
        </span>
      </div>

      <ReadAccuracyBar value={session.read_accuracy} />
    </Link>
  )
}

export default SessionCard
