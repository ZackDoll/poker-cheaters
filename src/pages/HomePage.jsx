import { Link } from 'react-router'
import './HomePage.css'

function HomePage({ user }) {
  const firstName = user?.name?.split(' ')[0]

  return (
    <section className="home-page">
      <h1 className="home-title">{firstName ? `Welcome back, ${firstName}` : 'Poker Cheaters'}</h1>
      <p className="home-subtitle">Placeholder tagline goes here.</p>
      <Link className="home-cta" to="/live">Go live</Link>
    </section>
  )
}

export default HomePage
