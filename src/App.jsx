import { Routes, Route } from 'react-router'
import Sidebar from './components/Sidebar.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import './App.css'

function App() {
  return (
    <div className="app">
      <Sidebar />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
