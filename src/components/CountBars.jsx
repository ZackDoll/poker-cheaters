import './CountBars.css'

// A ranked list of labelled counts, drawn as bars relative to the largest.
function CountBars({ title, items, empty }) {
  const max = Math.max(1, ...items.map((item) => item.count))
  return (
    <section className="countbars">
      <h3 className="countbars-title">{title}</h3>
      {items.length === 0 ? (
        <p className="countbars-empty">{empty}</p>
      ) : (
        <ul className="countbars-list">
          {items.map((item, index) => (
            <li className="countbars-item" key={item.code}>
              <div className="countbars-row">
                <span>{item.label}</span>
                <span className="countbars-count">{item.count}×</span>
              </div>
              <div className="countbars-track">
                <div
                  className="countbars-fill"
                  style={{ width: `${(item.count / max) * 100}%`, animationDelay: `${index * 80}ms` }}
                ></div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default CountBars
