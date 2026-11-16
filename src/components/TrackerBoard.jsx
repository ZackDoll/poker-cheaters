import { useState } from 'react'
import CardPicker from './CardPicker.jsx'
import PlayingCard from './PlayingCard.jsx'
import { capitalize } from '../helpers/format.js'
import { STREET_BY_BOARD_SIZE, parseCard } from '../helpers/cards.js'
import './TrackerBoard.css'

// What to enter next, by how many board cards are showing.
const NEXT_STREET = { 0: { name: 'flop', count: 3 }, 3: { name: 'turn', count: 1 }, 4: { name: 'river', count: 1 } }

function Slots({ cards, total }) {
  return Array.from({ length: total }, (_, index) =>
    cards[index] ? (
      <PlayingCard key={cards[index]} size="md" {...parseCard(cards[index])} />
    ) : (
      <span className="trackerboard-empty" key={`empty-${index}`} aria-hidden="true"></span>
    ),
  )
}

// The board for the current hand, plus your own two cards (optional, they sharpen blocker reads).
// onBoard / onMyCards receive the full new list and return a promise; busy locks the buttons.
function TrackerBoard({ board, myCards, onBoard, onMyCards, busy }) {
  const [picker, setPicker] = useState(null) // 'board' | 'mine' | null
  const next = NEXT_STREET[board.length]
  const street = STREET_BY_BOARD_SIZE[board.length]
  const used = [...board, ...myCards]

  async function confirm(cards) {
    const target = picker
    setPicker(null)
    if (target === 'board') await onBoard([...board, ...cards])
    else await onMyCards(cards)
  }

  function undoStreet() {
    const keep = board.length === 3 ? 0 : board.length - 1
    return onBoard(board.slice(0, keep))
  }

  return (
    <section className="trackerboard" aria-label="Board">
      <header className="trackerboard-header">
        <h2 className="trackerboard-title">Board</h2>
        <span className="trackerboard-street">{capitalize(street)}</span>
      </header>

      <div className="trackerboard-cards">
        <Slots cards={board} total={5} />
      </div>

      <div className="trackerboard-actions">
        {next && (
          <button className="trackerboard-button trackerboard-primary" type="button" disabled={busy} onClick={() => setPicker('board')}>
            Add {next.name}
          </button>
        )}
        {board.length > 0 && (
          <button className="trackerboard-button" type="button" disabled={busy} onClick={undoStreet}>
            Remove {street}
          </button>
        )}
      </div>

      <div className="trackerboard-mine">
        <span className="trackerboard-label">Your cards</span>
        <div className="trackerboard-cards">
          <Slots cards={myCards} total={2} />
        </div>
        <button className="trackerboard-button" type="button" disabled={busy} onClick={() => setPicker('mine')}>
          {myCards.length ? 'Change' : 'Add your cards'}
        </button>
      </div>

      {picker === 'board' && (
        <CardPicker title={`Add the ${next.name}`} count={next.count} used={used} onConfirm={confirm} onCancel={() => setPicker(null)} />
      )}
      {picker === 'mine' && (
        <CardPicker
          title="Your two cards"
          count={2}
          used={board}
          onConfirm={confirm}
          onCancel={() => setPicker(null)}
        />
      )}
    </section>
  )
}

export default TrackerBoard
