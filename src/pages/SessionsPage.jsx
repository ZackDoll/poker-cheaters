import { Link } from 'react-router'
import PagePlaceholder from '../components/PagePlaceholder.jsx'
import './SessionsPage.css'

function SessionsPage() {
  return (
    <div className="sessions-page">
      <PagePlaceholder
        eyebrow="SESSIONS"
        title="Match history"
        description="Every past session, with hand counts and how many of your reads were right."
      >
        <Link className="sessions-link" to="/sessions/sample">
          Open a sample session
        </Link>
      </PagePlaceholder>
    </div>
  )
}

export default SessionsPage
