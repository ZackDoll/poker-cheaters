import './LandingNav.css'

function LandingNav() {
  return (
    <header className="landing-nav">
      <a className="landing-nav-brand" href="#top">
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
      </a>
      <nav className="landing-nav-links">
        <a href="#signals">Signals</a>
        <a href="#modes">Live &amp; post-game</a>
        <a href="#how">How it works</a>
        <a href="#fair">Fair play</a>
        <a className="landing-nav-cta" href="#join">Try for free</a>
      </nav>
    </header>
  )
}

export default LandingNav
