import { useState, useEffect, useRef } from 'react'
import { useEEG } from '../store/EEGContext'
import './MeasurementTools.css'

export default function MeasurementTools() {
  const { settings, actions, measurement, currentTime, eegBuffer } = useEEG()
  const { display } = settings
  const [isActive, setIsActive] = useState(false)
  const [measurements, setMeasurements] = useState([])

  const startMeasurement = () => {
    if (eegBuffer[0] && eegBuffer[0].length > 0) {
      const latestPoint = eegBuffer[0][eegBuffer[0].length - 1]
      actions.setMeasurement({
        active: true,
        startTime: latestPoint.x,
        startAmplitude: latestPoint.y,
        currentTime: latestPoint.x,
        currentAmplitude: latestPoint.y,
      })
      setIsActive(true)
    }
  }

  const stopMeasurement = () => {
    if (measurement.active) {
      const duration = measurement.currentTime - measurement.startTime
      const amplitudeDiff = Math.abs(measurement.currentAmplitude - measurement.startAmplitude)
      
      const newMeasurement = {
        id: Date.now(),
        startTime: measurement.startTime,
        endTime: measurement.currentTime,
        duration: duration,
        startAmplitude: measurement.startAmplitude,
        endAmplitude: measurement.currentAmplitude,
        amplitudeDifference: amplitudeDiff,
        timestamp: new Date().toISOString(),
      }
      
      setMeasurements([...measurements, newMeasurement])
      actions.clearMeasurement()
      setIsActive(false)
    }
  }

  const clearMeasurements = () => {
    setMeasurements([])
  }

  // Update current measurement while active
  useEffect(() => {
    if (measurement.active && eegBuffer[0] && eegBuffer[0].length > 0) {
      const latestPoint = eegBuffer[0][eegBuffer[0].length - 1]
      actions.setMeasurement({
        ...measurement,
        currentTime: latestPoint.x,
        currentAmplitude: latestPoint.y,
      })
    }
  }, [currentTime, measurement.active])

  const formatTime = (seconds) => {
    return seconds.toFixed(2) + 's'
  }

  const formatAmplitude = (amplitude) => {
    return amplitude.toFixed(2) + ' μV'
  }

  return (
    <div className="measurement-tools">
      <div className="measurement-controls">
        <h3>Measurement Tools</h3>
        <div className="measurement-buttons">
          <button
            className={`measure-btn ${isActive ? 'active' : ''}`}
            onClick={isActive ? stopMeasurement : startMeasurement}
          >
            {isActive ? 'Stop Measurement' : 'Start Measurement'}
          </button>
          {measurements.length > 0 && (
            <button className="clear-btn" onClick={clearMeasurements}>
              Clear All
            </button>
          )}
        </div>
        
        {measurement.active && (
          <div className="current-measurement">
            <div className="measurement-label">Current Measurement:</div>
            <div className="measurement-values">
              <div>Duration: {formatTime(measurement.currentTime - measurement.startTime)}</div>
              <div>Amplitude Δ: {formatAmplitude(Math.abs(measurement.currentAmplitude - measurement.startAmplitude))}</div>
            </div>
          </div>
        )}
      </div>

      {measurements.length > 0 && (
        <div className="measurements-list">
          <h4>Measurements</h4>
          <div className="measurements-table">
            <div className="measurement-header">
              <span>Start Time</span>
              <span>End Time</span>
              <span>Duration</span>
              <span>Amplitude Δ</span>
            </div>
            {measurements.map((m) => (
              <div key={m.id} className="measurement-row">
                <span>{formatTime(m.startTime)}</span>
                <span>{formatTime(m.endTime)}</span>
                <span>{formatTime(m.duration)}</span>
                <span>{formatAmplitude(m.amplitudeDifference)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

