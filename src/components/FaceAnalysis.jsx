import { useEffect, useRef, useState } from 'react'
import { createFaceLandmarker } from '../helpers/faceLandmarker.js'
import { createAccumulator, addSample, finalizeBaseline, deviations, deviationScore } from '../helpers/baselineStats.js'
import { framingIssue, createHistory, sustainedRead, expressionSummary } from '../helpers/faceRead.js'
import './FaceAnalysis.css'

const CALIBRATION_MS = 10000

function FaceAnalysis({ videoRef }) {
  const [status, setStatus] = useState('Loading face model…')
  const [error, setError] = useState(null)
  const [tracking, setTracking] = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [hasBaseline, setHasBaseline] = useState(false)
  const [rows, setRows] = useState([])
  const [settled, setSettled] = useState(false)
  const analysis = useRef({ accumulator: null, baseline: null, elapsed: 0, history: createHistory() })

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
        } else {
          setRows([])
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

  function calibrate() {
    analysis.current = { accumulator: createAccumulator(), baseline: null, elapsed: 0, history: createHistory() }
    setSettled(false)
    setProgress(0)
    setRows([])
    setHasBaseline(false)
    setCalibrating(true)
  }

  return (
    <section className="face-analysis" aria-label="Facial expression analysis">
      <h3 className="face-analysis-title">Facial expression analysis</h3>
      <p className="face-analysis-note">Calibrate your relaxed face for about 10 seconds. Only well-framed samples count. Keep lighting and camera position steady; relax and blink naturally.</p>
      {error ? <p className="face-analysis-error" role="alert">{error}</p> : (
        <>
          <button className="face-analysis-button" type="button" onClick={calibrate} disabled={!tracking || calibrating}>
            {calibrating ? 'Calibrating…' : hasBaseline ? 'Recalibrate' : 'Calibrate neutral face'}
          </button>
          <p className="face-analysis-status" role="status">{status}</p>
          {calibrating && <progress className="face-analysis-progress" max={CALIBRATION_MS} value={progress} aria-label="Calibration progress" />}
          {hasBaseline && tracking && !settled && <p className="face-analysis-status">Collecting a steady read…</p>}
          {tracking && settled && rows.length > 0 && (
            <>
              <p className="face-analysis-score"><strong>{deviationScore(rows).toFixed(1)} / 10</strong> sustained expression change</p>
              <p className="face-analysis-summary">{expressionSummary(rows)}</p>
              <ul className="face-analysis-list">
                {rows.slice(0, 6).map(({ name, z }) => (
                  <li className="face-analysis-row" key={name}>
                    <span>{name.replace(/([A-Z])/g, ' $1')}</span>
                    <meter className="face-analysis-meter" min="0" max="4" value={Math.min(4, Math.abs(z))} aria-label={`${name} deviation magnitude`} />
                    <span>{z >= 0 ? '+' : ''}{z.toFixed(1)}σ</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <p className="face-analysis-note">Readings average the last 1.5 seconds. Normal blinks and gaze shifts are excluded from the headline score. This score describes estimated expression changes. It does not determine mood or bluff probability.</p>
    </section>
  )
}

export default FaceAnalysis

