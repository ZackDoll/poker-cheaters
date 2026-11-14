import { useFaceRead, CALIBRATION_MS } from '../helpers/useFaceRead.js'
import { deviationScore } from '../helpers/baselineStats.js'
import { expressionSummary } from '../helpers/faceRead.js'
import './FaceAnalysis.css'

function FaceAnalysis({ videoRef }) {
  const { status, error, tracking, calibrating, progress, hasBaseline, rows, settled, calibrate } =
    useFaceRead(videoRef)

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
