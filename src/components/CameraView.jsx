import { useEffect, useRef, useState } from 'react'
import './CameraView.css'

function CameraView() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    const effect = { cancelled: false }

    function stop() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (video) {
        video.srcObject = null
      }
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser does not support camera access.')
        return
      }

      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })

        // The effect may have been cleaned up while we awaited permission.
        if (effect.cancelled) {
          stop()
          return
        }

        if (video) {
          video.srcObject = streamRef.current
          setReady(true)
        }
      } catch (err) {
        if (effect.cancelled) return
        if (err.name === 'NotAllowedError') {
          setError('Camera permission was denied. Allow it in your browser settings and reload.')
        } else if (err.name === 'NotFoundError') {
          setError('No camera was found on this device.')
        } else {
          setError(`Could not start the camera: ${err.message}`)
        }
      }
    }

    start()

    return () => {
      effect.cancelled = true
      stop()
    }
  }, [])

  return (
    <div className="camera-view">
      {error ? (
        <p className="camera-error">{error}</p>
      ) : (
        <>
          <video
            ref={videoRef}
            className="camera-video"
            autoPlay
            playsInline
            muted
          />
          {!ready && <p className="camera-status">Starting camera…</p>}
        </>
      )}
    </div>
  )
}

export default CameraView
