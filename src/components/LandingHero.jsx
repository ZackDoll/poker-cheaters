import LiveReadCard from './LiveReadCard.jsx'
import './LandingHero.css'

function LandingHero() {
  return (
    <section className="landing-hero" id="top">
      <div className="landing-hero-copy">
        <h1 className="landing-hero-title">
          Read the table.<br />Catch the bluff.
        </h1>
        <p className="landing-hero-text">
          Tell watches faces, listens to voices, scans the board and weighs
          every bet, live at the table or hand by hand after the session. One
          read on who is representing, and who actually has it.
        </p>
        <div className="landing-hero-actions">
          <a className="landing-hero-primary" href="#join">Try for free</a>
          <a className="landing-hero-secondary" href="#modes">See it in action</a>
        </div>
      </div>
      <LiveReadCard />
    </section>
  )
}

export default LandingHero
