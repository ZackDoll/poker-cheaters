export function createAccumulator() {
  return { count: 0, stats: new Map() }
}

export function addSample(acc, categories) {
  acc.count += 1
  for (const { categoryName: name, score } of categories) {
    if (name === '_neutral') continue
    const stat = acc.stats.get(name) || { n: 0, mean: 0, m2: 0 }
    stat.n += 1
    const delta = score - stat.mean
    stat.mean += delta / stat.n
    stat.m2 += delta * (score - stat.mean)
    acc.stats.set(name, stat)
  }
}

export function finalizeBaseline(acc) {
  return new Map([...acc.stats].map(([name, s]) => [name, {
    mean: s.mean,
    std: Math.max(0.015, Math.sqrt(s.n > 1 ? s.m2 / (s.n - 1) : 0)),
  }]))
}

export function deviations(baseline, categories) {
  return categories.filter((c) => baseline.has(c.categoryName)).map((c) => {
    const stat = baseline.get(c.categoryName)
    return { name: c.categoryName, z: (c.score - stat.mean) / stat.std }
  }).sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
}

export function deviationScore(sorted) {
  // Ordinary blinks and gaze shifts do not contribute to the headline score.
  const top = sorted.filter((r) => !/^eyeBlink|^eyeLook/.test(r.name)).slice(0, 5)
  if (!top.length) return 0
  return Math.min(10, Math.sqrt(top.reduce((sum, d) => sum + d.z ** 2, 0) / top.length) / 3 * 10)
}

