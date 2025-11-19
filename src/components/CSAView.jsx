import { useMemo } from 'react'
import { useEEG } from '../store/EEGContext'
import './CSAView.css'

const CHANNEL_NAMES = [
  'F3-P3', 'P3-O1', 'F3-T3', 'T3-O1',
  'F4-P4', 'P4-O2', 'F4-T4', 'T4-O2'
]

export default function CSAView({ data, theme }) {
  const { settings } = useEEG()
  const { spectrogram } = settings

  // Calculate frequency bands power for each channel
  const csaData = useMemo(() => {
    if (!data || data.length === 0) return []

    return data.map((channelData, channelIndex) => {
      if (!channelData || channelData.length === 0) {
        return { channelIndex, bands: [] }
      }

      // Get the most recent time point
      const latestPoint = channelData[channelData.length - 1]
      if (!latestPoint || !latestPoint.frequencies) {
        return { channelIndex, bands: [] }
      }

      // Calculate power in each frequency band
      const bands = [
        { name: 'Delta', min: 0.5, max: 4, power: 0 },
        { name: 'Theta', min: 4, max: 8, power: 0 },
        { name: 'Alpha', min: 8, max: 13, power: 0 },
        { name: 'Beta', min: 13, max: 30, power: 0 },
        { name: 'Gamma', min: 30, max: 60, power: 0 },
      ]

      latestPoint.frequencies.forEach(({ freq, power }) => {
        bands.forEach(band => {
          if (freq >= band.min && freq < band.max) {
            band.power += power
          }
        })
      })

      // Normalize to 0-1 range
      const maxPower = Math.max(...bands.map(b => b.power), 1)
      bands.forEach(band => {
        band.power = band.power / maxPower
      })

      return { channelIndex, bands }
    })
  }, [data])

  return (
    <div className="csa-view">
      <div className="csa-header">
        <h2>CSA Spectral</h2>
      </div>
      <div className="csa-content">
        {csaData.map(({ channelIndex, bands }) => (
          <div key={channelIndex} className="csa-channel">
            <div className="csa-channel-label">{CHANNEL_NAMES[channelIndex]}</div>
            <div className="csa-bars">
              {bands.map((band, idx) => (
                <div key={band.name} className="csa-bar-container">
                  <div 
                    className="csa-bar"
                    style={{
                      height: `${band.power * 100}%`,
                      backgroundColor: getBandColor(band.name)
                    }}
                    title={`${band.name}: ${(band.power * 100).toFixed(1)}%`}
                  />
                  <div className="csa-bar-label">{band.name[0]}</div>
                </div>
              ))}
            </div>
            <div className="csa-frequency-labels">
              <span>0</span>
              <span>4</span>
              <span>8</span>
              <span>12</span>
              <span>16</span>
              <span>20</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getBandColor(bandName) {
  switch (bandName) {
    case 'Delta':
      return '#3b82f6'
    case 'Theta':
      return '#10b981'
    case 'Alpha':
      return '#f59e0b'
    case 'Beta':
      return '#ef4444'
    case 'Gamma':
      return '#8b5cf6'
    default:
      return '#6b7280'
  }
}

