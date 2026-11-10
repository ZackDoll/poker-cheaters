import PagePlaceholder from '../components/PagePlaceholder.jsx'
import './SettingsPage.css'

function SettingsPage() {
  return (
    <div className="settings-page">
      <PagePlaceholder
        eyebrow="SETTINGS"
        title="Settings"
        description="Camera and mic setup, how reads are shown, and data retention."
      />
    </div>
  )
}

export default SettingsPage
