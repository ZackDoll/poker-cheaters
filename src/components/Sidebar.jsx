import { NavLink } from 'react-router'
import './Sidebar.css'

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Poker Cheaters</div>
      <nav className="sidebar-links">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/login">Login</NavLink>
      </nav>
    </aside>
  )
}

export default Sidebar
