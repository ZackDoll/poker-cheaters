import { Link } from 'react-router'
import Avatar from './Avatar.jsx'
import ReadAccuracyBar from './ReadAccuracyBar.jsx'
import { formatNet, formatPercent, netTone } from '../helpers/format.js'
import './PlayerCard.css'

// A player from your past games: how they bet, and how well they could be read.
function PlayerCard({ profile, index = 0 }) {
  return (
    <Link
      className={`playercard ${profile.is_me ? 'playercard-me' : ''}`}
      to={`/opponents/${profile.player.id}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="playercard-head">
        <Avatar name={profile.player.name} url={profile.player.avatar_url} size={48} />
        <div className="playercard-who">
          <span className="playercard-name">{profile.player.name}</span>
          <span className="playercard-sub">
            {profile.is_me ? 'You · ' : ''}
            {profile.sessions} {profile.sessions === 1 ? 'game' : 'games'} · {profile.hands_played}{' '}
            {profile.hands_played === 1 ? 'hand' : 'hands'}
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
          <dt>Net chips</dt>
          <dd className={`playercard-net-${netTone(profile.net_chips)}`}>{formatNet(profile.net_chips)}</dd>
        </div>
      </dl>

      <ReadAccuracyBar value={profile.read_accuracy} label="How readable" />
    </Link>
  )
}

export default PlayerCard
