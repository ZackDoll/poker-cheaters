import api, { gameApi } from './api.js'

// Returns the logged-in user ({ id, email, name, avatarUrl }) or null.
export async function getCurrentUser() {
  try {
    const response = await api.get('/auth/me')
    return response.data.user
  } catch (error) {
    if (error.response?.status === 401) return null
    throw error
  }
}

export async function logout() {
  clearRoomToken()
  await api.post('/auth/logout')
}

// The game server (FastAPI) trusts a short-lived token signed by the login backend.
let cachedToken = null

export async function getRoomToken() {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.token
  const response = await api.get('/auth/room-token')
  cachedToken = response.data
  return cachedToken.token
}

export function clearRoomToken() {
  cachedToken = null
}

gameApi.interceptors.request.use(async (config) => {
  config.headers.Authorization = `Bearer ${await getRoomToken()}`
  return config
})
