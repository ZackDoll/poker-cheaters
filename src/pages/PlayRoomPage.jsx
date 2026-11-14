import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import ActionBar from '../components/ActionBar.jsx'
import GreenRoom from '../components/GreenRoom.jsx'
import HandLog from '../components/HandLog.jsx'
import PlayingCard from '../components/PlayingCard.jsx'
import PokerTable from '../components/PokerTable.jsx'
import RoomWaiting from '../components/RoomWaiting.jsx'
import ShowdownOverlay from '../components/ShowdownOverlay.jsx'
import { setActiveRoom } from '../helpers/activeRoom.js'
import { parseCard } from '../helpers/cards.js'
import { describeEvent, describeRead } from '../helpers/handLog.js'
import { createPeerMesh } from '../helpers/peerMesh.js'
import { createRoomSocket } from '../helpers/roomSocket.js'
import { useFaceRead } from '../helpers/useFaceRead.js'
import './PlayRoomPage.css'

const FACE_INTERVAL_MS = 500
const MAX_LOG = 200

function mediaMessage(error) {
  if (error.name === 'NotAllowedError') return 'Camera or microphone access was denied. Allow it in your browser, then try again.'
  if (error.name === 'NotFoundError') return 'No camera or microphone was found on this device.'
  if (error.name === 'NotReadableError') return 'Your camera is in use by another app. Close it, then try again.'
  return 'Could not start your camera and microphone.'
}

function PlayRoomPage() {
  const { code: rawCode } = useParams()
  const code = rawCode.toUpperCase()
  const navigate = useNavigate()

  const [stage, setStage] = useState('checkin')
  const [stream, setStream] = useState(null)
  const [mediaError, setMediaError] = useState(null)
  const [mediaAttempt, setMediaAttempt] = useState(0)
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(true)
  const [consent, setConsent] = useState(false)

  const [connection, setConnection] = useState('connecting')
  const [snap, setSnap] = useState(null)
  const [remoteStreams, setRemoteStreams] = useState({})
  const [reads, setReads] = useState({})
  const [recap, setRecap] = useState(null)
  const [winners, setWinners] = useState(new Set())
  const [log, setLog] = useState([])
  const [logOpen, setLogOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const socketRef = useRef(null)
  const meshRef = useRef(null)
  const membersRef = useRef({})
  const analysisRef = useRef(null)
  const baselineRef = useRef(false)
  const lastFaceRef = useRef(0)
  const toastTimer = useRef(null)
  // The mesh is created inside a socket callback, which needs the latest stream.
  const streamRef = useRef(null)

  // ---- camera and microphone -------------------------------------------------
  useEffect(() => {
    const session = { cancelled: false, stream: null }
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError('Camera access needs a supported browser on HTTPS or localhost.')
        return
      }
      const video = { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      const audio = { echoCancellation: true, noiseSuppression: true }
      let acquired
      try {
        acquired = await navigator.mediaDevices.getUserMedia({ video, audio })
      } catch (error) {
        try {
          acquired = await navigator.mediaDevices.getUserMedia({ video, audio: false })
        } catch {
          if (!session.cancelled) setMediaError(mediaMessage(error))
          return
        }
      }
      if (session.cancelled) {
        acquired.getTracks().forEach((track) => track.stop())
        return
      }
      session.stream = acquired
      setMediaError(null)
      setMic(acquired.getAudioTracks().length > 0)
      setCam(true)
      setStream(acquired)
    }
    start()
    return () => {
      session.cancelled = true
      session.stream?.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }, [mediaAttempt])

  useEffect(() => {
    streamRef.current = stream
    const video = analysisRef.current
    if (video) video.srcObject = stream
    meshRef.current?.setLocalStream(stream)
  }, [stream])

  function setTrack(kind, on) {
    const tracks = kind === 'mic' ? stream?.getAudioTracks() : stream?.getVideoTracks()
    tracks?.forEach((track) => {
      track.enabled = on
    })
    if (kind === 'mic') setMic(on)
    else setCam(on)
  }

  // ---- face analysis (runs in this browser; only scores leave it) -----------
  const onFaceSample = useCallback((sample) => {
    if (!baselineRef.current) return
    if (sample.tracking && sample.rows.length === 0) return // Still settling.
    const now = performance.now()
    if (now - lastFaceRef.current < FACE_INTERVAL_MS) return
    lastFaceRef.current = now
    const top = sample.rows.slice(0, 6).map((row) => ({ name: row.name, z: Math.max(-20, Math.min(20, row.z)) }))
    socketRef.current?.send({ type: 'face', score: sample.score, peak: sample.score, top, tracking: sample.tracking })
  }, [])
  const face = useFaceRead(analysisRef, onFaceSample)

  useEffect(() => {
    baselineRef.current = face.hasBaseline
  }, [face.hasBaseline])

  // ---- the room socket ------------------------------------------------------
  const nameOf = useCallback((sub) => membersRef.current[sub]?.name || 'Player', [])

  const showToast = useCallback((message) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }, [])

  const pushLog = useCallback((entries) => {
    const added = entries.filter(Boolean)
    if (added.length) setLog((current) => [...current, ...added].slice(-MAX_LOG))
  }, [])

  useEffect(() => {
    if (stage !== 'table') return undefined
    setActiveRoom(code)

    function onMessage(message) {
      switch (message.type) {
        case 'welcome':
          if (!meshRef.current) {
            meshRef.current = createPeerMesh({
              selfId: message.you,
              send: (data) => socketRef.current?.send(data),
              onStream: (id, remote) =>
                setRemoteStreams((current) => {
                  const next = { ...current }
                  if (remote) next[id] = remote
                  else delete next[id]
                  return next
                }),
              onState: () => {},
            })
            meshRef.current.setLocalStream(streamRef.current)
          }
          break
        case 'state': {
          membersRef.current = Object.fromEntries(message.members.map((member) => [member.sub, member]))
          const skew = message.now - Date.now()
          setSnap({ ...message, deadlineLocal: message.deadline ? message.deadline - skew : null })
          meshRef.current?.sync(message.members.map((member) => member.sub))
          break
        }
        case 'events':
          for (const event of message.events) {
            if (event.type === 'hand_start') {
              setReads({})
              setRecap(null)
              setWinners(new Set())
            } else if (event.type === 'pot_awarded') {
              setWinners((current) => new Set(current).add(event.player))
            }
          }
          pushLog(message.events.map((event) => describeEvent(event, nameOf)))
          break
        case 'read':
          setReads((current) => ({ ...current, [message.player]: message }))
          pushLog([describeRead(message, nameOf)])
          break
        case 'hand_recap':
          setRecap(message)
          break
        case 'rtc':
          meshRef.current?.handleSignal(message.from, message.data)
          break
        case 'error':
          if (message.code !== 'full') showToast(message.message)
          break
        default:
      }
    }

    const socket = createRoomSocket({
      code,
      onMessage,
      onStatus: (status) => {
        setConnection(status)
        if (status?.fatal) setActiveRoom(null)
      },
    })
    socketRef.current = socket
    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [stage, code, nameOf, pushLog, showToast])

  useEffect(
    () => () => {
      meshRef.current?.close()
      meshRef.current = null
      clearTimeout(toastTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (connection === 'open') socketRef.current?.send({ type: 'media', mic, cam, calibrated: face.hasBaseline })
  }, [connection, mic, cam, face.hasBaseline])

  // ---- actions ------------------------------------------------------------------
  const send = useCallback((message) => socketRef.current?.send(message), [])
  const act = useCallback((action) => send({ type: 'action', ...action }), [send])

  function sitDown(withCamera) {
    if (!withCamera) {
      stream?.getTracks().forEach((track) => track.stop())
      setStream(null)
      setMic(false)
      setCam(false)
    }
    setStage('table')
  }

  function leave() {
    socketRef.current?.leave()
    setActiveRoom(null)
    navigate('/play')
  }

  // ---- screens --------------------------------------------------------------------
  if (connection?.fatal) {
    return (
      <div className="playroom-fatal" role="alert">
        <h1 className="playroom-fatal-title">You can’t stay in this room</h1>
        <p>{connection.fatal}</p>
        <Link className="playroom-fatal-link" to="/play" onClick={() => setActiveRoom(null)}>
          Back to the lobby
        </Link>
      </div>
    )
  }

  const analysisVideo = <video ref={analysisRef} className="playroom-analysis" autoPlay muted playsInline aria-hidden="true" />

  if (stage === 'checkin') {
    return (
      <>
        {analysisVideo}
        <GreenRoom
          code={code}
          stream={stream}
          mediaError={mediaError}
          mic={mic}
          cam={cam}
          onToggleMic={() => setTrack('mic', !mic)}
          onToggleCam={() => setTrack('cam', !cam)}
          face={face}
          consent={consent}
          onConsent={setConsent}
          joining={false}
          onJoin={() => sitDown(true)}
          onJoinWithoutCamera={() => sitDown(false)}
          onRetryMedia={() => setMediaAttempt((current) => current + 1)}
        />
      </>
    )
  }

  if (!snap) {
    return (
      <>
        {analysisVideo}
        <div className="playroom-loading" role="status">
          {connection === 'reconnecting' ? 'Reconnecting to the room…' : 'Joining the room…'}
        </div>
      </>
    )
  }

  const { table, room, members: memberList } = snap
  const members = Object.fromEntries(memberList.map((member) => [member.sub, member]))
  const mySeatIndex = table.seats.findIndex((seat) => seat?.player === snap.you)
  const mySeat = table.seats[mySeatIndex]
  const isHost = room.host === snap.you
  const handActive = table.phase !== 'waiting'
  const holeCards = mySeat?.hole?.map(parseCard)
  const streams = { ...remoteStreams, [snap.you]: stream }

  let center = null
  if (!room.started) {
    center = (
      <RoomWaiting
        room={room}
        playerCount={memberList.length}
        isHost={isHost}
        error={toast}
        onStart={() => send({ type: 'start_game' })}
        onSettings={(settings) => send({ type: 'settings', settings })}
      />
    )
  } else if (recap && !handActive) {
    center = <ShowdownOverlay key={recap.hand} recap={recap} onClose={() => setRecap(null)} />
  } else if (!handActive) {
    const ready = table.seats.filter((seat) => seat && seat.stack > 0 && !seat.sitting_out).length
    center = (
      <div className="playroom-notice" role="status">
        {ready >= 2 ? 'Next hand starting…' : 'Waiting for more players with chips…'}
      </div>
    )
  }

  return (
    <div className="playroom">
      {analysisVideo}
      {connection === 'reconnecting' && (
        <div className="playroom-banner" role="status">Connection lost. Reconnecting — your seat is held for a minute.</div>
      )}
      {toast && room.started && (
        <div className="playroom-toast" role="alert">{toast}</div>
      )}

      <div className="playroom-stage">
        <PokerTable
          table={table}
          members={members}
          mySub={snap.you}
          streams={streams}
          reads={reads}
          winners={winners}
          deadline={snap.deadlineLocal}
          canKick={isHost && !handActive}
          onKick={(player) => send({ type: 'kick', player })}
        >
          {center}
        </PokerTable>
      </div>

      <div className="playroom-bottom">
        <div className="playroom-hole" aria-label="Your cards">
          {holeCards && handActive && mySeat?.has_cards ? (
            holeCards.map((card, index) => (
              <PlayingCard key={`${table.hand}-${index}`} size="lg" deal dealDelay={index * 260} {...card} />
            ))
          ) : (
            <span className="playroom-hole-empty">{room.started ? 'No cards' : 'Cards appear here'}</span>
          )}
        </div>

        <div className="playroom-action">
          <ActionBar
            key={`${table.hand}-${table.phase}-${table.legal?.min_raise_to}-${table.legal?.max_raise_to}`}
            legal={table.legal}
            pot={table.pot}
            currentBet={table.current_bet}
            waitingFor={table.actor ? members[table.actor]?.name : null}
            onAction={act}
          />
        </div>

        <div className="playroom-tools">
          <button className={`playroom-tool ${mic ? '' : 'playroom-tool-off'}`} type="button" onClick={() => setTrack('mic', !mic)} disabled={!stream || stream.getAudioTracks().length === 0}>
            {mic ? 'Mute' : 'Unmute'}
          </button>
          <button className={`playroom-tool ${cam ? '' : 'playroom-tool-off'}`} type="button" onClick={() => setTrack('cam', !cam)} disabled={!stream}>
            {cam ? 'Camera off' : 'Camera on'}
          </button>
          <button className="playroom-tool" type="button" onClick={() => setLogOpen((current) => !current)} aria-expanded={logOpen}>
            Hand log
          </button>
          {room.started && mySeat && mySeat.stack === 0 && !handActive && (
            <button className="playroom-tool playroom-tool-gold" type="button" onClick={() => send({ type: 'rebuy' })}>
              Rebuy
            </button>
          )}
          <button className="playroom-tool playroom-tool-leave" type="button" onClick={leave}>
            Leave
          </button>
        </div>
      </div>

      <HandLog entries={log} open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  )
}

export default PlayRoomPage
