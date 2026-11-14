import { useState } from 'react'
import RoomSettingsForm from './RoomSettingsForm.jsx'
import './RoomWaiting.css'

// Shown over the felt before play starts: the room code to share, the table settings,
// and the host's start button.
function RoomWaiting({ room, playerCount, isHost, onStart, onSettings, error }) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(room.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked; the code is on screen to read out.
    }
  }

  const { settings } = room

  return (
    <div className="roomwaiting">
      <span className="roomwaiting-label">ROOM CODE</span>
      <button className="roomwaiting-code" type="button" onClick={copy} aria-label={`Copy room code ${room.code}`}>
        {[...room.code].map((char, index) => (
          <span key={index} className="roomwaiting-char" style={{ animationDelay: `${index * 60}ms` }}>
            {char}
          </span>
        ))}
      </button>
      <span className="roomwaiting-copied" role="status">{copied ? 'Copied!' : 'Click the code to copy it'}</span>

      <p className="roomwaiting-summary">
        {playerCount} of 6 seated · {settings.small_blind}/{settings.big_blind} blinds ·{' '}
        {settings.starting_stack.toLocaleString()} chips ·{' '}
        {settings.reads === 'open' ? 'open reads' : 'sealed reads'}
      </p>

      {isHost ? (
        <>
          {editing && <RoomSettingsForm value={settings} onChange={onSettings} />}
          {error && <p className="roomwaiting-error" role="alert">{error}</p>}
          <div className="roomwaiting-actions">
            <button className="roomwaiting-secondary" type="button" onClick={() => setEditing((current) => !current)}>
              {editing ? 'Done' : 'Table settings'}
            </button>
            <button className="roomwaiting-start" type="button" onClick={onStart} disabled={playerCount < 2}>
              {playerCount < 2 ? 'Waiting for a second player…' : 'Deal the first hand'}
            </button>
          </div>
        </>
      ) : (
        <p className="roomwaiting-guest" role="status">Waiting for the host to start the game…</p>
      )}
    </div>
  )
}

export default RoomWaiting
