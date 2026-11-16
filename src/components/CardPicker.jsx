import { useEffect, useRef, useState } from 'react'
import { RANKS, SUITS, SUIT_NAMES, SUIT_SYMBOLS, cardText } from '../helpers/cards.js'
import './CardPicker.css'

// A dialog for entering exactly `count` cards. `used` are cards already placed elsewhere on the
// table, so the same card can't be entered twice. onConfirm gets the chosen codes ("As", "Td").
function CardPicker({ title, count, used = [], onConfirm, onCancel }) {
  const [chosen, setChosen] = useState([])
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current?.focus()
    function onKey(event) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function toggle(code) {
    setChosen((current) => {
      if (current.includes(code)) return current.filter((c) => c !== code)
      return current.length < count ? [...current, code] : current
    })
  }

  return (
    <div className="cardpicker-backdrop" onClick={onCancel}>
      <div
        className="cardpicker"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cardpicker-header">
          <h2 className="cardpicker-title">{title}</h2>
          <span className="cardpicker-count">
            {chosen.length} of {count}
          </span>
        </header>

        <div className="cardpicker-grid">
          {SUITS.map((suit) => (
            <div className="cardpicker-row" key={suit}>
              {RANKS.map((rank) => {
                const code = rank + suit
                const taken = used.includes(code)
                const selected = chosen.includes(code)
                return (
                  <button
                    key={code}
                    type="button"
                    className={`cardpicker-card cardpicker-${suit === 'h' || suit === 'd' ? 'red' : 'black'} ${selected ? 'cardpicker-selected' : ''}`}
                    disabled={taken}
                    aria-pressed={selected}
                    aria-label={`${rank === 'T' ? '10' : rank} of ${SUIT_NAMES[suit]}${taken ? ' (already used)' : ''}`}
                    onClick={() => toggle(code)}
                  >
                    {rank === 'T' ? '10' : rank}
                    <span aria-hidden="true">{SUIT_SYMBOLS[suit]}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <p className="cardpicker-chosen" aria-live="polite">
          {chosen.length ? chosen.map(cardText).join('  ') : 'Tap cards to choose them'}
        </p>

        <footer className="cardpicker-actions">
          <button className="cardpicker-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="cardpicker-button cardpicker-primary"
            type="button"
            disabled={chosen.length !== count}
            onClick={() => onConfirm(chosen)}
          >
            Confirm
          </button>
        </footer>
      </div>
    </div>
  )
}

export default CardPicker
