import { useState } from 'react'
import { capitalize } from '../helpers/format.js'
import './ActionForm.css'

const ACTIONS = ['fold', 'check', 'call', 'bet', 'raise']
const POSITIONS = [
  ['early', 'Early'],
  ['middle', 'Middle'],
  ['late', 'Late'],
]

// Logs what one opponent just did. onSubmit gets the action fields and returns a promise.
// pot is the last pot size entered, kept so you only retype it when it changes.
function ActionForm({ opponents, street, pot, onPot, onSubmit, onAddOpponent, busy, error }) {
  const [opponentId, setOpponentId] = useState('')
  const [action, setAction] = useState('bet')
  const [betSize, setBetSize] = useState('')
  const [activePlayers, setActivePlayers] = useState('2')
  const [position, setPosition] = useState('')
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState(null)

  const needsBet = action === 'call' || action === 'bet' || action === 'raise'
  const needsPot = action === 'bet' || action === 'raise'
  const selected = opponents.some((o) => o.id === opponentId) ? opponentId : (opponents[0]?.id ?? '')

  async function submit(event) {
    event.preventDefault()
    const logged = await onSubmit({
      opponentId: selected,
      action,
      betSize: needsBet ? Number(betSize) : 0,
      potSize: needsPot ? Number(pot) : 0,
      activePlayers: Number(activePlayers) || null,
      position: street === 'preflop' && position ? position : null,
    })
    if (logged) setBetSize('')
  }

  async function addOpponent(event) {
    event.preventDefault()
    setAddError(null)
    const created = await onAddOpponent(newName)
    if (created.error) {
      setAddError(created.error)
      return
    }
    setOpponentId(created.id)
    setNewName('')
  }

  return (
    <section className="actionform" aria-label="Log an action">
      <h2 className="actionform-title">What did they do?</h2>

      <div className="actionform-field">
        <span className="actionform-label">Opponent</span>
        <div className="actionform-chips" role="radiogroup" aria-label="Opponent">
          {opponents.map((opponent) => (
            <button
              key={opponent.id}
              type="button"
              role="radio"
              aria-checked={opponent.id === selected}
              className={`actionform-chip ${opponent.id === selected ? 'actionform-chip-on' : ''}`}
              onClick={() => setOpponentId(opponent.id)}
            >
              {opponent.name}
            </button>
          ))}
        </div>
        <form className="actionform-add" onSubmit={addOpponent}>
          <input
            className="actionform-input"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={opponents.length ? 'Add another opponent' : 'Add your first opponent'}
            aria-label="New opponent name"
            maxLength={60}
          />
          <button className="actionform-add-button" type="submit" disabled={!newName.trim()}>
            Add
          </button>
        </form>
        {addError && (
          <p className="actionform-error" role="alert">
            {addError}
          </p>
        )}
      </div>

      <form className="actionform-fields" onSubmit={submit}>
        <div className="actionform-field">
          <span className="actionform-label">Action · {capitalize(street)}</span>
          <div className="actionform-chips" role="radiogroup" aria-label="Action">
            {ACTIONS.map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={name === action}
                className={`actionform-chip ${name === action ? 'actionform-chip-on' : ''}`}
                onClick={() => setAction(name)}
              >
                {capitalize(name)}
              </button>
            ))}
          </div>
        </div>

        <div className="actionform-row">
          {needsBet && (
            <label className="actionform-field">
              <span className="actionform-label">{action === 'call' ? 'Called' : 'Bet size'}</span>
              <input
                className="actionform-input"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={betSize}
                onChange={(event) => setBetSize(event.target.value)}
                required
              />
            </label>
          )}
          {needsPot && (
            <label className="actionform-field">
              <span className="actionform-label">Pot before the bet</span>
              <input
                className="actionform-input"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={pot}
                onChange={(event) => onPot(event.target.value)}
                required
              />
            </label>
          )}
          <label className="actionform-field">
            <span className="actionform-label">Players in</span>
            <input
              className="actionform-input"
              type="number"
              inputMode="numeric"
              min="2"
              max="10"
              value={activePlayers}
              onChange={(event) => setActivePlayers(event.target.value)}
            />
          </label>
          {street === 'preflop' && (
            <label className="actionform-field">
              <span className="actionform-label">Position</span>
              <select className="actionform-input" value={position} onChange={(event) => setPosition(event.target.value)}>
                <option value="">Not sure</option>
                {POSITIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {error && (
          <p className="actionform-error" role="alert">
            {error}
          </p>
        )}
        <button className="actionform-submit" type="submit" disabled={busy || !selected}>
          {busy ? 'Logging…' : 'Log action'}
        </button>
      </form>
    </section>
  )
}

export default ActionForm
