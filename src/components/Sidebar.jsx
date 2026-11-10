import { NavLink } from 'react-router'
import './Sidebar.css'

function Sidebar() {
  return (
    <aside className="sidebar">
      <NavLink className="sidebar-brand" to="/">
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
        <NavLink to="/home">Home</NavLink>
      </nav>

      <nav className="sidebar-links sidebar-links-bottom">
        <NavLink to="/" end>Landing page</NavLink>
        <NavLink to="/login">Login</NavLink>
      </nav>
    </aside>
  )
}

export default Sidebar
