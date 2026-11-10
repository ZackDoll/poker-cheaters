import './PagePlaceholder.css'

// Shared "coming soon" layout used by pages that aren't built yet.
function PagePlaceholder({ eyebrow, title, description, children }) {
  return (
    <div className="page-placeholder">
      <header className="page-placeholder-header">
        <div className="page-placeholder-eyebrow">{eyebrow}</div>
        <h1 className="page-placeholder-title">{title}</h1>
        <p className="page-placeholder-text">{description}</p>
      </header>
      <div className="page-placeholder-body">
        Placeholder: this page is not built yet.
      </div>
      {children}
    </div>
  )
}

export default PagePlaceholder
