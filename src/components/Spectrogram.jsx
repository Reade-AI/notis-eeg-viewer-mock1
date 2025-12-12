import { useEffect, useRef, useMemo, useState } from 'react'
import { useEEG } from '../store/EEGContext'
import './Spectrogram.css'

const CHANNEL_NAMES = [
  'F3-P3',
  'P3-O1',
  'F3-T3',
  'T3-O1',
  'F4-P4',
  'P4-O2',
  'F4-T4',
  'T4-O2'
]

export function ChannelSpectrogram({ channelIndex, channelData, channelName, theme, settings, displaySettings }) {
  const canvasRef = useRef(null)
  const [cursorPos, setCursorPos] = useState(null)

  const spectrogramMatrix = useMemo(() => {
    if (!channelData || channelData.length === 0) return null

    // Use the same time range calculation as raw EEG charts
    const timeWindow = displaySettings?.timeWindow || 10
    const timeScale = displaySettings?.timeScale || 30
    const timeOffset = (displaySettings?.timeOffset !== undefined && displaySettings?.timeOffset !== null) ? displaySettings.timeOffset : 0
    const baseTimeScale = 30
    const adjustedTimeWindow = timeWindow * (baseTimeScale / timeScale)
    
    // Get the actual data range
    const maxTime = channelData.length > 0 ? channelData[channelData.length - 1]?.time : 0
    const actualDataMinTime = channelData.length > 0 ? channelData[0]?.time : 0
    const dataMinTime = actualDataMinTime
    const dataRange = maxTime - dataMinTime
    
    // Calculate visible time range (same logic as raw EEG charts)
    let visibleMinTime, visibleMaxTime
    if (channelData.length === 0 || dataRange === 0) {
      visibleMinTime = 0
      visibleMaxTime = Math.max(adjustedTimeWindow, timeWindow)
    } else {
      const navigationStartTime = 0
      const calculatedStartTime = maxTime - timeOffset - adjustedTimeWindow
      const maxStartTime = Math.max(navigationStartTime, maxTime - adjustedTimeWindow)
      const clampedStartTime = Math.max(navigationStartTime, Math.min(maxStartTime, calculatedStartTime))
      visibleMinTime = Math.max(dataMinTime, clampedStartTime)
      visibleMaxTime = Math.min(maxTime, clampedStartTime + adjustedTimeWindow)
    }
    
    // Filter data to visible range
    const filteredData = channelData.filter(row => row.time >= visibleMinTime && row.time <= visibleMaxTime)

    // Build a matrix of time vs frequency
    const maxFreq = settings?.frequencyRange?.[1] || 60 // Hz
    const freqBins = Math.floor((settings?.fftSize || 256) / 2)
    const timeSteps = filteredData.length
    
    const matrix = Array(timeSteps).fill(null).map(() => 
      Array(freqBins).fill(0)
    )

    filteredData.forEach((row, timeIndex) => {
      if (row.frequencies) {
        row.frequencies.forEach(({ freq, power }) => {
          const freqIndex = Math.floor((freq / maxFreq) * freqBins)
          if (freqIndex >= 0 && freqIndex < freqBins) {
            matrix[timeIndex][freqIndex] = power
          }
        })
      }
    })

    return { matrix, visibleMinTime, visibleMaxTime, maxTime, dataMinTime }
  }, [channelData, settings, displaySettings])

  useEffect(() => {
    if (!canvasRef.current || !spectrogramMatrix || !spectrogramMatrix.matrix) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Clear canvas with theme-aware background
    ctx.fillStyle = theme === 'dark' ? '#000000' : '#ffffff'
    ctx.fillRect(0, 0, width, height)

    const matrix = spectrogramMatrix.matrix
    if (matrix.length === 0) return

    const timeSteps = matrix.length
    const freqBins = matrix[0].length

    // Find max power for normalization
    let maxPower = 0
    matrix.forEach(row => {
      row.forEach(power => {
        if (power > maxPower) maxPower = power
      })
    })

    // Draw spectrogram
    // Orientation: X-axis = Time (horizontal, left to right)
    //              Y-axis = Frequency (vertical, 0 Hz at bottom, max Hz at top)
    const cellWidth = width / timeSteps
    const cellHeight = height / freqBins

    for (let t = 0; t < timeSteps; t++) {
      for (let f = 0; f < freqBins; f++) {
        const power = matrix[t][f]
        const normalizedPower = maxPower > 0 ? power / maxPower : 0
        
        // Color mapping: dark blue (low) to yellow/white (high)
        const color = getSpectrogramColor(normalizedPower)
        
        ctx.fillStyle = color
        // X position: time goes left to right (t * cellWidth)
        // Y position: frequency 0 at bottom, max at top (height - (f + 1) * cellHeight)
        ctx.fillRect(
          t * cellWidth,                    // X-axis: Time (left to right)
          height - (f + 1) * cellHeight,    // Y-axis: Frequency (0 at bottom, max at top)
          cellWidth,
          cellHeight
        )
      }
    }

    // Draw axes with correct time range
    drawAxes(ctx, width, height, timeSteps, freqBins, channelData, theme, spectrogramMatrix.visibleMinTime, spectrogramMatrix.visibleMaxTime)
    
    // Draw cursor if hovering
    if (cursorPos) {
      const { x, y } = cursorPos
      const timeRange = spectrogramMatrix.visibleMaxTime - spectrogramMatrix.visibleMinTime
      const time = spectrogramMatrix.visibleMinTime + (x / width) * timeRange
      const maxFreq = settings?.frequencyRange?.[1] || 60
      const freq = maxFreq - (y / height) * maxFreq
      
      // Draw crosshair
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
      ctx.setLineDash([])
      
      // Draw cursor info box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      const infoText = `Time: ${time.toFixed(2)}s | Freq: ${freq.toFixed(1)}Hz`
      const textWidth = ctx.measureText(infoText).width
      ctx.fillRect(x + 10, y - 20, textWidth + 10, 20)
      ctx.fillStyle = '#ffffff'
      ctx.font = '10px monospace'
      ctx.fillText(infoText, x + 15, y - 6)
    }
  }, [spectrogramMatrix, channelData, theme, cursorPos, settings])

  const getSpectrogramColor = (normalizedPower) => {
    // Color scale: dark blue -> blue -> green -> yellow -> white
    if (normalizedPower < 0.2) {
      const intensity = normalizedPower / 0.2
      const r = Math.floor(0 + intensity * 0)
      const g = Math.floor(0 + intensity * 0)
      const b = Math.floor(50 + intensity * 100)
      return `rgb(${r}, ${g}, ${b})`
    } else if (normalizedPower < 0.4) {
      const intensity = (normalizedPower - 0.2) / 0.2
      const r = Math.floor(0)
      const g = Math.floor(0 + intensity * 100)
      const b = Math.floor(150 - intensity * 50)
      return `rgb(${r}, ${g}, ${b})`
    } else if (normalizedPower < 0.6) {
      const intensity = (normalizedPower - 0.4) / 0.2
      const r = Math.floor(0 + intensity * 100)
      const g = Math.floor(100)
      const b = Math.floor(100 - intensity * 100)
      return `rgb(${r}, ${g}, ${b})`
    } else if (normalizedPower < 0.8) {
      const intensity = (normalizedPower - 0.6) / 0.2
      const r = Math.floor(100 + intensity * 155)
      const g = Math.floor(100 + intensity * 155)
      const b = Math.floor(0)
      return `rgb(${r}, ${g}, ${b})`
    } else {
      const intensity = (normalizedPower - 0.8) / 0.2
      const r = Math.floor(255)
      const g = Math.floor(255)
      const b = Math.floor(0 + intensity * 255)
      return `rgb(${r}, ${g}, ${b})`
    }
  }

  const drawAxes = (ctx, width, height, timeSteps, freqBins, data, theme, visibleMinTime, visibleMaxTime) => {
    const gridColor = theme === 'dark' ? '#666666' : '#cccccc'
    const textColor = theme === 'dark' ? '#cccccc' : '#333333'
    const labelColor = theme === 'dark' ? '#ffffff' : '#000000'
    const labelBgColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)'
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1
    ctx.fillStyle = textColor
    ctx.font = '10px monospace'

    // Frequency bands overlay
    const frequencyBands = [
      { name: 'Delta', min: 0.5, max: 4, color: 'rgba(59, 130, 246, 0.2)' },
      { name: 'Theta', min: 4, max: 8, color: 'rgba(16, 185, 129, 0.2)' },
      { name: 'Alpha', min: 8, max: 13, color: 'rgba(245, 158, 11, 0.2)' },
      { name: 'Beta', min: 13, max: 30, color: 'rgba(239, 68, 68, 0.2)' },
      { name: 'Gamma', min: 30, max: 60, color: 'rgba(139, 92, 246, 0.2)' },
    ]
    
    const maxFreq = settings?.frequencyRange?.[1] || 60
    
    // Draw frequency band overlays
    frequencyBands.forEach(band => {
      const yMin = height - (band.max / maxFreq) * height
      const yMax = height - (band.min / maxFreq) * height
      ctx.fillStyle = band.color
      ctx.fillRect(0, yMin, width, yMax - yMin)
      
      // Draw band label
      if (channelIndex % 2 === 0) {
        ctx.fillStyle = labelColor
        ctx.font = '8px sans-serif'
        ctx.textAlign = 'left'
        ctx.fillText(band.name, width - 50, (yMin + yMax) / 2)
      }
    })

    // Y-axis (Frequency) - only show on left column
    if (channelIndex % 2 === 0) {
      const freqLabels = [0, 20, 40, 60]
      freqLabels.forEach(freq => {
        const y = height - (freq / 60) * height
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
        
        ctx.font = '10px monospace'
        ctx.fillStyle = textColor
        ctx.fillText(`${freq}`, 4, y - 4)
      })
      
      // Y-axis label: "Frequency (Hz)" - positioned on the left side, rotated vertically
      ctx.save()
      // Position closer to left edge, smaller and less intrusive
      ctx.translate(25, height / 2)
      ctx.rotate(-Math.PI / 2)
      
      // Draw background for better visibility (smaller and more subtle)
      const labelText = 'Frequency (Hz)'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const textMetrics = ctx.measureText(labelText)
      const textWidth = textMetrics.width
      const textHeight = 14
      const padding = 3
      
      // Draw subtle background rectangle
      ctx.fillStyle = labelBgColor
      ctx.fillRect(-textWidth / 2 - padding, -textHeight / 2 - padding, textWidth + padding * 2, textHeight + padding * 2)
      
      // Draw text with good contrast but smaller
      ctx.fillStyle = labelColor
      ctx.fillText(labelText, 0, 0)
      ctx.restore()
    }

    // X-axis (Time) - only show on bottom row
    // Use the visible time range to show correct time labels
    if (channelIndex >= 6 && timeSteps > 0 && visibleMinTime !== undefined && visibleMaxTime !== undefined) {
      const numLabels = 3
      const timeRange = visibleMaxTime - visibleMinTime
      
      for (let i = 0; i <= numLabels; i++) {
        const time = visibleMinTime + (i / numLabels) * timeRange
        const x = (i / numLabels) * width
        
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
        
        const timeStr = time.toFixed(1)
        ctx.font = '10px monospace'
        ctx.fillStyle = textColor
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        // Position tick labels above the axis label
        ctx.fillText(timeStr, x, height - 30)
      }
      
      // X-axis label: "Time (s)" - positioned at the bottom center
      const timeLabelText = 'Time (s)'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const timeTextMetrics = ctx.measureText(timeLabelText)
      const timeTextWidth = timeTextMetrics.width
      const timeTextHeight = 18
      const timePadding = 6
      // Position higher from bottom to ensure visibility and avoid overlap with tick labels
      const labelY = height - 25
      
      // Draw background rectangle
      ctx.fillStyle = labelBgColor
      ctx.fillRect(width / 2 - timeTextWidth / 2 - timePadding, labelY - timeTextHeight / 2 - timePadding, timeTextWidth + timePadding * 2, timeTextHeight + timePadding * 2)
      
      // Draw text with better contrast
      ctx.fillStyle = labelColor
      ctx.fillText(timeLabelText, width / 2, labelY)
    }
  }

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      setCursorPos({ x, y })
    } else {
      setCursorPos(null)
    }
  }

  const handleMouseLeave = () => {
    setCursorPos(null)
  }


  return (
    <div className="channel-spectrogram">
      <div className="spectrogram-title">{channelName}</div>
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="spectrogram-canvas"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'crosshair' }}
      />
    </div>
  )
}

export default function Spectrogram({ data, theme }) {
  const { settings } = useEEG()
  const { spectrogram: spectrogramSettings, display: displaySettings } = settings
  
  // Show only selected channel or all channels based on settings
  const channelsToShow = data.map((channelData, index) => ({
    channelData,
    index,
    name: CHANNEL_NAMES[index]
  }))

  const { ui, actions } = useEEG()

  return (
    <div className="spectrogram">
      <div className="spectrogram-header">
        <h2>Spectrogram</h2>
        <div className="spectrogram-controls">
          <div className="color-scale">
            <span>0</span>
            <div className="color-bar"></div>
            <span>1 μV²</span>
          </div>
          <button
            className={`panel-toggle-btn ${ui.csaPanelOpen ? 'active' : ''}`}
            onClick={actions.toggleCsaPanel}
            title={ui.csaPanelOpen ? 'Hide CSA Panel' : 'Show CSA Panel'}
          >
            CSA
          </button>
          <button
            className={`panel-toggle-btn ${ui.qdsaPanelOpen ? 'active' : ''}`}
            onClick={actions.toggleQdsaPanel}
            title={ui.qdsaPanelOpen ? 'Hide QDSA Panel' : 'Show QDSA Panel'}
          >
            QDSA
          </button>
        </div>
      </div>
      <div className="channels-grid">
        {channelsToShow.map(({ channelData, index, name }) => (
          <ChannelSpectrogram
            key={index}
            channelIndex={index}
            channelData={channelData}
            channelName={name}
            theme={theme}
            settings={spectrogramSettings}
            displaySettings={displaySettings}
          />
        ))}
      </div>
    </div>
  )
}

