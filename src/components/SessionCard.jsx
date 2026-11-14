import { Link } from 'react-router'
import Avatar from './Avatar.jsx'
import ReadAccuracyBar from './ReadAccuracyBar.jsx'
import { formatDateTime, formatNet, netTone } from '../helpers/format.js'
import './SessionCard.css'

// One past game: when, who played, how many bets were read and how well, and your result.
function SessionCard({ session, index = 0 }) {
  return (
    <Link className="sessioncard" to={`/sessions/${session.id}`} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="sessioncard-top">
        <span className="sessioncard-date">{formatDateTime(session.created_at)}</span>
        <span className="sessioncard-code">{session.room_code}</span>
      </div>

      <div className="sessioncard-players">
        {session.players.map((player) => (
          <span key={player.id} title={player.name} className="sessioncard-player">
            <Avatar name={player.name} url={player.avatar_url} size={32} />
          </span>
        ))}
      </div>

      <div className="sessioncard-stats">
        <span>
          <strong>{session.hands}</strong> {session.hands === 1 ? 'hand' : 'hands'}
        </span>
        <span>
          <strong>{session.judged_bets}</strong> bets read
        </span>
        {session.my_net_chips !== null && (
          <span className={`sessioncard-net sessioncard-net-${netTone(session.my_net_chips)}`}>
            {formatNet(session.my_net_chips)} chips
          </span>
        )}
      </div>

      <ReadAccuracyBar value={session.read_accuracy} />
    </Link>
  )
}

export default SessionCard
