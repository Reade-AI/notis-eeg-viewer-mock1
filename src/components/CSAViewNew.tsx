import React, { useMemo } from 'react'
import { CSAPanel } from './CSAPanel'
import { computeCSA, CSAResult } from '../utils/csa'
import './CSAViewNew.css'

const CHANNEL_NAMES = [
  'F3-P3', 'P3-O1', 'F3-T3', 'T3-O1',
  'F4-P4', 'P4-O2', 'F4-T4', 'T4-O2'
]

export interface CSAMontage {
  id: string
  label: string
  data: Float32Array
  samplingRate?: number // Optional: if not provided, use the global samplingRate prop
}

export interface CSAViewProps {
  montages: CSAMontage[]
  samplingRate: number
  durationSeconds: number
  startTime?: Date // Optional: if not provided, will calculate from duration
  timeOffset?: number // Optional: offset in seconds to add to CSA slice times (for syncing with raw EEG window)
  theme?: 'light' | 'dark'
}

export const CSAView: React.FC<CSAViewProps> = ({
  montages,
  samplingRate,
  durationSeconds,
  startTime: providedStartTime,
  timeOffset = 0,
  theme = 'light',
}) => {
  // Compute CSA for each montage
  const csaResults = useMemo(() => {
    console.log('[CSAView] Computing CSA for', montages.length, 'montages')
    
    return montages.map((montage, index) => {
      if (!montage.data || montage.data.length === 0) {
        console.warn(`[CSAView] Montage ${index} (${montage.label}) has no data`)
        return null
      }
      
      // Use montage-specific sample rate if provided, otherwise use global
      const montageSampleRate = montage.samplingRate || samplingRate
      
      console.log(`[CSAView] Computing CSA for montage ${index} (${montage.label}):`, {
        dataLength: montage.data.length,
        samplingRate: montageSampleRate
      })
      
      const csa = computeCSA(montage.data, montageSampleRate, {
        windowSeconds: 2,
        stepSeconds: 1,
        maxFreqHz: 30,
        numFreqBins: 64,
      })
      
      console.log(`[CSAView] CSA result for ${montage.label}:`, {
        slicesCount: csa.slices.length,
        freqAxisLength: csa.freqAxisHz.length,
        firstSlice: csa.slices[0],
        lastSlice: csa.slices[csa.slices.length - 1]
      })
      
      return { montage, csa }
    })
  }, [montages, samplingRate])
  
  // Calculate start time (use provided or calculate from duration)
  const startTime = useMemo(() => {
    if (providedStartTime) {
      return providedStartTime
    }
    return new Date(Date.now() - durationSeconds * 1000)
  }, [providedStartTime, durationSeconds])
  
  return (
    <div className="csa-view-new">
      <div className="csa-view-header">
        <h2>CSA Spectral Review</h2>
      </div>
      <div className="csa-grid">
        {montages.map((montage, index) => {
          // Always render a panel, even if empty, to show blank chart
          const result = csaResults[index]
          const csa = result?.csa || { slices: [], freqAxisHz: [] }
          
          return (
            <CSAPanel
              key={montage.id}
              label={montage.label}
              csa={csa}
              startTime={startTime}
              durationSeconds={durationSeconds}
              timeOffset={timeOffset}
              width={180}
              height={240}
              theme={theme}
            />
          )
        })}
      </div>
    </div>
  )
}

