import { useEffect, useState } from 'react'
import { formatChips } from '../helpers/cards.js'
import './ActionBar.css'

// Fold / check / call / raise for the player on the clock.
// legal: { to_call, can_check, can_raise, min_raise_to, max_raise_to } or null when it is not your turn.
function ActionBar({ legal, pot, currentBet, waitingFor, onAction }) {
  // The parent remounts this for each new decision, so every one starts at the minimum raise.
  const [raiseTo, setRaiseTo] = useState(legal?.min_raise_to ?? 0)
  const myTurn = Boolean(legal)

  const callOrCheck = () => onAction(legal.can_check ? { kind: 'check' } : { kind: 'call' })

  useEffect(() => {
    if (!myTurn) return undefined
    function onKey(event) {
      if (event.target.closest('input, textarea, select') || event.metaKey || event.ctrlKey) return
      if (event.key === 'f') onAction({ kind: 'fold' })
      else if (event.key === 'c') onAction(legal.can_check ? { kind: 'check' } : { kind: 'call' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [myTurn, legal, onAction])

  if (!myTurn) {
    return (
      <div className="actionbar actionbar-idle" role="status">
        {waitingFor ? `Waiting for ${waitingFor}…` : 'Waiting for the next hand…'}
      </div>
    )
  }

  const clamp = (value) => Math.max(legal.min_raise_to, Math.min(legal.max_raise_to, Math.round(value)))
  const presets = [
    ['Min', legal.min_raise_to],
    ['½ pot', clamp(currentBet + (pot + legal.to_call) * 0.5)],
    ['Pot', clamp(currentBet + (pot + legal.to_call))],
    ['All in', legal.max_raise_to],
  ]
  const allIn = legal.can_raise && raiseTo >= legal.max_raise_to

  return (
    <div className="actionbar" role="group" aria-label="Your action">
      <button className="actionbar-button actionbar-fold" type="button" onClick={() => onAction({ kind: 'fold' })}>
        Fold <kbd>F</kbd>
      </button>
      <button className="actionbar-button actionbar-call" type="button" onClick={callOrCheck}>
        {legal.can_check ? 'Check' : `Call ${formatChips(legal.to_call)}`} <kbd>C</kbd>
      </button>

      {legal.can_raise && (
        <div className="actionbar-raise">
          <div className="actionbar-presets">
            {presets.map(([label, value]) => (
              <button
                key={label}
                className={`actionbar-preset ${raiseTo === value ? 'actionbar-preset-on' : ''}`}
                type="button"
                onClick={() => setRaiseTo(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="actionbar-slider">
            <input
              type="range"
              min={legal.min_raise_to}
              max={legal.max_raise_to}
              step={1}
              value={raiseTo}
              aria-label="Raise to"
              onChange={(event) => setRaiseTo(Number(event.target.value))}
            />
            <input
              className="actionbar-amount"
              type="number"
              min={legal.min_raise_to}
              max={legal.max_raise_to}
              value={raiseTo}
              aria-label="Raise amount"
              onChange={(event) => setRaiseTo(Number(event.target.value) || 0)}
              onKeyDown={(event) => event.key === 'Enter' && onAction({ kind: 'raise', amount: clamp(raiseTo) })}
            />
          </div>
          <button
            className="actionbar-button actionbar-raise-button"
            type="button"
            onClick={() => onAction({ kind: 'raise', amount: clamp(raiseTo) })}
          >
            {allIn ? 'All in' : currentBet > 0 ? 'Raise to' : 'Bet'} {formatChips(clamp(raiseTo))}
          </button>
        </div>
      )}
    </div>
  )
}

export default ActionBar
