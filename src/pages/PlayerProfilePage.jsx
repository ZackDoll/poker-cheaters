import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Avatar from '../components/Avatar.jsx'
import CountBars from '../components/CountBars.jsx'
import PageNotice from '../components/PageNotice.jsx'
import ReadAccuracyBar from '../components/ReadAccuracyBar.jsx'
import SessionCard from '../components/SessionCard.jsx'
import StatTile from '../components/StatTile.jsx'
import { formatPercent } from '../helpers/format.js'
import { apiErrorText, deleteOpponent, getOpponent } from '../helpers/tracker.js'
import { useLoad } from '../helpers/useLoad.js'
import './PlayerProfilePage.css'

function PlayerProfilePage() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const { data: profile, error, loading } = useLoad(() => getOpponent(playerId), playerId)
  const [deleteError, setDeleteError] = useState(null)
  const notFound = error?.response?.status === 404

  async function remove() {
    const confirmed = window.confirm(
      `Delete ${profile.opponent.name}? Every action logged against them is deleted too. This can’t be undone.`,
    )
    if (!confirmed) return
    try {
      await deleteOpponent(playerId)
      navigate('/opponents')
    } catch (failure) {
      setDeleteError(apiErrorText(failure))
    }
  }

  return (
    <div className="player-profile-page">
      <Link className="player-profile-back" to="/opponents">
        ← Back to opponents
      </Link>

      {loading && <PageNotice kind="loading" />}
      {error && (
        <PageNotice
          kind="error"
          title={notFound ? 'Opponent not found' : 'Couldn’t load this profile'}
          text={notFound ? 'They may have been deleted.' : apiErrorText(error)}
        />
      )}

      {profile && (
        <>
          <header className="player-profile-header">
            <Avatar name={profile.opponent.name} size={72} />
            <div>
              <div className="player-profile-eyebrow">OPPONENT</div>
              <h1 className="player-profile-title">{profile.opponent.name}</h1>
            </div>
          </header>

          <div className="player-profile-tiles">
            <StatTile
              label="Sessions"
              value={profile.sessions}
              hint={`${profile.hands_seen} ${profile.hands_seen === 1 ? 'hand' : 'hands'} seen`}
            />
            <StatTile label="Bets read" value={profile.judged_bets} hint={`${profile.labeled_bets} scored`} />
            <StatTile label="Bluff rate" value={formatPercent(profile.bluff_rate)} hint="of scored bets" />
            <StatTile label="Average read" value={formatPercent(profile.average_read)} hint="model bluff estimate" />
          </div>

          <div className="player-profile-accuracy">
            <ReadAccuracyBar value={profile.read_accuracy} label="How readable they have been" />
            <p className="player-profile-note">
              Counts how often the bluff read was on the right side of 50% once their cards were shown. Reads are
              uncalibrated estimates, and a bet is scored as a bluff by a simple hand-strength rule. Bets they never
              showed down on aren’t scored.
            </p>
          </div>

          <div className="player-profile-lists">
            <CountBars title="Common bet signals" items={profile.top_reasons} empty="No bets read yet." />
            <CountBars
              title="Facial tells"
              items={profile.top_tells}
              empty="No expression tells recorded. They appear when you log a bet with the camera on and calibrated."
            />
          </div>

          {profile.recent_sessions.length > 0 && (
            <section className="player-profile-sessions">
              <h2 className="player-profile-subtitle">Recent sessions</h2>
              <div className="player-profile-grid">
                {profile.recent_sessions.map((session, index) => (
                  <SessionCard key={session.id} session={session} index={index} />
                ))}
              </div>
            </section>
          )}

          <div className="player-profile-danger">
            <button className="player-profile-delete" type="button" onClick={remove}>
              Delete this opponent
            </button>
            {deleteError && (
              <p className="player-profile-delete-error" role="alert">
                {deleteError}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default PlayerProfilePage
