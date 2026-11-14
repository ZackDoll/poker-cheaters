import { useState } from 'react'
import CardPicker from './CardPicker.jsx'
import PlayingCard from './PlayingCard.jsx'
import { parseCard } from '../helpers/cards.js'
import './ShowdownPanel.css'

// Record the cards an opponent turned over. That is what scores their bets: once both cards
// are in, each bet or raise they made this hand is labelled bluff or value.
// players: the opponents who acted this hand. shown: { opponentId: [card, card] }.
function ShowdownPanel({ players, shown, board, myCards, onShow, busy }) {
  const [picking, setPicking] = useState(null) // opponent being entered

  if (players.length === 0) return null

  // Every card already on the table, except the hand being edited.
  const usedBy = (id) => [
    ...board,
    ...myCards,
    ...Object.entries(shown)
      .filter(([otherId]) => otherId !== id)
      .flatMap(([, cards]) => cards),
  ]

  async function confirm(cards) {
    const id = picking.id
    setPicking(null)
    await onShow({ ...shown, [id]: cards })
  }

  function clear(id) {
    const { [id]: _removed, ...rest } = shown
    return onShow(rest)
  }

  return (
    <section className="showdown" aria-label="Showdown">
      <h2 className="showdown-title">Showdown</h2>
      <p className="showdown-text">
        If an opponent showed their cards, enter them. That is how their bets get scored as a bluff or a value bet.
      </p>
      <ul className="showdown-list">
        {players.map((player) => {
          const cards = shown[player.id]
          return (
            <li className="showdown-row" key={player.id}>
              <span className="showdown-name">{player.name}</span>
              {cards ? (
                <span className="showdown-cards">
                  {cards.map((code) => (
                    <PlayingCard key={code} size="sm" {...parseCard(code)} />
                  ))}
                </span>
              ) : (
                <span className="showdown-none">Not shown</span>
              )}
              <button className="showdown-button" type="button" disabled={busy} onClick={() => setPicking(player)}>
                {cards ? 'Change' : 'Enter cards'}
              </button>
              {cards && (
                <button className="showdown-button" type="button" disabled={busy} onClick={() => clear(player.id)}>
                  Clear
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {picking && (
        <CardPicker
          title={`${picking.name}’s cards`}
          count={2}
          used={usedBy(picking.id)}
          onConfirm={confirm}
          onCancel={() => setPicking(null)}
        />
      )}
    </section>
  )
}

export default ShowdownPanel
