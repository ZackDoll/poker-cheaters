import { useSyncExternalStore } from 'react'
import { Link, NavLink } from 'react-router'
import { getActiveRoom, subscribeActiveRoom } from '../helpers/activeRoom.js'
import './TopBar.css'

// The header above every signed-in page. "Play live" lives here, not in the sidebar.
// compact is the slim version shown on the immersive table page.
function TopBar({ compact = false }) {
  const activeRoom = useSyncExternalStore(subscribeActiveRoom, getActiveRoom)

  return (
    <header className={`topbar ${compact ? 'topbar-compact' : ''}`}>
      {compact && (
        <Link className="topbar-brand" to="/home">
          Tell
        </Link>
      )}
      <nav className="topbar-nav" aria-label="Main">
        <NavLink className="topbar-play" to="/play" end={false}>
          <span className="topbar-play-dot" aria-hidden="true"></span>
          Play live
        </NavLink>
      </nav>
      {activeRoom && (
        <Link className="topbar-room" to={`/play/${activeRoom}`}>
          Back to table
          <span className="topbar-room-code">{activeRoom}</span>
        </Link>
      )}
    </header>
  )
}

export default TopBar
