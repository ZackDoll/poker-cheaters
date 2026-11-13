import './PuppetDealer.css'

// The dealer is drawn in "puppet units" with the origin at the base of the
// torso, then scaled up inside the 480 x 480 stage coordinate system.
const FULL_VIEW = '0 0 480 480'
const BUST_VIEW = '82 112 292 246'

const DIAMOND = 'M0 -5l3.6 5-3.6 5-3.6-5z'
const SPADE = 'M0 -5c3 3.2 5 4.6 5 7a2.6 2.6 0 0 1-4.3 1.9c.1 1 .5 1.8 1.3 2.6h-4c.8-.8 1.2-1.6 1.3-2.6A2.6 2.6 0 0 1-5 2c0-2.4 2-3.8 5-7z'

// The fan he shows the audience: a royal flush in diamonds.
const FAN_CARDS = [
  { rank: 'A', offset: -2 },
  { rank: 'K', offset: -1 },
  { rank: 'Q', offset: 0 },
  { rank: 'J', offset: 1 },
  { rank: '10', offset: 2 },
]

// Cards that spring from hand to hand during the shuffle.
const SPRING_CARDS = [0, 1, 2, 3, 4, 5, 6]

// Where the pulled card ends its rise, so the stage can hand it to the page.
const PULL_ORIGIN = { x: 48.5, y: -38.2 }
const PULL_RISE = 34

function CardBack({ x, y, width, height }) {
  const cx = x + width / 2
  const cy = y + height / 2
  return (
    <g className="puppet-dealer-card-back">
      <rect x={x} y={y} width={width} height={height} rx="2" />
      <path
        d={`M${cx} ${cy - height * 0.3}l${width * 0.3} ${height * 0.3}-${width * 0.3} ${height * 0.3}-${width * 0.3}-${height * 0.3}z`}
      />
    </g>
  )
}

function PuppetDealer({ pose = 'closed', variant = 'full', className = '', giveAnchorRef }) {
  const isFull = variant === 'full'

  return (
    <svg
      className={`puppet-dealer puppet-dealer-pose-${pose} ${className}`}
      viewBox={isFull ? FULL_VIEW : BUST_VIEW}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(228 392) scale(2.8)">
        <g className="puppet-dealer-body">
          <line className="puppet-dealer-rod" x1="0" y1="0" x2="0" y2="70" />
          <path className="puppet-dealer-shirt" d="M-24 0L-20-34Q0-44 20-34L24 0Z" />
          <path className="puppet-dealer-vest" d="M-13 0L-11-36L0-22L11-36L13 0Z" />
          <path className="puppet-dealer-tie" d="M-3-36h6l1 16-4 6-4-6z" />

          {/* Head: a playing card, pivoting at the neck. */}
          <g transform="translate(0 -40)">
            <g className="puppet-dealer-head">
              <g className="puppet-dealer-head-back">
                <CardBack x={-16} y={-46} width={32} height={46} />
              </g>
              <g className="puppet-dealer-head-face">
                <rect className="puppet-dealer-card-face" x="-16" y="-46" width="32" height="46" rx="4" />
                <g className="puppet-dealer-pip">
                  <text className="puppet-dealer-rank" x="-11" y="-36.5" textAnchor="middle">A</text>
                  <path d={DIAMOND} transform="translate(-11 -31.5) scale(0.55)" />
                </g>
                <g className="puppet-dealer-pip" transform="rotate(180 0 -23)">
                  <text className="puppet-dealer-rank" x="-11" y="-36.5" textAnchor="middle">A</text>
                  <path d={DIAMOND} transform="translate(-11 -31.5) scale(0.55)" />
                </g>
                <g transform="translate(-5 -25)">
                  <ellipse className="puppet-dealer-eye" rx="1.9" ry="1.9" />
                </g>
                <g transform="translate(5 -25)">
                  <ellipse className="puppet-dealer-eye puppet-dealer-eye-wink" rx="1.9" ry="1.9" />
                </g>
                <path className="puppet-dealer-mouth" d="M-6 -17q6 5 12 0" />
              </g>
            </g>
          </g>

          {/* Left arm (viewer's left): holds the burn card. */}
          <g transform="translate(-19 -33)">
            <g className="puppet-dealer-arm puppet-dealer-arm-left">
              <path className="puppet-dealer-sleeve-edge" d="M0 0V27" />
              <path className="puppet-dealer-sleeve" d="M0 0V27" />
              <g transform="translate(0 30)">
                <g className="puppet-dealer-held">
                  {isFull && (
                    <>
                      <g className="puppet-dealer-half-deck">
                        <CardBack x={-8} y={-22} width={16} height={18} />
                      </g>
                      <g className="puppet-dealer-burn">
                        <g transform="translate(0 -18)">
                          <g className="puppet-dealer-burn-card">
                            <g className="puppet-dealer-burn-back">
                              <CardBack x={-8} y={-13} width={16} height={26} />
                            </g>
                            <g className="puppet-dealer-burn-face">
                              <rect className="puppet-dealer-card-face" x="-8" y="-13" width="16" height="26" rx="2" />
                              <text className="puppet-dealer-rank puppet-dealer-rank-dark" x="-4.2" y="-6" textAnchor="middle">A</text>
                              <path className="puppet-dealer-pip-dark" d={SPADE} transform="translate(0 2) scale(0.9)" />
                            </g>
                            <g transform="translate(0 -13)">
                              <rect className="puppet-dealer-burn-char" x="-8" y="0" width="16" height="26" rx="2" />
                            </g>
                          </g>
                        </g>
                        <g transform="translate(1 -30)">
                          <g className="puppet-dealer-flame">
                            <path className="puppet-dealer-flame-outer" d="M0 0C-10 -6 -8 -16 -2 -24C-1 -17 3 -17 4 -20C10 -12 9 -4 0 0Z" />
                            <path className="puppet-dealer-flame-inner" d="M0 -1C-5 -4 -4 -9 -1 -14C0 -10 2 -10 3 -11C5 -7 4 -3 0 -1Z" />
                          </g>
                        </g>
                        <g className="puppet-dealer-ash">
                          <circle cx="-4" cy="-20" r="1.1" />
                          <circle cx="3" cy="-24" r="0.9" />
                          <circle cx="0" cy="-16" r="1.3" />
                          <circle cx="5" cy="-18" r="0.8" />
                        </g>
                      </g>
                    </>
                  )}
                </g>
              </g>
              <circle className="puppet-dealer-glove" cy="30" r="4.4" />
            </g>
            <circle className="puppet-dealer-brad" r="1.5" />
          </g>

          {/* Right arm: holds the deck and the fan. */}
          <g transform="translate(19 -33)">
            <g className="puppet-dealer-arm puppet-dealer-arm-right">
              <path className="puppet-dealer-sleeve-edge" d="M0 0V27" />
              <path className="puppet-dealer-sleeve" d="M0 0V27" />
              <g transform="translate(0 30)">
                <g className="puppet-dealer-held">
                  {isFull && (
                    <>
                      <g className="puppet-dealer-half-deck">
                        <CardBack x={-8} y={-22} width={16} height={18} />
                      </g>
                      <g className="puppet-dealer-fan">
                        {FAN_CARDS.map((card) => (
                          <g
                            key={card.rank}
                            className="puppet-dealer-fan-card"
                            style={{ '--puppet-dealer-i': card.offset }}
                          >
                            <g className="puppet-dealer-fan-back">
                              <CardBack x={-8} y={-30} width={16} height={26} />
                            </g>
                            <g className="puppet-dealer-fan-face">
                              <rect className="puppet-dealer-card-face" x="-8" y="-30" width="16" height="26" rx="2" />
                              <text className="puppet-dealer-rank" x="-3.5" y="-22.5" textAnchor="middle">{card.rank}</text>
                              <path className="puppet-dealer-pip" d={DIAMOND} transform="translate(0 -14) scale(0.8)" />
                            </g>
                          </g>
                        ))}
                      </g>
                    </>
                  )}
                </g>
              </g>
              <circle className="puppet-dealer-glove" cy="30" r="4.4" />
            </g>
            <circle className="puppet-dealer-brad" r="1.5" />
          </g>

          {isFull && (
            <>
              {/* Shuffle: cards travel an arc over his head, pivoting below it. */}
              <g transform="translate(0 -58.4)">
                {SPRING_CARDS.map((index) => (
                  <g
                    key={index}
                    className={`puppet-dealer-spring-card ${index % 2 ? 'puppet-dealer-spring-face' : ''}`}
                    style={{ '--puppet-dealer-i': index }}
                  >
                    {index % 2 ? (
                      <rect className="puppet-dealer-card-face" x="-6" y="-58.1" width="12" height="17" rx="1.5" />
                    ) : (
                      <CardBack x={-6} y={-58.1} width={12} height={17} />
                    )}
                  </g>
                ))}
              </g>

              {/* The card he pulls out of the fan and offers to the viewer. */}
              <g transform={`translate(${PULL_ORIGIN.x} ${PULL_ORIGIN.y})`}>
                <g className="puppet-dealer-pull-card">
                  <CardBack x={-8} y={-30} width={16} height={26} />
                </g>
              </g>
              <rect
                ref={giveAnchorRef}
                className="puppet-dealer-give-anchor"
                x={PULL_ORIGIN.x - 9.2}
                y={PULL_ORIGIN.y - 17 - PULL_RISE - 15}
                width="18.4"
                height="30"
              />
            </>
          )}

          {!isFull && (
            <g transform="translate(40 -8)">
              <g className="puppet-dealer-toss">
                <CardBack x={-6} y={-9} width={12} height={18} />
              </g>
            </g>
          )}
        </g>
      </g>
    </svg>
  )
}

export default PuppetDealer
