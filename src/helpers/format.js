export function formatPercent(value) {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`
}

export function formatDateTime(iso) {
  const date = new Date(iso)
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export function capitalize(text) {
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : ''
}

// 'low' | 'mid' | 'high' for a bluff likelihood percentage (0-100), used to colour reads.
export function getLikelihoodTone(likelihood) {
  if (likelihood >= 65) return 'high'
  if (likelihood >= 40) return 'mid'
  return 'low'
}
