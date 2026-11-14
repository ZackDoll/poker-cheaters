import { useState } from 'react'
import PageNotice from '../components/PageNotice.jsx'
import PlayerCard from '../components/PlayerCard.jsx'
import { apiErrorText, createOpponent, listOpponents } from '../helpers/tracker.js'
import { useLoad } from '../helpers/useLoad.js'
import './OpponentsPage.css'

function OpponentsPage() {
  const [version, setVersion] = useState(0)
  const { data: players, error, loading } = useLoad(listOpponents, `opponents-${version}`)
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  async function add(event) {
    event.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      await createOpponent(name)
      setName('')
      setVersion((current) => current + 1)
    } catch (failure) {
      setAddError(apiErrorText(failure))
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="opponents-page">
      <header className="opponents-header">
        <div className="opponents-eyebrow">OPPONENTS</div>
        <h1 className="opponents-title">Player profiles</h1>
        <p className="opponents-text">
          The people you track: how often they bluff, which tells showed up before a bluff, and how readable they have
          been. Profiles fill in as you log hands and enter the cards they show.
        </p>
      </header>

      <form className="opponents-add" onSubmit={add}>
        <input
          className="opponents-add-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add an opponent by name"
          aria-label="Opponent name"
          maxLength={60}
        />
        <button className="opponents-add-button" type="submit" disabled={adding || !name.trim()}>
          Add
        </button>
      </form>
      {addError && (
        <p className="opponents-error" role="alert">
          {addError}
        </p>
      )}

      {loading && <PageNotice kind="loading" />}
      {error && <PageNotice kind="error" title="Couldn’t load profiles" text={apiErrorText(error)} />}

      {players?.length > 0 && (
        <div className="opponents-grid">
          {players.map((profile, index) => (
            <PlayerCard key={profile.opponent.id} profile={profile} index={index} />
          ))}
        </div>
      )}
      {players?.length === 0 && (
        <PageNotice
          kind="empty"
          title="No opponents yet"
          text="Add the people you play against, or add them while tracking a session."
          action={{ to: '/sessions', label: 'Track a session' }}
        />
      )}
    </div>
  )
}

export default OpponentsPage
