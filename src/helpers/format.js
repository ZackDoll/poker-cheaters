export function formatPercent(value) {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`
}

export function formatDateTime(iso) {
  const date = new Date(iso)
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export function formatNet(chips) {
  if (chips === null || chips === undefined) return '—'
  return `${chips > 0 ? '+' : ''}${chips.toLocaleString('en-US')}`
}

export function netTone(chips) {
  if (!chips) return 'flat'
  return chips > 0 ? 'up' : 'down'
}

export function errorText(error) {
  if (error?.response?.status === 401 || error?.response?.status === 503) {
    return 'Could not reach the game server. Check that you are signed in and the backend is running.'
  }
  return 'Something went wrong loading this page. Try again in a moment.'
}
