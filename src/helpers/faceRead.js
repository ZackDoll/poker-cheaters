// These are conservative framing heuristics, not model confidence estimates.
export function framingIssue(points) {
  if (!points?.length) return 'No face detected — face the camera.'
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const width = Math.max(...xs) - Math.min(...xs)
  if (width < 0.18) return 'Move closer so your face fills more of the preview.'
  if (Math.min(...xs) < 0.02 || Math.max(...xs) > 0.98 || Math.min(...ys) < 0.02 || Math.max(...ys) > 0.98) {
    return 'Keep your whole face inside the preview.'
  }
  const left = points[33]
  const right = points[263]
  const nose = points[1]
  if (!left || !right || !nose) return 'Waiting for complete face tracking.'
  const span = Math.abs(right.x - left.x)
  if (span < 0.04 || Math.abs(right.y - left.y) / span > 0.35) return 'Keep your head upright and face the camera.'
  if (Math.abs(nose.x - (left.x + right.x) / 2) / span > 0.3) return 'Turn toward the camera for a steadier read.'
  return null
}

export function createHistory() {
  return []
}

// Average signed deviations over a short time window. Opposite movements cancel;
// an isolated twitch has less influence than a sustained change.
export function sustainedRead(history, now, rows) {
  history.push({ time: now, rows })
  while (history.length && history[0].time < now - 1500) history.shift()
  const totals = new Map()
  for (const sample of history) {
    for (const row of sample.rows) {
      const item = totals.get(row.name) || { name: row.name, sum: 0, count: 0 }
      item.sum += Math.max(-6, Math.min(6, row.z))
      item.count += 1
      totals.set(row.name, item)
    }
  }
  return {
    ready: history.length > 1 && now - history[0].time >= 1000,
    rows: [...totals.values()].map((r) => ({ name: r.name, z: r.sum / r.count }))
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z)),
  }
}

export function expressionSummary(rows) {
  const groups = [
    ['Brow movement', /brow/],
    ['Lip movement', /mouthPress|mouthPucker|mouthFunnel|mouthRoll|mouthShrug/],
    ['Smile movement', /mouthSmile|mouthDimple/],
    ['Jaw movement', /jaw/],
    ['Eye narrowing', /eyeSquint/],
  ]
  return groups.map(([label, pattern]) => ({
    label,
    strength: Math.max(0, ...rows.filter((r) => pattern.test(r.name)).map((r) => Math.abs(r.z))),
  })).filter((g) => g.strength >= 2).sort((a, b) => b.strength - a.strength).slice(0, 2)
    .map((g) => g.label).join(' and ') || 'Expressions close to your resting baseline'
}
