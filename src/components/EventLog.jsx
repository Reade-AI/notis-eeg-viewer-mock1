import { useState, useMemo } from 'react'
import { useEEG } from '../store/EEGContext'
import './EventLog.css'

export default function EventLog({ isOpen = true }) {
  const { ischemiaEvents, annotations, currentTime, actions } = useEEG()
  const [selectedEvent, setSelectedEvent] = useState(null)

  // Combine ischemia events and annotations into a single chronological list
  const allEvents = useMemo(() => {
    const events = []
    
    // Add ischemia events
    ischemiaEvents.forEach(event => {
      events.push({
        id: event.id,
        type: 'ischemia',
        timestamp: event.startTime,
        text: `Ischemia detected (${(event.confidence * 100).toFixed(0)}% confidence)`,
        duration: event.endTime ? (event.endTime - event.startTime).toFixed(1) : null,
        severity: event.severity || 'warning',
        acknowledged: event.acknowledged || false,
        channelIds: event.channelIds || [],
        event: event,
      })
    })
    
    // Add annotations
    annotations.forEach(annotation => {
      events.push({
        id: annotation.id,
        type: annotation.type || 'note',
        timestamp: annotation.timestamp,
        text: annotation.text || '',
        duration: null,
        severity: null,
        acknowledged: false,
        channelIds: annotation.channelIds || [],
        annotation: annotation,
      })
    })
    
    // Sort by timestamp (most recent first)
    return events.sort((a, b) => b.timestamp - a.timestamp)
  }, [ischemiaEvents, annotations])

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = (seconds % 60).toFixed(1)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`
    }
    return `${minutes}:${secs.padStart(5, '0')}`
  }

  const handleEventClick = (event) => {
    if (event.type === 'ischemia' && event.event) {
      // Navigate to ischemia event (similar to notification click)
      const ischemiaEvent = event.event
      const eventCenter = ischemiaEvent.endTime 
        ? (ischemiaEvent.startTime + ischemiaEvent.endTime) / 2
        : ischemiaEvent.startTime
      const eventDuration = ischemiaEvent.endTime 
        ? ischemiaEvent.endTime - ischemiaEvent.startTime
        : 5
      const viewWindow = Math.max(eventDuration * 1.5, 10)
      
      actions.updateSettings('display', {
        timeOffset: currentTime - eventCenter,
        timeWindow: viewWindow,
      })
      
      if (actions.pauseMockStream) {
        actions.pauseMockStream()
      }
    }
    setSelectedEvent(event.id === selectedEvent ? null : event.id)
  }

  const handleDelete = (eventId, eventType) => {
    if (eventType === 'ischemia') {
      // Note: In a real app, you might want to mark as deleted rather than remove
      console.log('Delete ischemia event:', eventId)
    } else {
      actions.deleteAnnotation(eventId)
    }
  }

  const handleEdit = (event) => {
    if (event.type !== 'ischemia') {
      // Open edit dialog for annotations
      const newText = prompt('Edit annotation:', event.text)
      if (newText !== null) {
        actions.updateAnnotation(event.id, { text: newText })
      }
    }
  }

  const getEventIcon = (type) => {
    switch (type) {
      case 'ischemia':
        return '⚠️'
      case 'seizure':
        return '⚡'
      case 'artifact':
        return '🔧'
      case 'event':
        return '📌'
      default:
        return '📝'
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return '#ef4444'
      case 'warning':
        return '#f59e0b'
      case 'info':
        return '#3b82f6'
      default:
        return '#6b7280'
    }
  }

  return (
    <div className={`event-log ${isOpen ? 'open' : ''}`}>
      <div className="event-log-header">
        <h3>Event Log</h3>
        <div className="event-log-header-actions">
          <button 
            className="event-log-add-btn"
            onClick={() => {
              const text = prompt('Add annotation:')
              if (text) {
                actions.addAnnotation({
                  type: 'note',
                  text: text,
                  timestamp: currentTime,
                })
              }
            }}
            title="Add annotation"
          >
            +
          </button>
          <button 
            className="event-log-close-btn"
            onClick={actions.toggleEventLog}
            title="Close Event Log"
          >
            ×
          </button>
        </div>
      </div>
      
      <div className="event-log-content">
        {allEvents.length === 0 ? (
          <div className="event-log-empty">
            <p>No events recorded</p>
            <p className="event-log-empty-hint">Events and annotations will appear here</p>
          </div>
        ) : (
          <div className="event-log-list">
            {allEvents.map((event) => (
              <div
                key={event.id}
                className={`event-log-item ${selectedEvent === event.id ? 'selected' : ''} ${event.acknowledged ? 'acknowledged' : ''}`}
                onClick={() => handleEventClick(event)}
              >
                <div className="event-log-item-header">
                  <span className="event-log-icon">{getEventIcon(event.type)}</span>
                  <span className="event-log-time">{formatTime(event.timestamp)}</span>
                  {event.severity && (
                    <span 
                      className="event-log-severity"
                      style={{ color: getSeverityColor(event.severity) }}
                    >
                      {event.severity}
                    </span>
                  )}
                  {event.acknowledged && (
                    <span className="event-log-acknowledged">✓</span>
                  )}
                </div>
                <div className="event-log-item-text">{event.text}</div>
                {event.duration && (
                  <div className="event-log-item-duration">Duration: {event.duration}s</div>
                )}
                {event.channelIds && event.channelIds.length > 0 && (
                  <div className="event-log-item-channels">
                    Channels: {event.channelIds.join(', ')}
                  </div>
                )}
                <div className="event-log-item-actions">
                  {event.type !== 'ischemia' && (
                    <>
                      <button
                        className="event-log-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(event)
                        }}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        className="event-log-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Delete this event?')) {
                            handleDelete(event.id, event.type)
                          }
                        }}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="event-log-footer">
        <button 
          className="event-log-print-btn"
          onClick={() => {
            const printContent = allEvents.map(e => 
              `${formatTime(e.timestamp)} - ${e.text}`
            ).join('\n')
            const printWindow = window.open('', '_blank')
            printWindow.document.write(`
              <html>
                <head><title>Event Log</title></head>
                <body>
                  <h1>Event Log</h1>
                  <pre>${printContent}</pre>
                </body>
              </html>
            `)
            printWindow.document.close()
            printWindow.print()
          }}
        >
          Print All...
        </button>
      </div>
    </div>
  )
}

