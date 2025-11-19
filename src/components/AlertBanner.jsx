import { useState, useEffect } from 'react'
import { useEEG } from '../store/EEGContext'
import './AlertBanner.css'

export default function AlertBanner() {
  const { ischemiaEvents, settings } = useEEG()
  const [activeAlert, setActiveAlert] = useState(null)
  const [isVisible, setIsVisible] = useState(false)

  // Show alert for existing ischemia events on mount
  useEffect(() => {
    if (ischemiaEvents && ischemiaEvents.length > 0 && settings) {
      // Show the most recent event
      const latestEvent = ischemiaEvents[ischemiaEvents.length - 1]
      if (latestEvent && settings.alerts && settings.alerts.onScreenNotifications) {
        setActiveAlert(latestEvent)
        setIsVisible(true)
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
          setIsVisible(false)
        }, 10000)
      }
    }
  }, [ischemiaEvents, settings]) // On mount and when events change

  useEffect(() => {
    const handleAlert = (event) => {
      if (!settings.alerts.onScreenNotifications) return
      
      const ischemiaEvent = event.detail
      setActiveAlert(ischemiaEvent)
      setIsVisible(true)

      // Auto-hide after 10 seconds
      setTimeout(() => {
        setIsVisible(false)
      }, 10000)

      // Play audio alert if enabled
      if (settings.alerts.audioEnabled) {
        // Create a simple beep sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = 800
        oscillator.type = 'sine'

        gainNode.gain.setValueAtTime(0, audioContext.currentTime)
        gainNode.gain.linearRampToValueAtTime(
          settings.alerts.audioVolume * 0.3,
          audioContext.currentTime + 0.01
        )
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + 0.3
        )

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.3)
      }
    }

    window.addEventListener('ischemia-alert', handleAlert)
    return () => {
      window.removeEventListener('ischemia-alert', handleAlert)
    }
  }, [settings.alerts])

  if (!activeAlert || !isVisible) return null

  const confidencePercent = Math.round(activeAlert.confidence * 100)

  return (
    <div className={`alert-banner ${activeAlert.confidence > 0.8 ? 'critical' : 'warning'}`}>
      <div className="alert-content">
        <div className="alert-icon">⚠️</div>
        <div className="alert-text">
          <div className="alert-title">Ischemia Detected</div>
          <div className="alert-details">
            Confidence: {confidencePercent}% | 
            Start: {typeof activeAlert.startTime === 'number' ? activeAlert.startTime.toFixed(1) : activeAlert.startTime}s
            {activeAlert.endTime && (
              <> | End: {typeof activeAlert.endTime === 'number' ? activeAlert.endTime.toFixed(1) : activeAlert.endTime}s</>
            )}
            {activeAlert.channelIds && activeAlert.channelIds.length > 0 && (
              <> | Channels: {activeAlert.channelIds.join(', ')}</>
            )}
          </div>
        </div>
        <button
          className="alert-close"
          onClick={() => setIsVisible(false)}
          aria-label="Close alert"
        >
          ×
        </button>
      </div>
    </div>
  )
}

