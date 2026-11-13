import { NavLink } from 'react-router'
import './Sidebar.css'

function Sidebar({ user, onLogout }) {
  return (
    <aside className="sidebar">
      <NavLink className="sidebar-brand" to="/home">
        <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
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
      </NavLink>

      <nav className="sidebar-links">
        <NavLink to="/live">Live</NavLink>
        <NavLink to="/sessions">Sessions</NavLink>
        <NavLink to="/opponents">Opponents</NavLink>
        <NavLink to="/insights">Insights</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>

      <div className="sidebar-bottom">
        <nav className="sidebar-links">
          <NavLink to="/home">Home</NavLink>
        </nav>
        <div className="sidebar-user">
          {user?.avatarUrl && (
            <img
              className="sidebar-avatar"
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          )}
          <span className="sidebar-user-name">{user?.name || user?.email}</span>
        </div>
        <button className="sidebar-logout" type="button" onClick={onLogout}>
          Log out
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
