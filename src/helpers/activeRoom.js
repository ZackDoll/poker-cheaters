// Remembers which room this browser tab is sitting in, so the header can offer
// a way back to the table after you navigate elsewhere in the app.
const KEY = 'tell_active_room'
const EVENT = 'tell-active-room'

export function getActiveRoom() {
  return sessionStorage.getItem(KEY)
}

export function setActiveRoom(code) {
  if (code) sessionStorage.setItem(KEY, code)
  else sessionStorage.removeItem(KEY)
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeActiveRoom(callback) {
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}
