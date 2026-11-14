import { useRef } from 'react'
import './RoomCodeInput.css'

const LENGTH = 6
const ALLOWED = /[^A-Z0-9]/g

// Six boxes for a room code. Typing advances, backspace retreats, and pasting fills them all.
// shake plays a short error animation; change its value to replay it.
function RoomCodeInput({ value, onChange, onSubmit, shake }) {
  const refs = useRef([])
  const chars = value.padEnd(LENGTH, ' ').split('')

  function focus(index) {
    refs.current[Math.max(0, Math.min(LENGTH - 1, index))]?.focus()
  }

  function setAt(index, char) {
    const next = chars.slice()
    next[index] = char || ' '
    onChange(next.join('').trimEnd())
  }

  function handleChange(index, event) {
    const typed = event.target.value.toUpperCase().replace(ALLOWED, '')
    if (!typed) return setAt(index, '')
    if (typed.length > 1) return fillFrom(index, typed)
    setAt(index, typed)
    focus(index + 1)
  }

  function fillFrom(index, text) {
    const next = value.padEnd(LENGTH, ' ').split('')
    for (const [offset, char] of [...text].slice(0, LENGTH - index).entries()) next[index + offset] = char
    onChange(next.join('').trimEnd())
    focus(index + text.length)
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && chars[index] === ' ') {
      event.preventDefault()
      setAt(index - 1, '')
      focus(index - 1)
    } else if (event.key === 'ArrowLeft') focus(index - 1)
    else if (event.key === 'ArrowRight') focus(index + 1)
    else if (event.key === 'Enter') onSubmit?.()
  }

  function handlePaste(index, event) {
    event.preventDefault()
    fillFrom(index, event.clipboardData.getData('text').toUpperCase().replace(ALLOWED, ''))
  }

  return (
    <div className="room-code" role="group" aria-label="Room code" key={shake}>
      <div className={`room-code-boxes ${shake ? 'room-code-shake' : ''}`}>
        {chars.map((char, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node
            }}
            className={`room-code-box ${char.trim() ? 'room-code-box-filled' : ''}`}
            style={{ animationDelay: `${index * 45}ms` }}
            value={char.trim()}
            maxLength={LENGTH}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label={`Character ${index + 1}`}
            onChange={(event) => handleChange(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onFocus={(event) => event.target.select()}
          />
        ))}
      </div>
    </div>
  )
}

export default RoomCodeInput
