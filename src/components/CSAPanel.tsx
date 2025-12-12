import React, { useEffect, useRef } from 'react'
import { CSAResult } from '../utils/csa'
import './CSAPanel.css'

export interface CSAPanelProps {
  label: string
  csa: CSAResult
  startTime: Date
  durationSeconds: number
  timeOffset?: number // Optional: offset in seconds to add to CSA slice times (for syncing with raw EEG window)
  width?: number
  height?: number
  theme?: 'light' | 'dark'
}

const DEFAULT_WIDTH = 180
const DEFAULT_HEIGHT = 240

/**
 * Map normalized power (0-1) to red→yellow color map for CSA
 * CSA uses red→yellow colormap to show relative spectral power
 * Low power: dark red
 * High power: yellow/white
 */
function powerToColor(power: number): string {
  // Clamp to [0, 1]
  const p = Math.max(0, Math.min(1, power))
  
  // Red→yellow color map
  // Low power: dark red
  // Mid power: bright red → orange
  // High power: yellow → white
  
  if (p < 0.25) {
    // Dark red range
    const t = p / 0.25
    const r = Math.floor(120 + t * 100)  // 120-220
    const g = Math.floor(0 + t * 20)     // 0-20
    const b = Math.floor(0 + t * 10)     // 0-10
    return `rgb(${r}, ${g}, ${b})`
  } else if (p < 0.5) {
    // Red → bright red
    const t = (p - 0.25) / 0.25
    const r = Math.floor(220 + t * 35)   // 220-255
    const g = Math.floor(20 + t * 30)    // 20-50
    const b = Math.floor(10 + t * 10)     // 10-20
    return `rgb(${r}, ${g}, ${b})`
  } else if (p < 0.75) {
    // Bright red → orange → yellow
    const t = (p - 0.5) / 0.25
    const r = 255
    const g = Math.floor(50 + t * 150)   // 50-200
    const b = Math.floor(20 - t * 20)     // 20-0
    return `rgb(${r}, ${g}, ${b})`
  } else {
    // Yellow → white
    const t = (p - 0.75) / 0.25
    const r = 255
    const g = Math.floor(200 + t * 55)   // 200-255
    const b = Math.floor(0 + t * 200)    // 0-200 (slight blue tint for white)
    return `rgb(${r}, ${g}, ${b})`
  }
}

/**
 * Convert frequency to X coordinate using log scale
 */
function freqToX(freq: number, width: number, maxFreqHz: number): number {
  const fMin = 0.1
  const fMax = maxFreqHz
  if (freq <= fMin) return 0
  if (freq >= fMax) return width
  
  const logFreq = Math.log10(freq)
  const logMin = Math.log10(fMin)
  const logMax = Math.log10(fMax)
  
  return ((logFreq - logMin) / (logMax - logMin)) * width
}

/**
 * Format time in seconds as HH:MM:SS (relative time from start)
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export const CSAPanel: React.FC<CSAPanelProps> = ({
  label,
  csa,
  startTime,
  durationSeconds,
  timeOffset = 0,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  theme = 'light',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !csa || csa.slices.length === 0) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Set canvas size
    canvas.width = width
    canvas.height = height
    
    // Clear canvas
    ctx.fillStyle = theme === 'dark' ? '#1a1a1a' : '#f0f0f0'
    ctx.fillRect(0, 0, width, height)
    
    // Chart area (leave space for labels and power legend)
    const marginLeft = 50
    const marginRight = 35 // Extra space for power legend
    const marginTop = 20
    const marginBottom = 25
    const chartWidth = width - marginLeft - marginRight
    const chartHeight = height - marginTop - marginBottom
    const chartX = marginLeft
    const chartY = marginTop
    
    // Draw heatmap background - Time on X-axis, Frequency on Y-axis
    const numSlices = csa.slices.length
    const numBins = csa.freqAxisHz.length
    const timePixelWidth = chartWidth / numSlices
    const freqPixelHeight = chartHeight / numBins
    
    // Calculate time range from slices
    // Note: slice.timeSec is relative to the start of the filtered data (0-based)
    // The actual absolute time is timeOffset + slice.timeSec
    const maxFreq = csa.freqAxisHz.length > 0 ? csa.freqAxisHz[csa.freqAxisHz.length - 1] : 30
    
    for (let sliceIdx = 0; sliceIdx < numSlices; sliceIdx++) {
      const slice = csa.slices[sliceIdx]
      const timeX = chartX + sliceIdx * timePixelWidth
      
      for (let binIdx = 0; binIdx < numBins; binIdx++) {
        const freq = csa.freqAxisHz[binIdx]
        const power = slice.freqBins[binIdx]
        
        // Calculate Y position: frequency on Y-axis (0 Hz at bottom, maxFreq at top)
        const freqRatio = freq / maxFreq
        const freqY = chartY + chartHeight - (freqRatio * chartHeight)
        
        ctx.fillStyle = powerToColor(power)
        ctx.fillRect(timeX, freqY - freqPixelHeight, timePixelWidth, freqPixelHeight)
      }
    }
    
    // Draw SEF95 line overlay (bright yellow as in screenshot) - now horizontal (along time axis)
    if (csa.slices.length > 0) {
      // Use bright yellow matching the screenshot's prominent yellow waveform
      ctx.strokeStyle = '#ffff00' // Bright yellow
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(255, 255, 0, 0.5)'
      ctx.shadowBlur = 2
      ctx.beginPath()
      
      const maxFreq = csa.freqAxisHz.length > 0 ? csa.freqAxisHz[csa.freqAxisHz.length - 1] : 30
      
      let firstPoint = true
      for (let i = 0; i < csa.slices.length; i++) {
        const slice = csa.slices[i]
        const x = chartX + (i / numSlices) * chartWidth
        const freqRatio = slice.sef95Hz / maxFreq
        const y = chartY + chartHeight - (freqRatio * chartHeight)
        
        if (firstPoint) {
          ctx.moveTo(x, y)
          firstPoint = false
        } else {
          ctx.lineTo(x, y)
        }
      }
      
      ctx.stroke()
      ctx.shadowBlur = 0 // Reset shadow
    }
    
    // Draw power legend (relative power 0-100%) on the right
    const legendX = width - marginRight + 5
    const legendY = chartY
    const legendHeight = chartHeight
    const numLegendSteps = 10
    
    ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000'
    ctx.font = '8px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    
    // Draw legend gradient (0% to 100% relative power)
    for (let i = 0; i < numLegendSteps; i++) {
      const ratio = i / (numLegendSteps - 1)
      const power = ratio // 0 to 1 (relative power)
      const y = legendY + (1 - ratio) * legendHeight
      const stepHeight = legendHeight / numLegendSteps
      
      ctx.fillStyle = powerToColor(power)
      ctx.fillRect(legendX, y - stepHeight / 2, 12, stepHeight)
      
      // Label with percentage
      ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000'
      ctx.fillText(`${Math.round(ratio * 100)}%`, legendX + 16, y)
    }
    
    // Legend title
    ctx.textAlign = 'center'
    ctx.font = '7px monospace'
    ctx.save()
    ctx.translate(legendX + 6, chartY + chartHeight / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Power', 0, 0)
    ctx.restore()
    
    // Draw axes and labels
    ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000'
    ctx.font = '9px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    
    // Top label (channel name)
    ctx.textAlign = 'center'
    ctx.fillText(label, width / 2, 12)
    
    // Bottom: time labels (X-axis) - show actual time range
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    // Use durationSeconds as the actual range, starting from timeOffset
    // The slices' timeSec values are relative to the start of filtered data,
    // so the absolute time range is timeOffset to timeOffset + durationSeconds
    const actualStartTime = timeOffset
    const actualEndTime = timeOffset + durationSeconds
    const timeRange = durationSeconds
    
    // Determine appropriate precision based on time range
    let precision = 1 // default to 1 decimal place
    let stepSize = 0.1
    if (timeRange < 0.5) {
      precision = 2
      stepSize = 0.01
    } else if (timeRange < 5) {
      precision = 1
      stepSize = 0.1
    } else if (timeRange < 50) {
      precision = 0
      stepSize = 1
    } else {
      precision = 0
      stepSize = 5
    }
    
    // Calculate how many labels we can fit without overlapping
    // Use smaller spacing to allow more labels
    const estimatedTextWidth = 35 // pixels (reduced from 50)
    const minSpacing = 30 // minimum spacing between labels (reduced from 60)
    const maxNumLabels = Math.max(3, Math.floor(chartWidth / minSpacing))
    
    // Calculate optimal number of labels - aim for 4-6 labels for better visibility
    const targetNumLabels = Math.min(maxNumLabels, Math.max(4, Math.min(6, Math.ceil(chartWidth / 25))))
    
    // Collect labels with distinct values
    const labels: Array<{ x: number; time: number; text: string }> = []
    const seenValues = new Set<string>()
    
    // Generate evenly spaced labels
    for (let i = 0; i < targetNumLabels; i++) {
      const ratio = i / (targetNumLabels - 1)
      const timeInSeconds = actualStartTime + ratio * timeRange
      const x = chartX + ratio * chartWidth
      
      // Round based on precision
      const roundedTime = Math.round(timeInSeconds / stepSize) * stepSize
      let displayTime: string
      if (precision === 0) {
        displayTime = roundedTime.toString()
      } else {
        displayTime = roundedTime.toFixed(precision)
      }
      
      // Only add if we haven't seen this value
      if (!seenValues.has(displayTime)) {
        // Check if this label is too close to the previous one
        const tooClose = labels.length > 0 && Math.abs(x - labels[labels.length - 1].x) < minSpacing
        if (!tooClose || labels.length === 0) {
          labels.push({ x, time: timeInSeconds, text: displayTime })
          seenValues.add(displayTime)
        }
      }
    }
    
    // Always ensure we have at least start and end labels
    // Round start and end times to avoid floating point precision issues
    const roundedStartTime = Math.round(actualStartTime / stepSize) * stepSize
    const roundedEndTime = Math.round(actualEndTime / stepSize) * stepSize
    const startText = precision === 0 ? roundedStartTime.toString() : roundedStartTime.toFixed(precision)
    const endText = precision === 0 ? roundedEndTime.toString() : roundedEndTime.toFixed(precision)
    
    // Add start label if not present or too far from start
    if (labels.length === 0 || Math.abs(labels[0].x - chartX) > 5) {
      labels.unshift({ x: chartX, time: roundedStartTime, text: startText })
    } else if (labels[0].text !== startText) {
      labels[0] = { x: chartX, time: roundedStartTime, text: startText }
    }
    
    // Add end label if not present or too far from end
    if (labels.length === 0 || Math.abs(labels[labels.length - 1].x - (chartX + chartWidth)) > 5) {
      labels.push({ x: chartX + chartWidth, time: roundedEndTime, text: endText })
    } else if (labels[labels.length - 1].text !== endText) {
      labels[labels.length - 1] = { x: chartX + chartWidth, time: roundedEndTime, text: endText }
    }
    
    // Draw the labels
    labels.forEach(label => {
      ctx.fillText(label.text, label.x, chartY + chartHeight + 4)
    })
    // X-axis label
    ctx.textAlign = 'center'
    ctx.fillText('Time (sec)', width / 2, height - 8)
    
    // Left: frequency labels (Y-axis)
    const freqLabels = [0.1, 1, 8, 18, 30]
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    freqLabels.forEach(freq => {
      const freqRatio = freq / maxFreq
      const y = chartY + chartHeight - (freqRatio * chartHeight)
      ctx.fillText(freq.toString(), chartX - 4, y)
    })
    // Y-axis label
    ctx.save()
    ctx.translate(12, chartY + chartHeight / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('Frequency (Hz)', 0, 0)
    ctx.restore()
    
    // Draw border
    ctx.strokeStyle = theme === 'dark' ? '#444444' : '#cccccc'
    ctx.lineWidth = 1
    ctx.strokeRect(chartX, chartY, chartWidth, chartHeight)
    
  }, [label, csa, startTime, durationSeconds, timeOffset, width, height, theme])
  
  return (
    <div className="csa-panel-container">
      <canvas
        ref={canvasRef}
        className="csa-panel-canvas"
        width={width}
        height={height}
      />
    </div>
  )
}

