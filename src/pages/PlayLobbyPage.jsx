import { useState } from 'react'
import { useNavigate } from 'react-router'
import RoomCodeInput from '../components/RoomCodeInput.jsx'
import RoomSettingsForm from '../components/RoomSettingsForm.jsx'
import { DEFAULT_SETTINGS, createRoom, findRoom } from '../helpers/rooms.js'
import './PlayLobbyPage.css'

function describeError(error, fallback) {
  const detail = error.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (error.response?.status === 503 || error.response?.status === 401) {
    return 'Live rooms are not available right now. Check that you are signed in and the game server is running.'
  }
  return fallback
}

function PlayLobbyPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [code, setCode] = useState('')
  const [hosting, setHosting] = useState(false)
  const [joining, setJoining] = useState(false)
  const [hostError, setHostError] = useState(null)
  const [joinError, setJoinError] = useState(null)
  const [shake, setShake] = useState(0)

  async function host() {
    setHosting(true)
    setHostError(null)
    try {
      const room = await createRoom(settings)
      navigate(`/play/${room.code}`)
    } catch (error) {
      setHostError(describeError(error, 'Could not create the room. Try again.'))
      setHosting(false)
    }
  }

  async function join() {
    if (code.length !== 6) {
      setJoinError('Room codes have 6 characters.')
      setShake((current) => current + 1)
      return
    }
    setJoining(true)
    setJoinError(null)
    try {
      const room = await findRoom(code)
      if (!room) {
        setJoinError('No room with that code. Check it with whoever is hosting.')
        setShake((current) => current + 1)
      } else if (room.players >= room.max) {
        setJoinError('That room is full.')
        setShake((current) => current + 1)
      } else {
        navigate(`/play/${code}`)
        return
      }
    } catch (error) {
      setJoinError(describeError(error, 'Could not look up that room. Try again.'))
    }
    setJoining(false)
  }

  return (
    <div className="playlobby-page">
      <header className="playlobby-header">
        <div className="playlobby-eyebrow">PLAY LIVE</div>
        <h1 className="playlobby-title">Sit down. Read the table.</h1>
        <p className="playlobby-text">
          Host a room for up to six players, cameras on. Every bet gets a live bluff read, and every hand lands in
          your Sessions and Opponents tabs.
        </p>
      </header>

      <div className="playlobby-cards">
        <section className="playlobby-card playlobby-host" aria-labelledby="playlobby-host-title">
          <h2 className="playlobby-card-title" id="playlobby-host-title">Host a table</h2>
          <RoomSettingsForm value={settings} onChange={setSettings} disabled={hosting} />
          {hostError && <p className="playlobby-error" role="alert">{hostError}</p>}
          <button className="playlobby-button" type="button" onClick={host} disabled={hosting}>
            {hosting ? 'Opening the room…' : 'Create room'}
          </button>
        </section>

        <section className="playlobby-card playlobby-join" aria-labelledby="playlobby-join-title">
          <h2 className="playlobby-card-title" id="playlobby-join-title">Join with a code</h2>
          <p className="playlobby-card-text">Ask the host for their six-character room code.</p>
          <RoomCodeInput
            value={code}
            onChange={(next) => {
              setCode(next)
              setJoinError(null)
            }}
            onSubmit={join}
            shake={shake}
          />
          {joinError && <p className="playlobby-error" role="alert">{joinError}</p>}
          <button className="playlobby-button" type="button" onClick={join} disabled={joining}>
            {joining ? 'Looking…' : 'Join room'}
          </button>
        </section>
      </div>

      <p className="playlobby-privacy">
        Video and voice go directly between players. Your browser measures your own expression changes against a
        baseline you calibrate, and sends only those scores. No video or audio is ever recorded or uploaded.
      </p>
    </div>
  )
}

export default PlayLobbyPage
