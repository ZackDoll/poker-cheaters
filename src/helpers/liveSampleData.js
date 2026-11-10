// Sample data for the Live page UI. Replace with real API data later.

export const SAMPLE_HAND = {
  street: 'River',
  pot: '$420',
  facingBet: '$310 · Overbet',
  board: [
    { rank: 'K', suit: 'spades' },
    { rank: '9', suit: 'hearts' },
    { rank: '4', suit: 'diamonds' },
    { rank: '2', suit: 'clubs' },
    { rank: '7', suit: 'spades' },
  ],
}

// signal tone: 'low' (green), 'mid' (gold), 'high' (coral)
export const SAMPLE_OPPONENTS = [
  {
    id: 'seat-2',
    seat: 2,
    name: 'Seat 2',
    likelihood: 31,
    verdict: 'Leans value',
    signals: [
      { label: 'Facial tension', value: 'Low', percent: 24, tone: 'low' },
      { label: 'Voice pitch shift', value: 'Low', percent: 20, tone: 'low' },
      { label: 'Bet size vs. board story', value: 'Consistent', percent: 30, tone: 'low' },
    ],
    reasons: [
      'Relaxed face compared with their baseline.',
      'Bet size fits the hands this board story represents.',
    ],
  },
  {
    id: 'seat-4',
    seat: 4,
    name: 'Seat 4',
    likelihood: 78,
    verdict: 'Leans bluff',
    signals: [
      { label: 'Facial tension', value: 'High', percent: 78, tone: 'high' },
      { label: 'Voice pitch shift', value: 'Moderate', percent: 52, tone: 'mid' },
      { label: 'Bet size vs. board story', value: 'Mismatch', percent: 70, tone: 'high' },
    ],
    reasons: [
      'Facial tension spiked at the moment of the bet.',
      'Pitch rose and pace slowed compared with earlier streets.',
      'Overbet on a dry board with few draws to represent.',
    ],
  },
  {
    id: 'seat-6',
    seat: 6,
    name: 'Seat 6',
    likelihood: 52,
    verdict: 'Mixed signals',
    signals: [
      { label: 'Facial tension', value: 'Moderate', percent: 48, tone: 'mid' },
      { label: 'Voice pitch shift', value: 'Low', percent: 22, tone: 'low' },
      { label: 'Bet size vs. board story', value: 'Mismatch', percent: 64, tone: 'high' },
    ],
    reasons: [
      'Face and voice look normal, but the sizing is unusual.',
      'Not enough hands yet to trust this player’s baseline.',
    ],
  },
]

// Returns 'low' | 'mid' | 'high' for a bluff likelihood percentage.
export function getLikelihoodTone(likelihood) {
  if (likelihood >= 65) return 'high'
  if (likelihood >= 40) return 'mid'
  return 'low'
}
