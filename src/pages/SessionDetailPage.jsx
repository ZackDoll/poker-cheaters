import { Link, useParams } from 'react-router'
import PagePlaceholder from '../components/PagePlaceholder.jsx'
import './SessionDetailPage.css'

function SessionDetailPage() {
  const { sessionId } = useParams()

  return (
    <div className="session-detail-page">
      <PagePlaceholder
        eyebrow={`SESSION · ${sessionId.toUpperCase()}`}
        title="Session review"
        description="Hand-by-hand breakdown of the signals, your reads, and what actually happened."
      >
        <Link className="session-detail-back" to="/sessions">
          ← Back to sessions
        </Link>
      </PagePlaceholder>
    </div>
  )
}

export default SessionDetailPage
