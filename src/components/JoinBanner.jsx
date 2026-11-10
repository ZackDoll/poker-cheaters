import { Link } from 'react-router'
import './JoinBanner.css'

function JoinBanner() {
  return (
    <section className="join-section" id="join">
      <div className="join-banner">
        <div className="join-copy">
          <h2 className="join-title">Stop guessing. Start reading.</h2>
          <p className="join-text">Try it free and run your first read today.</p>
        </div>
        <Link className="join-button" to="/login">Try for free</Link>
      </div>
    </section>
  )
}

export default JoinBanner
