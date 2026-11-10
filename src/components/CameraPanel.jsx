import CameraView from './CameraView.jsx'
import './CameraPanel.css'

function CameraPanel({ active, onToggle }) {
  return (
    <div className="camera-panel">
      <div className="camera-header">
        <span className="camera-status">
          <span className={`camera-dot ${active ? 'camera-dot-live' : ''}`}></span>
          {active ? 'CAMERA TEST' : 'SESSION OFF'}
        </span>
        <span>EXPRESSION TEST</span>
      </div>
      {active ? <CameraView /> : (
        <div className="camera-panel-placeholder">
          Camera is off. Start a session to test your front camera.
        </div>
      )}
      <p className="camera-panel-note">
        Video is processed in your browser without recording or uploading. Opponent reads are sample data.
      </p>
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

