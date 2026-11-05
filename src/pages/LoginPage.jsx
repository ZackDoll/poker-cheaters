import { useState } from 'react'
import './LoginPage.css'

// UI only: submitting does not authenticate yet.
function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
  }

  return (
    <section className="login-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title">Login</h1>
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
    </section>
  )
}

export default LoginPage
