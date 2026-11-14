import { Link, useParams } from 'react-router'
import Avatar from '../components/Avatar.jsx'
import CountBars from '../components/CountBars.jsx'
import PageNotice from '../components/PageNotice.jsx'
import ReadAccuracyBar from '../components/ReadAccuracyBar.jsx'
import SessionCard from '../components/SessionCard.jsx'
import StatTile from '../components/StatTile.jsx'
import { errorText, formatNet, formatPercent, netTone } from '../helpers/format.js'
import { getPlayer } from '../helpers/players.js'
import { useLoad } from '../helpers/useLoad.js'
import './PlayerProfilePage.css'

function PlayerProfilePage() {
  const { playerId } = useParams()
  const { data: profile, error, loading } = useLoad(() => getPlayer(playerId), playerId)
  const notFound = error?.response?.status === 404

  return (
    <div className="player-profile-page">
      <Link className="player-profile-back" to="/opponents">
        ← Back to opponents
      </Link>

      {loading && <PageNotice kind="loading" />}
      {error && (
        <PageNotice
          kind="error"
          title={notFound ? 'Player not found' : 'Couldn’t load this profile'}
          text={notFound ? 'You can only see people you have sat at a table with.' : errorText(error)}
        />
      )}

      {profile && (
        <>
          <header className="player-profile-header">
            <Avatar name={profile.player.name} url={profile.player.avatar_url} size={72} />
            <div>
              <div className="player-profile-eyebrow">{profile.is_me ? 'YOUR PROFILE' : 'OPPONENT'}</div>
              <h1 className="player-profile-title">{profile.player.name}</h1>
            </div>
          </header>

          <div className="player-profile-tiles">
            <StatTile label="Games" value={profile.sessions} hint={`${profile.hands_played} ${profile.hands_played === 1 ? 'hand' : 'hands'} played`} />
            <StatTile label="Bets read" value={profile.judged_bets} hint={`${profile.labeled_bets} scored`} />
            <StatTile label="Bluff rate" value={formatPercent(profile.bluff_rate)} hint="of scored bets" />
            <StatTile label="Average read" value={formatPercent(profile.average_read)} hint="model bluff estimate" />
            <StatTile
              label="Net chips"
              value={formatNet(profile.net_chips)}
              tone={netTone(profile.net_chips) === 'flat' ? null : netTone(profile.net_chips)}
            />
          </div>

          <div className="player-profile-accuracy">
            <ReadAccuracyBar value={profile.read_accuracy} label="How readable they have been" />
            <p className="player-profile-note">
              Counts how often the bluff read was on the right side of 50% once the cards were dealt. Reads are
              uncalibrated estimates, and a bet is scored as a bluff by a simple hand-strength rule.
            </p>
          </div>

          <div className="player-profile-lists">
            <CountBars
              title="Common bet signals"
              items={profile.top_reasons}
              empty="No scored bets yet."
            />
            <CountBars
              title="Facial tells"
              items={profile.top_tells}
              empty="No expression tells recorded. They appear once this player calibrates and bets on camera."
            />
          </div>

          {profile.recent_sessions.length > 0 && (
            <section className="player-profile-sessions">
              <h2 className="player-profile-subtitle">Recent games</h2>
              <div className="player-profile-grid">
                {profile.recent_sessions.map((session, index) => (
                  <SessionCard key={session.id} session={session} index={index} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default PlayerProfilePage
