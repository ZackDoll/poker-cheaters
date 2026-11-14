import { useState } from 'react'
import { useNavigate } from 'react-router'
import PageNotice from '../components/PageNotice.jsx'
import SessionCard from '../components/SessionCard.jsx'
import { apiErrorText, createSession, listSessions } from '../helpers/tracker.js'
import { useLoad } from '../helpers/useLoad.js'
import './SessionsPage.css'

function SessionsPage() {
  const navigate = useNavigate()
  const { data: sessions, error, loading } = useLoad(listSessions, 'sessions')
  const [label, setLabel] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(null)

  async function start(event) {
    event.preventDefault()
    setStarting(true)
    setStartError(null)
    try {
      const created = await createSession(label)
      navigate(`/track/${created.id}`)
    } catch (failure) {
      setStartError(apiErrorText(failure))
      setStarting(false)
    }
  }

  return (
    <div className="sessions-page">
      <header className="sessions-header">
        <div className="sessions-eyebrow">SESSIONS</div>
        <h1 className="sessions-title">Track a game</h1>
        <p className="sessions-text">
          Log what each opponent does, get a bluff read on every bet, then enter the cards they show. Every session
          you finish is kept here, with how often the reads landed on the right side.
        </p>
      </header>

      <form className="sessions-new" onSubmit={start}>
        <input
          className="sessions-new-input"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Name this session (optional)"
          aria-label="Session name"
          maxLength={100}
        />
        <button className="sessions-new-button" type="submit" disabled={starting}>
          {starting ? 'Starting…' : 'Start tracking'}
        </button>
      </form>
      {startError && (
        <p className="sessions-error" role="alert">
          {startError}
        </p>
      )}

      {loading && <PageNotice kind="loading" />}
      {error && <PageNotice kind="error" title="Couldn’t load your sessions" text={apiErrorText(error)} />}
      {sessions?.length === 0 && (
        <PageNotice
          kind="empty"
          title="No sessions yet"
          text="Start tracking above. Finished and in-progress sessions show up here."
        />
      )}
      {sessions?.length > 0 && (
        <div className="sessions-grid">
          {sessions.map((session, index) => (
            <SessionCard key={session.id} session={session} index={index} />
          ))}
        </div>
      )}
    </div>
  )
}

export default SessionsPage
