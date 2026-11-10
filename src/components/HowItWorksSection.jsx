import './HowItWorksSection.css'

const STEPS = [
  {
    number: '01',
    title: 'Set up your view',
    text: 'Frame the table with a phone, webcam or stream. Tell finds the seats, the board and the chips.',
  },
  {
    number: '02',
    title: 'Let it learn each player',
    text: 'It builds a baseline for each opponent first, so a change in behavior stands out from how they normally look and sound.',
  },
  {
    number: '03',
    title: 'Act on the read',
    text: 'Get a live read in the moment, then dig into the full breakdown after the session.',
  },
]

function HowItWorksSection() {
  return (
    <section className="how-section" id="how">
      <div className="how-inner">
        <h2 className="how-title">Point a camera. Get a read.</h2>
        <div className="how-steps">
          {STEPS.map((step) => (
            <div className="how-step" key={step.number}>
              <div className="how-step-number">{step.number}</div>
              <h3 className="how-step-title">{step.title}</h3>
              <p className="how-step-text">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HowItWorksSection
