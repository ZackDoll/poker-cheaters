import { Routes, Route, useLocation } from 'react-router'
import Sidebar from './components/Sidebar.jsx'
import LandingPage from './pages/LandingPage.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import './App.css'

function App() {
  const { pathname } = useLocation()
  // The landing page is a full-width marketing page with its own nav.
  const showSidebar = pathname !== '/'

  return (
    <div className="app">
      {showSidebar && <Sidebar />}
      <main className={showSidebar ? 'app-content' : 'app-content-full'}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
