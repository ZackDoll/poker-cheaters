import { useCallback, useEffect, useRef, useState } from 'react'
import { createFaceLandmarker } from './faceLandmarker.js'
import {
  createAccumulator,
  addSample,
  finalizeBaseline,
  deviations,
  deviationScore,
} from './baselineStats.js'
import { framingIssue, createHistory, sustainedRead } from './faceRead.js'

export const CALIBRATION_MS = 10000

// Runs the in-browser face model on a <video> element: calibrates a neutral baseline,
// then reports how far the face moves from it. Nothing leaves the browser.
//
// onSample (optional) is called for every analysed frame with
//   { tracking, score, rows }  where rows are { name, z } sorted by strength.
// score is the 0-10 sustained expression change, or 0 while there is no baseline.
export function useFaceRead(videoRef, onSample) {
  const [status, setStatus] = useState('Loading face model…')
  const [error, setError] = useState(null)
  const [tracking, setTracking] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [hasBaseline, setHasBaseline] = useState(false)
  const [rows, setRows] = useState([])
  const [settled, setSettled] = useState(false)
  const analysis = useRef({ accumulator: null, baseline: null, elapsed: 0, history: createHistory() })
  const sampleRef = useRef(onSample)

  useEffect(() => {
    sampleRef.current = onSample
  }, [onSample])

  useEffect(() => {
    const state = { cancelled: false, model: null, frame: null, lastTime: -1, lastRun: 0, smoothed: null }

    function loop(now) {
      if (state.cancelled) return
      state.frame = requestAnimationFrame(loop)
      const video = videoRef.current
      if (!video || video.readyState < 2 || video.paused || now - state.lastRun < 65 || video.currentTime === state.lastTime) return
      const elapsed = Math.min(150, state.lastRun ? now - state.lastRun : 0)
      state.lastRun = now
      state.lastTime = video.currentTime
      try {
        const result = state.model.detectForVideo(video, now)
        const found = result.faceBlendshapes?.[0]?.categories
        const issue = framingIssue(result.faceLandmarks?.[0])
        if (!found?.length || issue) {
          state.smoothed = null
          analysis.current.history = createHistory()
          setSettled(false)
          setTracking(false)
          setRows([])
          setStatus((issue || 'No face detected.') + ' Read paused.')
          sampleRef.current?.({ tracking: false, score: 0, rows: [] })
          return
        }
        const prior = state.smoothed
        const alpha = 1 - Math.exp(-elapsed / 180)
        const categories = found.map((c) => ({ ...c,
          score: prior?.has(c.categoryName) ? prior.get(c.categoryName) + alpha * (c.score - prior.get(c.categoryName)) : c.score,
        }))
        state.smoothed = new Map(categories.map((c) => [c.categoryName, c.score]))
        setTracking(true)
        const current = analysis.current
        if (current.accumulator) {
          addSample(current.accumulator, categories)
          current.elapsed += prior ? elapsed : 0
          setProgress(current.elapsed)
          setStatus('Hold a relaxed, neutral face…')
          if (current.elapsed >= CALIBRATION_MS && current.accumulator.count >= 60) {
            current.baseline = finalizeBaseline(current.accumulator)
            current.accumulator = null
            setCalibrating(false)
            setHasBaseline(true)
          }
        } else {
          setStatus(current.baseline ? 'Tracking changes from your baseline' : 'Face detected — calibrate to begin')
        }
        if (current.baseline) {
          const read = sustainedRead(current.history, now, deviations(current.baseline, categories))
          setRows(read.rows)
          setSettled(read.ready)
          sampleRef.current?.({
            tracking: true,
            score: read.ready ? deviationScore(read.rows) : 0,
            rows: read.ready ? read.rows : [],
          })
        } else {
          setRows([])
          sampleRef.current?.({ tracking: true, score: 0, rows: [] })
        }
      } catch {
        cancelAnimationFrame(state.frame)
        setTracking(false)
        setRows([])
        setError('Face analysis stopped. End the session and start again to retry.')
      }
    }

    async function start() {
      try {
        const model = await createFaceLandmarker()
        if (state.cancelled) {
          model.close()
          return
        }
        state.model = model
        state.frame = requestAnimationFrame(loop)
      } catch {
        if (!state.cancelled) setError('Could not load face analysis. Check your internet connection, then restart the session.')
      }
    }
    start()
    return () => {
      state.cancelled = true
      cancelAnimationFrame(state.frame)
      state.model?.close()
    }
  }, [videoRef])

  const calibrate = useCallback(() => {
    analysis.current = { accumulator: createAccumulator(), baseline: null, elapsed: 0, history: createHistory() }
    setSettled(false)
    setProgress(0)
    setRows([])
    setHasBaseline(false)
    setCalibrating(true)
  }, [])

  return { status, error, tracking, calibrating, progress, hasBaseline, rows, settled, calibrate }
}
