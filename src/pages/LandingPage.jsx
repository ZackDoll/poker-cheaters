import { Link } from 'react-router'
import './LandingPage.css'

function LandingPage() {
  return (
    <section className="landing-page">
      <h1 className="landing-title">Poker Cheaters</h1>
      <p className="landing-subtitle">Placeholder tagline goes here.</p>
      <Link className="landing-cta" to="/login">Get started</Link>
    </section>
  )
}

export default LandingPage
