import { NavLink } from 'react-router'
import './Navbar.css'

function Navbar() {
  return (
    <nav className="navbar">
      <span className="navbar-brand">Poker Cheaters</span>
      <div className="navbar-links">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/about">About</NavLink>
      </div>
    </nav>
  )
}

export default Navbar
