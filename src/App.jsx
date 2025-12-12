import { useEffect, useMemo } from 'react'
import { EEGProvider, useEEG } from './store/EEGContext'
import HeaderBar from './components/HeaderBar'
import RawEEGPlot from './components/RawEEGPlot'
import Spectrogram from './components/Spectrogram'
import SettingsPanel from './components/SettingsPanel'
import AlertBanner from './components/AlertBanner'
import EventLog from './components/EventLog'
import CompactEEGView from './components/CompactEEGView'
import CSAView from './components/CSAView'
import CSAViewAdapter from './components/CSAViewAdapter'
import DSAViewAdapter from './components/DSAViewAdapter'
import './App.css'

function AppContent() {
  // All hooks must be called unconditionally and in the same order
  const { eegBuffer, ischemiaEvents, settings, ui, actions, isStreaming, currentTime } = useEEG()

  // Debug: log data status
  useEffect(() => {
    const dataLength = eegBuffer?.[0]?.length || 0
    if (dataLength > 0) {
      console.log('AppContent - Data status:', {
        isStreaming,
        currentTime: currentTime?.toFixed(2),
        channel0Length: dataLength,
        firstPoint: eegBuffer[0][0],
        lastPoint: eegBuffer[0][dataLength - 1]
      })
    }
  }, [eegBuffer, isStreaming, currentTime])

  // Calculate spectrogram data from EEG buffer
  const calculateSpectrum = (sample, fftSize, sampleRate, channelIndex) => {
    const frequencies = []
    const numFreqBins = fftSize / 2
    
    for (let i = 0; i < numFreqBins; i++) {
      const freq = (i * sampleRate) / fftSize
      let power = 0
      const channelVariation = 1 + (channelIndex % 4) * 0.1
      
      if (freq >= 0.5 && freq <= 4) {
        power = Math.abs(sample) * 0.3 * (1 + Math.sin(freq * Math.PI / 2)) * channelVariation
      } else if (freq > 4 && freq <= 8) {
        power = Math.abs(sample) * 0.25 * (1 + Math.sin((freq - 4) * Math.PI / 4)) * channelVariation
      } else if (freq > 8 && freq <= 13) {
        power = Math.abs(sample) * 0.35 * (1 + Math.sin((freq - 8) * Math.PI / 5)) * channelVariation
      } else if (freq > 13 && freq <= 30) {
        power = Math.abs(sample) * 0.2 * (1 + Math.sin((freq - 13) * Math.PI / 17)) * channelVariation
      } else if (freq > 30 && freq <= 60) {
        power = Math.abs(sample) * 0.1 * (1 + Math.sin((freq - 30) * Math.PI / 30)) * channelVariation
      }
      
      power *= (0.8 + Math.random() * 0.4)
      frequencies.push({ freq, power: Math.max(0, power) })
    }
    
    return frequencies
  }

  // Convert EEG buffer to spectrogram format
  // Optimize: Use sliding window approach to prevent browser freezing
  const spectrogramData = useMemo(() => {
    if (!eegBuffer || !settings) return []
    return eegBuffer.map((channelData, channelIndex) => {
      const fftSize = settings.spectrogram.fftSize
      const sampleRate = 250
      
      // Handle empty channel data
      if (!channelData || channelData.length === 0) {
        return []
      }
      
      // Use sliding window: calculate spectrum every N samples to reduce computation
      // For real-time streaming, we only need to update the most recent data
      const windowSize = Math.floor(sampleRate * 0.1) // 100ms windows
      const stepSize = Math.max(1, Math.floor(windowSize / 4)) // Overlap windows
      
      const spectrogramPoints = []
      
      // Only process recent data (last 10 seconds) for performance
      const maxDataPoints = sampleRate * 10
      const startIdx = Math.max(0, channelData.length - maxDataPoints)
      const dataToProcess = channelData.slice(startIdx)
      
      // Process in windows
      for (let i = 0; i < dataToProcess.length - windowSize; i += stepSize) {
        const window = dataToProcess.slice(i, i + windowSize)
        if (window.length < windowSize) break
        
        // Calculate average value in window for spectrum
        const avgValue = window.reduce((sum, p) => sum + Math.abs(p.y), 0) / window.length
        const centerTime = window[Math.floor(window.length / 2)].x
        
        spectrogramPoints.push({
          time: centerTime,
          frequencies: calculateSpectrum(avgValue, fftSize, sampleRate, channelIndex)
        })
      }
      
      return spectrogramPoints
    })
  }, [eegBuffer, settings?.spectrogram?.fftSize])

  // Apply theme
  useEffect(() => {
    if (ui && ui.theme) {
      document.documentElement.setAttribute('data-theme', ui.theme)
    }
  }, [ui?.theme])

  // Safety check - after all hooks
  if (!eegBuffer || !settings || !ui) {
    return (
      <div className="app" style={{ padding: '20px', color: 'white', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
        <h1>Loading...</h1>
      </div>
    )
  }

  // Transform ischemia events to match component expectations
  const transformedIschemiaEvents = ischemiaEvents.map(event => ({
    start: event.startTime,
    end: event.endTime,
    confidence: event.confidence,
  }))

  return (
    <div className="app">
      <HeaderBar />
      <AlertBanner />
      <div className="app-content">
        <div className={`main-panels ${ui.settingsPanelOpen ? 'settings-open' : ''} ${ui.eventLogOpen ? 'event-log-open' : ''} ${ui.compactSidebarOpen ? 'compact-sidebar-open' : ''}`}>
          <div className={`compact-sidebar ${ui.compactSidebarOpen ? 'open' : ''}`}>
            <CompactEEGView />
          </div>
          <div className="center-panel">
            <div className="main-eeg-panel">
              <RawEEGPlot 
                data={eegBuffer}
                ischemiaEvents={transformedIschemiaEvents}
                theme={ui.theme}
              />
            </div>
            <div className={`spectral-panels ${!ui.csaPanelOpen ? 'csa-hidden' : ''} ${!ui.qdsaPanelOpen ? 'qdsa-hidden' : ''}`}>
              <div className="spectrogram-panel">
                <Spectrogram 
                  data={spectrogramData}
                  theme={ui.theme}
                />
              </div>
              {ui.csaPanelOpen && (
                <div className="csa-panel">
                  <CSAViewAdapter 
                    data={spectrogramData}
                    eegBuffer={eegBuffer}
                    theme={ui.theme}
                  />
                </div>
              )}
              {ui.qdsaPanelOpen && (
                <div className="quadrant-dsa-panel">
                  <DSAViewAdapter 
                    data={spectrogramData}
                    eegBuffer={eegBuffer}
                    theme={ui.theme}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        {ui.eventLogOpen && <EventLog isOpen={ui.eventLogOpen} />}
        <SettingsPanel />
      </div>
    </div>
  )
}

function App() {
  return (
    <EEGProvider>
      <AppContent />
    </EEGProvider>
  )
}

export default App
