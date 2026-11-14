import { useEffect, useRef } from 'react'
import { CALIBRATION_MS } from '../helpers/useFaceRead.js'
import './GreenRoom.css'

function Check({ ok, children }) {
  return (
    <li className={`greenroom-check ${ok ? 'greenroom-check-ok' : ''}`}>
      <span className="greenroom-check-mark" aria-hidden="true">
        {ok ? '✓' : '·'}
      </span>
      {children}
    </li>
  )
}

// The step before sitting down: check camera and mic, calibrate your neutral face,
// and agree to how your expression data is used.
function GreenRoom({
  code,
  stream,
  mediaError,
  mic,
  cam,
  onToggleMic,
  onToggleCam,
  face,
  consent,
  onConsent,
  joining,
  onJoin,
  onJoinWithoutCamera,
  onRetryMedia,
}) {
  const previewRef = useRef(null)

  useEffect(() => {
    const video = previewRef.current
    if (video) video.srcObject = stream || null
  }, [stream])

  const ready = Boolean(stream) && consent

  return (
    <div className="greenroom">
      <header className="greenroom-header">
        <div className="greenroom-eyebrow">ROOM {code}</div>
        <h1 className="greenroom-title">Check in before you sit.</h1>
      </header>

      <div className="greenroom-body">
        <div className="greenroom-preview">
          <div className="greenroom-frame">
            <video ref={previewRef} className="greenroom-video" autoPlay playsInline muted aria-label="Your camera preview" />
            {(!stream || !cam) && (
              <div className="greenroom-off">{mediaError || (stream ? 'Camera is off' : 'Starting camera…')}</div>
            )}
          </div>
          <div className="greenroom-toggles">
            <button className={`greenroom-toggle ${mic ? '' : 'greenroom-toggle-off'}`} type="button" onClick={onToggleMic} disabled={!stream}>
              {mic ? 'Mic on' : 'Mic off'}
            </button>
            <button className={`greenroom-toggle ${cam ? '' : 'greenroom-toggle-off'}`} type="button" onClick={onToggleCam} disabled={!stream}>
              {cam ? 'Camera on' : 'Camera off'}
            </button>
          </div>
          {mediaError && (
            <div className="greenroom-error" role="alert">
              <p>{mediaError}</p>
              <div className="greenroom-error-actions">
                <button className="greenroom-secondary" type="button" onClick={onRetryMedia}>
                  Try again
                </button>
                <button className="greenroom-secondary" type="button" onClick={onJoinWithoutCamera} disabled={!consent || joining}>
                  Join without camera
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="greenroom-steps">
          <ul className="greenroom-checks">
            <Check ok={Boolean(stream)}>Camera and microphone</Check>
            <Check ok={face.hasBaseline}>Neutral face calibrated</Check>
            <Check ok={consent}>Data use confirmed</Check>
          </ul>

          <div className="greenroom-calibrate">
            <p className="greenroom-text">
              Calibrate once so reads on you are measured against your own relaxed face. Hold still and look at the
              camera for about 10 seconds.
            </p>
            {face.error ? (
              <p className="greenroom-error-text" role="alert">{face.error}</p>
            ) : (
              <>
                <button
                  className="greenroom-secondary"
                  type="button"
                  onClick={face.calibrate}
                  disabled={!stream || !cam || !face.tracking || face.calibrating}
                >
                  {face.calibrating ? 'Calibrating…' : face.hasBaseline ? 'Recalibrate' : 'Calibrate neutral face'}
                </button>
                {face.calibrating && (
                  <progress className="greenroom-progress" max={CALIBRATION_MS} value={face.progress} aria-label="Calibration progress" />
                )}
                <p className="greenroom-status" role="status">{face.status}</p>
              </>
            )}
            {!face.hasBaseline && (
              <p className="greenroom-hint">Without a baseline, no one gets a face read on you. You can still play.</p>
            )}
          </div>

          <label className="greenroom-consent">
            <input type="checkbox" checked={consent} onChange={(event) => onConsent(event.target.checked)} />
            <span>
              I understand my expressions are analysed in my browser. Only derived scores (never video or audio) are
              sent to the server and saved to my profile, and other players can see my bluff reads and tells.
            </span>
          </label>

          <button className="greenroom-join" type="button" onClick={onJoin} disabled={!ready || joining}>
            {joining ? 'Sitting down…' : 'Join the table'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GreenRoom
