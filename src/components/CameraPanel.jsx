import './CameraPanel.css'

function CameraPanel({ active, onToggle }) {
  return (
    <div className="camera-panel">
      <div className="camera-header">
        <span className="camera-status">
          <span className={`camera-dot ${active ? 'camera-dot-live' : ''}`}></span>
          {active ? 'SESSION LIVE' : 'SESSION OFF'}
        </span>
        <span>SAMPLE DATA</span>
      </div>
      <div className="camera-view">
        {active
          ? 'Placeholder for live camera feed with seat tracking'
          : 'Camera is off. Start a session to begin reading the table.'}
      </div>
      <button
        className={`camera-button ${active ? 'camera-button-stop' : ''}`}
        type="button"
        onClick={onToggle}
      >
        {active ? 'End session' : 'Start session'}
      </button>
    </div>
  )
}

export default CameraPanel
