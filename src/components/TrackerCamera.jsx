import { useCallback, useEffect, useRef, useState } from 'react'
import { CALIBRATION_MS, useFaceRead } from '../helpers/useFaceRead.js'
import './TrackerCamera.css'

function cameraErrorText(error) {
  if (error.name === 'NotAllowedError') return 'Camera access was denied. Allow it in your browser, then turn the camera on again.'
  if (error.name === 'NotFoundError') return 'No camera was found on this device.'
  if (error.name === 'NotReadableError') return 'The camera is in use by another app. Close it, then try again.'
  return 'Could not start the camera. Turn it off and on to retry.'
}

// The part that exists only while the camera is on, so the face model loads only when asked for.
function CameraStage({ collector, onFailure }) {
  const videoRef = useRef(null)
  const [ready, setReady] = useState(false)

  const onSample = useCallback((sample) => collector.push(sample), [collector])
  const face = useFaceRead(videoRef, onSample)

  useEffect(() => {
    const video = videoRef.current
    // Each effect owns its stream, including StrictMode's cancelled first request.
    const run = { cancelled: false, stream: null }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        onFailure('Camera access needs a supported browser on HTTPS or localhost.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (run.cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        run.stream = stream
        video.srcObject = stream
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            if (!run.cancelled) onFailure('The camera disconnected. Turn it on again to retry.')
          }
        })
        await video.play()
      } catch (error) {
        if (!run.cancelled) {
          run.stream?.getTracks().forEach((track) => track.stop())
          onFailure(cameraErrorText(error))
        }
      }
    }
    start()

    return () => {
      run.cancelled = true
      run.stream?.getTracks().forEach((track) => {
        track.onended = null
        track.stop()
      })
      if (video.srcObject === run.stream) video.srcObject = null
      collector.clear()
    }
  }, [collector, onFailure])

  return (
    <>
      <div className="trackercamera-frame">
        <video
          ref={videoRef}
          className="trackercamera-video"
          aria-label="Camera preview"
          autoPlay
          playsInline
          muted
          onPlaying={() => setReady(true)}
        />
        {!ready && <p className="trackercamera-overlay">Starting camera. Allow access when prompted.</p>}
      </div>

      {face.error ? (
        <p className="trackercamera-error" role="alert">
          {face.error}
        </p>
      ) : (
        <>
          <button
            className="trackercamera-button"
            type="button"
            onClick={face.calibrate}
            disabled={!face.tracking || face.calibrating}
          >
            {face.calibrating ? 'Calibrating…' : face.hasBaseline ? 'Recalibrate neutral face' : 'Calibrate neutral face'}
          </button>
          {face.calibrating && (
            <progress className="trackercamera-progress" max={CALIBRATION_MS} value={face.progress} aria-label="Calibration progress" />
          )}
          <p className="trackercamera-status" role="status">
            {face.hasBaseline && face.tracking && !face.settled ? 'Collecting a steady read…' : face.status}
          </p>
        </>
      )}
    </>
  )
}

// Optional webcam read. Point it at the player you are logging, calibrate while they look
// relaxed, and each bet or raise you log carries the recent expression-change score with it.
function TrackerCamera({ collector }) {
  const [on, setOn] = useState(false)
  const [error, setError] = useState(null)

  const fail = useCallback((message) => {
    setError(message)
    setOn(false)
  }, [])

  function toggle() {
    setError(null)
    setOn((current) => !current)
  }

  return (
    <section className="trackercamera" aria-label="Face read">
      <header className="trackercamera-header">
        <h2 className="trackercamera-title">Face read</h2>
        <span className={`trackercamera-badge ${on ? 'trackercamera-badge-on' : ''}`}>{on ? 'ON' : 'OFF'}</span>
      </header>

      {on ? (
        <CameraStage collector={collector} onFailure={fail} />
      ) : (
        <p className="trackercamera-note">
          Optional. Turn it on to add the player’s expression changes to each bet read. You can log hands without it.
        </p>
      )}
      {error && (
        <p className="trackercamera-error" role="alert">
          {error}
        </p>
      )}

      <button className={`trackercamera-button ${on ? 'trackercamera-stop' : ''}`} type="button" onClick={toggle}>
        {on ? 'Turn camera off' : 'Turn camera on'}
      </button>
      <p className="trackercamera-note">
        Video stays in your browser and is never recorded or uploaded. Only the derived expression scores are sent.
      </p>
    </section>
  )
}

export default TrackerCamera
