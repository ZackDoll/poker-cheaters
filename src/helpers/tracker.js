import api from './api.js'

// Calls for the card tracker (api/opponents.js, sessions.js, hands.js, actions.js).
// Ids go in the query string, so each function URL-encodes them.

export async function listOpponents() {
  return (await api.get('/opponents')).data
}

export async function getOpponent(id) {
  return (await api.get('/opponents', { params: { id } })).data
}

export async function createOpponent(name) {
  return (await api.post('/opponents', { name })).data
}

export async function deleteOpponent(id) {
  return (await api.delete('/opponents', { params: { id } })).data
}

export async function listSessions() {
  return (await api.get('/sessions')).data
}

export async function getSession(id) {
  return (await api.get('/sessions', { params: { id } })).data
}

export async function createSession(label) {
  return (await api.post('/sessions', { label })).data
}

export async function endSession(id) {
  return (await api.patch('/sessions', { end: true }, { params: { id } })).data
}

export async function deleteSession(id) {
  return (await api.delete('/sessions', { params: { id } })).data
}

export async function startHand(sessionId) {
  return (await api.post('/hands', { sessionId })).data
}

// changes: { board?, myCards?, shown?, finish? }
export async function updateHand(id, changes) {
  return (await api.patch('/hands', changes, { params: { id } })).data
}

// action: { handId, opponentId, street, action, betSize, potSize, activePlayers, position, face }
export async function logAction(action) {
  return (await api.post('/actions', action)).data
}

export async function deleteAction(id) {
  return (await api.delete('/actions', { params: { id } })).data
}

// A readable message for a failed call. The server's own message is shown when it sent one,
// because it already says what to fix ("Enter the flop cards first").
export function apiErrorText(error, fallback = 'Something went wrong. Try again in a moment.') {
  if (error?.response?.status === 401) return 'You are signed out. Log in again to continue.'
  const message = error?.response?.data?.error
  if (error?.response?.status < 500 && typeof message === 'string') return message
  return fallback
}
