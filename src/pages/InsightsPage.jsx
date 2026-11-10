import PagePlaceholder from '../components/PagePlaceholder.jsx'
import './InsightsPage.css'

function InsightsPage() {
  return (
    <div className="insights-page">
      <PagePlaceholder
        eyebrow="INSIGHTS"
        title="Your stats"
        description="Read accuracy over time, which signals predict best, and your own tells."
      />
    </div>
  )
}

export default InsightsPage
