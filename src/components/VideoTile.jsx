import { useEffect, useRef } from 'react'
import Avatar from './Avatar.jsx'
import { useSpeaking } from '../helpers/useSpeaking.js'
import './VideoTile.css'

// One player's camera. The <video> element is always mounted, even with the camera
// off, because it is also what plays their voice. local mutes it and mirrors it.
function VideoTile({ stream, name, avatarUrl, camOn, micOn, local = false }) {
  const videoRef = useRef(null)
  const speaking = useSpeaking(micOn ? stream : null)
  const hasVideo = Boolean(stream && camOn && stream.getVideoTracks().length > 0)

  useEffect(() => {
    const video = videoRef.current
    if (video && video.srcObject !== (stream || null)) video.srcObject = stream || null
  }, [stream])

  return (
    <div className={`video-tile ${speaking ? 'video-tile-speaking' : ''}`}>
      <video
        ref={videoRef}
        className={`video-tile-video ${local ? 'video-tile-local' : ''} ${hasVideo ? '' : 'video-tile-hidden'}`}
        autoPlay
        playsInline
        muted={local}
        aria-label={`${name} camera`}
      />
      {!hasVideo && (
        <div className="video-tile-fallback">
          <Avatar name={name} url={avatarUrl} size={52} />
        </div>
      )}
      {!micOn && (
        <span className="video-tile-flag" title="Microphone off">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-label="Microphone off" role="img">
            <path
              d="M4 4l16 16M9 9v2a3 3 0 0 0 5 2.2M15 9.3V6a3 3 0 0 0-5.6-1.5M6 11a6 6 0 0 0 9.5 4.9M18 11a6 6 0 0 1-.6 2.600M12 18v3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}
    </div>
  )
}

export default VideoTile
