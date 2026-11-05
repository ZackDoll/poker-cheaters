import { Link } from 'react-router'
import './HomePage.css'

function HomePage() {
  return (
    <section className="home-page">
      <h1 className="home-title">Poker Cheaters</h1>
      <p className="home-subtitle">Placeholder tagline goes here.</p>
      <Link className="home-cta" to="/login">Get started</Link>
    </section>
  )
}

export default HomePage
