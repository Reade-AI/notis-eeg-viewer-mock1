import React, { useMemo } from 'react'
import { CSAView, CSAMontage } from './CSAViewNew'
import { useEEG } from '../store/EEGContext'

const CHANNEL_NAMES = [
  'F3-P3', 'P3-O1', 'F3-T3', 'T3-O1',
  'F4-P4', 'P4-O2', 'F4-T4', 'T4-O2'
]

interface CSAViewAdapterProps {
  data: Array<Array<{ x: number; y: number }>> // Existing spectrogram data format
  theme?: 'light' | 'dark'
  eegBuffer?: Array<Array<{ x: number; y: number }>> // Raw EEG buffer
}

/**
 * Adapter component that converts existing data format to new CSAView format
 */
export default function CSAViewAdapter({ data, theme = 'light', eegBuffer }: CSAViewAdapterProps) {
  // Call useEEG hook unconditionally at the top
  const { settings } = useEEG()
  
  // Extract display settings with defaults
  const displaySettings = settings?.display || {}
  const timeWindow = displaySettings.timeWindow || 10
  const timeScale = displaySettings.timeScale || 30
  const timeOffset = (displaySettings.timeOffset !== undefined && displaySettings.timeOffset !== null) ? displaySettings.timeOffset : 0
  const baseTimeScale = 30
  const adjustedTimeWindow = timeWindow * (baseTimeScale / timeScale)
  
  // Calculate the visible time range
  const visibleTimeRange = useMemo(() => {
    if (!eegBuffer || eegBuffer.length === 0 || !eegBuffer[0] || eegBuffer[0].length === 0) {
      return { minTime: 0, maxTime: 10, durationSeconds: 10 }
    }
    
    const maxTime = eegBuffer[0][eegBuffer[0].length - 1].x
    const dataMinTime = eegBuffer[0][0].x
    const dataRange = maxTime - dataMinTime
    
    // Calculate visible range the same way RawEEGPlot does
    let minTime: number
    let actualMaxTime: number
    
    if (adjustedTimeWindow >= dataRange || dataRange === 0) {
      // Window is larger than data range, or no data yet - show all available data
      minTime = dataMinTime
      actualMaxTime = Math.max(maxTime, adjustedTimeWindow)
    } else {
      // Calculate the start time from the offset
      const navigationStartTime = 0
      const calculatedStartTime = maxTime - timeOffset - adjustedTimeWindow
      const maxStartTime = Math.max(navigationStartTime, maxTime - adjustedTimeWindow)
      const clampedStartTime = Math.max(navigationStartTime, Math.min(maxStartTime, calculatedStartTime))
      
      minTime = Math.max(dataMinTime, clampedStartTime)
      actualMaxTime = Math.min(maxTime, clampedStartTime + adjustedTimeWindow)
    }
    
    const durationSeconds = Math.max(actualMaxTime - minTime, 0.1) // Ensure non-zero duration
    
    console.log('[CSAViewAdapter] Visible time range:', {
      dataMinTime: dataMinTime.toFixed(2),
      maxTime: maxTime.toFixed(2),
      dataRange: dataRange.toFixed(2),
      adjustedTimeWindow: adjustedTimeWindow.toFixed(2),
      timeOffset: timeOffset.toFixed(2),
      minTime: minTime.toFixed(2),
      actualMaxTime: actualMaxTime.toFixed(2),
      durationSeconds: durationSeconds.toFixed(2)
    })
    
    return { minTime, maxTime: actualMaxTime, durationSeconds }
  }, [eegBuffer, timeWindow, timeScale, timeOffset, adjustedTimeWindow])
  
  const { minTime, maxTime: actualMaxTime, durationSeconds } = visibleTimeRange
  
  // Convert eegBuffer to CSAMontage format
  const montages = useMemo(() => {
    if (!eegBuffer || eegBuffer.length === 0) {
      console.log('[CSAViewAdapter] No eegBuffer data')
      return []
    }
    
    // Check if we have any channels with data
    const hasData = eegBuffer.some(ch => ch && ch.length > 0)
    if (!hasData) {
      console.log('[CSAViewAdapter] eegBuffer exists but all channels are empty')
      return []
    }
    
    // Calculate actual sample rate from the data
    let actualSamplingRate = 250 // Default fallback
    const firstChannelWithData = eegBuffer.find(ch => ch && ch.length >= 2)
    if (firstChannelWithData && firstChannelWithData.length >= 2) {
      const timeDiff = firstChannelWithData[firstChannelWithData.length - 1].x - firstChannelWithData[firstChannelWithData.length - 2].x
      if (timeDiff > 0) {
        actualSamplingRate = 1 / timeDiff
      }
    }
    
    console.log('[CSAViewAdapter] Processing eegBuffer:', {
      numChannels: eegBuffer.length,
      channelsWithData: eegBuffer.filter(ch => ch && ch.length > 0).length,
      channel0Length: eegBuffer[0]?.length || 0,
      channel0First: eegBuffer[0]?.[0],
      channel0Last: eegBuffer[0]?.[eegBuffer[0].length - 1],
      calculatedSampleRate: actualSamplingRate.toFixed(2)
    })
    
    // Filter data to visible time range (matching RawEEGPlot window)
    const result = eegBuffer.map((channelData, index) => {
      if (!channelData || channelData.length === 0) {
        console.log(`[CSAViewAdapter] Channel ${index} has no data`)
        return null
      }
      
      // When there's very little data (less than 2 seconds), use all available data
      // Otherwise filter to visible time range
      let visibleData: Array<{ x: number; y: number }>
      const dataTimeRange = channelData[channelData.length - 1].x - channelData[0].x
      const minRequiredTime = 2 // Need at least 2 seconds for CSA computation
      
      if (dataTimeRange < minRequiredTime) {
        // Use all available data if we have less than 2 seconds
        visibleData = channelData
        console.log(`[CSAViewAdapter] Channel ${index}: Using all data (${dataTimeRange.toFixed(2)}s < ${minRequiredTime}s)`)
      } else {
        // Filter data to visible time range (with small tolerance for floating point issues)
        const tolerance = 0.001
        visibleData = channelData.filter(point => 
          point.x >= (minTime - tolerance) && point.x <= (actualMaxTime + tolerance)
        )
      }
      
      if (visibleData.length === 0) {
        console.log(`[CSAViewAdapter] Channel ${index} has no data in visible range [${minTime.toFixed(2)}, ${actualMaxTime.toFixed(2)}]`, {
          totalDataPoints: channelData.length,
          firstPoint: channelData[0] ? { x: channelData[0].x.toFixed(3), y: channelData[0].y.toFixed(3) } : null,
          lastPoint: channelData[channelData.length - 1] ? { x: channelData[channelData.length - 1].x.toFixed(3), y: channelData[channelData.length - 1].y.toFixed(3) } : null
        })
        return null
      }
      
      console.log(`[CSAViewAdapter] Channel ${index}:`, {
        totalLength: channelData.length,
        visibleDataLength: visibleData.length,
        visibleTimeRange: `[${minTime.toFixed(2)}, ${actualMaxTime.toFixed(2)}]`,
        firstPoint: visibleData[0],
        lastPoint: visibleData[visibleData.length - 1]
      })
      
      // Convert to Float32Array of sample values
      const samples = new Float32Array(visibleData.length)
      visibleData.forEach((point, i) => {
        samples[i] = point.y || 0
      })
      
      // Check if we have enough samples for CSA (need at least 2 seconds)
      const minRequired = Math.ceil(actualSamplingRate * 2)
      if (samples.length < minRequired) {
        console.warn(`[CSAViewAdapter] Channel ${index} has insufficient data: ${samples.length} samples (need at least ${minRequired} for 2-second window at ${actualSamplingRate.toFixed(2)} Hz)`)
      }
      
      return {
        id: `channel-${index}`,
        label: CHANNEL_NAMES[index] || `Channel ${index}`,
        data: samples,
        samplingRate: actualSamplingRate, // Store actual sample rate with montage
      } as CSAMontage & { samplingRate: number }
    }).filter((m): m is CSAMontage & { samplingRate: number } => m !== null)
    
    console.log('[CSAViewAdapter] Generated montages:', result.length, result.map(m => ({ 
      id: m.id, 
      label: m.label, 
      dataLength: m.data.length,
      samplingRate: m.samplingRate 
    })))
    
    return result
  }, [eegBuffer, minTime, actualMaxTime])
  
  // Always render CSAView, even with empty montages, to show blank charts
  // Create empty montages for all 8 channels if no data is available
  const allMontages = useMemo(() => {
    if (montages.length === 0) {
      // Create empty montages for all 8 channels
      return CHANNEL_NAMES.map((name, index) => ({
        id: `channel-${index}`,
        label: name,
        data: new Float32Array(0),
        samplingRate: 250,
      }))
    }
    return montages
  }, [montages])
  
  // Calculate average sample rate from montages
  const avgSamplingRate = useMemo(() => {
    if (allMontages.length === 0) return 250
    const rates = allMontages.map(m => (m as any).samplingRate).filter(r => r && r > 0)
    if (rates.length === 0) return 250
    return rates.reduce((sum, r) => sum + r, 0) / rates.length
  }, [allMontages])
  
  // Calculate start time for display
  // The time stamps on Y-axis should match the visible time window (minTime to actualMaxTime)
  // Since CSA slices have timeSec relative to the start of the filtered data (0-based),
  // we need to offset by minTime to show the correct absolute time
  const startTime = useMemo(() => {
    if (!eegBuffer || eegBuffer.length === 0 || !eegBuffer[0] || eegBuffer[0].length === 0) {
      return new Date(Date.now() - durationSeconds * 1000)
    }
    // Use current time as reference and subtract actualMaxTime to get a base time
    // Then add minTime offset so that time stamps show the correct range
    const referenceTime = new Date()
    // The startTime should represent the time at minTime
    // If actualMaxTime is the current time offset, then minTime is actualMaxTime - durationSeconds
    // So startTime = referenceTime - actualMaxTime + minTime
    // But we want to show absolute times, so we'll use a simpler approach:
    // Use referenceTime and offset by minTime
    return new Date(referenceTime.getTime() - actualMaxTime * 1000 + minTime * 1000)
  }, [minTime, actualMaxTime, durationSeconds, eegBuffer])
  
  return (
    <CSAView
      montages={allMontages}
      samplingRate={avgSamplingRate}
      durationSeconds={durationSeconds}
      startTime={startTime}
      timeOffset={minTime}
      theme={theme}
    />
  )
}

