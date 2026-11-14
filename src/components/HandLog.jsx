import { useEffect, useRef } from 'react'
import './HandLog.css'

// A scrolling feed of what has happened: actions, streets, reads and results.
function HandLog({ entries, open, onClose }) {
  const listRef = useRef(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [entries, open])

  return (
    <aside className={`handlog ${open ? 'handlog-open' : ''}`} aria-label="Hand log" aria-hidden={!open}>
      <div className="handlog-header">
        <span>HAND LOG</span>
        <button className="handlog-close" type="button" onClick={onClose} aria-label="Close hand log" tabIndex={open ? 0 : -1}>
          ×
        </button>
      </div>
      <ol className="handlog-list" ref={listRef}>
        {entries.length === 0 && <li className="handlog-empty">Nothing yet. Start a hand.</li>}
        {entries.map((entry) => (
          <li key={entry.id} className={`handlog-entry handlog-${entry.tone}`}>
            {entry.text}
          </li>
        ))}
      </ol>
    </aside>
  )
}

export default HandLog
