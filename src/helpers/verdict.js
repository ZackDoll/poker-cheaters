// How a bluff read compared with the cards, once they were shown. Null until then, and for
// actions that were never given a read (folds, checks, calls).
export function verdictOf(action) {
  if (action.probability === null || action.was_bluff === null) return null
  const hit = action.was_bluff === action.probability >= 0.5
  return {
    text: `${action.was_bluff ? 'Bluff' : 'Value bet'} · read ${hit ? 'held up' : 'missed'}`,
    hit,
  }
}
