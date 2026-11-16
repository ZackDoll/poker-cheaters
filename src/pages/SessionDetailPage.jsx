import { Link, useParams } from 'react-router'
import PageNotice from '../components/PageNotice.jsx'
import PlayingCard from '../components/PlayingCard.jsx'
import ReadAccuracyBar from '../components/ReadAccuracyBar.jsx'
import StatTile from '../components/StatTile.jsx'
import { formatChips, parseCard } from '../helpers/cards.js'
import { capitalize, formatDateTime, formatPercent, getLikelihoodTone } from '../helpers/format.js'
import { apiErrorText, getSession } from '../helpers/tracker.js'
import { useLoad } from '../helpers/useLoad.js'
import { verdictOf } from '../helpers/verdict.js'
import './SessionDetailPage.css'

const NO_SIZE = { fold: 'folded', check: 'checked' }

function describe(action) {
  const size = formatChips(action.bet_size)
  if (action.action === 'bet') return `bet ${size} into ${formatChips(action.pot_size)}`
  if (action.action === 'raise') return `raised to ${size}`
  if (action.action === 'call') return `called ${size}`
  return NO_SIZE[action.action]
}

function SessionDetailPage() {
  const { sessionId } = useParams()
  const { data: session, error, loading } = useLoad(() => getSession(sessionId), sessionId)

  const notFound = error?.response?.status === 404

  return (
    <div className="session-detail-page">
      <Link className="session-detail-back" to="/sessions">
        ← Back to sessions
      </Link>

      {loading && <PageNotice kind="loading" />}
      {error && (
        <PageNotice
          kind="error"
          title={notFound ? 'Session not found' : 'Couldn’t load this session'}
          text={notFound ? 'It may have been deleted.' : apiErrorText(error)}
        />
      )}

      {session && (
        <>
          <header className="session-detail-header">
            <div className="session-detail-eyebrow">SESSION REVIEW{session.ended_at ? '' : ' · IN PROGRESS'}</div>
            <h1 className="session-detail-title">{session.label || 'Untitled session'}</h1>
            <p className="session-detail-text">{formatDateTime(session.created_at)}</p>
            {!session.ended_at && (
              <Link className="session-detail-resume" to={`/track/${session.id}`}>
                Continue tracking
              </Link>
            )}
          </header>

          <div className="session-detail-tiles">
            <StatTile label="Hands" value={session.hands} />
            <StatTile label="Bets read" value={session.judged_bets} hint={`${session.labeled_bets} scored from shown cards`} />
            <StatTile label="Bluff rate" value={formatPercent(session.bluff_rate)} hint="of scored bets" />
            <div className="session-detail-accuracy">
              <ReadAccuracyBar value={session.read_accuracy} />
            </div>
          </div>

          {session.opponents.length > 0 && (
            <section className="session-detail-players" aria-label="Opponents">
              {session.opponents.map((opponent) => (
                <Link className="session-detail-player" key={opponent.id} to={`/opponents/${opponent.id}`}>
                  <span className="session-detail-player-name">{opponent.name}</span>
                </Link>
              ))}
            </section>
          )}

          {session.hand_list.length === 0 && (
            <PageNotice kind="empty" title="No hands yet" text="Start a hand in the tracker and log what your opponents do." />
          )}

          <ol className="session-detail-hands">
            {session.hand_list.map((hand) => (
              <li className="session-detail-hand" key={hand.id}>
                <div className="session-detail-hand-head">
                  <strong>Hand {hand.number}</strong>
                  <span className="session-detail-hand-pot">{hand.ended_at ? 'Finished' : 'In progress'}</span>
                </div>
                {hand.board.length > 0 && (
                  <div className="session-detail-board">
                    {hand.board.map((code) => (
                      <PlayingCard key={code} size="sm" {...parseCard(code)} />
                    ))}
                  </div>
                )}

                {hand.actions.length === 0 ? (
                  <p className="session-detail-quiet">Nothing was logged in this hand.</p>
                ) : (
                  <ul className="session-detail-reads">
                    {hand.actions.map((action) => {
                      const verdict = verdictOf(action)
                      const percent = action.probability === null ? null : Math.round(action.probability * 100)
                      return (
                        <li className="session-detail-read" key={action.id}>
                          <div className="session-detail-read-top">
                            <span>
                              <strong>{action.opponent_name}</strong> {describe(action)} · {capitalize(action.street)}
                            </span>
                            {percent !== null && (
                              <span className={`session-detail-percent session-detail-tone-${getLikelihoodTone(percent)}`}>
                                {percent}%
                              </span>
                            )}
                          </div>
                          {percent !== null && (
                            <div className="session-detail-meter">
                              <div
                                className={`session-detail-meter-fill session-detail-fill-${getLikelihoodTone(percent)}`}
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                          )}
                          {percent !== null && (
                            <div className="session-detail-read-bottom">
                              <span className={`session-detail-verdict ${verdict ? (verdict.hit ? 'session-detail-hit' : 'session-detail-miss') : ''}`}>
                                {verdict ? verdict.text : 'Not scored'}
                              </span>
                              {action.reasons[0] && <span className="session-detail-reason">{action.reasons[0].description}</span>}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

export default SessionDetailPage
