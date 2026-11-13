import { Navigate } from 'react-router'
import './AuthGate.css'

// Guards a route based on login state.
// user: undefined = still checking, null = logged out, object = logged in.
// mode "private": logged-out visitors go to /login.
// mode "guest": logged-in users go to /home (landing page, login page).
function AuthGate({ user, mode, children }) {
  if (user === undefined) {
    return <div className="authgate-loading">Loading…</div>
  }
  if (mode === 'private' && !user) {
    return <Navigate to="/login" replace />
  }
  if (mode === 'guest' && user) {
    return <Navigate to="/home" replace />
  }
  return children
}

export default AuthGate
