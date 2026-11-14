import { gameApi } from './api.js'

export async function listSessions() {
  const response = await gameApi.get('/sessions')
  return response.data
}

export async function getSession(sessionId) {
  const response = await gameApi.get(`/sessions/${encodeURIComponent(sessionId)}`)
  return response.data
}
