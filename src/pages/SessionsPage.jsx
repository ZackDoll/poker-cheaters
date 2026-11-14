import PageNotice from '../components/PageNotice.jsx'
import SessionCard from '../components/SessionCard.jsx'
import { errorText } from '../helpers/format.js'
import { listSessions } from '../helpers/sessions.js'
import { useLoad } from '../helpers/useLoad.js'
import './SessionsPage.css'

function SessionsPage() {
  const { data: sessions, error, loading } = useLoad(listSessions, 'sessions')

  return (
    <div className="sessions-page">
      <header className="sessions-header">
        <div className="sessions-eyebrow">SESSIONS</div>
        <h1 className="sessions-title">Match history</h1>
        <p className="sessions-text">
          Every live game you have played, with hand counts and how often the bluff reads landed on the right side.
        </p>
      </header>

      {loading && <PageNotice kind="loading" />}
      {error && <PageNotice kind="error" title="Couldn’t load your sessions" text={errorText(error)} />}
      {sessions?.length === 0 && (
        <PageNotice
          kind="empty"
          title="No games yet"
          text="Host or join a live room and play a few hands. Finished games show up here."
          action={{ to: '/play', label: 'Play live' }}
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
