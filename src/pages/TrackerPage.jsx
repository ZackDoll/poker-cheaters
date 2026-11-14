import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import ActionFeed from '../components/ActionFeed.jsx'
import ActionForm from '../components/ActionForm.jsx'
import PageNotice from '../components/PageNotice.jsx'
import ShowdownPanel from '../components/ShowdownPanel.jsx'
import TrackerBoard from '../components/TrackerBoard.jsx'
import TrackerCamera from '../components/TrackerCamera.jsx'
import { STREET_BY_BOARD_SIZE } from '../helpers/cards.js'
import { createFaceCollector } from '../helpers/faceCollector.js'
import {
  apiErrorText,
  createOpponent,
  deleteAction,
  endSession,
  getSession,
  listOpponents,
  logAction,
  startHand,
  updateHand,
} from '../helpers/tracker.js'
import './TrackerPage.css'

// The hand being played: the newest one that has not been finished.
function openHand(session) {
  return [...session.hand_list].reverse().find((hand) => !hand.ended_at) ?? null
}

// Live tracking for one session: enter the board, log what each opponent does, get a bluff
// read on every bet, then record any cards shown so those bets are scored.
function TrackerSession({ sessionId }) {
  const navigate = useNavigate()
  const [collector] = useState(createFaceCollector)

  const [state, setState] = useState({ loading: true, error: null })
  const [session, setSession] = useState(null)
  const [opponents, setOpponents] = useState([])
  const [hand, setHand] = useState(null)
  const [pot, setPot] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const [pageError, setPageError] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getSession(sessionId), listOpponents()])
      .then(([detail, profiles]) => {
        if (cancelled) return
        setSession(detail)
        setOpponents(profiles.map((profile) => profile.opponent))
        setHand(openHand(detail))
        setState({ loading: false, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, error })
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // Runs one server change with the buttons locked, and shows what went wrong if it fails.
  const run = useCallback(async (work) => {
    setBusy(true)
    setPageError(null)
    try {
      return await work()
    } catch (error) {
      setPageError(apiErrorText(error))
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])

  // Keeps the hand's logged actions when only its cards changed.
  const mergeHand = (updated) => setHand((current) => ({ ...updated, actions: current?.actions ?? [] }))

  const beginHand = () =>
    run(async () => {
      const created = await startHand(sessionId)
      setHand(created)
      setSession((current) => ({ ...current, hands: created.number }))
      setPot('')
    })

  const changeBoard = (board) => run(async () => mergeHand(await updateHand(hand.id, { board })))
  const changeMyCards = (myCards) => run(async () => mergeHand(await updateHand(hand.id, { myCards })))

  // Saving the shown hands labels the bets, so reload the hand to get the new verdicts.
  const showHands = (shown) =>
    run(async () => {
      await updateHand(hand.id, { shown })
      const detail = await getSession(sessionId)
      setHand(detail.hand_list.find((h) => h.id === hand.id) ?? null)
    })

  const finishHand = () =>
    run(async () => {
      await updateHand(hand.id, { finish: true })
      setHand(null)
    })

  const closeSession = () =>
    run(async () => {
      if (hand) await updateHand(hand.id, { finish: true })
      await endSession(sessionId)
      navigate(`/sessions/${sessionId}`)
    })

  async function submitAction(fields) {
    setBusy(true)
    setFormError(null)
    try {
      const logged = await logAction({
        handId: hand.id,
        street: STREET_BY_BOARD_SIZE[hand.board.length],
        face: collector.summary(),
        ...fields,
      })
      setHand((current) => ({ ...current, actions: [...current.actions, logged] }))
      return true
    } catch (error) {
      setFormError(apiErrorText(error))
      return false
    } finally {
      setBusy(false)
    }
  }

  const removeAction = (action) =>
    run(async () => {
      await deleteAction(action.id)
      setHand((current) => ({ ...current, actions: current.actions.filter((a) => a.id !== action.id) }))
    })

  async function addOpponent(name) {
    try {
      const created = await createOpponent(name)
      setOpponents((current) => [...current, created])
      return created
    } catch (error) {
      return { error: apiErrorText(error) }
    }
  }

  if (state.loading) return <PageNotice kind="loading" />
  if (state.error) {
    const notFound = state.error.response?.status === 404
    return (
      <div className="trackerpage">
        <PageNotice
          kind="error"
          title={notFound ? 'Session not found' : 'Couldn’t load this session'}
          text={notFound ? 'It may have been deleted.' : apiErrorText(state.error)}
          action={{ to: '/sessions', label: 'Back to sessions' }}
        />
      </div>
    )
  }

  const ended = Boolean(session.ended_at)
  const street = hand ? STREET_BY_BOARD_SIZE[hand.board.length] : null
  const players = hand
    ? [...new Map(hand.actions.map((a) => [a.opponent_id, { id: a.opponent_id, name: a.opponent_name }])).values()]
    : []

  return (
    <div className="trackerpage">
      <header className="trackerpage-header">
        <div>
          <div className="trackerpage-eyebrow">TRACKING{hand ? ` · HAND ${hand.number}` : ''}</div>
          <h1 className="trackerpage-title">{session.label || 'Untitled session'}</h1>
        </div>
        <div className="trackerpage-header-actions">
          {hand && (
            <button className="trackerpage-button" type="button" disabled={busy} onClick={finishHand}>
              Finish hand
            </button>
          )}
          {!ended && (
            <button className="trackerpage-button trackerpage-danger" type="button" disabled={busy} onClick={closeSession}>
              End session
            </button>
          )}
        </div>
      </header>

      {pageError && (
        <p className="trackerpage-error" role="alert">
          {pageError}
        </p>
      )}

      {ended && (
        <PageNotice
          kind="empty"
          title="This session has ended"
          text="Open the review to see how the reads held up."
          action={{ to: `/sessions/${sessionId}`, label: 'Review session' }}
        />
      )}

      {!ended && !hand && (
        <div className="trackerpage-start">
          <p className="trackerpage-start-text">
            {session.hands === 0 ? 'Ready when you are.' : `Hand ${session.hands} is finished.`} Start a hand, then log
            what each opponent does.
          </p>
          <button className="trackerpage-start-button" type="button" disabled={busy} onClick={beginHand}>
            Start hand {session.hands + 1}
          </button>
          <Link className="trackerpage-link" to={`/sessions/${sessionId}`}>
            Review this session so far
          </Link>
        </div>
      )}

      {!ended && hand && (
        <div className="trackerpage-layout">
          <div className="trackerpage-side">
            <TrackerBoard
              board={hand.board}
              myCards={hand.my_cards}
              onBoard={changeBoard}
              onMyCards={changeMyCards}
              busy={busy}
            />
            <TrackerCamera collector={collector} />
          </div>

          <div className="trackerpage-main">
            <ActionForm
              opponents={opponents}
              street={street}
              pot={pot}
              onPot={setPot}
              onSubmit={submitAction}
              onAddOpponent={addOpponent}
              busy={busy}
              error={formError}
            />
            <section className="trackerpage-feed" aria-label="This hand">
              <h2 className="trackerpage-subtitle">This hand</h2>
              <ActionFeed actions={hand.actions} onDelete={removeAction} busy={busy} />
            </section>
            <ShowdownPanel
              players={players}
              shown={hand.shown}
              board={hand.board}
              myCards={hand.my_cards}
              onShow={showHands}
              busy={busy}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Keyed by session, so opening a different session starts from a clean slate.
function TrackerPage() {
  const { sessionId } = useParams()
  return <TrackerSession key={sessionId} sessionId={sessionId} />
}

export default TrackerPage
