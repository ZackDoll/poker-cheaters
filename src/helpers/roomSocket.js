import { gameSocketUrl } from './api.js'
import { clearRoomToken, getRoomToken } from './auth.js'

// Close codes the server uses to say "do not reconnect".
const FATAL = {
  4000: 'You joined this room from another tab or device.',
  4003: 'You were removed from the room by the host.',
  4004: 'That room no longer exists.',
  4005: 'That room is full.',
}
const MAX_BACKOFF_MS = 8000

// A WebSocket to one room that says hello with a signed token, and reconnects
// with backoff when the connection drops. The server keeps a seat for 60 seconds.
//
// onStatus receives: 'connecting' | 'open' | 'reconnecting' | { fatal: message }
export function createRoomSocket({ code, onMessage, onStatus }) {
  let socket = null
  let stopped = false
  let attempt = 0
  let retryTimer = null
  let authRetried = false

  async function connect() {
    if (stopped) return
    onStatus(attempt === 0 ? 'connecting' : 'reconnecting')
    let token
    try {
      token = await getRoomToken()
    } catch {
      return scheduleRetry()
    }
    if (stopped) return
    const ws = new WebSocket(gameSocketUrl(code))
    socket = ws
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', token }))
    ws.onmessage = (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      if (message.type === 'welcome') {
        attempt = 0
        authRetried = false
        onStatus('open')
      }
      onMessage(message)
    }
    ws.onclose = (event) => {
      if (stopped || socket !== ws) return
      socket = null
      if (FATAL[event.code]) {
        stopped = true
        onStatus({ fatal: FATAL[event.code] })
      } else if (event.code === 4001 && !authRetried) {
        authRetried = true
        clearRoomToken() // The token may simply have expired.
        scheduleRetry(0)
      } else if (event.code === 4001) {
        stopped = true
        onStatus({ fatal: 'Could not sign you in to the room. Log in again.' })
      } else if (event.code === 1000 || event.code === 1001) {
        stopped = true
        onStatus({ fatal: 'The room was closed.' })
      } else {
        scheduleRetry()
      }
    }
  }

  function scheduleRetry(delay) {
    if (stopped) return
    attempt += 1
    onStatus('reconnecting')
    const wait = delay ?? Math.min(MAX_BACKOFF_MS, 500 * 2 ** (attempt - 1))
    retryTimer = setTimeout(connect, wait)
  }

  connect()

  return {
    send(message) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
    },
    // Leaving on purpose tells the server to free the seat now instead of after the grace period.
    leave() {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'leave' }))
      this.close()
    },
    close() {
      stopped = true
      clearTimeout(retryTimer)
      const ws = socket
      socket = null
      if (ws) {
        ws.onclose = null
        ws.close()
      }
    },
  }
}
