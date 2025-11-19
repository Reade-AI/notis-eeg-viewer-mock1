import { useRef, useEffect, useMemo } from 'react'
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
import './CompactEEGView.css'

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

const COMPACT_VIEW_CONFIGS = [
  { id: 'US', label: 'US - Live', channels: [0, 1], colors: ['#3b82f6', '#ef4444'] },
  { id: 'UD', label: 'UD - Live', channels: [2, 3], colors: ['#3b82f6', '#ef4444'] },
  { id: 'TS', label: 'TS - Live', channels: [4, 5], colors: ['#3b82f6', '#ef4444'] },
  { id: 'TD', label: 'TD - Live', channels: [6, 7], colors: ['#3b82f6', '#ef4444'] },
]

const CHANNEL_NAMES = [
  'F3-P3', 'P3-O1', 'F3-T3', 'T3-O1',
  'F4-P4', 'P4-O2', 'F4-T4', 'T4-O2'
]

function CompactChart({ channelData, channelName, channelColor, theme }) {
  const chartRef = useRef(null)

  const data = useMemo(() => {
    if (!channelData || channelData.length === 0) {
      return { labels: [], datasets: [] }
    }

    // Show last 10 seconds of data
    const timeWindow = 10
    const maxTime = channelData[channelData.length - 1]?.x || 0
    const minTime = Math.max(0, maxTime - timeWindow)
    const filteredData = channelData.filter(point => point.x >= minTime && point.x <= maxTime)

    return {
      labels: filteredData.map(point => point.x.toFixed(2)),
      datasets: [
        {
          label: channelName,
          data: filteredData.map(point => point.y),
          borderColor: channelColor,
          backgroundColor: channelColor + '20',
          borderWidth: 1.5,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0.1,
        },
      ],
    }
  }, [channelData, channelName, channelColor])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        display: false,
        grid: {
          display: false,
        },
      },
      y: {
        display: true,
        position: 'right',
        grid: {
          color: theme === 'dark' ? '#333333' : '#e5e7eb',
        },
        ticks: {
          font: { size: 9 },
          color: theme === 'dark' ? '#888888' : '#666666',
          maxTicksLimit: 3,
        },
        min: -100,
        max: 100,
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
  }), [theme])

  return (
    <div className="compact-chart-container">
      <Line ref={chartRef} data={data} options={options} />
    </div>
  )
}

export default function CompactEEGView() {
  const { eegBuffer, settings, ui } = useEEG()
  const { display } = settings

  return (
    <div className="compact-eeg-view">
      {COMPACT_VIEW_CONFIGS.map((config) => (
        <div key={config.id} className="compact-view-panel">
          <div className="compact-view-header">
            <h4>{config.label}</h4>
            <div className="compact-view-controls">
              <button className="compact-control-btn" title="Zoom">🔍</button>
              <button className="compact-control-btn" title="Pan">↔</button>
              <button className="compact-control-btn" title="Settings">⚙</button>
            </div>
          </div>
          <div className="compact-view-content">
            {config.channels.map((channelIndex, idx) => {
              const channelData = eegBuffer[channelIndex] || []
              const channelName = CHANNEL_NAMES[channelIndex]
              const channelColor = config.colors[idx]
              
              return (
                <div key={channelIndex} className="compact-channel">
                  <div className="compact-channel-label">{channelName}</div>
                  <CompactChart
                    channelData={channelData}
                    channelName={channelName}
                    channelColor={channelColor}
                    theme={ui?.theme || 'light'}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

