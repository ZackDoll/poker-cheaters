import { useState } from 'react'
import { Link } from 'react-router'
import LiveReadCard from '../components/LiveReadCard.jsx'
import './LoginPage.css'

// UI only: submitting does not authenticate yet.
function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-side-form">
          <Link className="login-brand" to="/">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
              <rect x="2" y="2" width="24" height="24" rx="7" fill="#F4C95D" />
              <path
                d="M8 11h12M14 11v10"
                stroke="#0B1411"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            Tell
          </Link>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-eyebrow">WELCOME BACK</div>
            <h1 className="login-title">Log in to Tell</h1>
            <label className="login-label">
              Username
              <input
                className="login-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="login-label">
              Password
              <input
                className="login-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="login-button" type="submit">Log in</button>
          </form>
        </div>

        <aside className="login-side-preview">
          <div className="login-preview-copy">
            <div className="login-eyebrow">READ THE TABLE</div>
            <h2 className="login-preview-title">Catch the bluff.</h2>
            <p className="login-preview-text">
              Faces, voices, the board and every bet, weighed into one read.
            </p>
          </div>
          <LiveReadCard />
        </aside>
      </div>
    </div>
  )
}

export default LoginPage
