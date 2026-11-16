// Keeps the last few seconds of face samples from useFaceRead and boils them down to the
// derived scores the server accepts. Raw video and landmarks never leave the browser; this
// holds only { time, ready, score, rows } for each analysed frame.

const WINDOW_MS = 6000
const MIN_READY_SAMPLES = 3

export function createFaceCollector() {
  const samples = []

  return {
    // sample is what useFaceRead reports: { tracking, score, rows: [{ name, z }] }.
    // A frame is "ready" once the face is tracked, a baseline exists and the read has settled
    // (the hook reports rows only then).
    push(sample, now = performance.now()) {
      samples.push({ time: now, ready: sample.tracking && sample.rows.length > 0, score: sample.score, rows: sample.rows })
      while (samples.length && samples[0].time < now - WINDOW_MS) samples.shift()
    },

    clear() {
      samples.length = 0
    },

    // { samples, trackedRatio, meanScore, deviations } or null when there is too little to read.
    summary(now = performance.now()) {
      const recent = samples.filter((s) => s.time >= now - WINDOW_MS)
      const ready = recent.filter((s) => s.ready)
      if (ready.length < MIN_READY_SAMPLES) return null

      const totals = new Map()
      for (const sample of ready) {
        for (const { name, z } of sample.rows) {
          const entry = totals.get(name) ?? { sum: 0, count: 0 }
          entry.sum += z
          entry.count += 1
          totals.set(name, entry)
        }
      }
      const deviations = [...totals]
        .map(([name, { sum, count }]) => ({ name, z: Math.round((sum / count) * 100) / 100 }))
        .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
        .slice(0, 12)

      return {
        samples: ready.length,
        trackedRatio: Math.round((ready.length / recent.length) * 100) / 100,
        meanScore: Math.round((ready.reduce((sum, s) => sum + s.score, 0) / ready.length) * 100) / 100,
        deviations,
      }
    },
  }
}
