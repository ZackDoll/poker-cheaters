import { Link } from 'react-router'
import './PageNotice.css'

// Loading, error and empty states for data pages. action is { to, label }.
function PageNotice({ kind, title, text, action }) {
  if (kind === 'loading') {
    return (
      <div className="pagenotice-skeletons" role="status" aria-label="Loading">
        {[0, 1, 2].map((index) => (
          <div className="pagenotice-skeleton" key={index} style={{ animationDelay: `${index * 120}ms` }}></div>
        ))}
      </div>
    )
  }
  return (
    <div className={`pagenotice pagenotice-${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      <h2 className="pagenotice-title">{title}</h2>
      <p className="pagenotice-text">{text}</p>
      {action && (
        <Link className="pagenotice-action" to={action.to}>
          {action.label}
        </Link>
      )}
    </div>
  )
}

export default PageNotice
