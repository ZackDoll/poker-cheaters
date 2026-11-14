import { Link, useParams } from 'react-router'
import Avatar from '../components/Avatar.jsx'
import PageNotice from '../components/PageNotice.jsx'
import PlayingCard from '../components/PlayingCard.jsx'
import ReadAccuracyBar from '../components/ReadAccuracyBar.jsx'
import StatTile from '../components/StatTile.jsx'
import { formatChips, parseCard } from '../helpers/cards.js'
import { errorText, formatDateTime, formatNet, netTone } from '../helpers/format.js'
import { getSession } from '../helpers/sessions.js'
import { useLoad } from '../helpers/useLoad.js'
import { getLikelihoodTone } from '../helpers/liveSampleData.js'
import './SessionDetailPage.css'

function verdictOf(decision) {
  if (decision.was_bluff === null) return { text: 'Not scored', className: '' }
  const percent = Math.round(decision.probability * 100)
  const hit = decision.was_bluff === percent >= 50
  return {
    text: `${decision.was_bluff ? 'Bluff' : 'Value bet'} · ${hit ? 'read held up' : 'read missed'}`,
    className: hit ? 'session-detail-hit' : 'session-detail-miss',
  }
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
          text={notFound ? 'It may belong to a table you were not seated at.' : errorText(error)}
        />
      )}

      {session && (
        <>
          <header className="session-detail-header">
            <div className="session-detail-eyebrow">SESSION · {session.room_code}</div>
            <h1 className="session-detail-title">Session review</h1>
            <p className="session-detail-text">{formatDateTime(session.created_at)}</p>
          </header>

          <div className="session-detail-tiles">
            <StatTile label="Hands" value={session.hands} />
            <StatTile label="Bets read" value={session.judged_bets} hint={`${session.labeled_bets} scored at the end of the hand`} />
            <StatTile label="Your result" value={formatNet(session.my_net_chips)} tone={netTone(session.my_net_chips) === 'flat' ? null : netTone(session.my_net_chips)} />
            <div className="session-detail-accuracy">
              <ReadAccuracyBar value={session.read_accuracy} />
            </div>
          </div>

          <section className="session-detail-players" aria-label="Players">
            {[...session.players]
              .sort((a, b) => (b.final_chips ?? 0) - (a.final_chips ?? 0))
              .map((player) => (
                <Link className="session-detail-player" key={player.id} to={`/opponents/${player.id}`}>
                  <Avatar name={player.name} url={player.avatar_url} size={36} />
                  <span className="session-detail-player-name">{player.name}</span>
                  <span className="session-detail-player-chips">
                    {formatChips(player.final_chips ?? player.starting_chips)}
                  </span>
                </Link>
              ))}
          </section>

          <ol className="session-detail-hands">
            {session.hand_list.map((hand) => (
              <li className="session-detail-hand" key={hand.number}>
                <div className="session-detail-hand-head">
                  <strong>Hand {hand.number}</strong>
                  <span className="session-detail-hand-pot">Pot {formatChips(hand.pot)}</span>
                  <span className="session-detail-hand-winners">
                    {hand.winners.map((winner) => `${winner.name || 'Player'} +${formatChips(winner.amount)}`).join(' · ')}
                  </span>
                </div>
                <div className="session-detail-board">
                  {hand.board.map((code) => (
                    <PlayingCard key={code} size="sm" {...parseCard(code)} />
                  ))}
                </div>

                {hand.decisions.length === 0 ? (
                  <p className="session-detail-quiet">No bets or raises were read in this hand.</p>
                ) : (
                  <ul className="session-detail-reads">
                    {hand.decisions.map((decision) => {
                      const percent = Math.round(decision.probability * 100)
                      const verdict = verdictOf(decision)
                      return (
                        <li className="session-detail-read" key={decision.id}>
                          <div className="session-detail-read-top">
                            <span>
                              <strong>{decision.player_name}</strong> bet {formatChips(decision.bet_size)} on the{' '}
                              {decision.street}
                            </span>
                            <span className={`session-detail-percent session-detail-tone-${getLikelihoodTone(percent)}`}>
                              {percent}%
                            </span>
                          </div>
                          <div className="session-detail-meter">
                            <div className={`session-detail-meter-fill session-detail-fill-${getLikelihoodTone(percent)}`} style={{ width: `${percent}%` }}></div>
                          </div>
                          <div className="session-detail-read-bottom">
                            <span className={`session-detail-verdict ${verdict.className}`}>{verdict.text}</span>
                            {decision.reasons[0] && <span className="session-detail-reason">{decision.reasons[0].description}</span>}
                          </div>
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
