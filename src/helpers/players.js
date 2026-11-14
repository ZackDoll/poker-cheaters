import { gameApi } from './api.js'

// The caller's own profile first, then everyone they have shared a table with.
export async function listPlayers() {
  const response = await gameApi.get('/players')
  return response.data
}

export async function getPlayer(playerId) {
  const response = await gameApi.get(`/players/${encodeURIComponent(playerId)}`)
  return response.data
}
