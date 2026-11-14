import { gameApi } from './api.js'

export const DEFAULT_SETTINGS = { starting_stack: 1000, small_blind: 5, big_blind: 10, reads: 'open' }

export async function createRoom(settings) {
  const response = await gameApi.post('/rooms', settings)
  return response.data
}

// Resolves to the room summary, or null if no room has that code.
export async function findRoom(code) {
  try {
    const response = await gameApi.get(`/rooms/${encodeURIComponent(code)}`)
    return response.data
  } catch (error) {
    if (error.response?.status === 404) return null
    throw error
  }
}
