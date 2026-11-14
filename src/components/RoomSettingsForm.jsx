import { formatChips } from '../helpers/cards.js'
import './RoomSettingsForm.css'

const STACKS = [1000, 2500, 5000]
const BLINDS = [
  [5, 10],
  [10, 20],
  [25, 50],
]
const READS = [
  { value: 'open', title: 'Open reads', text: 'Everyone sees the live bluff read on a bettor.' },
  { value: 'hidden', title: 'Sealed reads', text: 'Reads are revealed with the answer after each hand.' },
]

function Choice({ selected, onClick, children }) {
  return (
    <button
      className={`room-settings-choice ${selected ? 'room-settings-choice-on' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// Table settings. Used when creating a room and by the host before play starts.
function RoomSettingsForm({ value, onChange, disabled = false }) {
  const set = (patch) => onChange({ ...value, ...patch })

  return (
    <fieldset className="room-settings" disabled={disabled}>
      <div className="room-settings-group">
        <span className="room-settings-label">Starting stack</span>
        <div className="room-settings-row">
          {STACKS.map((stack) => (
            <Choice key={stack} selected={value.starting_stack === stack} onClick={() => set({ starting_stack: stack })}>
              {formatChips(stack)}
            </Choice>
          ))}
        </div>
      </div>
      <div className="room-settings-group">
        <span className="room-settings-label">Blinds</span>
        <div className="room-settings-row">
          {BLINDS.map(([small, big]) => (
            <Choice
              key={big}
              selected={value.big_blind === big}
              onClick={() => set({ small_blind: small, big_blind: big })}
            >
              {small} / {big}
            </Choice>
          ))}
        </div>
      </div>
      <div className="room-settings-group">
        <span className="room-settings-label">Bluff reads</span>
        <div className="room-settings-row room-settings-row-wide">
          {READS.map((option) => (
            <Choice key={option.value} selected={value.reads === option.value} onClick={() => set({ reads: option.value })}>
              <strong className="room-settings-choice-title">{option.title}</strong>
              <span className="room-settings-choice-text">{option.text}</span>
            </Choice>
          ))}
        </div>
      </div>
    </fieldset>
  )
}

export default RoomSettingsForm
