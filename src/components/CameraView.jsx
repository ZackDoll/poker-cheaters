import { useEffect, useRef, useState } from 'react'
import FaceAnalysis from './FaceAnalysis.jsx'
import './CameraView.css'

function CameraView() {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    // Each effect owns its stream, including StrictMode's cancelled first request.
    const session = { cancelled: false, stream: null }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera access requires a supported browser on HTTPS or localhost.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        if (session.cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        session.stream = stream
        video.srcObject = stream
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            if (!session.cancelled) {
              setReady(false)
              setError('Camera disconnected. End the session and start again to retry.')
            }
          }
        })
        await video.play()
      } catch (err) {
        if (session.cancelled) return
        session.stream?.getTracks().forEach((track) => track.stop())
        if (err.name === 'NotAllowedError') {
          setError('Camera access was denied. Allow camera access in your browser, then end the session and start again.')
        } else if (err.name === 'NotFoundError') {
          setError('No camera was found on this device.')
        } else if (err.name === 'NotReadableError') {
          setError('Camera is unavailable. Close other apps using it, then try again.')
        } else {
          setError('Could not start the camera. End the session and start again to retry.')
        }
      }
    }
    start()
    return () => {
      session.cancelled = true
      session.stream?.getTracks().forEach((track) => {
        track.onended = null
        track.stop()
      })
      if (video.srcObject === session.stream) video.srcObject = null
    }
  }, [])

  return (
    <>
    <div className="camera-view">
      <video
        ref={videoRef}
        className="camera-view-video"
        aria-label="Front camera test preview"
        autoPlay
        playsInline
        muted
        onPlaying={() => setReady(true)}
      />
      {error ? (
        <p className="camera-view-error" role="alert">{error}</p>
      ) : !ready ? (
        <p className="camera-view-status" role="status">Starting camera — allow camera access when prompted.</p>
      ) : null}
    </div>
    {ready && !error && <FaceAnalysis videoRef={videoRef} />}
    </>
  )
}

export default CameraView


