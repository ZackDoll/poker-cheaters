import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import LiveReadCard from './LiveReadCard.jsx'
import PuppetDealer from './PuppetDealer.jsx'
import './PuppetStage.css'

// The dealer's routine, in order. `ms` is how long each beat lasts;
// the last beat has no duration because the show rests there.
const PHASES = [
  { name: 'closed', pose: 'closed', ms: 450 },
  { name: 'rise', pose: 'rise', ms: 1500 },
  { name: 'shuffle', pose: 'shuffle', ms: 1600 },
  { name: 'show', pose: 'show', ms: 1300 },
  { name: 'burn', pose: 'burn', ms: 1900 },
  { name: 'pull', pose: 'pull', ms: 800 },
  { name: 'give', pose: 'give', ms: 700 },
  { name: 'handoff', pose: 'bow', ms: 1300 },
  { name: 'idle', pose: 'bow', ms: null },
]
const LAST_STEP = PHASES.length - 1

// Chip stacks standing on the table, in the 480 x 480 stage coordinates.
const CHIP_STACKS = [
  { x: 112, y: 373, count: 4 },
  { x: 150, y: 376, count: 2 },
  { x: 376, y: 374, count: 3 },
]

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clamp(value) {
  return Math.max(-1, Math.min(1, value))
}

function PuppetStage() {
  // With reduced motion the show is skipped: the read card is simply there.
  const [reducedMotion] = useState(prefersReducedMotion)
  const [step, setStep] = useState(reducedMotion ? LAST_STEP : 0)
  // The curtain stays down until the set is actually on screen.
  const [started, setStarted] = useState(reducedMotion)
  const stageRef = useRef(null)
  const setRef = useRef(null)
  const handoffRef = useRef(null)
  const giveAnchorRef = useRef(null)

  const phase = PHASES[step]
  const isIdle = step === LAST_STEP

  useEffect(() => {
    if (started) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStarted(true)
      },
      { threshold: 0.5 },
    )
    observer.observe(setRef.current)
    return () => observer.disconnect()
  }, [started])

  // Advance to the next beat when the current one has played.
  useEffect(() => {
    if (!started || phase.ms === null) return undefined
    const timer = setTimeout(() => {
      setStep((current) => Math.min(current + 1, LAST_STEP))
    }, phase.ms)
    return () => clearTimeout(timer)
  }, [started, phase])

  // Just before the card leaves his hand, measure where it is on screen so
  // the page-level card can start exactly on top of it.
  useLayoutEffect(() => {
    if (phase.name !== 'pull') return
    const stage = stageRef.current
    const handoff = handoffRef.current
    const anchor = giveAnchorRef.current
    if (!stage || !handoff || !anchor) return

    const stageBox = stage.getBoundingClientRect()
    const anchorBox = anchor.getBoundingClientRect()
    const restX = stageBox.left + handoff.offsetLeft + handoff.offsetWidth / 2
    const restY = stageBox.top + handoff.offsetTop + handoff.offsetHeight / 2

    stage.style.setProperty('--puppet-stage-give-x', `${anchorBox.left + anchorBox.width / 2 - restX}px`)
    stage.style.setProperty('--puppet-stage-give-y', `${anchorBox.top + anchorBox.height / 2 - restY}px`)
    stage.style.setProperty('--puppet-stage-give-sx', (anchorBox.width / handoff.offsetWidth).toFixed(4))
    stage.style.setProperty('--puppet-stage-give-sy', (anchorBox.height / handoff.offsetHeight).toFixed(4))
  }, [phase])

  // Tilt the stage toward the pointer so the flat layers show their depth.
  function handlePointerMove(event) {
    if (event.pointerType === 'touch') return
    const box = stageRef.current.getBoundingClientRect()
    const x = clamp(((event.clientX - box.left) / box.width) * 2 - 1)
    const y = clamp(((event.clientY - box.top) / box.height) * 2 - 1)
    stageRef.current.style.setProperty('--puppet-stage-look-x', x.toFixed(3))
    stageRef.current.style.setProperty('--puppet-stage-look-y', y.toFixed(3))
  }

  function handlePointerLeave() {
    stageRef.current.style.setProperty('--puppet-stage-look-x', '0')
    stageRef.current.style.setProperty('--puppet-stage-look-y', '0')
  }

  return (
    <div
      ref={stageRef}
      className={`puppet-stage puppet-stage-phase-${phase.name}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="puppet-stage-frame" aria-hidden="true">
        <div className="puppet-stage-sway">
          <div className="puppet-stage-scene">
            <div className="puppet-stage-wall"></div>
            <div className="puppet-stage-spot"></div>
            <div ref={setRef} className="puppet-stage-set">
              <div className="puppet-stage-floor"></div>
              <PuppetDealer
                className="puppet-stage-dealer"
                pose={phase.pose}
                giveAnchorRef={giveAnchorRef}
              />
              <div className="puppet-stage-tabletop"></div>
              <svg
                className="puppet-stage-chips"
                viewBox="0 0 480 480"
                preserveAspectRatio="xMidYMax meet"
                focusable="false"
              >
                {CHIP_STACKS.map((stack) => (
                  <g key={stack.x}>
                    {Array.from({ length: stack.count }, (_, index) => (
                      <ellipse
                        key={index}
                        className={index % 2 ? 'puppet-stage-chip-gold' : 'puppet-stage-chip-coral'}
                        cx={stack.x}
                        cy={stack.y - index * 5}
                        rx="15"
                        ry="5"
                      />
                    ))}
                  </g>
                ))}
              </svg>
              <div className="puppet-stage-apron"></div>
            </div>
            <div className="puppet-stage-curtain puppet-stage-curtain-left"></div>
            <div className="puppet-stage-curtain puppet-stage-curtain-right"></div>
            <div className="puppet-stage-valance"></div>
          </div>
        </div>
      </div>

      {/* The card he hands over: a card back that flips into the live read. */}
      <div ref={handoffRef} className="puppet-stage-handoff">
        <div className="puppet-stage-cardback" aria-hidden="true"></div>
        <div className="puppet-stage-read">
          <LiveReadCard />
        </div>
      </div>

      {reducedMotion ? (
        <div className="puppet-stage-peek" aria-hidden="true">
          <PuppetDealer variant="bust" pose="peek" />
        </div>
      ) : (
        <button
          type="button"
          className="puppet-stage-peek"
          onClick={() => setStep(0)}
          disabled={!isIdle}
          aria-label="Replay the dealer's routine"
          title="Replay"
        >
          <PuppetDealer variant="bust" pose="peek" />
        </button>
      )}

      {step < LAST_STEP - 1 && (
        <button type="button" className="puppet-stage-skip" onClick={() => setStep(LAST_STEP)}>
          Skip intro
        </button>
      )}
    </div>
  )
}

export default PuppetStage
