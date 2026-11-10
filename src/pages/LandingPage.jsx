import LandingNav from '../components/LandingNav.jsx'
import LandingHero from '../components/LandingHero.jsx'
import SignalsSection from '../components/SignalsSection.jsx'
import ModesSection from '../components/ModesSection.jsx'
import HowItWorksSection from '../components/HowItWorksSection.jsx'
import FairPlaySection from '../components/FairPlaySection.jsx'
import JoinBanner from '../components/JoinBanner.jsx'
import LandingFooter from '../components/LandingFooter.jsx'
import './LandingPage.css'

function LandingPage() {
  return (
    <div className="landing-page">
      <LandingNav />
      <LandingHero />
      <SignalsSection />
      <ModesSection />
      <HowItWorksSection />
      <FairPlaySection />
      <JoinBanner />
      <LandingFooter />
    </div>
  )
}

export default LandingPage
