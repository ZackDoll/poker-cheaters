import { useEffect, useState } from 'react'

const THRESHOLD = 0.04
const INTERVAL_MS = 100

// True while the audio in `stream` is loud enough to be someone talking.
export function useSpeaking(stream) {
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!stream || !AudioContextClass || stream.getAudioTracks().length === 0) return undefined

    const context = new AudioContextClass()
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)
    let frame
    let last = 0
    let current = false

    function tick(now) {
      frame = requestAnimationFrame(tick)
      if (now - last < INTERVAL_MS) return
      last = now
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const value of samples) sum += ((value - 128) / 128) ** 2
      const loud = Math.sqrt(sum / samples.length) > THRESHOLD
      if (loud !== current) {
        current = loud
        setSpeaking(loud)
      }
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      source.disconnect()
      context.close()
      setSpeaking(false)
    }
  }, [stream])

  return speaking
}
