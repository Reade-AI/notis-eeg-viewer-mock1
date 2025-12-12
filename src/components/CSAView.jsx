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
            <div className="csa-chart-container">
              {/* Chart area with bars */}
              <div className="csa-chart-area">
                {/* Y-axis: Frequency bands (vertical, bottom to top: Delta, Theta, Alpha, Beta, Gamma) */}
                <div className="csa-y-axis">
                  <div className="csa-y-axis-label">Frequency Band</div>
                  <div className="csa-y-axis-ticks">
                    {bands.map((band) => (
                      <div key={band.name} className="csa-y-axis-tick">
                        <span className="csa-band-label">{band.name}</span>
                        <span className="csa-band-range">({band.min}-{band.max} Hz)</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Bars area */}
                <div className="csa-bars-container">
                  {/* X-axis grid lines */}
                  <div className="csa-x-axis-grid">
                    <div className="csa-grid-line" style={{ left: '0%' }}><span>0%</span></div>
                    <div className="csa-grid-line" style={{ left: '25%' }}><span>25%</span></div>
                    <div className="csa-grid-line" style={{ left: '50%' }}><span>50%</span></div>
                    <div className="csa-grid-line" style={{ left: '75%' }}><span>75%</span></div>
                    <div className="csa-grid-line" style={{ left: '100%' }}><span>100%</span></div>
                  </div>
                  
                  {bands.map((band) => (
                    <div key={band.name} className="csa-bar-row">
                      <div 
                        className="csa-bar"
                        style={{
                          width: `${band.power * 100}%`,
                          backgroundColor: getBandColor(band.name)
                        }}
                        title={`${band.name}: ${(band.power * 100).toFixed(1)}%`}
                      />
                      <span className="csa-bar-value">{((band.power * 100).toFixed(0))}%</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* X-axis label */}
              <div className="csa-x-axis-label">Normalized Power (%)</div>
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

