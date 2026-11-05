import './PlayingCard.css'

const SUITS = {
  spades: {
    red: false,
    shape: (
      <path d="M12 2c4 4.5 8 7 8 11a4.5 4.5 0 0 1-7.5 3.3c.2 2 .9 3.7 2.5 5.7H9c1.600-2 2.300-3.700 2.500-5.700A4.500 4.500 0 0 1 4 13c0-4 4-6.500 8-11z" />
    ),
  },
  hearts: {
    red: true,
    shape: (
      <path d="M12 21s-7-4.4-9-9.2C1.6 8 4 5 7 5c2 0 3.4 1.1 5 3 1.6-1.900 3-3 5-3 3 0 5.400 3 4 6.800C19 16.600 12 21 12 21z" />
    ),
  },
  diamonds: {
    red: true,
    shape: <path d="M12 2l7 10-7 10-7-10z" />,
  },
  clubs: {
    red: false,
    shape: (
      <g>
        <circle cx="12" cy="7" r="4.2" />
        <circle cx="7" cy="14" r="4.2" />
        <circle cx="17" cy="14" r="4.2" />
        <path d="M12 12l-2 9h4z" />
      </g>
    ),
  },
}

function PlayingCard({ rank, suit }) {
  const { red, shape } = SUITS[suit]
  return (
    <div className={`playing-card ${red ? 'playing-card-red' : 'playing-card-black'}`}>
      <span>{rank}</span>
      <svg
        className="playing-card-suit"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        aria-label={suit}
        role="img"
      >
        {shape}
      </svg>
    </div>
  )
}

export default PlayingCard
