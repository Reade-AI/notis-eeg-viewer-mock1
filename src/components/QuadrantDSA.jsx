import { useMemo } from 'react'
import { useEEG } from '../store/EEGContext'
import { ChannelSpectrogram } from './Spectrogram'
import './QuadrantDSA.css'

const QUADRANT_CONFIGS = [
  { id: 'left-anterior', label: 'Left Anterior', channels: [0, 1, 2, 3] },
  { id: 'right-anterior', label: 'Right Anterior', channels: [4, 5, 6, 7] },
  { id: 'left-posterior', label: 'Left Posterior', channels: [0, 1] },
  { id: 'right-posterior', label: 'Right Posterior', channels: [4, 5] },
]

export default function QuadrantDSA({ data, theme }) {
  const { settings } = useEEG()
  const { spectrogram: spectrogramSettings, display: displaySettings } = settings

  // Aggregate data for each quadrant (average of channels)
  const quadrantData = useMemo(() => {
    if (!data || data.length === 0) return []

    return QUADRANT_CONFIGS.map(config => {
      const channelDataList = config.channels.map(chIdx => data[chIdx] || [])
      
      // Average the spectrogram data across channels in this quadrant
      const aggregatedData = []
      const maxLength = Math.max(...channelDataList.map(d => d.length))
      
      for (let i = 0; i < maxLength; i++) {
        const timePoints = channelDataList
          .map(chData => chData[i])
          .filter(tp => tp !== undefined)
        
        if (timePoints.length === 0) continue
        
        // Average frequencies across channels
        const avgFrequencies = {}
        timePoints.forEach(tp => {
          if (tp.frequencies) {
            tp.frequencies.forEach(({ freq, power }) => {
              if (!avgFrequencies[freq]) {
                avgFrequencies[freq] = { freq, power: 0, count: 0 }
              }
              avgFrequencies[freq].power += power
              avgFrequencies[freq].count += 1
            })
          }
        })
        
        const frequencies = Object.values(avgFrequencies).map(({ freq, power, count }) => ({
          freq,
          power: power / count
        }))
        
        aggregatedData.push({
          time: timePoints[0].time,
          frequencies
        })
      }
      
      return {
        id: config.id,
        label: config.label,
        data: aggregatedData
      }
    })
  }, [data])

  return (
    <div className="quadrant-dsa">
      <div className="quadrant-dsa-header">
        <h2>Quadrant DSA</h2>
      </div>
      <div className="quadrant-dsa-grid">
        {quadrantData.map(quadrant => (
          <div key={quadrant.id} className="quadrant-dsa-item">
            <div className="quadrant-dsa-label">{quadrant.label}</div>
            <ChannelSpectrogram
              channelIndex={0}
              channelData={quadrant.data}
              channelName={quadrant.label}
              theme={theme}
              settings={spectrogramSettings}
              displaySettings={displaySettings}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

