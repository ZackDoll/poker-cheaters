import VideoTile from './VideoTile.jsx'
import PlayingCard from './PlayingCard.jsx'
import BluffReadBadge from './BluffReadBadge.jsx'
import AnimatedNumber from './AnimatedNumber.jsx'
import { parseCard } from '../helpers/cards.js'
import { useCountdown } from '../helpers/useCountdown.js'
import './PlayerSeat.css'

// One player's place at the table: camera, name plate, stack, status and bluff read.
function PlayerSeat({
  seat,
  member,
  stream,
  isYou,
  isActor,
  isButton,
  isWinner,
  deadline,
  read,
  dealKey,
  dealOrder,
  canKick,
  onKick,
}) {
  const fraction = useCountdown(isActor ? deadline : null)
  const hole = seat.hole?.map(parseCard)
  const away = !member.connected
  const busted = seat.stack === 0 && !seat.in_hand && !seat.all_in

  const classes = [
    'playerseat',
    isActor ? 'playerseat-active' : '',
    seat.folded ? 'playerseat-folded' : '',
    isWinner ? 'playerseat-winner' : '',
    away ? 'playerseat-away' : '',
  ]

  return (
    <div className={classes.filter(Boolean).join(' ')}>
      <div className="playerseat-read">
        <BluffReadBadge read={read} />
      </div>

      <div className="playerseat-ring" style={{ '--progress': fraction }}>
        <div className="playerseat-tile">
          <VideoTile
            stream={stream}
            name={member.name}
            avatarUrl={member.avatar}
            camOn={member.cam}
            micOn={member.mic}
            local={isYou}
          />
          {seat.has_cards && !isYou && (
            <div className="playerseat-cards">
              {[0, 1].map((index) => (
                <PlayingCard
                  key={`${dealKey}-${index}`}
                  size="sm"
                  deal
                  dealDelay={dealOrder * 90 + index * 260}
                  faceDown={!hole?.[index]}
                  {...(hole?.[index] || {})}
                  win={isWinner && Boolean(hole?.[index])}
                />
              ))}
            </div>
          )}
          {isButton && (
            <span className="playerseat-button" title="Dealer button">
              D
            </span>
          )}
          {(seat.folded || away || busted || seat.all_in) && (
            <span className={`playerseat-tag ${seat.all_in && !seat.folded ? 'playerseat-tag-allin' : ''}`}>
              {seat.folded ? 'FOLDED' : seat.all_in ? 'ALL IN' : away ? 'AWAY' : 'OUT'}
            </span>
          )}
        </div>
      </div>

      <div className="playerseat-plate">
        <span className="playerseat-name">
          {member.name}
          {isYou && <span className="playerseat-you"> · you</span>}
        </span>
        <span className="playerseat-stack">
          <AnimatedNumber value={seat.stack} />
        </span>
        {canKick && !isYou && (
          <button className="playerseat-kick" type="button" onClick={onKick} aria-label={`Remove ${member.name}`}>
            ×
          </button>
        )}
      </div>
    </div>
  )
}

export default PlayerSeat
