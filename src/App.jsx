import { useEffect, useState } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router'
import Sidebar from './components/Sidebar.jsx'
import AuthGate from './components/AuthGate.jsx'
import LandingPage from './pages/LandingPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LivePage from './pages/LivePage.jsx'
import SessionsPage from './pages/SessionsPage.jsx'
import SessionDetailPage from './pages/SessionDetailPage.jsx'
import OpponentsPage from './pages/OpponentsPage.jsx'
import InsightsPage from './pages/InsightsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import { getCurrentUser, logout } from './helpers/auth.js'
import './App.css'

// Full-width pages that bring their own layout (no sidebar).
const STANDALONE_PATHS = ['/', '/login']

function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // undefined = still checking the session cookie, null = logged out.
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogout() {
    try {
      await logout()
    } finally {
      setUser(null)
      navigate('/')
    }
  }

  const showSidebar = Boolean(user) && !STANDALONE_PATHS.includes(pathname)

  function priv(element) {
    return (
      <AuthGate user={user} mode="private">
        {element}
      </AuthGate>
    )
  }

  function guest(element) {
    return (
      <AuthGate user={user} mode="guest">
        {element}
      </AuthGate>
    )
  }

  return (
    <div className="app">
      {showSidebar && <Sidebar user={user} onLogout={handleLogout} />}
      <main className={showSidebar ? 'app-content' : 'app-content-full'}>
        <Routes>
          <Route path="/" element={guest(<LandingPage />)} />
          <Route path="/login" element={guest(<LoginPage />)} />
          <Route path="/home" element={priv(<HomePage user={user} />)} />
          <Route path="/live" element={priv(<LivePage />)} />
          <Route path="/sessions" element={priv(<SessionsPage />)} />
          <Route path="/sessions/:sessionId" element={priv(<SessionDetailPage />)} />
          <Route path="/opponents" element={priv(<OpponentsPage />)} />
          <Route path="/insights" element={priv(<InsightsPage />)} />
          <Route path="/settings" element={priv(<SettingsPage />)} />
        </Routes>
      </main>
    </div>
  )
}

export default App
