import { Link } from 'react-router'
import Avatar from './Avatar.jsx'
import ReadAccuracyBar from './ReadAccuracyBar.jsx'
import { formatPercent } from '../helpers/format.js'
import './PlayerCard.css'

// An opponent you track: how often they bluff, and how well they could be read.
function PlayerCard({ profile, index = 0 }) {
  const { opponent } = profile
  return (
    <Link
      className="playercard"
      to={`/opponents/${opponent.id}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="playercard-head">
        <Avatar name={opponent.name} size={48} />
        <div className="playercard-who">
          <span className="playercard-name">{opponent.name}</span>
          <span className="playercard-sub">
            {profile.sessions} {profile.sessions === 1 ? 'session' : 'sessions'} · {profile.hands_seen}{' '}
            {profile.hands_seen === 1 ? 'hand' : 'hands'}
          </span>
        </div>
      </div>

      <dl className="playercard-stats">
        <div>
          <dt>Bluff rate</dt>
          <dd>{formatPercent(profile.bluff_rate)}</dd>
        </div>
        <div>
          <dt>Avg read</dt>
          <dd>{formatPercent(profile.average_read)}</dd>
        </div>
        <div>
          <dt>Bets read</dt>
          <dd>{profile.judged_bets}</dd>
        </div>
      </dl>

      <ReadAccuracyBar value={profile.read_accuracy} label="How readable" />
    </Link>
  )
}

export default PlayerCard
