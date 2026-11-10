import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import LiveReadCard from '../components/LiveReadCard.jsx'
import './LoginPage.css'

// The username/password form is UI only (submitting does nothing).
// Google sign-in is the working login, handled by /api/auth/google.
function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [searchParams] = useSearchParams()
  const googleFailed = searchParams.get('error') === 'google'

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

            <div className="login-divider">or</div>
            {googleFailed && (
              <div className="login-error" role="alert">
                Google sign-in didn’t work. Please try again.
              </div>
            )}
            {/* Full-page navigation: the server handles the Google redirect. */}
            <a className="login-google" href="/api/auth/google">
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
                <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
              Continue with Google
            </a>
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
