import './Avatar.css'

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

// A profile picture, or the person's initials when there is none.
function Avatar({ name, url, size = 36 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {url ? (
        <img className="avatar-image" src={url} alt="" referrerPolicy="no-referrer" />
      ) : (
        initials(name)
      )}
    </span>
  )
}

export default Avatar
