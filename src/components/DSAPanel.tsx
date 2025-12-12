import React, { useEffect, useRef } from 'react'
import { DSAResult } from '../utils/csa'
import './DSAPanel.css'

export interface DSAPanelProps {
  label: string
  dsa: DSAResult
  startTime: Date
  durationSeconds: number
  timeOffset?: number // Optional: offset in seconds to add to DSA slice times (for syncing with raw EEG window)
  width?: number
  height?: number
  theme?: 'light' | 'dark'
}

const DEFAULT_WIDTH = 180
const DEFAULT_HEIGHT = 240

/**
 * Map power in dB μV²/Hz to viridis-like colormap (dark purple → blue → green → yellow)
 * Matches the reference DSA plot colormap
 * Uses fixed range: +40 to -120 dB
 */
function powerToColor(power: number, minPower: number, maxPower: number): string {
  // Fixed DSA power scale: +40 to -120 dB
  const DSA_MAX_POWER = 40
  const DSA_MIN_POWER = -120
  
  // Clamp power to the fixed range and normalize to [0, 1]
  const clampedPower = Math.max(DSA_MIN_POWER, Math.min(DSA_MAX_POWER, power))
  const range = DSA_MAX_POWER - DSA_MIN_POWER
  const p = (clampedPower - DSA_MIN_POWER) / range
  
  // Viridis-like colormap: dark purple → blue → green → yellow
  // This approximates the perceptually uniform viridis colormap
  if (p < 0.25) {
    // Dark purple to blue
    const t = p / 0.25
    const r = Math.floor(68 + t * 33)    // 68-101
    const g = Math.floor(1 + t * 53)     // 1-54
    const b = Math.floor(84 + t * 100)   // 84-184
    return `rgb(${r}, ${g}, ${b})`
  } else if (p < 0.5) {
    // Blue to cyan
    const t = (p - 0.25) / 0.25
    const r = Math.floor(101 + t * 42)  // 101-143
    const g = Math.floor(54 + t * 99)   // 54-153
    const b = Math.floor(184 + t * 71)  // 184-255
    return `rgb(${r}, ${g}, ${b})`
  } else if (p < 0.75) {
    // Cyan to green
    const t = (p - 0.5) / 0.25
    const r = Math.floor(143 + t * 42)  // 143-185
    const g = Math.floor(153 + t * 70)  // 153-223
    const b = Math.floor(255 - t * 55)  // 255-200
    return `rgb(${r}, ${g}, ${b})`
  } else {
    // Green to yellow
    const t = (p - 0.75) / 0.25
    const r = Math.floor(185 + t * 70)  // 185-255
    const g = Math.floor(223 + t * 32)  // 223-255
    const b = Math.floor(200 - t * 200) // 200-0
    return `rgb(${r}, ${g}, ${b})`
  }
}

/**
 * Convert frequency to Y coordinate using linear scale (frequency on Y-axis)
 */
function freqToY(freq: number, height: number, maxFreqHz: number): number {
  if (freq <= 0) return height
  if (freq >= maxFreqHz) return 0
  return height - (freq / maxFreqHz) * height
}

/**
 * Convert time to X coordinate (time on X-axis)
 */
function timeToX(time: number, width: number, minTime: number, maxTime: number): number {
  if (time <= minTime) return 0
  if (time >= maxTime) return width
  return ((time - minTime) / (maxTime - minTime)) * width
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

export const DSAPanel: React.FC<DSAPanelProps> = ({
  label,
  dsa,
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
    if (!canvas || !dsa || dsa.slices.length === 0) return
    
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
    
    // Draw heatmap: Time on X-axis, Frequency on Y-axis
    const numSlices = dsa.slices.length
    const numBins = dsa.freqAxisHz.length
    
    // Calculate time range from slices
    // Note: slice.timeSec is relative to the start of the filtered data (0-based)
    // The actual absolute time is timeOffset + slice.timeSec
    
    // Fixed DSA power scale: +40 to -120 dB
    const DSA_MAX_POWER = 40
    const DSA_MIN_POWER = -120
    
    // Use fixed range for color mapping (actual computed values are still used for clamping)
    const minPower = DSA_MIN_POWER
    const maxPower = DSA_MAX_POWER
    
    // Calculate pixel dimensions
    const maxFreq = dsa.freqAxisHz.length > 0 ? dsa.freqAxisHz[dsa.freqAxisHz.length - 1] : 30
    const timePixelWidth = chartWidth / numSlices
    const freqPixelHeight = chartHeight / numBins
    
    // Draw heatmap: iterate over time slices (X-axis) and frequency bins (Y-axis)
    for (let sliceIdx = 0; sliceIdx < numSlices; sliceIdx++) {
      const slice = dsa.slices[sliceIdx]
      const timeX = chartX + sliceIdx * timePixelWidth
      
      for (let binIdx = 0; binIdx < numBins; binIdx++) {
        const freq = dsa.freqAxisHz[binIdx]
        const power = slice.powerSpectrum[binIdx] // Power in dB μV²/Hz
        
        // Calculate Y position: frequency on Y-axis (0 Hz at bottom, maxFreq at top)
        // Invert so higher frequencies are at the top
        const freqRatio = freq / maxFreq
        const freqY = chartY + chartHeight - (freqRatio * chartHeight)
        
        ctx.fillStyle = powerToColor(power, minPower, maxPower)
        ctx.fillRect(timeX, freqY - freqPixelHeight, timePixelWidth, freqPixelHeight)
      }
    }
    
    // Draw SEF95 line overlay (bright yellow/white)
    if (dsa.slices.length > 0) {
      ctx.strokeStyle = '#ffff00' // Bright yellow
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(255, 255, 0, 0.5)'
      ctx.shadowBlur = 2
      ctx.beginPath()
      
      let firstPoint = true
      for (let i = 0; i < dsa.slices.length; i++) {
        const slice = dsa.slices[i]
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
    
    // Draw power legend (dB μV²/Hz scale) on the right
    // Fixed range: +40 to -120 dB
    const legendX = width - marginRight + 5
    const legendY = chartY
    const legendHeight = chartHeight
    const numLegendSteps = 10
    
    ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000'
    ctx.font = '8px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    
    // Draw legend gradient (from top to bottom: +40 to -120 dB)
    for (let i = 0; i < numLegendSteps; i++) {
      const ratio = i / (numLegendSteps - 1)
      const power = maxPower - ratio * (maxPower - minPower) // Top is max (+40), bottom is min (-120)
      const stepHeight = legendHeight / numLegendSteps
      const y = legendY + (1 - ratio) * legendHeight // Top is at legendY, bottom is at legendY + legendHeight
      
      ctx.fillStyle = powerToColor(power, minPower, maxPower)
      ctx.fillRect(legendX, y - stepHeight / 2, 12, stepHeight)
      
      // Label with dB power value
      ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000'
      ctx.fillText(power.toFixed(0), legendX + 16, y)
    }
    
    // Legend title
    ctx.textAlign = 'center'
    ctx.font = '7px monospace'
    ctx.save()
    ctx.translate(legendX + 6, chartY + chartHeight / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Power (dB μV²/Hz)', 0, 0)
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
    const freqLabels = [0, 5, 10, 15, 20, 25].filter(f => f <= maxFreq)
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
    
  }, [label, dsa, startTime, durationSeconds, timeOffset, width, height, theme])
  
  return (
    <div className="dsa-panel-container">
      <canvas
        ref={canvasRef}
        className="dsa-panel-canvas"
        width={width}
        height={height}
      />
    </div>
  )
}

