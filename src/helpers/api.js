import axios from 'axios'

// Shared axios instance. All API queries should go through this.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

// Second instance for the FastAPI game server (rooms, sessions, players).
// It defaults to the same origin; under `vercel dev` set VITE_GAME_API_URL to FastAPI.
// helpers/auth.js attaches the signed room token to every request.
export const gameApi = axios.create({
  baseURL: import.meta.env.VITE_GAME_API_URL || '/api',
})

// WebSockets are a browser redirect-style API that axios cannot do, so the room
// socket uses the native WebSocket. This builds its URL.
export function gameSocketUrl(code) {
  const base =
    import.meta.env.VITE_GAME_WS_URL ||
    `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api`
  return `${base.replace(/\/$/, '')}/rooms/${encodeURIComponent(code)}/ws`
}

export async function get(path, params) {
  const response = await api.get(path, { params })
  return response.data
}

export default api
