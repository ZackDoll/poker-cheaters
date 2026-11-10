import PagePlaceholder from '../components/PagePlaceholder.jsx'
import './OpponentsPage.css'

function OpponentsPage() {
  return (
    <div className="opponents-page">
      <PagePlaceholder
        eyebrow="OPPONENTS"
        title="Player profiles"
        description="A behavior baseline for each regular opponent, and how their tells have held up over time."
      />
    </div>
  )
}

export default OpponentsPage
