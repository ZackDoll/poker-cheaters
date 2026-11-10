import SignalCard from './SignalCard.jsx'
import './SignalsSection.css'

const ICON_PROPS = {
  width: 36,
  height: 36,
  viewBox: '0 0 36 36',
  fill: 'none',
  stroke: '#F4C95D',
  strokeWidth: 2,
  'aria-hidden': 'true',
}

const SIGNALS = [
  {
    title: 'Facial cues',
    text: 'Tracks micro-expressions, eye movement and tension shifts, and compares each player to their own baseline instead of a generic average.',
    icon: (
      <svg {...ICON_PROPS} strokeLinecap="round">
        <circle cx="18" cy="18" r="13" />
        <circle cx="13" cy="15" r="1.5" fill="#F4C95D" />
        <circle cx="23" cy="15" r="1.5" fill="#F4C95D" />
        <path d="M12 23q6 5 12 0" />
      </svg>
    ),
  },
  {
    title: 'Vocal cues',
    text: 'Listens for changes in pitch, pace, hesitation and breath when a player talks, calls the clock or makes a bet announcement.',
    icon: (
      <svg {...ICON_PROPS} strokeLinecap="round">
        <path d="M5 18v0M10 13v10M15 8v20M20 12v12M25 6v24M31 15v6" />
      </svg>
    ),
  },
  {
    title: 'Board scanning',
    text: 'Your camera reads the community cards as they land, then scores texture, draws and the hands a given line would actually represent.',
    icon: (
      <svg {...ICON_PROPS} strokeLinejoin="round">
        <rect x="6" y="5" width="15" height="22" rx="3" />
        <rect x="15" y="9" width="15" height="22" rx="3" fill="#12201B" />
      </svg>
    ),
  },
  {
    title: 'Bet-size analysis',
    text: 'Reads sizing against pot, stack depth and board, then flags bets that tell a story the rest of the signals do not back up.',
    icon: (
      <svg {...ICON_PROPS} strokeLinecap="round">
        <ellipse cx="18" cy="12" rx="11" ry="5" />
        <path d="M7 12v6c0 2.8 5 5 11 5s11-2.2 11-5v-6M7 18v6c0 2.8 5 5 11 5s11-2.2 11-5v-6" />
      </svg>
    ),
  },
]

function SignalsSection() {
  return (
    <section className="signals-section" id="signals">
      <div className="signals-inner">
        <div className="signals-intro">
          <div className="signals-eyebrow">FOUR SIGNALS, ONE READ</div>
          <h2 className="signals-title">A tell is never just one thing.</h2>
          <p className="signals-text">
            Players hide a lot. They rarely hide everything at once. Tell
            cross-checks what the body gives away against what the cards and
            the chips say.
          </p>
        </div>
        <div className="signals-grid">
          {SIGNALS.map((signal) => (
            <SignalCard key={signal.title} {...signal} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default SignalsSection
