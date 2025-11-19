import { useState } from 'react'
import { useEEG } from '../store/EEGContext'
import './AnnotationPanel.css'

export default function AnnotationPanel() {
  const { annotations, actions, currentTime } = useEEG()
  const [isAdding, setIsAdding] = useState(false)
  const [annotationType, setAnnotationType] = useState('note')
  const [annotationText, setAnnotationText] = useState('')
  const [selectedChannels, setSelectedChannels] = useState([])

  const CHANNEL_NAMES = ['F3-P3', 'P3-O1', 'F3-T3', 'T3-O1', 'F4-P4', 'P4-O2', 'F4-T4', 'T4-O2']

  const handleAddAnnotation = () => {
    if (!annotationText.trim()) {
      alert('Please enter annotation text')
      return
    }

    actions.addAnnotation({
      timestamp: currentTime,
      type: annotationType,
      text: annotationText,
      channelIds: selectedChannels,
    })

    setAnnotationText('')
    setSelectedChannels([])
    setIsAdding(false)
  }

  const handleDelete = (id) => {
    if (confirm('Delete this annotation?')) {
      actions.deleteAnnotation(id)
    }
  }

  const formatTime = (seconds) => {
    return seconds.toFixed(2) + 's'
  }

  const getTypeColor = (type) => {
    const colors = {
      note: '#3b82f6',
      seizure: '#ef4444',
      artifact: '#f59e0b',
      event: '#10b981',
    }
    return colors[type] || '#3b82f6'
  }

  return (
    <div className="annotation-panel">
      <div className="annotation-header">
        <h3>Annotations</h3>
        <button className="add-annotation-btn" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? 'Cancel' : '+ Add Annotation'}
        </button>
      </div>

      {isAdding && (
        <div className="annotation-form">
          <div className="form-group">
            <label>Type</label>
            <select value={annotationType} onChange={(e) => setAnnotationType(e.target.value)}>
              <option value="note">Note</option>
              <option value="seizure">Seizure</option>
              <option value="artifact">Artifact</option>
              <option value="event">Event</option>
            </select>
          </div>
          <div className="form-group">
            <label>Text</label>
            <textarea
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              placeholder="Enter annotation..."
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Channels (optional)</label>
            <div className="channel-checkboxes">
              {CHANNEL_NAMES.map((name, index) => (
                <label key={index} className="channel-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes(index)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedChannels([...selectedChannels, index])
                      } else {
                        setSelectedChannels(selectedChannels.filter(i => i !== index))
                      }
                    }}
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleAddAnnotation}>Add</button>
            <button className="btn-secondary" onClick={() => setIsAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="annotations-list">
        {annotations.length === 0 ? (
          <div className="no-annotations">No annotations yet</div>
        ) : (
          annotations.map((ann) => (
            <div key={ann.id} className="annotation-item" style={{ borderLeftColor: getTypeColor(ann.type) }}>
              <div className="annotation-header-item">
                <span className="annotation-type" style={{ backgroundColor: getTypeColor(ann.type) }}>
                  {ann.type.toUpperCase()}
                </span>
                <span className="annotation-time">{formatTime(ann.timestamp)}</span>
                <button className="delete-btn" onClick={() => handleDelete(ann.id)}>×</button>
              </div>
              <div className="annotation-text">{ann.text}</div>
              {ann.channelIds && ann.channelIds.length > 0 && (
                <div className="annotation-channels">
                  Channels: {ann.channelIds.map(i => CHANNEL_NAMES[i]).join(', ')}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

