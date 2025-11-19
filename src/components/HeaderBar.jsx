import { useState, useRef, useEffect } from 'react'
import { useEEG } from '../store/EEGContext'
import { getChannelLabel } from '../utils/montages'
import PatientModal from './PatientModal'
import './HeaderBar.css'

export default function HeaderBar() {
  const { settings, isStreaming, ui, actions, ischemiaEvents, currentTime, eegBuffer } = useEEG()
  const { patient, system } = settings
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [patientModalOpen, setPatientModalOpen] = useState(false)
  const notificationsRef = useRef(null)

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [notificationsOpen])

  const formatTimestamp = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = (seconds % 60).toFixed(1)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`
    }
    return `${minutes}:${secs.padStart(5, '0')}`
  }

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  // Calculate recording duration and update in real-time
  const [recordingDuration, setRecordingDuration] = useState(0)
  
  useEffect(() => {
    if (isStreaming && currentTime) {
      setRecordingDuration(currentTime)
    } else if (!isStreaming) {
      // Keep the last duration when stopped
      if (currentTime) {
        setRecordingDuration(currentTime)
      }
    }
  }, [isStreaming, currentTime])
  
  const recordingDurationFormatted = formatTimestamp(recordingDuration)

  const handleIschemiaEventClick = (event) => {
    console.log('🔍 Clicked on ischemia event:', event)
    
    // Pause streaming if it's running
    if (isStreaming) {
      console.log('⏸ Pausing stream...')
      actions.stopMockStream()
    }
    
    // Wait a moment for stream to stop, then navigate
    setTimeout(() => {
      // Calculate time offset to center the ischemia event in the view
      const timeWindow = settings.display.timeWindow
      const timeScale = settings.display.timeScale
      const baseTimeScale = 30
      const adjustedTimeWindow = timeWindow * (baseTimeScale / timeScale)
      
      // Get the maximum time available in the actual data buffer
      let maxTime = currentTime || 0
      if (eegBuffer && eegBuffer.length > 0 && eegBuffer[0] && eegBuffer[0].length > 0) {
        maxTime = eegBuffer[0][eegBuffer[0].length - 1].x
      }
      // Fallback to event time if no data
      if (maxTime === 0) {
        maxTime = event.endTime || event.startTime + 10
      }
      
      console.log('📊 Navigation calculation:', {
        currentTime: currentTime?.toFixed(2),
        eventStart: event.startTime,
        eventEnd: event.endTime,
        maxTime: maxTime.toFixed(2),
        timeWindow,
        timeScale,
        adjustedTimeWindow: adjustedTimeWindow.toFixed(2)
      })
      
      // Calculate the center point between start and end
      let eventCenter
      let eventDuration = 0
      if (event.endTime) {
        // If event has ended, center between start and end
        eventDuration = event.endTime - event.startTime
        eventCenter = (event.startTime + event.endTime) / 2
      } else {
        // If event is ongoing, assume 5 second duration for centering
        eventDuration = 5
        eventCenter = event.startTime + (eventDuration / 2)
      }
      
      // Ensure the view window is large enough to show the entire event
      // Add padding on both sides (at least 3 seconds before start and after end)
      const padding = 3
      const requiredWindow = eventDuration + (padding * 2)
      const viewWindow = Math.max(adjustedTimeWindow, requiredWindow)
      
      console.log('📐 Event details:', {
        eventDuration: eventDuration.toFixed(2),
        eventCenter: eventCenter.toFixed(2),
        requiredWindow: requiredWindow.toFixed(2),
        viewWindow: viewWindow.toFixed(2),
        padding
      })
      
      // Calculate the desired view range to center the event
      // We want: [eventCenter - viewWindow/2, eventCenter + viewWindow/2]
      const desiredMinTime = Math.max(0, eventCenter - (viewWindow / 2))
      const desiredMaxTime = eventCenter + (viewWindow / 2)
      
      // Calculate offset: offset = maxTime - desiredMaxTime
      // This will position the view so that desiredMaxTime is at the right edge
      let timeOffset = maxTime - desiredMaxTime
      
      // Ensure we don't go negative (can't scroll past the beginning)
      timeOffset = Math.max(0, timeOffset)
      
      // Verify that both start and end will be visible
      const actualMaxTime = maxTime - timeOffset
      const actualMinTime = actualMaxTime - viewWindow
      
      console.log('🎯 Initial calculation:', {
        desiredMinTime: desiredMinTime.toFixed(2),
        desiredMaxTime: desiredMaxTime.toFixed(2),
        timeOffset: timeOffset.toFixed(2),
        actualMinTime: actualMinTime.toFixed(2),
        actualMaxTime: actualMaxTime.toFixed(2)
      })
      
      // If start is not visible, adjust to show it
      if (actualMinTime > event.startTime - padding) {
        console.log('⚠️ Start not visible, adjusting...')
        // Need to show more to the left - reduce offset
        const neededMaxTime = event.endTime ? event.endTime + padding : event.startTime + eventDuration + padding
        timeOffset = Math.max(0, maxTime - neededMaxTime)
        console.log('   Adjusted timeOffset:', timeOffset.toFixed(2))
      }
      
      // If end is not visible, adjust to show it
      const finalMaxTime = maxTime - timeOffset
      const finalMinTime = finalMaxTime - viewWindow
      if (event.endTime && finalMaxTime < event.endTime + padding) {
        console.log('⚠️ End not visible, adjusting...')
        // Need to show more to the right - increase offset (but not beyond start)
        const neededMinTime = Math.max(0, event.startTime - padding)
        const neededMaxTime = neededMinTime + viewWindow
        timeOffset = Math.max(0, maxTime - neededMaxTime)
        console.log('   Adjusted timeOffset:', timeOffset.toFixed(2))
      }
      
      // Final verification
      const finalMaxTime2 = maxTime - timeOffset
      const finalMinTime2 = finalMaxTime2 - viewWindow
      
      console.log('✅ Final navigation:', {
        timeOffset: timeOffset.toFixed(2),
        finalViewRange: `${finalMinTime2.toFixed(2)} - ${finalMaxTime2.toFixed(2)}`,
        eventStart: event.startTime.toFixed(2),
        eventEnd: event.endTime ? event.endTime.toFixed(2) : 'ongoing',
        startVisible: finalMinTime2 <= event.startTime && event.startTime <= finalMaxTime2,
        endVisible: event.endTime ? (finalMinTime2 <= event.endTime && event.endTime <= finalMaxTime2) : 'N/A'
      })
      
      // Update the time offset to navigate to the event
      console.log('🔄 Updating settings with timeOffset:', timeOffset)
      actions.updateSettings('display', { timeOffset })
      
      // Force a small delay to ensure state update propagates
      setTimeout(() => {
        console.log('✅ Settings updated, timeOffset should now be:', timeOffset)
      }, 50)
      
      // Close the notification dropdown
      setNotificationsOpen(false)
    }, 100)
  }

  return (
    <div className="header-bar">
      <div className="header-left">
        <div className="app-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="40" height="40" rx="8" fill="url(#notisLogoGradient)"/>
            <path d="M12 20L16 16L20 24L24 12L28 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="20" r="2" fill="white"/>
            <circle cx="16" cy="16" r="2" fill="white"/>
            <circle cx="20" cy="24" r="2" fill="white"/>
            <circle cx="24" cy="12" r="2" fill="white"/>
            <circle cx="28" cy="20" r="2" fill="white"/>
            <defs>
              <linearGradient id="notisLogoGradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3b82f6"/>
                <stop offset="1" stopColor="#1e40af"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="app-branding">
          <h1 className="app-title">NOTIS EEG Viewer</h1>
          <span className="app-subtitle">MOCK 1</span>
        </div>
        <div className="patient-info-compact">
          <div className="patient-info-display">
            <div className="patient-id-compact">
              {patient.patientId || 'No Patient'}
            </div>
            {patient.firstName || patient.lastName ? (
              <div className="patient-name-compact">
                {patient.firstName || ''} {patient.lastName || ''}
              </div>
            ) : null}
            {patient.sessionType && (
              <span className="session-badge-compact">{patient.sessionType}</span>
            )}
          </div>
          <button 
            className="edit-patient-icon-btn"
            onClick={() => setPatientModalOpen(true)}
            title="Edit Patient Information"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.12 5.13L18.87 8.88L20.71 7.04Z" 
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <PatientModal isOpen={patientModalOpen} onClose={() => setPatientModalOpen(false)} />
      </div>

      <div className="header-center">
        <div className="recording-info-section">
          <div className="status-group">
            <div className={`status-card ${system.deviceConnected ? 'status-active' : 'status-inactive'}`}>
              <div className="status-header">
                <span className="status-dot-large"></span>
                <span className="status-label">Device</span>
              </div>
              <span className="status-value">{system.deviceConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            <div className={`status-card ${isStreaming ? 'status-active' : 'status-inactive'}`}>
              <div className="status-header">
                <span className="status-dot-large"></span>
                <span className="status-label">Stream</span>
              </div>
              <span className="status-value">{isStreaming ? 'Active' : 'Stopped'}</span>
            </div>
            
            {isStreaming && (
              <div className="recording-timer">
                <span className="timer-label">Duration</span>
                <span className="timer-value">{recordingDurationFormatted}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="stream-controls">
          <button
            className={`stream-button start-button ${isStreaming ? 'disabled' : ''}`}
            onClick={() => actions.startMockStream()}
            disabled={isStreaming || !system.deviceConnected}
            title="Start EEG recording"
          >
            <span className="button-icon">▶</span>
            <span className="button-text">Start</span>
          </button>
          <button
            className={`stream-button pause-button ${!isStreaming ? 'disabled' : ''}`}
            onClick={() => actions.stopMockStream()}
            disabled={!isStreaming}
            title="Pause EEG recording"
          >
            <span className="button-icon">⏸</span>
            <span className="button-text">Pause</span>
          </button>
          <button
            className={`stream-button stop-button ${!isStreaming ? 'disabled' : ''}`}
            onClick={() => {
              actions.stopMockStream()
              
              // Wait a moment for stream to stop, then adjust view
              // Store the current time window before stopping to preserve user's manual setting
              const currentTimeWindowBeforeStop = settings.display.timeWindow || 10
              
              setTimeout(() => {
                // Calculate the time window needed to show all data from start
                // Get the current data range
                const maxTime = eegBuffer && eegBuffer.length > 0 && eegBuffer[0].length > 0 
                  ? eegBuffer[0][eegBuffer[0].length - 1]?.x 
                  : (currentTime || 0)
                // Always assume data starts from 0 (mock stream starts from 0)
                // The buffer might be trimmed, so we can't rely on the first point
                const dataMinTime = 0
                const dataRange = maxTime - dataMinTime
                
                if (dataRange > 0) {
                  // Set time window to show all data (add a small buffer)
                  // But only if the user hasn't manually set a smaller window
                  const timeWindowToShowAll = Math.max(10, Math.ceil(dataRange) + 1)
                  
                  // Only update time window if it was at default (10s) or very large when Stop was clicked
                  // Use the stored value from before the stop, not the current value
                  // This preserves user's manual time window setting
                  const shouldUpdateWindow = currentTimeWindowBeforeStop <= 10 || currentTimeWindowBeforeStop >= timeWindowToShowAll - 1
                  
                  // Calculate offset to show from the start
                  const baseTimeScale = 30
                  const currentTimeScale = settings.display.timeScale
                  const timeWindowToUse = shouldUpdateWindow ? timeWindowToShowAll : currentTimeWindow
                  const adjustedTimeWindow = timeWindowToUse * (baseTimeScale / currentTimeScale)
                  
                  // Calculate offset to show from the start
                  // When window is large, we want to show from dataMinTime
                  // offset = maxTime - dataMinTime - adjustedTimeWindow
                  // But if this is negative (window > dataRange), we still want to show from start
                  // So we use the actual calculation and ensure it shows from start
                  let offsetToShowStart = maxTime - dataMinTime - adjustedTimeWindow
                  
                  // If window is larger than data range, we can't scroll, but we want to show from start
                  // In this case, set offset to ensure we show from dataMinTime
                  if (adjustedTimeWindow >= dataRange) {
                    // Window is large enough to show all data - set offset to show from start
                    // The offset should position the view so that dataMinTime is at the left edge
                    offsetToShowStart = maxTime - dataMinTime - adjustedTimeWindow
                    // Clamp to 0 minimum, but this should show from start when window is large
                  } else {
                    // Window is smaller than data range - use calculated offset
                    offsetToShowStart = Math.max(0, offsetToShowStart)
                  }
                  
                  // Verify the calculation will show from start
                  const willShowFrom = maxTime - offsetToShowStart - adjustedTimeWindow
                  const willShowTo = maxTime - offsetToShowStart
                  
                  console.log('Stop button: Adjusting view to show all data', {
                    maxTime: maxTime.toFixed(2),
                    dataMinTime: dataMinTime.toFixed(2),
                    dataRange: dataRange.toFixed(2),
                    currentTimeWindow,
                    timeWindowToShowAll,
                    shouldUpdateWindow,
                    timeWindowToUse,
                    adjustedTimeWindow: adjustedTimeWindow.toFixed(2),
                    offsetToShowStart: offsetToShowStart.toFixed(2),
                    willShowFrom: willShowFrom.toFixed(2),
                    willShowTo: willShowTo.toFixed(2),
                    windowIsLarge: adjustedTimeWindow >= dataRange
                  })
                  
                  // Update settings to show all data from the start
                  if (shouldUpdateWindow) {
                    actions.updateSettings('display', { 
                      timeWindow: timeWindowToShowAll,
                      timeOffset: Math.max(0, offsetToShowStart)
                    })
                  } else {
                    // Keep user's time window, just adjust offset
                    actions.updateSettings('display', { 
                      timeOffset: Math.max(0, offsetToShowStart)
                    })
                  }
                } else {
                  // No data yet, just reset offset
                  actions.updateSettings('display', { timeOffset: 0 })
                }
              }, 100)
            }}
            disabled={!isStreaming}
            title="Stop EEG recording and show all data from start"
          >
            <span className="button-icon">⏹</span>
            <span className="button-text">Stop</span>
          </button>
        </div>
      </div>

      <div className="header-right">
        <div className="header-actions">
          <div className="notification-container" ref={notificationsRef}>
            <button
              className="icon-button notification-button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              title={`Ischemia Detection Alerts${ischemiaEvents && ischemiaEvents.length > 0 ? ` (${ischemiaEvents.length} unread)` : ''}`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.89 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" 
                  fill="currentColor"
                />
              </svg>
              {ischemiaEvents && ischemiaEvents.length > 0 && (
                <span className="notification-badge">{ischemiaEvents.length}</span>
              )}
            </button>
            {notificationsOpen && (
              <div className="notifications-dropdown">
                <div className="notifications-header">
                  <h3>Ischemia Alerts</h3>
                  <span className="notification-count">{ischemiaEvents?.length || 0} event(s)</span>
                </div>
                <div className="notifications-list">
                  {ischemiaEvents && ischemiaEvents.length > 0 ? (
                    ischemiaEvents
                      .filter(event => {
                        const severity = event.severity || 'info'
                        return settings.alerts.severityLevels[severity] !== false
                      })
                      .map((event, index) => {
                        const severity = event.severity || 'info'
                        const severityColors = {
                          critical: '#ef4444',
                          warning: '#f59e0b',
                          info: '#3b82f6'
                        }
                        const severityLabels = {
                          critical: 'CRITICAL',
                          warning: 'WARNING',
                          info: 'INFO'
                        }
                        const isAcknowledged = event.acknowledged || false
                        
                        return (
                          <div 
                            key={index} 
                            className={`notification-item ${severity} ${isAcknowledged ? 'acknowledged' : ''}`}
                            onClick={() => handleIschemiaEventClick(event)}
                            style={{ 
                              cursor: 'pointer',
                              borderLeft: `4px solid ${severityColors[severity]}`,
                              opacity: isAcknowledged ? 0.6 : 1
                            }}
                            title="Click to pause and navigate to this event"
                          >
                            <div className="notification-icon" style={{ color: severityColors[severity] }}>
                              {severity === 'critical' ? '🔴' : severity === 'warning' ? '🟡' : '🔵'}
                            </div>
                            <div className="notification-content">
                              <div className="notification-title">
                                <span>Ischemia Detected</span>
                                <span className="severity-badge" style={{ 
                                  backgroundColor: severityColors[severity],
                                  color: 'white',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  marginLeft: '8px'
                                }}>
                                  {severityLabels[severity]}
                                </span>
                                {isAcknowledged && (
                                  <span className="acknowledged-badge" style={{
                                    marginLeft: '8px',
                                    fontSize: '10px',
                                    color: 'var(--text-secondary)'
                                  }}>
                                    ✓ Acknowledged
                                  </span>
                                )}
                              </div>
                              <div className="notification-details">
                                <div className="notification-time">
                                  Start: {formatTimestamp(event.startTime)}s
                                </div>
                                {event.endTime && (
                                  <div className="notification-time">
                                    End: {formatTimestamp(event.endTime)}s
                                    <span style={{ marginLeft: '8px', color: 'var(--text-secondary)' }}>
                                      (Duration: {formatTimestamp(event.endTime - event.startTime)})
                                    </span>
                                  </div>
                                )}
                                {!event.endTime && (
                                  <div className="notification-time" style={{ color: '#ef4444', fontWeight: 500 }}>
                                    Ongoing
                                  </div>
                                )}
                                {event.confidence && (
                                  <div className="notification-confidence">
                                    Confidence: {(event.confidence * 100).toFixed(1)}%
                                  </div>
                                )}
                                {event.detectionCriteria && (
                                  <div className="notification-criteria" style={{ 
                                    marginTop: '8px', 
                                    padding: '8px',
                                    backgroundColor: 'var(--bg-secondary)',
                                    borderRadius: '4px',
                                    fontSize: '11px'
                                  }}>
                                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Detection Criteria:</div>
                                    <div>Power Drop: {(event.detectionCriteria.relativePowerDrop * 100).toFixed(0)}%</div>
                                    <div>Alpha/Delta Ratio: {event.detectionCriteria.alphaDeltaRatio.toFixed(2)}</div>
                                    <div>Slow Wave Increase: {(event.detectionCriteria.slowWaveIncrease * 100).toFixed(0)}%</div>
                                    {event.primaryChannels && event.primaryChannels.length > 0 && (
                                      <div style={{ marginTop: '4px' }}>
                                        Primary Channels: {event.primaryChannels.map(ch => getChannelLabel(settings.display.montage, ch)).join(', ')}
                                      </div>
                                    )}
                                    {event.channelIds && (
                                      <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                                        All Affected: {event.channelIds.length} channels
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {!isAcknowledged && (
                                <button
                                  className="acknowledge-btn"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    actions.acknowledgeAlert(event.id)
                                  }}
                                  style={{
                                    marginTop: '8px',
                                    padding: '4px 12px',
                                    fontSize: '11px',
                                    backgroundColor: severityColors[severity],
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Acknowledge
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })
                  ) : (
                    <div className="notification-empty">No ischemia events detected</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            className="icon-button theme-toggle"
            onClick={() => actions.setTheme(ui?.theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${ui?.theme === 'dark' ? 'light' : 'dark'} mode (Currently: ${ui?.theme || 'light'})`}
          >
            {ui?.theme === 'dark' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M12 7C13.93 7 15.68 7.78 16.95 9.05C18.22 10.32 19 12.07 19 14C19 15.93 18.22 17.68 16.95 18.95C15.68 20.22 13.93 21 12 21C10.07 21 8.32 20.22 7.05 18.95C5.78 17.68 5 15.93 5 14C5 12.07 5.78 10.32 7.05 9.05C8.32 7.78 10.07 7 12 7ZM12 9V5C13.19 5 14.27 5.47 15.12 6.22C15.97 6.97 16.5 7.93 16.5 9H12ZM12 19C13.19 19 14.27 18.53 15.12 17.78C15.97 17.03 16.5 16.07 16.5 15C16.5 13.93 15.97 12.97 15.12 12.22C14.27 11.47 13.19 11 12 11V19Z" 
                  fill="currentColor"
                />
                <path 
                  d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" 
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
          
          <button
            className="icon-button compact-sidebar-toggle"
            onClick={actions.toggleCompactSidebar}
            title={ui?.compactSidebarOpen ? "Hide Compact EEG Views (US, UD, TS, TD)" : "Show Compact EEG Views (US, UD, TS, TD)"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M3 18H21V16H3V18ZM3 13H21V11H3V13ZM3 6V8H21V6H3Z" 
                fill="currentColor"
              />
            </svg>
          </button>
          
          <button
            className="icon-button event-log-toggle"
            onClick={actions.toggleEventLog}
            title={ui?.eventLogOpen ? "Hide Event Log (Clinical Events & Annotations)" : "Show Event Log (Clinical Events & Annotations)"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM17 12H7V10H17V12ZM15 16H7V14H15V16ZM17 8H7V6H17V8Z" 
                fill="currentColor"
              />
            </svg>
          </button>
          
          <button
            className="icon-button settings-toggle"
            onClick={actions.toggleSettingsPanel}
            title={ui?.settingsPanelOpen ? "Hide Settings Panel" : "Show Settings Panel (Display, Spectrogram, Detection, etc.)"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M19.14 12.94C19.18 12.64 19.2 12.33 19.2 12C19.2 11.67 19.18 11.36 19.14 11.06L21.16 9.48C21.34 9.33 21.39 9.07 21.28 8.86L19.36 5.44C19.25 5.23 19.01 5.13 18.8 5.19L16.38 6.06C15.9 5.65 15.37 5.32 14.79 5.07L14.4 2.5C14.36 2.27 14.18 2.1 13.95 2.1H10.05C9.82 2.1 9.64 2.27 9.6 2.5L9.21 5.07C8.63 5.32 8.1 5.66 7.62 6.06L5.2 5.19C4.99 5.13 4.75 5.23 4.64 5.44L2.72 8.86C2.61 9.07 2.66 9.33 2.84 9.48L4.86 11.06C4.82 11.36 4.8 11.67 4.8 12C4.8 12.33 4.82 12.64 4.86 12.94L2.84 14.52C2.66 14.67 2.61 14.93 2.72 15.14L4.64 18.56C4.75 18.77 4.99 18.87 5.2 18.81L7.62 17.94C8.1 18.35 8.63 18.68 9.21 18.93L9.6 21.5C9.64 21.73 9.82 21.9 10.05 21.9H13.95C14.18 21.9 14.36 21.73 14.4 21.5L14.79 18.93C15.37 18.68 15.9 18.34 16.38 17.94L18.8 18.81C19.01 18.87 19.25 18.77 19.36 18.56L21.28 15.14C21.39 14.93 21.34 14.67 21.16 14.52L19.14 12.94ZM12 15.6C10.02 15.6 8.4 13.98 8.4 12C8.4 10.02 10.02 8.4 12 8.4C13.98 8.4 15.6 10.02 15.6 12C15.6 13.98 13.98 15.6 12 15.6Z" 
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

