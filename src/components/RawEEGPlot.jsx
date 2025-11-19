import { useEffect, useRef, useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useEEG } from '../store/EEGContext'
import { getChannelLabel } from '../utils/montages'
import './RawEEGPlot.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const CHANNEL_COLORS = [
  '#3b82f6', // Blue
  '#3b82f6',
  '#3b82f6',
  '#3b82f6',
  '#ef4444', // Red
  '#ef4444',
  '#ef4444',
  '#ef4444'
]

function ChannelChart({ channelIndex, channelData, channelName, channelColor, ischemiaEvents, theme, settings, onPan, impedance, isBad, onToggleBad }) {
  const chartRef = useRef(null)
  const containerRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  // Debug: log channel data and settings
  useEffect(() => {
    if (channelData && channelData.length > 0) {
      console.log(`Channel ${channelIndex} (${channelName}) data:`, {
        length: channelData.length,
        first: channelData[0],
        last: channelData[channelData.length - 1],
        timeRange: channelData.length > 0 ? `${channelData[0].x.toFixed(2)} - ${channelData[channelData.length - 1].x.toFixed(2)}` : 'N/A',
        timeOffset: settings?.timeOffset,
        timeWindow: settings?.timeWindow,
        timeScale: settings?.timeScale
      })
    }
  }, [channelData, channelIndex, channelName, settings?.timeOffset, settings?.timeWindow, settings?.timeScale])

  const isInIschemia = (x) => {
    return ischemiaEvents.some(event => {
      if (!event.end) return x >= event.start
      return x >= event.start && x <= event.end
    })
  }

  // Calculate time window and scale settings (needed for chart rendering)
  const timeWindow = settings?.timeWindow || 10
  const timeScale = settings?.timeScale || 30 // mm/sec
  const timeOffset = (settings?.timeOffset !== undefined && settings?.timeOffset !== null) ? settings.timeOffset : 0
  const baseTimeScale = 30
  const adjustedTimeWindow = timeWindow * (baseTimeScale / timeScale)
  
  // Get the actual data range
  const maxTime = channelData.length > 0 ? channelData[channelData.length - 1]?.x : 0
  const actualDataMinTime = channelData.length > 0 ? channelData[0]?.x : 0
  const dataMinTime = actualDataMinTime
  const dataRange = maxTime - dataMinTime

  // Split data into normal and ischemia segments
  // Don't filter data here - let Chart.js handle rendering based on scales
  // Chart.js will automatically clip data outside the visible range
  const normalPoints = []
  const ischemiaPoints = []

  channelData.forEach(point => {
    if (isInIschemia(point.x)) {
      ischemiaPoints.push(point)
    } else {
      normalPoints.push(point)
    }
  })

  const datasets = [
    // Normal data
    {
      label: channelName,
      data: normalPoints,
      borderColor: channelColor,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.1
    },
    // Ischemia data (red)
    ...(ischemiaPoints.length > 0 ? [{
      label: `${channelName} (Ischemia)`,
      data: ischemiaPoints,
      borderColor: '#ef4444',
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.1
    }] : [])
  ]

  // Only show lines if visualization is enabled
  const showLines = settings?.detection?.visualization?.showStartEndLines !== false
  const showRedSegment = settings?.detection?.visualization?.showRedSegment !== false
  
  // Create vertical line datasets for ischemia markers
  const ischemiaLineDatasets = showLines ? ischemiaEvents.flatMap((event, eventIndex) => {
    const lines = []
    const yMin = -100
    const yMax = 100
    
    // Start line
    lines.push({
      label: `Ischemia Start ${eventIndex + 1}`,
      data: [
        { x: event.start, y: yMin },
        { x: event.start, y: yMax }
      ],
      borderColor: '#ef4444',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0,
      pointHoverRadius: 0,
      showLine: true,
      fill: false,
      tension: 0
    })
    
    // End line (if exists)
    if (event.end) {
      lines.push({
        label: `Ischemia End ${eventIndex + 1}`,
        data: [
          { x: event.end, y: yMin },
          { x: event.end, y: yMax }
        ],
        borderColor: '#ef4444',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        showLine: true,
        fill: false,
        tension: 0
      })
    }
    
    return lines
  }) : []

  // Only show red segment if enabled
  const finalDatasets = showRedSegment ? datasets : [datasets[0]]
  const allDatasets = [...finalDatasets, ...ischemiaLineDatasets]

  // Custom plugin to draw ischemia labels and highlighted regions
  const ischemiaLabelPlugin = {
    id: 'ischemiaLabels',
    beforeDatasetsDraw: (chart) => {
      const ctx = chart.ctx
      const xScale = chart.scales.x
      const yScale = chart.scales.y
      
      // Draw highlighted background regions for ischemia events
      ischemiaEvents.forEach((event) => {
        const startX = xScale.getPixelForValue(event.start)
        const endX = event.end ? xScale.getPixelForValue(event.end) : xScale.right
        
        // Draw semi-transparent red background for ischemia region
        ctx.save()
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)' // Light red background
        ctx.fillRect(startX, yScale.top, endX - startX, yScale.bottom - yScale.top)
        ctx.restore()
      })
    },
    afterDraw: (chart) => {
      const ctx = chart.ctx
      const xScale = chart.scales.x
      const yScale = chart.scales.y
      const labelTextColor = theme === 'dark' ? '#ffffff' : '#ffffff'
      
      ischemiaEvents.forEach((event) => {
        // Draw start label
        const startX = xScale.getPixelForValue(event.start)
        ctx.save()
        ctx.fillStyle = '#ef4444'
        const startLabel = 'Start Ischemia'
        const startLabelWidth = ctx.measureText(startLabel).width
        ctx.fillRect(startX - startLabelWidth / 2 - 4, yScale.top, startLabelWidth + 8, 18)
        ctx.fillStyle = labelTextColor
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(startLabel, startX, yScale.top + 13)
        ctx.restore()
        
        // Draw stop label if exists
        if (event.end) {
          const endX = xScale.getPixelForValue(event.end)
          ctx.save()
          ctx.fillStyle = '#ef4444'
          const stopLabel = 'Stop Ischemia'
          const stopLabelWidth = ctx.measureText(stopLabel).width
          ctx.fillRect(endX - stopLabelWidth / 2 - 4, yScale.bottom - 18, stopLabelWidth + 8, 18)
          ctx.fillStyle = labelTextColor
          ctx.font = '9px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(stopLabel, endX, yScale.bottom - 5)
          ctx.restore()
        }
      })
    }
  }

  const chartData = {
    datasets: allDatasets
  }
  
  // Calculate visible range based on timeScale and timeOffset
  // timeOffset = 0 means showing the most recent data
  // timeOffset < 0 means showing data from earlier (when window >= data range)
  // The offset represents: offset = maxTime - startTime - adjustedTimeWindow
  // So: startTime = maxTime - offset - adjustedTimeWindow
  let minTime, actualMaxTime
  
  // If no data yet, show a default range starting from 0
  if (channelData.length === 0 || dataRange === 0) {
    minTime = 0
    actualMaxTime = Math.max(adjustedTimeWindow, timeWindow)
  } else {
    // Calculate the start time from the offset
    // offset = maxTime - startTime - adjustedTimeWindow
    // So: startTime = maxTime - offset - adjustedTimeWindow
    const navigationStartTime = 0 // Always assume data starts from 0 for navigation
    const calculatedStartTime = maxTime - timeOffset - adjustedTimeWindow
    
    // Clamp start time to valid range
    // Minimum: navigationStartTime (0s) - but we can only show from dataMinTime if data exists
    // Maximum: maxTime - adjustedTimeWindow (to ensure end time doesn't exceed maxTime)
    const maxStartTime = Math.max(navigationStartTime, maxTime - adjustedTimeWindow)
    const clampedStartTime = Math.max(navigationStartTime, Math.min(maxStartTime, calculatedStartTime))
    
    // Calculate the view range
    // Always use the calculated start time to allow navigation even when window is large
    minTime = Math.max(dataMinTime, clampedStartTime)
    actualMaxTime = Math.min(maxTime, clampedStartTime + adjustedTimeWindow)
    
    // If the window is larger than the data range, we still want to allow navigation
    // But we need to ensure we don't show data beyond what exists
    // The clampedStartTime already handles this, so we don't need special handling here
  }
  
  // Debug logging - only log when timeOffset is significant or changes
  if (timeOffset > 0.1 || Math.abs(timeOffset - (settings?.timeOffset || 0)) > 0.1) {
    console.log(`[Channel ${channelIndex}] TimeScale update:`, { 
      timeScale, 
      timeWindow, 
      timeOffset,
      settingsTimeOffset: settings?.timeOffset,
      settingsObject: settings,
      adjustedTimeWindow, 
      minTime, 
      maxTime: actualMaxTime,
      dataRange: { dataMinTime, maxTime },
      visibleRange: actualMaxTime - minTime,
      calculatedFrom: `maxTime(${maxTime}) - timeOffset(${timeOffset}) = ${(maxTime - timeOffset).toFixed(2)}`
    })
  }

  // Theme-aware colors
  const textColor = theme === 'dark' ? '#ffffff' : '#1a1a1a'
  const textSecondaryColor = theme === 'dark' ? '#888888' : '#666666'
  const gridColor = theme === 'dark' ? '#222222' : '#f0f0f0'
  const tooltipBg = theme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)'
  const tooltipBorder = theme === 'dark' ? '#333' : '#e0e0e0'

  // Create options object - this will be recreated when settings change
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    onHover: (event, activeElements) => {
      // Change cursor to grab when hovering over chart
      if (event.native && event.native.target) {
        event.native.target.style.cursor = isDragging ? 'grabbing' : 'grab'
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: !isDragging, // Disable tooltip while dragging
        backgroundColor: tooltipBg,
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: tooltipBorder,
        borderWidth: 1,
        filter: (tooltipItem) => {
          return tooltipItem.datasetIndex < datasets.length
        }
      },
      title: {
        display: true,
        text: `${channelName}${isBad ? ' [BAD]' : ''}${impedance ? ` (${impedance.value.toFixed(1)}kΩ${impedance.status !== 'good' ? ` ${impedance.status.toUpperCase()}` : ''})` : ''}`,
        color: isBad ? '#ef4444' : (impedance?.status === 'poor' || impedance?.status === 'bad') ? '#f59e0b' : channelColor,
        font: {
          size: 12,
          weight: 'bold'
        },
        padding: {
          top: 4,
          bottom: 4
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        title: {
          display: channelIndex >= 6, // Only show on bottom row
          text: 'Time (seconds)',
          color: textColor,
          font: {
            size: 10
          }
        },
        ticks: {
          color: textSecondaryColor,
          font: {
            size: 9
          },
          maxTicksLimit: Math.max(3, Math.floor(adjustedTimeWindow / 2)), // More ticks for longer time windows
          stepSize: adjustedTimeWindow > 20 ? 5 : adjustedTimeWindow > 10 ? 2 : 1
        },
        grid: {
          color: gridColor,
          lineWidth: 1
        },
        min: minTime,
        max: actualMaxTime
      },
      y: {
        title: {
          display: channelIndex % 4 === 0, // Only show on left column
          text: 'Amplitude (μV)',
          color: textColor,
          font: {
            size: 10
          }
        },
        ticks: {
          color: textSecondaryColor,
          font: {
            size: 9
          },
          maxTicksLimit: 5
        },
        grid: {
          color: gridColor,
          lineWidth: 1
        },
        min: -100,
        max: 100
      }
    }
  }), [channelIndex, channelName, channelColor, textColor, textSecondaryColor, gridColor, tooltipBg, tooltipBorder, minTime, actualMaxTime, adjustedTimeWindow, datasets.length, theme, timeScale, timeWindow, timeOffset, isDragging])

  // Update chart when timeOffset or other relevant settings change
  useEffect(() => {
    if (chartRef.current && channelData && channelData.length > 0) {
      const chart = chartRef.current
      // Update chart scales directly
      if (chart.scales && chart.scales.x) {
        // Recalculate the view range based on current timeOffset
        // Recalculate maxTime from current data to ensure we have the latest value
        const currentMaxTime = channelData[channelData.length - 1]?.x || 0
        const currentDataMinTime = channelData[0]?.x || 0
        
        if (currentMaxTime > 0) {
          const navigationStartTime = 0
          const calculatedStartTime = currentMaxTime - timeOffset - adjustedTimeWindow
          const maxStartTime = Math.max(navigationStartTime, currentMaxTime - adjustedTimeWindow)
          const clampedStartTime = Math.max(navigationStartTime, Math.min(maxStartTime, calculatedStartTime))
          const newMinTime = Math.max(currentDataMinTime, clampedStartTime)
          const newMaxTime = Math.min(currentMaxTime, clampedStartTime + adjustedTimeWindow)
          
          // Always update to ensure chart reflects current timeOffset
          console.log(`[Channel ${channelIndex}] Updating chart scales:`, {
            oldMin: chart.scales.x.min,
            oldMax: chart.scales.x.max,
            newMinTime,
            newMaxTime,
            timeOffset,
            settingsTimeOffset: settings?.timeOffset,
            calculatedStartTime,
            clampedStartTime,
            currentMaxTime,
            adjustedTimeWindow
          })
          chart.scales.x.min = newMinTime
          chart.scales.x.max = newMaxTime
          chart.update('none')
        }
      }
    }
  }, [timeOffset, maxTime, adjustedTimeWindow, dataMinTime, channelIndex, settings?.timeOffset, channelData?.length])
  
  // Update chart when options change
  useEffect(() => {
    if (chartRef.current && options) {
      const chart = chartRef.current
      // Update chart with new options
      chart.options = options
      chart.update('none')
    }
  }, [options, channelData, ischemiaEvents])

  // Handle mouse events for dragging on the container
  useEffect(() => {
    if (!containerRef.current || !onPan) return

    const container = containerRef.current
    let startX = 0
    let startOffset = 0
    let dragging = false

    const handleMouseDown = (e) => {
      // Only left mouse button
      if (e.button !== 0) return
      
      // Don't start drag if clicking on buttons or inputs
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return
      
      dragging = true
      startX = e.clientX
      startOffset = timeOffset
      setIsDragging(true)
      container.style.cursor = 'grabbing'
      container.style.userSelect = 'none'
      e.preventDefault()
      e.stopPropagation()
    }

    const handleMouseMove = (e) => {
      if (!dragging) return

      if (!chartRef.current || !chartRef.current.scales || !chartRef.current.scales.x) {
        dragging = false
        setIsDragging(false)
        return
      }

      e.preventDefault()
      e.stopPropagation()

      const chart = chartRef.current
      const deltaX = e.clientX - startX
      const xScale = chart.scales.x
      const pixelRange = xScale.right - xScale.left
      const timeRange = actualMaxTime - minTime
      
      if (pixelRange <= 0 || timeRange <= 0) return
      
      // Convert pixel movement to time offset change
      // Dragging right (positive deltaX) = moving forward in time = decreasing offset
      // Dragging left (negative deltaX) = moving backward in time = increasing offset
      const timeDelta = (deltaX / pixelRange) * timeRange
      const newOffset = startOffset - timeDelta
      
      // Calculate max offset based on data range
      const maxTime = channelData.length > 0 ? channelData[channelData.length - 1]?.x : timeWindow
      const dataMinTime = channelData.length > 0 ? channelData[0]?.x : 0
      const dataRange = maxTime - dataMinTime
      const adjustedTimeWindow = timeWindow * (30 / timeScale)
      const maxOffset = Math.max(0, dataRange - adjustedTimeWindow)
      
      // Clamp offset to valid range
      const clampedOffset = Math.max(0, Math.min(maxOffset, newOffset))
      
      onPan(clampedOffset)
    }

    const handleMouseUp = (e) => {
      if (dragging) {
        dragging = false
        setIsDragging(false)
        container.style.cursor = 'grab'
        container.style.userSelect = ''
      }
    }

    container.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      container.style.cursor = 'grab'
      container.style.userSelect = ''
    }
  }, [actualMaxTime, minTime, timeWindow, timeScale, channelData, onPan, timeOffset])

  return (
    <div 
      ref={containerRef}
      className="channel-chart"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      onDoubleClick={(e) => {
        // Double-click on chart container to toggle bad channel
        if (onToggleBad && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
          onToggleBad()
        }
      }}
      title="Double-click to mark/unmark channel as bad"
    >
      <Line 
        ref={chartRef} 
        data={chartData} 
        options={options}
        plugins={[ischemiaLabelPlugin]}
      />
    </div>
  )
}

export default function RawEEGPlot({ data, ischemiaEvents, theme }) {
  const { settings, actions, currentTime, isStreaming, channelImpedance, badChannels } = useEEG()
  const { display, detection } = settings
  const [sliderValue, setSliderValue] = useState(0)

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  // Filter channels based on visibility and bad channels
  const visibleChannels = data
    .map((channelData, index) => ({ channelData, index }))
    .filter(({ index: idx }) => display.channelVisibility[idx] && !badChannels?.[idx])

  const handleTimeScaleChange = (newScale) => {
    // Allow time scale from 1 to 1000
    const clampedScale = Math.max(1, Math.min(1000, newScale))
    actions.updateSettings('display', { timeScale: clampedScale })
  }

  const handleTimeScaleIncrement = (delta) => {
    // Allow time scale from 1 to 1000
    const newScale = Math.max(1, Math.min(1000, display.timeScale + delta))
    actions.updateSettings('display', { timeScale: newScale })
  }

  const handleTimeWindowChange = (newWindow) => {
    // Clamp newWindow to valid range: min 5s, max based on available data
    const maxTime = data.length > 0 && data[0].length > 0 ? data[0][data[0].length - 1]?.x : 0
    const dataMinTime = data.length > 0 && data[0].length > 0 ? data[0][0]?.x : 0
    const dataRange = maxTime - dataMinTime
    const maxWindow = Math.max(dataRange, currentTime || 0, 120)
    const clampedWindow = Math.max(5, Math.min(maxWindow, newWindow))
    
    // When time window changes, we may need to adjust the offset
    const currentOffset = display.timeOffset
    const currentWindow = display.timeWindow
    const currentScale = display.timeScale
    
    if (maxTime > 0 && dataMinTime >= 0) {
      const baseTimeScale = 30
      const currentAdjustedWindow = currentWindow * (baseTimeScale / currentScale)
      const newAdjustedWindow = clampedWindow * (baseTimeScale / currentScale)
      const dataRange = maxTime - dataMinTime
      
      // If the new window is larger than or equal to the data range, show all data from the beginning
      if (newAdjustedWindow >= dataRange) {
        console.log('Time window change: Showing all data from beginning', {
          oldWindow: currentWindow,
          newWindow: clampedWindow,
          newAdjustedWindow: newAdjustedWindow.toFixed(2),
          dataRange: dataRange.toFixed(2),
          dataMinTime: dataMinTime.toFixed(2),
          maxTime: maxTime.toFixed(2)
        })
        
        // When window is large enough to show all data, set offset to show from the start
        // Calculate offset needed to show from dataMinTime
        const offsetToShowStart = Math.max(0, maxTime - dataMinTime - newAdjustedWindow)
        
        actions.updateSettings('display', { 
          timeWindow: clampedWindow,
          timeOffset: offsetToShowStart // Set offset to show from the beginning
        })
        return
      }
    
    // Calculate current view center
    const currentViewEnd = maxTime - currentOffset
    const currentViewCenter = currentViewEnd - (currentAdjustedWindow / 2)
    
    // Calculate new offset to maintain the same center
    const newViewEnd = currentViewCenter + (newAdjustedWindow / 2)
    let newOffset = Math.max(0, maxTime - newViewEnd)
    
    // Clamp to valid range
    const maxOffset = Math.max(0, dataRange - newAdjustedWindow)
    let clampedOffset = Math.min(maxOffset, newOffset)
    
    // If the new window would show data before the start, adjust to show from the beginning
    const newViewStart = maxTime - clampedOffset - newAdjustedWindow
    if (newViewStart < dataMinTime) {
      // Adjust to show from the beginning of data
      clampedOffset = Math.max(0, maxTime - dataMinTime - newAdjustedWindow)
      console.log('Time window change: Adjusted to show from beginning', {
        oldWindow: currentWindow,
        newWindow: clampedWindow,
        adjustedOffset: clampedOffset.toFixed(2),
        newViewStart: (maxTime - clampedOffset - newAdjustedWindow).toFixed(2),
        dataMinTime: dataMinTime.toFixed(2)
      })
    } else {
      console.log('Time window change: Maintaining view center', {
        oldWindow: currentWindow,
        newWindow: clampedWindow,
        oldOffset: currentOffset,
        newOffset: clampedOffset,
        currentViewCenter: currentViewCenter.toFixed(2),
        maxTime: maxTime.toFixed(2)
      })
    }
    
    actions.updateSettings('display', { 
      timeWindow: clampedWindow,
      timeOffset: clampedOffset
    })
    } else {
      actions.updateSettings('display', { timeWindow: clampedWindow })
    }
  }

  const handleTimeWindowIncrement = (delta) => {
    // Calculate max window based on available data
    const maxTime = data.length > 0 && data[0].length > 0 ? data[0][data[0].length - 1]?.x : 0
    const dataMinTime = data.length > 0 && data[0].length > 0 ? data[0][0]?.x : 0
    const dataRange = maxTime - dataMinTime
    // Max window is either the data range or currentTime, whichever is larger
    const maxWindow = Math.max(dataRange, currentTime || 0, 120)
    const newWindow = Math.max(5, Math.min(maxWindow, display.timeWindow + delta))
    // Use the same logic as handleTimeWindowChange to maintain view center
    handleTimeWindowChange(newWindow)
  }

  const handleTimeOffsetChange = (newOffset) => {
    actions.updateSettings('display', { timeOffset: newOffset })
  }

  // Calculate max offset based on data range (shared calculation)
  const maxTime = data.length > 0 && data[0].length > 0 ? data[0][data[0].length - 1]?.x : 0
  // Get the actual minimum time from the data (buffer might be trimmed)
  const actualDataMinTime = data.length > 0 && data[0].length > 0 ? data[0][0]?.x : 0
  // For navigation: use 0 as the conceptual start (mock stream starts from 0)
  // For display: use actualDataMinTime to show where data actually exists
  // This allows navigation from 0s even if buffer was trimmed during streaming
  const navigationStartTime = 0 // Always assume data starts from 0 for navigation
  const dataMinTime = actualDataMinTime // Use actual start for display
  const navigationDataRange = maxTime - navigationStartTime // Full range from 0 to maxTime
  const dataRange = maxTime - dataMinTime // Actual available data range
  const adjustedTimeWindow = display.timeWindow * (30 / display.timeScale)
  // maxOffset: maximum offset to still show data (0 = most recent, maxOffset = oldest visible)
  // If window is larger than data range, maxOffset = 0 (can't scroll, showing all)
  // Otherwise, maxOffset allows scrolling to show older data
  const maxOffset = Math.max(0, dataRange - adjustedTimeWindow)
  
  // For slider: we want to be able to navigate from showing most recent (offset=0) 
  // to showing oldest (offset=maxOffset). 
  // When window >= data range, maxOffset = 0, but we still want slider to work
  // In that case, we'll use a normalized slider position (0-1) and map it to offset
  // Use navigationDataRange (from 0 to maxTime) as slider max to allow full navigation
  // The slider represents the position in the data, not just the scrollable offset
  // Show slider if we have any data (maxTime > 0) or if we're streaming
  const sliderMax = Math.max(1, navigationDataRange)
  const hasDataForSlider = maxTime > 0 || (data.length > 0 && data[0] && data[0].length > 0)
  
  // Calculate the maximum offset needed to show from the very start of data (0s)
  // This allows navigation to the beginning regardless of time window size
  const maxOffsetToShowStart = Math.max(0, maxTime - navigationStartTime - adjustedTimeWindow)

  const handleTimeOffsetIncrement = (delta) => {
    // delta > 0 means move left (earlier) = increase offset
    // delta < 0 means move right (later) = decrease offset
    const newOffset = Math.max(0, Math.min(maxOffset, display.timeOffset + delta))
    
    console.log('Pan control:', {
      currentOffset: display.timeOffset,
      delta,
      newOffset,
      maxOffset,
      dataRange,
      adjustedTimeWindow,
      canMoveLeft: display.timeOffset < maxOffset,
      canMoveRight: display.timeOffset > 0
    })
    
    actions.updateSettings('display', { timeOffset: newOffset })
  }

  // Calculate view range for display (memoized to ensure it updates when timeOffset changes)
  const viewRangeText = useMemo(() => {
    const currentTimeOffset = display.timeOffset ?? 0
    const currentTimeWindow = display.timeWindow ?? 10
    const currentTimeScale = display.timeScale ?? 30
    
    // Use maxTime calculated from data (already available in component scope)
    const currentMaxTime = maxTime
    const currentNavigationStartTime = 0
    
    // Recalculate adjustedTimeWindow with current values
    const currentAdjustedTimeWindow = currentTimeWindow * (30 / currentTimeScale)
    
    // Calculate the start time from the offset (same as in ChannelChart)
    const calculatedStartTime = currentMaxTime - currentTimeOffset - currentAdjustedTimeWindow
    const maxStartTime = Math.max(currentNavigationStartTime, currentMaxTime - currentAdjustedTimeWindow)
    const clampedStartTime = Math.max(currentNavigationStartTime, Math.min(maxStartTime, calculatedStartTime))
    
    // For view range text, use navigationStartTime (0s) instead of dataMinTime
    // to show the conceptual range, not the actual buffered data range
    const viewStartTime = Math.max(currentNavigationStartTime, clampedStartTime)
    const viewEndTime = Math.min(currentMaxTime, clampedStartTime + currentAdjustedTimeWindow)
    
    return {
      start: viewStartTime.toFixed(1),
      end: viewEndTime.toFixed(1)
    }
  }, [display.timeOffset, display.timeWindow, display.timeScale, maxTime])

  // Sync slider value with settings.timeOffset when it changes
  useEffect(() => {
    if (navigationDataRange > 0 && sliderMax > 0) {
      const currentTimeOffset = display.timeOffset ?? 0
      const currentStartTime = maxTime - currentTimeOffset - adjustedTimeWindow
      const maxStartTime = Math.max(navigationStartTime, maxTime - adjustedTimeWindow)
      const clampedStartTime = Math.max(navigationStartTime, Math.min(maxStartTime, currentStartTime))
      
      let calculatedSliderValue
      if (maxStartTime > navigationStartTime) {
        calculatedSliderValue = ((clampedStartTime - navigationStartTime) / (maxStartTime - navigationStartTime)) * sliderMax
      } else {
        const minOffset = maxTime - navigationStartTime - adjustedTimeWindow
        const maxOffset = 0
        if (maxOffset > minOffset) {
          const offsetRange = maxOffset - minOffset
          const normalizedOffset = (currentTimeOffset - minOffset) / offsetRange
          calculatedSliderValue = normalizedOffset * sliderMax
        } else {
          calculatedSliderValue = 0
        }
      }
      
      setSliderValue(Math.max(0, Math.min(sliderMax, calculatedSliderValue)))
    }
  }, [display.timeOffset, maxTime, adjustedTimeWindow, navigationStartTime, navigationDataRange, sliderMax])

  return (
    <div className="raw-eeg-plot">
      <div className="plot-header">
        <h2>Raw EEG Live {isStreaming && currentTime && formatTime(currentTime)}</h2>
        <div className="plot-controls">
          <select 
            className="control-dropdown"
            value={display.montage || 'BANANA'}
            onChange={(e) => actions.updateSettings('display', { montage: e.target.value })}
            title="Montage"
          >
            <option value="BANANA">BANANA</option>
            <option value="10-20">10-20</option>
            <option value="BIPOLAR">BIPOLAR</option>
            <option value="REFERENCE">REFERENCE</option>
          </select>
          
          <select 
            className="control-dropdown"
            value={display.filters.highPass}
            onChange={(e) => actions.updateSettings('display', { 
              filters: { ...display.filters, highPass: parseFloat(e.target.value) }
            })}
            title="Low Frequency Filter"
          >
            <option value="0.1">LFF 0.1 Hz</option>
            <option value="0.5">LFF 0.5 Hz</option>
            <option value="1.0">LFF 1.0 Hz</option>
            <option value="5.0">LFF 5.0 Hz</option>
          </select>
          
          <select 
            className="control-dropdown"
            value={display.filters.lowPass}
            onChange={(e) => actions.updateSettings('display', { 
              filters: { ...display.filters, lowPass: parseFloat(e.target.value) }
            })}
            title="High Frequency Filter"
          >
            <option value="15">HFF 15 Hz</option>
            <option value="30">HFF 30 Hz</option>
            <option value="50">HFF 50 Hz</option>
            <option value="70">HFF 70 Hz</option>
          </select>
          
          <select 
            className="control-dropdown"
            value={display.filters.notch || 60}
            onChange={(e) => actions.updateSettings('display', { 
              filters: { ...display.filters, notch: parseFloat(e.target.value) }
            })}
            title="Notch Filter"
          >
            <option value="0">Notch Off</option>
            <option value="50">Notch 50 Hz</option>
            <option value="60">Notch 60 Hz</option>
          </select>
          
          <select 
            className="control-dropdown"
            value={display.amplitudeScale}
            onChange={(e) => actions.updateSettings('display', { amplitudeScale: parseFloat(e.target.value) })}
            title="Sensitivity"
          >
            <option value="2.5">Sensitivity 2.5 uV/mm</option>
            <option value="5.0">Sensitivity 5.0 uV/mm</option>
            <option value="10.0">Sensitivity 10.0 uV/mm</option>
            <option value="20.0">Sensitivity 20.0 uV/mm</option>
          </select>
          
          <div className="timebase-control">
            <span className="control-label">Timebase:</span>
            <button 
              className="control-button"
              onClick={() => handleTimeScaleIncrement(-5)}
              title="Decrease time scale"
            >
              −
            </button>
            <input
              type="number"
              className="timebase-input"
              value={display.timeScale}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 30
                handleTimeScaleChange(value)
              }}
              min="1"
              max="1000"
              step="1"
            />
            <span className="control-label">s/page</span>
            <button 
              className="control-button"
              onClick={() => handleTimeScaleIncrement(5)}
              title="Increase time scale"
            >
              +
            </button>
          </div>
          <div className="timebase-control">
            <span className="control-label">Time Window:</span>
            <button 
              className="control-button"
              onClick={() => handleTimeWindowIncrement(-5)}
              title="Decrease time window"
            >
              −
            </button>
            <input
              type="number"
              className="timebase-input"
              value={display.timeWindow}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 10
                // Calculate max window based on available data
                const maxTime = data.length > 0 && data[0].length > 0 ? data[0][data[0].length - 1]?.x : 0
                const dataMinTime = data.length > 0 && data[0].length > 0 ? data[0][0]?.x : 0
                const dataRange = maxTime - dataMinTime
                // Max window is either the data range or currentTime, whichever is larger, with minimum of 120
                const maxWindow = Math.max(dataRange, currentTime || 0, 120)
                // Allow any value >= 5, but clamp to maxWindow if provided
                const clampedValue = value >= 5 ? Math.min(value, maxWindow) : 5
                handleTimeWindowChange(clampedValue)
              }}
              min="5"
              step="1"
            />
            <span className="control-label">sec</span>
            <button 
              className="control-button"
              onClick={() => handleTimeWindowIncrement(5)}
              title="Increase time window"
            >
              +
            </button>
          </div>
          <div className="timebase-control">
            <button 
              className="control-button"
              onClick={() => handleTimeOffsetIncrement(adjustedTimeWindow * 0.5)}
              title="Scroll left (earlier) - shows older data"
              disabled={maxOffset <= 0 || display.timeOffset >= maxOffset - 0.1}
            >
              ←
            </button>
            <button 
              className="control-button"
              onClick={() => handleTimeOffsetIncrement(-adjustedTimeWindow * 0.5)}
              title="Scroll right (later) - shows more recent data"
              disabled={display.timeOffset <= 0.1}
            >
              →
            </button>
            <button 
              className="control-button"
              onClick={() => handleTimeOffsetChange(0)}
              title="Jump to most recent"
              disabled={display.timeOffset <= 0.1}
            >
              ⟳
            </button>
          </div>
        </div>
      </div>
      {hasDataForSlider && (
        <div className="timeline-scrubber">
          <div className="timeline-label-section">
            <label className="timeline-label">Timeline Navigation</label>
            <span className="timeline-current-position">
              {(() => {
                // Calculate current position based on slider value
                if (navigationDataRange > 0 && sliderMax > 0) {
                  const targetStartTime = (sliderValue / sliderMax) * navigationDataRange
                  const maxStartTime = Math.max(navigationStartTime, maxTime - adjustedTimeWindow)
                  const clampedStartTime = Math.max(navigationStartTime, Math.min(maxStartTime, targetStartTime))
                  return clampedStartTime.toFixed(1)
                }
                return '0.0'
              })()}s
            </span>
          </div>
          <div className="timeline-controls">
            <span className="timeline-endpoint" style={{ minWidth: '60px' }}>
              {navigationStartTime.toFixed(1)}s
            </span>
            <input
              type="range"
              className="timeline-slider"
              min="0"
              max={sliderMax}
              step={Math.max(0.1, sliderMax / 100)}
              value={sliderValue}
              onChange={(e) => {
                const newSliderValue = parseFloat(e.target.value)
                setSliderValue(newSliderValue)
                
                if (navigationDataRange > 0 && sliderMax > 0) {
                  // Direct mapping: slider position directly represents the start time of the chart
                  // Slider at 0 (left) = show from 0s (start of streaming)
                  // Slider at max (right) = show from maxTime (when streaming stopped)
                  // The slider value represents the start time position in the data
                  const targetStartTime = (newSliderValue / sliderMax) * navigationDataRange
                  
                  // Calculate the valid start time range
                  const maxStartTime = Math.max(navigationStartTime, maxTime - adjustedTimeWindow)
                  
                  // Clamp targetStartTime to valid range
                  const clampedStartTime = Math.max(navigationStartTime, Math.min(maxStartTime, targetStartTime))
                  
                  // Calculate the offset needed to show from this start time
                  // offset = maxTime - startTime - adjustedTimeWindow
                  const calculatedOffset = maxTime - clampedStartTime - adjustedTimeWindow
                  
                  // Clamp offset to valid range
                  const minOffset = maxTime - navigationStartTime - adjustedTimeWindow
                  const maxOffset = 0
                  const clampedOffset = Math.max(minOffset, Math.min(maxOffset, calculatedOffset))
                  
                  console.log('Slider change:', {
                    sliderValue: newSliderValue.toFixed(2),
                    targetStartTime: targetStartTime.toFixed(2),
                    clampedStartTime: clampedStartTime.toFixed(2),
                    calculatedOffset: calculatedOffset.toFixed(2),
                    clampedOffset: clampedOffset.toFixed(2),
                    minOffset: minOffset.toFixed(2),
                    maxOffset: maxOffset.toFixed(2),
                    adjustedTimeWindow: adjustedTimeWindow.toFixed(2),
                    willShowFrom: clampedStartTime.toFixed(2),
                    willShowTo: (clampedStartTime + adjustedTimeWindow).toFixed(2),
                    maxTime: maxTime.toFixed(2)
                  })
                  
                  handleTimeOffsetChange(clampedOffset)
                } else {
                  // No data, can't navigate
                  handleTimeOffsetChange(0)
                }
              }}
              title={`Navigate timeline: ${(() => {
                // Use current timeOffset from settings for most up-to-date value
                const currentTimeOffset = settings?.timeOffset ?? display.timeOffset ?? 0
                const viewStartTime = Math.max(navigationStartTime, maxTime - currentTimeOffset - adjustedTimeWindow)
                return viewStartTime.toFixed(1)
              })()}s - ${(() => {
                // Use current timeOffset from settings for most up-to-date value
                const currentTimeOffset = settings?.timeOffset ?? display.timeOffset ?? 0
                const viewStartTime = Math.max(navigationStartTime, maxTime - currentTimeOffset - adjustedTimeWindow)
                const viewEndTime = Math.min(maxTime, viewStartTime + adjustedTimeWindow)
                return viewEndTime.toFixed(1)
              })()}s`}
            />
            <span className="timeline-endpoint" style={{ minWidth: '60px', textAlign: 'right' }}>
              {maxTime.toFixed(1)}s
            </span>
          </div>
          <div className="timeline-view-range">
            <span className="view-range-label">View Range:</span>
            <span className="view-range-value">
              {viewRangeText.start}s - {viewRangeText.end}s
            </span>
          </div>
        </div>
      )}
      <div className="channels-grid">
        {visibleChannels.map(({ channelData, index }) => (
          <ChannelChart
            key={`${index}-${display.timeScale}-${display.timeWindow}-${display.timeOffset}`}
            channelIndex={index}
            channelData={channelData}
            channelName={getChannelLabel(display.montage, index)}
            channelColor={display.colorMode === 'grayscale' ? '#888' : CHANNEL_COLORS[index]}
            ischemiaEvents={ischemiaEvents}
            theme={theme}
            settings={{ ...display, detection }}
            onPan={handleTimeOffsetChange}
            impedance={channelImpedance?.[index]}
            isBad={badChannels?.[index]}
            onToggleBad={() => actions.toggleBadChannel(index)}
          />
        ))}
      </div>
    </div>
  )
}
