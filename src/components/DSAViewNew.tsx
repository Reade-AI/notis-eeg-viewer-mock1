import React, { useMemo } from 'react'
import { DSAPanel } from './DSAPanel'
import { computeDSA, DSAResult } from '../utils/csa'
import './DSAViewNew.css'

const CHANNEL_NAMES = [
  'F3-P3', 'P3-O1', 'F3-T3', 'T3-O1',
  'F4-P4', 'P4-O2', 'F4-T4', 'T4-O2'
]

export interface DSAMontage {
  id: string
  label: string
  data: Float32Array
  samplingRate?: number // Optional: if not provided, use the global samplingRate prop
}

export interface DSAViewProps {
  montages: DSAMontage[]
  samplingRate: number
  durationSeconds: number
  startTime?: Date // Optional: if not provided, will calculate from duration
  timeOffset?: number // Optional: offset in seconds to add to DSA slice times (for syncing with raw EEG window)
  theme?: 'light' | 'dark'
}

export const DSAView: React.FC<DSAViewProps> = ({
  montages,
  samplingRate,
  durationSeconds,
  startTime: providedStartTime,
  timeOffset = 0,
  theme = 'light',
}) => {
  // Compute DSA for each montage (full-density with absolute power)
  const dsaResults = useMemo(() => {
    console.log('[DSAView] Computing DSA for', montages.length, 'montages')
    
    return montages.map((montage, index) => {
      if (!montage.data || montage.data.length === 0) {
        console.warn(`[DSAView] Montage ${index} (${montage.label}) has no data`)
        return null
      }
      
      // Use montage-specific sample rate if provided, otherwise use global
      const montageSampleRate = montage.samplingRate || samplingRate
      
      console.log(`[DSAView] Computing DSA for montage ${index} (${montage.label}):`, {
        dataLength: montage.data.length,
        samplingRate: montageSampleRate
      })
      
      const dsa = computeDSA(montage.data, montageSampleRate, {
        windowSeconds: 2,
        stepSeconds: 1,
        maxFreqHz: 30,
        freqResolutionHz: 0.5, // 0.5 Hz resolution for full density
      })
      
      console.log(`[DSAView] DSA result for ${montage.label}:`, {
        slicesCount: dsa.slices.length,
        freqAxisLength: dsa.freqAxisHz.length,
        globalMinPower: dsa.globalMinPower,
        globalMaxPower: dsa.globalMaxPower,
        firstSlice: dsa.slices[0],
        lastSlice: dsa.slices[dsa.slices.length - 1]
      })
      
      return { montage, dsa }
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
    <div className="dsa-view-new">
      <div className="dsa-view-header">
        <h2>DSA Spectral Review</h2>
      </div>
      <div className="dsa-grid">
        {montages.map((montage, index) => {
          // Always render a panel, even if empty, to show blank chart
          const result = dsaResults[index]
          const dsa = result?.dsa || { 
            slices: [], 
            freqAxisHz: [], 
            globalMinPower: 0, 
            globalMaxPower: 1 
          }
          
          return (
            <DSAPanel
              key={montage.id}
              label={montage.label}
              dsa={dsa}
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

