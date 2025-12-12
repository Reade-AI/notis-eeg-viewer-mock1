import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react'
import { FilterState } from '../utils/filters'

const EEGContext = createContext(null)

// Generate initial pre-loaded EEG data
function generateInitialEEGData(duration = 30, sampleRate = 10) {
  const numSamples = duration * sampleRate
  const channels = Array(8).fill(null).map(() => [])
  
  for (let i = 0; i < numSamples; i++) {
    const time = i / sampleRate
    const samples = Array(8).fill(0).map((_, channelIndex) => {
      let signal = 0
      // Delta (0.5-4 Hz)
      signal += 5 * Math.sin(2 * Math.PI * 2 * time + channelIndex * 0.5)
      // Theta (4-8 Hz)
      signal += 3 * Math.sin(2 * Math.PI * 6 * time + channelIndex * 0.3)
      // Alpha (8-13 Hz)
      signal += 4 * Math.sin(2 * Math.PI * 10 * time + channelIndex * 0.2)
      // Beta (13-30 Hz)
      signal += 2 * Math.sin(2 * Math.PI * 20 * time + channelIndex * 0.1)
      // Gamma (30-100 Hz)
      signal += 1 * Math.sin(2 * Math.PI * 40 * time + channelIndex * 0.05)
      // Noise
      signal += (Math.random() - 0.5) * 2
      
      // Apply ischemia effect between 10-15 seconds
      if (time >= 10 && time <= 15) {
        signal *= 0.3 // Reduced amplitude
        signal += 2 * Math.sin(2 * Math.PI * 1.5 * time) // More delta
      }
      
      return signal
    })
    
    samples.forEach((sample, channelIndex) => {
      channels[channelIndex].push({ x: time, y: sample })
    })
  }
  
  return channels
}

// Initial state - start with empty data for live streaming
const initialState = {
  // EEG Data - start empty for live streaming
  eegBuffer: Array(8).fill(null).map(() => []),
  currentTime: 0,
  isStreaming: false,
  
  // Channel impedance values (kΩ) - updated during streaming
  channelImpedance: Array(8).fill(null).map(() => ({
    value: Math.random() * 5 + 0.5, // Random between 0.5-5.5 kΩ
    lastUpdated: Date.now(),
    status: 'good' // 'good' | 'fair' | 'poor' | 'bad'
  })),
  
  // Bad channels - channels marked as bad/excluded
  badChannels: Array(8).fill(false),
  
  // Ischemia Events - start empty, will be detected during streaming
  ischemiaEvents: [],
  
  // Annotations - clinical notes and event markers
  annotations: [],
  
  // Alert acknowledgments
  alertAcknowledged: {},
  
  // Measurement state
  measurement: {
    active: false,
    startTime: null,
    startAmplitude: null,
    currentTime: null,
    currentAmplitude: null,
  },
  
  // Session information
  session: {
    startTime: null,
    sessionId: null,
    sessionType: 'OR',
  },
  
  // Presets
  presets: {
    saved: [],
    current: null,
  },
  
  // Settings
  settings: {
    // Display Settings
    display: {
      channelVisibility: Array(8).fill(true),
      channelOrder: [0, 1, 2, 3, 4, 5, 6, 7],
      montage: 'BANANA', // 'BANANA' | '10-20' | 'BIPOLAR' | 'REFERENCE'
      amplitudeScale: 7.0, // μV/mm
      timeScale: 60, // mm/sec (default timebase)
      timeWindow: 5, // seconds - default window for live streaming
      timeOffset: 0, // seconds - offset from the end of data (0 = showing most recent)
      filters: {
        highPass: 1.0, // Hz
        lowPass: 30, // Hz
        notch: 60 // Hz
      },
      baselineStabilization: false,
      colorMode: 'channel', // 'channel' | 'grayscale'
    },
    
    // Spectrogram Settings
    spectrogram: {
      selectedChannel: 0,
      timeWindow: 60, // seconds
      frequencyRange: [0, 60], // Hz
      fftSize: 256,
      windowLength: 1.0, // seconds
      smoothing: 0.5,
      colormap: 'jet', // 'jet' | 'hot' | 'cool'
      intensity: 1.0,
      contrast: 1.0,
    },
    
    // Ischemia Detection Settings
    detection: {
      sensitivity: 0.5, // 0-1
      thresholds: {
        relativePowerDrop: 0.3,
        alphaDeltaRatio: 0.5,
        slowWaveIncrease: 0.4,
        burstSuppression: 0.6,
      },
      minDuration: 5, // seconds
      recoveryCriteria: 'auto', // 'auto' | 'manual'
      visualization: {
        showStartEndLines: true,
        showRedSegment: true,
        showConfidence: true,
        showModelExplanation: false,
      },
    },
    
    // Alert Settings
    alerts: {
      audioEnabled: true,
      audioVolume: 0.7,
      onScreenNotifications: true,
      repeatInterval: 30, // seconds
      severityLevels: {
        critical: true,
        warning: true,
        info: false,
      },
      cooldownPeriod: 10, // seconds
    },
    
    // Recording Settings
    recording: {
      isRecording: false,
      autoStart: false,
      bufferSize: 3600, // seconds
    },
    
    // Patient & Session Settings
    patient: {
      patientId: '',
      mrn: '',
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      sessionType: 'OR', // 'OR' | 'ICU' | 'ER'
      deviceType: 'Standard',
      electrodeConfig: '10-20',
      impedanceThreshold: 5, // kΩ
      artifactSuppression: true,
      sessionDate: new Date().toISOString(),
      sessionStartTime: new Date().toISOString(),
    },
    
    // System Settings
    system: {
      refreshRate: 10, // Hz
      bufferSize: 3600, // seconds
      mode: 'realtime', // 'realtime' | 'lowlatency'
      deviceConnected: true,
    },
  },
  
  // UI State
  ui: {
    settingsPanelOpen: false,
    eventLogOpen: false, // Toggle to show/hide
    compactSidebarOpen: false, // Toggle to show/hide
    csaPanelOpen: true, // Toggle to show/hide CSA panel - enabled by default
    qdsaPanelOpen: true, // Toggle to show/hide Quadrant DSA panel - enabled by default
    theme: 'light',
  },
  
  // EDF State
  edfData: null, // Store loaded EDF data
  edfFileInfo: null, // Store EDF file metadata
  eegState: {
    isLoaded: false,
    channels: null, // Float32Array channels from EDF
    durationSec: 0,
    startTimeSec: 0,
    trimmedTimeOffset: 0, // Time offset from trimming leading zeros (preserves original EDF time context)
  },
  playback: {
    isPlaying: false,
    playbackTimeSec: 0,
    playbackSpeed: 1.0, // 1.0 = real-time
  },
}

// Action types
const ActionTypes = {
  APPEND_EEG_SAMPLES: 'APPEND_EEG_SAMPLES',
  SET_IS_STREAMING: 'SET_IS_STREAMING',
  ADD_ISCHEMIA_EVENT: 'ADD_ISCHEMIA_EVENT',
  UPDATE_ISCHEMIA_EVENT: 'UPDATE_ISCHEMIA_EVENT',
  SET_ISCHEMIA_EVENTS: 'SET_ISCHEMIA_EVENTS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  RESET_EEG_BUFFER: 'RESET_EEG_BUFFER',
  SET_CURRENT_TIME: 'SET_CURRENT_TIME',
  TOGGLE_SETTINGS_PANEL: 'TOGGLE_SETTINGS_PANEL',
  TOGGLE_EVENT_LOG: 'TOGGLE_EVENT_LOG',
  TOGGLE_COMPACT_SIDEBAR: 'TOGGLE_COMPACT_SIDEBAR',
  TOGGLE_CSA_PANEL: 'TOGGLE_CSA_PANEL',
  TOGGLE_QDSA_PANEL: 'TOGGLE_QDSA_PANEL',
  SET_THEME: 'SET_THEME',
  SET_RECORDING: 'SET_RECORDING',
  SET_DEVICE_CONNECTED: 'SET_DEVICE_CONNECTED',
  ADD_ANNOTATION: 'ADD_ANNOTATION',
  UPDATE_ANNOTATION: 'UPDATE_ANNOTATION',
  DELETE_ANNOTATION: 'DELETE_ANNOTATION',
  ACKNOWLEDGE_ALERT: 'ACKNOWLEDGE_ALERT',
  SET_MEASUREMENT: 'SET_MEASUREMENT',
  CLEAR_MEASUREMENT: 'CLEAR_MEASUREMENT',
  SET_SESSION: 'SET_SESSION',
  SAVE_PRESET: 'SAVE_PRESET',
  LOAD_PRESET: 'LOAD_PRESET',
  DELETE_PRESET: 'DELETE_PRESET',
  UPDATE_IMPEDANCE: 'UPDATE_IMPEDANCE',
  TOGGLE_BAD_CHANNEL: 'TOGGLE_BAD_CHANNEL',
  LOAD_EDF_DATA: 'LOAD_EDF_DATA',
  SET_EDF_FILE_INFO: 'SET_EDF_FILE_INFO',
  SET_EEG_STATE: 'SET_EEG_STATE',
  SET_PLAYBACK: 'SET_PLAYBACK',
  RESET_TO_LIVE_MODE: 'RESET_TO_LIVE_MODE',
}

// Reducer
function eegReducer(state, action) {
  switch (action.type) {
    case ActionTypes.APPEND_EEG_SAMPLES:
      return {
        ...state,
        eegBuffer: action.payload,
      }
    
    case ActionTypes.SET_IS_STREAMING:
      return {
        ...state,
        isStreaming: action.payload,
      }
    
    case ActionTypes.ADD_ISCHEMIA_EVENT:
      return {
        ...state,
        ischemiaEvents: [...state.ischemiaEvents, action.payload],
      }
    
    case ActionTypes.UPDATE_ISCHEMIA_EVENT:
      return {
        ...state,
        ischemiaEvents: state.ischemiaEvents.map(event =>
          event.id === action.payload.id
            ? { ...event, ...action.payload.updates }
            : event
        ),
      }
    
    case ActionTypes.SET_ISCHEMIA_EVENTS:
      return {
        ...state,
        ischemiaEvents: action.payload,
      }
    
    case ActionTypes.UPDATE_SETTINGS:
      const newState = {
        ...state,
        settings: {
          ...state.settings,
          [action.payload.category]: {
            ...state.settings[action.payload.category],
            ...action.payload.updates,
          },
        },
      }
      if (action.payload.category === 'display' && action.payload.updates.amplitudeScale !== undefined) {
        console.log('[EEGContext Reducer] amplitudeScale updated to:', newState.settings.display.amplitudeScale)
      }
      return newState
    
    case ActionTypes.RESET_EEG_BUFFER:
      return {
        ...state,
        eegBuffer: Array(8).fill(null).map(() => []),
        currentTime: 0,
      }
    
    case ActionTypes.SET_CURRENT_TIME:
      return {
        ...state,
        currentTime: action.payload,
      }
    
    case ActionTypes.TOGGLE_SETTINGS_PANEL:
      return {
        ...state,
        ui: {
          ...state.ui,
          settingsPanelOpen: !state.ui.settingsPanelOpen,
        },
      }
    
    case ActionTypes.TOGGLE_EVENT_LOG:
      return {
        ...state,
        ui: {
          ...state.ui,
          eventLogOpen: !state.ui.eventLogOpen,
        },
      }
    
    case ActionTypes.TOGGLE_COMPACT_SIDEBAR:
      return {
        ...state,
        ui: {
          ...state.ui,
          compactSidebarOpen: !state.ui.compactSidebarOpen,
        },
      }
    
    case ActionTypes.TOGGLE_CSA_PANEL:
      return {
        ...state,
        ui: {
          ...state.ui,
          csaPanelOpen: !state.ui.csaPanelOpen,
        },
      }
    
    case ActionTypes.TOGGLE_QDSA_PANEL:
      return {
        ...state,
        ui: {
          ...state.ui,
          qdsaPanelOpen: !state.ui.qdsaPanelOpen,
        },
      }
    
    case ActionTypes.SET_THEME:
      return {
        ...state,
        ui: {
          ...state.ui,
          theme: action.payload,
        },
      }
    
    case ActionTypes.SET_RECORDING:
      return {
        ...state,
        settings: {
          ...state.settings,
          recording: {
            ...state.settings.recording,
            isRecording: action.payload,
          },
        },
      }
    
    case ActionTypes.SET_DEVICE_CONNECTED:
      return {
        ...state,
        settings: {
          ...state.settings,
          system: {
            ...state.settings.system,
            deviceConnected: action.payload,
          },
        },
      }
    
    case ActionTypes.ADD_ANNOTATION:
      return {
        ...state,
        annotations: [...state.annotations, action.payload],
      }
    
    case ActionTypes.UPDATE_ANNOTATION:
      return {
        ...state,
        annotations: state.annotations.map(ann =>
          ann.id === action.payload.id ? { ...ann, ...action.payload.updates } : ann
        ),
      }
    
    case ActionTypes.DELETE_ANNOTATION:
      return {
        ...state,
        annotations: state.annotations.filter(ann => ann.id !== action.payload),
      }
    
    case ActionTypes.ACKNOWLEDGE_ALERT:
      return {
        ...state,
        alertAcknowledged: {
          ...state.alertAcknowledged,
          [action.payload]: true,
        },
      }
    
    case ActionTypes.SET_MEASUREMENT:
      return {
        ...state,
        measurement: {
          ...state.measurement,
          ...action.payload,
        },
      }
    
    case ActionTypes.CLEAR_MEASUREMENT:
      return {
        ...state,
        measurement: {
          active: false,
          startTime: null,
          startAmplitude: null,
          currentTime: null,
          currentAmplitude: null,
        },
      }
    
    case ActionTypes.SET_SESSION:
      return {
        ...state,
        session: {
          ...state.session,
          ...action.payload,
        },
      }
    
    case ActionTypes.SAVE_PRESET:
      return {
        ...state,
        presets: {
          ...state.presets,
          saved: [...state.presets.saved, action.payload],
        },
      }
    
    case ActionTypes.LOAD_PRESET:
      return {
        ...state,
        presets: {
          ...state.presets,
          current: action.payload,
        },
      }
    
    case ActionTypes.DELETE_PRESET:
      return {
        ...state,
        presets: {
          ...state.presets,
          saved: state.presets.saved.filter(p => p.id !== action.payload),
        },
      }
    
    case ActionTypes.UPDATE_IMPEDANCE:
      return {
        ...state,
        channelImpedance: state.channelImpedance.map((imp, idx) => 
          idx === action.payload.channelIndex
            ? {
                ...imp,
                value: action.payload.value,
                lastUpdated: Date.now(),
                status: action.payload.value < 2 ? 'good' : 
                        action.payload.value < 5 ? 'fair' : 
                        action.payload.value < 10 ? 'poor' : 'bad'
              }
            : imp
        ),
      }
    
    case ActionTypes.TOGGLE_BAD_CHANNEL:
      return {
        ...state,
        badChannels: state.badChannels.map((bad, idx) => 
          idx === action.payload ? !bad : bad
        ),
      }
    
    case ActionTypes.LOAD_EDF_DATA:
      return {
        ...state,
        edfData: action.payload,
      }
    
    case ActionTypes.SET_EDF_FILE_INFO:
      return {
        ...state,
        edfFileInfo: action.payload,
      }
    
    case ActionTypes.SET_EEG_STATE:
      // If channels are being set, update channel-related arrays to match
      const numChannels = action.payload.channels?.length || state.eegState?.channels?.length || 8
      const currentNumChannels = state.settings.display.channelVisibility?.length || 8
      
      // Only update arrays if channel count changed
      let updatedState = {
        ...state,
        eegState: {
          ...state.eegState,
          ...action.payload,
        },
      }
      
      if (numChannels !== currentNumChannels && action.payload.channels) {
        // Resize channelVisibility array
        const newChannelVisibility = Array(numChannels).fill(true)
        // Preserve existing visibility for channels that still exist
        for (let i = 0; i < Math.min(numChannels, currentNumChannels); i++) {
          newChannelVisibility[i] = state.settings.display.channelVisibility[i] !== false
        }
        
        // Resize channelImpedance array
        const newChannelImpedance = Array(numChannels).fill(null).map((_, idx) => {
          if (idx < currentNumChannels && state.channelImpedance[idx]) {
            return state.channelImpedance[idx]
          }
          return {
            value: null,
            lastUpdated: null,
            status: 'unknown'
          }
        })
        
        // Resize badChannels array
        const newBadChannels = Array(numChannels).fill(false)
        for (let i = 0; i < Math.min(numChannels, currentNumChannels); i++) {
          newBadChannels[i] = state.badChannels[i] || false
        }
        
        updatedState = {
          ...updatedState,
          settings: {
            ...updatedState.settings,
            display: {
              ...updatedState.settings.display,
              channelVisibility: newChannelVisibility,
            },
          },
          channelImpedance: newChannelImpedance,
          badChannels: newBadChannels,
        }
      }
      
      return updatedState
    
    case ActionTypes.SET_PLAYBACK:
      return {
        ...state,
        playback: {
          ...state.playback,
          ...action.payload,
        },
      }
    
    case ActionTypes.RESET_TO_LIVE_MODE:
      // Reset to default 8 channels for live mode
      return {
        ...state,
        edfData: null,
        edfFileInfo: null,
        eegState: {
          isLoaded: false,
          channels: null,
          durationSec: 0,
          startTimeSec: 0,
          trimmedTimeOffset: 0,
        },
        playback: {
          isPlaying: false,
          playbackTimeSec: 0,
          playbackSpeed: 1.0,
        },
        eegBuffer: Array(8).fill(null).map(() => []),
        currentTime: 0,
        isStreaming: false,
        // Reset channel arrays to default 8 channels
        channelImpedance: Array(8).fill(null).map(() => ({
          value: null,
          lastUpdated: null,
          status: 'unknown'
        })),
        badChannels: Array(8).fill(false),
        settings: {
          ...state.settings,
          display: {
            ...state.settings.display,
            channelVisibility: Array(8).fill(true),
          },
        },
      }
    
    default:
      return state
  }
}

// Provider component
export function EEGProvider({ children }) {
  const [state, dispatch] = useReducer(eegReducer, initialState)
  const streamIntervalRef = useRef(null)
  const detectionIntervalRef = useRef(null)
  const lastAlertTimeRef = useRef({})
  const stateRef = useRef(state)
  
  // Log initial amplitudeScale value for debugging
  useEffect(() => {
    console.log('[EEGContext] Initial amplitudeScale:', initialState.settings.display.amplitudeScale)
    console.log('[EEGContext] Current state amplitudeScale:', state.settings?.display?.amplitudeScale)
  }, [])
  
  // Keep state ref updated
  useEffect(() => {
    stateRef.current = state
  }, [state])
  
  // Note: amplitudeScale defaults to 7.0 in initialState
  // Users can change it to any value (2.5, 5.0, 7.0, 10.0, 20.0) via the dropdown

  // Actions
  const appendEEGSamples = useCallback((samples, timestamp) => {
    const currentState = stateRef.current
    const newBuffer = currentState.eegBuffer.map((channelData, index) => {
      const newPoint = { x: timestamp, y: samples[index] }
      const updated = [...(channelData || []), newPoint]
      // Don't trim buffer - keep all data so user can navigate through entire recording
      // Chart.js will handle rendering only the visible range
      return updated
    })
    
    // Debug: log first few samples
    if (newBuffer[0] && newBuffer[0].length <= 10) {
      console.log('Appending samples:', {
        timestamp: timestamp.toFixed(3),
        sampleCount: newBuffer[0].length,
        firstPoint: newBuffer[0][0],
        lastPoint: newBuffer[0][newBuffer[0].length - 1],
        sampleValues: samples.slice(0, 3)
      })
    }
    
    dispatch({ type: ActionTypes.APPEND_EEG_SAMPLES, payload: newBuffer })
    dispatch({ type: ActionTypes.SET_CURRENT_TIME, payload: timestamp })
  }, [])



  const startMockStream = useCallback(() => {
    if (streamIntervalRef.current) {
      console.log('Stream already running')
      return
    }
    
    console.log('Starting mock stream...')
    const currentState = stateRef.current
    let time = currentState.currentTime || 0
    const refreshRate = currentState.settings.system.refreshRate || 10
    const interval = 1000 / refreshRate // ms
    
    // Use realistic EEG sample rate (250 Hz) for proper spectral analysis
    // Generate multiple samples per UI update to simulate higher sample rate
    const targetSampleRate = 250 // Realistic EEG sample rate (Hz)
    const samplesPerUpdate = Math.max(1, Math.floor(targetSampleRate / refreshRate)) // ~25 samples per update
    const actualSampleRate = samplesPerUpdate * refreshRate // Effective sample rate
    const timeIncrement = 1 / actualSampleRate // Time increment per sample
    
    // Initialize filter states for each channel
    const mockFilterStates = {}
    for (let i = 0; i < 8; i++) {
      mockFilterStates[i] = new FilterState()
    }
    
    // Track last filter settings to detect changes
    let lastMockFilterSettings = JSON.stringify(currentState.settings.display.filters)
    
    // Mock ischemia event scheduling
    let nextIschemiaStart = 15 // Start first ischemia at 15 seconds
    let nextIschemiaEnd = null
    let ischemiaDuration = 5 // 5 seconds duration
    
    console.log('Stream config:', { 
      refreshRate, 
      interval, 
      targetSampleRate,
      samplesPerUpdate,
      actualSampleRate,
      startTime: time 
    })
    console.log('Mock ischemia will start at:', nextIschemiaStart, 'seconds')
    
    streamIntervalRef.current = setInterval(() => {
      const latestState = stateRef.current
      
      // Generate multiple samples per update for realistic sample rate
      const samplesToAdd = []
      
      for (let sampleIdx = 0; sampleIdx < samplesPerUpdate; sampleIdx++) {
        const sampleTime = time + (sampleIdx * timeIncrement)
        
        // Check if we should start a new ischemia event (check once per update, not per sample)
        if (sampleIdx === 0 && sampleTime >= nextIschemiaStart && !nextIschemiaEnd) {
        console.log('🩺 Mock ischemia START detected at', time.toFixed(2), 'seconds')
        
        // Realistic ischemia detection criteria based on actual signal changes
        // The signal generator creates:
        // - Delta increase: 3 → 8-20 (2.7x to 6.7x increase)
        // - Alpha decrease: 6-8 → 0.5-2 (75-90% decrease)
        // - Beta decrease: 4 → 0.2-1.2 (70-95% decrease)
        // - Overall power: decreases due to alpha/beta loss
        
        const affectedChannels = [0, 1, 2, 3, 4, 5, 6, 7] // All channels for mock
        const primaryChannels = [0, 1, 4, 5] // Most affected channels (anterior and posterior)
        
        // Calculate realistic detection criteria based on clinical research
        // Kamitaki et al. found: Alpha 52.1% decrease, Beta 41.6% decrease, Theta 36.4% decrease
        // Visser et al.: Severe ischemia shows alpha/beta reduction + delta/theta increase
        
        // Relative power drop: primarily from alpha (52.1%) and beta (41.6%) decreases
        // Normal: alpha ~8, beta ~4 = 12 total
        // Ischemia: alpha ~3.8 (52.1% drop), beta ~2.3 (41.6% drop) = 6.1 total
        // Drop = (12 - 6.1) / 12 = 49.2% (more realistic per research)
        const relativePowerDrop = 0.45 + Math.random() * 0.15 // 45-60% drop (matches research)
        
        // Alpha/Delta ratio (ADR): key qEEG parameter per research
        // Normal: alpha ~8, delta ~3, ADR = 8/3 = 2.67
        // Ischemia: alpha ~3.8 (52.1% drop), delta ~15 (severe) or ~3 (mild), ADR = 0.25 (severe) or 1.27 (mild)
        // For severe ischemia: 0.25 / 2.67 = 0.094 (90.6% decrease)
        const alphaDeltaRatio = 0.08 + Math.random() * 0.12 // 0.08-0.20 (matches severe ischemia)
        
        // Slow wave (delta) increase: only in severe ischemia
        // Normal delta: ~3, Severe ischemia delta: ~15
        // Increase: (15 - 3) / 3 = 400% = 4x increase
        const slowWaveIncrease = 3.0 + Math.random() * 2.0 // 300-500% increase (severe ischemia)
        
        // Confidence based on severity of changes
        const baseConfidence = 0.80 + (relativePowerDrop - 0.70) * 0.5 // Higher drop = higher confidence
        const confidence = Math.min(0.95, Math.max(0.70, baseConfidence + (Math.random() - 0.5) * 0.1))
        const severity = confidence > 0.90 ? 'critical' : confidence > 0.80 ? 'warning' : 'info'
        
        const newEvent = {
          id: Date.now() + Math.random(),
          startTime: time,
          endTime: null,
          confidence: confidence,
          severity: severity,
          channelIds: affectedChannels,
          primaryChannels: primaryChannels, // Most affected channels
          detectionCriteria: {
            relativePowerDrop: relativePowerDrop,
            alphaDeltaRatio: alphaDeltaRatio,
            slowWaveIncrease: slowWaveIncrease,
            affectedChannels: affectedChannels.length,
            primaryChannels: primaryChannels.length,
          },
          acknowledged: false,
        }
        dispatch({ type: ActionTypes.ADD_ISCHEMIA_EVENT, payload: newEvent })
        
        // Trigger alert notification
        if (latestState.settings.alerts.onScreenNotifications) {
          window.dispatchEvent(new CustomEvent('ischemia-alert', {
            detail: newEvent,
          }))
        }
        
          nextIschemiaEnd = sampleTime + ischemiaDuration
        }
        
        // Check if we should end the current ischemia event (check once per update)
        if (sampleIdx === 0 && nextIschemiaEnd && sampleTime >= nextIschemiaEnd) {
        const activeEvents = latestState.ischemiaEvents.filter(e => !e.endTime)
        if (activeEvents.length > 0) {
          const eventToEnd = activeEvents[activeEvents.length - 1]
          console.log('✅ Mock ischemia STOP detected at', sampleTime.toFixed(2), 'seconds')
          dispatch({ type: ActionTypes.UPDATE_ISCHEMIA_EVENT, payload: { id: eventToEnd.id, updates: { endTime: sampleTime } } })
        }
          nextIschemiaEnd = null
          // Schedule next ischemia event 20 seconds after this one ends
          nextIschemiaStart = sampleTime + 20
          console.log('Next mock ischemia will start at:', nextIschemiaStart.toFixed(2), 'seconds')
        }
        
        // Get filter settings from current state (check once per update)
        if (sampleIdx === 0) {
          const filterSettings = latestState.settings.display.filters || {
            highPass: 1.0,
            lowPass: 30,
            notch: 60
          }
          
          // Reset filter states if filter settings changed
          const currentMockFilterSettings = JSON.stringify(filterSettings)
          if (currentMockFilterSettings !== lastMockFilterSettings) {
            console.log('[startMockStream] Filter settings changed, resetting filter states')
            Object.values(mockFilterStates).forEach(state => state.reset())
            lastMockFilterSettings = currentMockFilterSettings
          }
        }
        
        // Generate realistic mock EEG samples with proper frequency characteristics
        const samples = Array(8).fill(0).map((_, i) => {
          const t = sampleTime
        let signal = 0
        
        // Check if we're in an active ischemia event
        const activeEvent = latestState.ischemiaEvents.find(
          e => !e.endTime && sampleTime >= e.startTime
        )
        
        // Channel-specific characteristics (simulate different brain regions)
        const channelPhase = i * 0.3 // Phase offset per channel
        const channelVariation = 0.8 + (i % 3) * 0.1 // Slight amplitude variation
        
        if (activeEvent) {
          // ISCHEMIA PATTERN: Based on clinical research (Visser et al., Kamitaki et al.)
          // Severe ischemia: reduction in alpha/beta, increase in delta/theta
          // Mild ischemia: only reduction in alpha
          // Power decreases: Alpha 52.1%, Beta 41.6%, Theta 36.4% (but increases in severe)
          
          // Time since ischemia started (for gradual changes)
          const ischemiaTime = sampleTime - activeEvent.startTime
          const ischemiaProgress = Math.min(1.0, ischemiaTime / 2.0) // Gradual onset over 2 seconds
          
          // Primary affected channels show stronger changes
          const isPrimaryChannel = activeEvent.primaryChannels?.includes(i) || false
          const severityFactor = isPrimaryChannel ? 1.0 : 0.6
          
          // Determine severity: severe shows delta/theta increase, mild only alpha decrease
          const isSevereIschemia = activeEvent.severity === 'critical' || activeEvent.severity === 'warning'
          
          // DELTA (0-4 Hz): INCREASED during severe ischemia (per Visser et al.)
          // Multiple delta components for realism
          const deltaFreq1 = 1.0 + Math.sin(t * 0.1) * 0.5 // Slow variation 1.0-1.5 Hz
          const deltaFreq2 = 2.5 + Math.sin(t * 0.15) * 0.8 // 2.5-3.3 Hz
          let deltaAmplitude
          if (isSevereIschemia) {
            // Severe: significant increase (3x-5x normal)
            deltaAmplitude = (3 + ischemiaProgress * 12) * severityFactor * channelVariation
          } else {
            // Mild: slight increase or maintain
            deltaAmplitude = (3 + ischemiaProgress * 2) * severityFactor * channelVariation
          }
          signal += deltaAmplitude * Math.sin(2 * Math.PI * deltaFreq1 * t + channelPhase)
          signal += deltaAmplitude * 0.7 * Math.sin(2 * Math.PI * deltaFreq2 * t + channelPhase * 1.3)
          
          // THETA (4-8 Hz): INCREASED during severe ischemia, DECREASED during mild
          const thetaFreq = 5.5 + Math.sin(t * 0.2) * 1.5 // 4-7 Hz variation
          let thetaAmplitude
          if (isSevereIschemia) {
            // Severe: increase (per Visser et al.)
            thetaAmplitude = (5 + ischemiaProgress * 4) * severityFactor * channelVariation
          } else {
            // Mild: decrease by ~36.4% (per Kamitaki et al.)
            thetaAmplitude = (5 * (1 - 0.364 * ischemiaProgress)) * severityFactor * channelVariation
          }
          signal += thetaAmplitude * Math.sin(2 * Math.PI * thetaFreq * t + channelPhase * 0.8)
          
          // ALPHA (8-12 Hz): SIGNIFICANTLY DECREASED (52.1% per Kamitaki et al.)
          const alphaFreq = 10 + Math.sin(t * 0.3) * 2 // 8-12 Hz variation (corrected from 8-13)
          const alphaBaseAmplitude = (i >= 4 ? 8 : 6) * channelVariation // Normal amplitude
          const alphaAmplitude = alphaBaseAmplitude * (1 - 0.521 * ischemiaProgress) * severityFactor
          signal += Math.max(0, alphaAmplitude) * Math.sin(2 * Math.PI * alphaFreq * t + channelPhase * 0.7)
          // Alpha harmonics (reduced during ischemia)
          signal += Math.max(0, alphaAmplitude * 0.3) * Math.sin(2 * Math.PI * alphaFreq * 2 * t + channelPhase * 0.5)
          
          // BETA (12-30 Hz): DECREASED (41.6% per Kamitaki et al.) - corrected from 13-30 Hz
          const betaFreq1 = 16 + Math.sin(t * 0.25) * 4 // 12-20 Hz
          const betaFreq2 = 24 + Math.sin(t * 0.3) * 3 // 21-27 Hz
          const betaBaseAmplitude = 4 * channelVariation // Normal amplitude
          const betaAmplitude = betaBaseAmplitude * (1 - 0.416 * ischemiaProgress) * severityFactor
          signal += Math.max(0, betaAmplitude) * Math.sin(2 * Math.PI * betaFreq1 * t + channelPhase * 0.5)
          signal += Math.max(0, betaAmplitude * 0.5) * Math.sin(2 * Math.PI * betaFreq2 * t + channelPhase * 0.3)
          
          // GAMMA (30-100 Hz): DECREASED (minimal, mostly filtered)
          const gammaFreq = 40 + Math.sin(t * 0.4) * 10 // 30-50 Hz
          const gammaBaseAmplitude = 1.5 * channelVariation
          const gammaAmplitude = gammaBaseAmplitude * (1 - 0.5 * ischemiaProgress) * severityFactor
          signal += Math.max(0, gammaAmplitude) * Math.sin(2 * Math.PI * gammaFreq * t + channelPhase * 0.2)
          
          // Realistic noise: Gaussian-like with reduced amplitude during ischemia
          const noiseAmplitude = 0.8 * severityFactor
          signal += (Math.random() - 0.5) * noiseAmplitude * 2
          signal += (Math.random() - 0.5) * noiseAmplitude * 1 // Additional noise component
          
        } else {
          // NORMAL EEG PATTERN: Realistic baseline activity
          
          // DELTA (0.5-4 Hz): Low amplitude in normal awake state
          const deltaFreq1 = 1.2 + Math.sin(t * 0.05) * 0.4 // 0.8-1.6 Hz
          const deltaFreq2 = 2.8 + Math.sin(t * 0.08) * 0.6 // 2.2-3.4 Hz
          const deltaAmplitude = 3 * channelVariation
          signal += deltaAmplitude * Math.sin(2 * Math.PI * deltaFreq1 * t + channelPhase)
          signal += deltaAmplitude * 0.6 * Math.sin(2 * Math.PI * deltaFreq2 * t + channelPhase * 1.2)
          
          // THETA (4-8 Hz): Moderate amplitude
          const thetaFreq = 6 + Math.sin(t * 0.1) * 1.5 // 4.5-7.5 Hz variation
          const thetaAmplitude = 5 * channelVariation
          signal += thetaAmplitude * Math.sin(2 * Math.PI * thetaFreq * t + channelPhase * 0.9)
          
          // ALPHA (8-12 Hz): Prominent in normal awake state (especially posterior channels)
          // Corrected frequency range per clinical standards (not 8-13 Hz)
          const alphaFreq = 10 + Math.sin(t * 0.2) * 2 // 8-12 Hz variation
          const alphaAmplitude = (i >= 4 ? 8 : 6) * channelVariation // Higher in posterior channels
          signal += alphaAmplitude * Math.sin(2 * Math.PI * alphaFreq * t + channelPhase * 0.7)
          // Alpha harmonics for more realistic appearance
          signal += alphaAmplitude * 0.3 * Math.sin(2 * Math.PI * alphaFreq * 2 * t + channelPhase * 0.5)
          
          // BETA (12-30 Hz): Moderate amplitude (corrected from 13-30 Hz per clinical standards)
          const betaFreq1 = 16 + Math.sin(t * 0.25) * 4 // 12-20 Hz
          const betaFreq2 = 24 + Math.sin(t * 0.3) * 3 // 21-27 Hz
          const betaAmplitude = 4 * channelVariation
          signal += betaAmplitude * Math.sin(2 * Math.PI * betaFreq1 * t + channelPhase * 0.5)
          signal += betaAmplitude * 0.5 * Math.sin(2 * Math.PI * betaFreq2 * t + channelPhase * 0.3)
          
          // GAMMA (30-100 Hz): Low amplitude (mostly filtered)
          const gammaFreq = 40 + Math.sin(t * 0.4) * 10 // 30-50 Hz
          const gammaAmplitude = 1.5 * channelVariation
          signal += gammaAmplitude * Math.sin(2 * Math.PI * gammaFreq * t + channelPhase * 0.2)
          
          // Realistic noise: Gaussian-like with multiple components
          const noiseAmplitude = 1.2
          signal += (Math.random() - 0.5) * noiseAmplitude * 2.5
          signal += (Math.random() - 0.5) * noiseAmplitude * 1.5
          signal += (Math.random() - 0.5) * noiseAmplitude * 0.8 // Multiple noise components
          
          // Add subtle artifacts and baseline drift for realism
          const baselineDrift = Math.sin(t * 0.01) * 0.5 // Very slow drift
          signal += baselineDrift
          
          // Occasional small artifacts (simulate muscle activity, eye blinks, etc.)
          if (Math.random() < 0.02) { // 2% chance per sample
            const artifactAmplitude = 3 + Math.random() * 5
            const artifactFreq = 15 + Math.random() * 20 // 15-35 Hz
            signal += artifactAmplitude * Math.sin(2 * Math.PI * artifactFreq * t)
          }
        }
        
          // Apply digital filters based on current settings
          const filterState = mockFilterStates[i]
          const filterSettings = latestState.settings.display.filters || {
            highPass: 1.0,
            lowPass: 30,
            notch: 60
          }
          signal = filterState.applyFilters(signal, filterSettings, actualSampleRate)
          
          return signal
        })
        
        samplesToAdd.push({ samples, time: sampleTime })
      }
      
      // Update time for next interval
      time += (samplesPerUpdate * timeIncrement)
      
      // Add all samples from this update
      samplesToAdd.forEach(({ samples, time: sampleTime }) => {
        appendEEGSamples(samples, sampleTime)
      })
      
      // Log every second for debugging
      const lastSampleTime = samplesToAdd[samplesToAdd.length - 1]?.time || time
      if (Math.floor(lastSampleTime) !== Math.floor(lastSampleTime - (samplesPerUpdate * timeIncrement))) {
        const activeEvents = latestState.ischemiaEvents.filter(e => !e.endTime)
        console.log('Streaming at time:', lastSampleTime.toFixed(2), 's, buffer size:', latestState.eegBuffer[0]?.length || 0, 
                   activeEvents.length > 0 ? `[ISCHEMIA ACTIVE]` : '', 
                   `(${actualSampleRate.toFixed(0)} Hz effective sample rate)`)
      }
    }, interval)
    
    dispatch({ type: ActionTypes.SET_IS_STREAMING, payload: true })
    console.log('Mock stream started:', {
      interval: interval + 'ms',
      refreshRate: refreshRate + 'Hz',
      targetSampleRate: targetSampleRate + 'Hz',
      samplesPerUpdate,
      actualSampleRate: actualSampleRate.toFixed(0) + 'Hz'
    })
  }, [appendEEGSamples, dispatch])

  const stopMockStream = useCallback(() => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current)
      streamIntervalRef.current = null
    }
    dispatch({ type: ActionTypes.SET_IS_STREAMING, payload: false })
  }, [])

  const addIschemiaEvent = useCallback((event) => {
    const confidence = event.confidence || 0.8
    const severity = confidence > 0.85 ? 'critical' : confidence > 0.75 ? 'warning' : 'info'
    const newEvent = {
      id: Date.now() + Math.random(),
      startTime: event.startTime,
      endTime: event.endTime || null,
      confidence: confidence,
      severity: severity,
      channelIds: event.channelIds || [],
      acknowledged: false,
      ...event,
    }
    dispatch({ type: ActionTypes.ADD_ISCHEMIA_EVENT, payload: newEvent })
    return newEvent
  }, [])

  const updateIschemiaEvent = useCallback((id, updates) => {
    dispatch({
      type: ActionTypes.UPDATE_ISCHEMIA_EVENT,
      payload: { id, updates },
    })
  }, [])

  const updateSettings = useCallback((category, updates) => {
    console.log('[EEGContext] updateSettings called:', { category, updates })
    dispatch({
      type: ActionTypes.UPDATE_SETTINGS,
      payload: { category, updates },
    })
  }, [])

  const toggleSettingsPanel = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_SETTINGS_PANEL })
  }, [])

  const toggleEventLog = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_EVENT_LOG })
  }, [])

  const toggleCompactSidebar = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_COMPACT_SIDEBAR })
  }, [])

  const toggleCsaPanel = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_CSA_PANEL })
  }, [])

  const toggleQdsaPanel = useCallback(() => {
    dispatch({ type: ActionTypes.TOGGLE_QDSA_PANEL })
  }, [])

  const setTheme = useCallback((theme) => {
    dispatch({ type: ActionTypes.SET_THEME, payload: theme })
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  const setRecording = useCallback((isRecording) => {
    dispatch({ type: ActionTypes.SET_RECORDING, payload: isRecording })
  }, [])

  const setDeviceConnected = useCallback((connected) => {
    dispatch({ type: ActionTypes.SET_DEVICE_CONNECTED, payload: connected })
  }, [])

  const addAnnotation = useCallback((annotation) => {
    const newAnnotation = {
      id: Date.now() + Math.random(),
      timestamp: annotation.timestamp || stateRef.current.currentTime,
      type: annotation.type || 'note', // 'note' | 'seizure' | 'artifact' | 'event'
      text: annotation.text || '',
      channelIds: annotation.channelIds || [],
      createdAt: new Date().toISOString(),
      ...annotation,
    }
    dispatch({ type: ActionTypes.ADD_ANNOTATION, payload: newAnnotation })
    return newAnnotation
  }, [])

  const updateAnnotation = useCallback((id, updates) => {
    dispatch({ type: ActionTypes.UPDATE_ANNOTATION, payload: { id, updates } })
  }, [])

  const deleteAnnotation = useCallback((id) => {
    dispatch({ type: ActionTypes.DELETE_ANNOTATION, payload: id })
  }, [])

  const acknowledgeAlert = useCallback((alertId) => {
    dispatch({ type: ActionTypes.ACKNOWLEDGE_ALERT, payload: alertId })
    // Also update the ischemia event if it exists
    const state = stateRef.current
    const event = state.ischemiaEvents.find(e => e.id === alertId)
    if (event) {
      dispatch({
        type: ActionTypes.UPDATE_ISCHEMIA_EVENT,
        payload: { id: alertId, updates: { acknowledged: true } },
      })
    }
  }, [])

  const setMeasurement = useCallback((measurement) => {
    dispatch({ type: ActionTypes.SET_MEASUREMENT, payload: measurement })
  }, [])

  const clearMeasurement = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_MEASUREMENT })
  }, [])

  const setSession = useCallback((session) => {
    dispatch({ type: ActionTypes.SET_SESSION, payload: session })
  }, [])

  const savePreset = useCallback((preset) => {
    const newPreset = {
      id: Date.now() + Math.random(),
      name: preset.name,
      settings: preset.settings,
      createdAt: new Date().toISOString(),
    }
    dispatch({ type: ActionTypes.SAVE_PRESET, payload: newPreset })
    return newPreset
  }, [])

  const loadPreset = useCallback((preset) => {
    dispatch({ type: ActionTypes.LOAD_PRESET, payload: preset })
    // Apply preset settings
    if (preset.settings) {
      Object.keys(preset.settings).forEach(category => {
        dispatch({
          type: ActionTypes.UPDATE_SETTINGS,
          payload: { category, updates: preset.settings[category] },
        })
      })
    }
  }, [])

  const deletePreset = useCallback((presetId) => {
    dispatch({ type: ActionTypes.DELETE_PRESET, payload: presetId })
  }, [])

  const updateImpedance = useCallback((channelIndex, value) => {
    dispatch({ 
      type: ActionTypes.UPDATE_IMPEDANCE, 
      payload: { channelIndex, value } 
    })
  }, [])

  const toggleBadChannel = useCallback((channelIndex) => {
    dispatch({ 
      type: ActionTypes.TOGGLE_BAD_CHANNEL, 
      payload: channelIndex 
    })
  }, [])

  // EDF Loading and Streaming
  const edfStreamIntervalRef = useRef(null)
  // Track when the user has manually paused/stopped to prevent auto-restart
  const edfUserPausedRef = useRef(false)

  const loadEDFFile = useCallback(async (file) => {
    try {
      console.log('[loadEDFFile] Starting to load file:', file.name, 'Size:', file.size)
      
      // Import EDF reader dynamically
      const { readEDFFile, parseEDFPatientInfo } = await import('../utils/edfReader')
      
      // Read EDF file
      const edfData = await readEDFFile(file)
      
      if (!edfData || !edfData.header || !edfData.channels) {
        throw new Error('EDF file parsing returned invalid data')
      }
      
      // Verify and log all available channels
      console.log('[loadEDFFile] EDF file loaded:', {
        numChannels: edfData.channels.length,
        durationSec: edfData.durationSec,
        sampleRate: edfData.channels[0]?.sampleRate
      })
      
      // Log detailed channel information
      // For large arrays, sample a subset to avoid stack overflow
      console.log('[loadEDFFile] Available channels:')
      edfData.channels.forEach((channel, idx) => {
        const sampleCount = channel.samples?.length || 0
        const sampleRate = channel.sampleRate || 0
        const duration = sampleCount / sampleRate
        
        // For very large arrays, sample a subset to calculate statistics
        let minSample = null
        let maxSample = null
        let avgSample = null
        
        if (channel.samples && channel.samples.length > 0) {
          // Sample up to 10000 points for statistics (or use all if smaller)
          const sampleSize = Math.min(10000, channel.samples.length)
          const step = Math.max(1, Math.floor(channel.samples.length / sampleSize))
          
          let sum = 0
          let count = 0
          minSample = channel.samples[0]
          maxSample = channel.samples[0]
          
          // Iterate through samples with step to avoid processing all
          for (let i = 0; i < channel.samples.length; i += step) {
            const val = channel.samples[i]
            if (isFinite(val)) {
              if (val < minSample) minSample = val
              if (val > maxSample) maxSample = val
              sum += val
              count++
            }
          }
          
          avgSample = count > 0 ? sum / count : null
        }
        
        console.log(`  Channel ${idx}: ${channel.label || `Channel-${idx}`}`, {
          sampleRate: `${sampleRate} Hz`,
          samples: sampleCount,
          duration: `${duration.toFixed(2)}s`,
          valueRange: minSample !== null && maxSample !== null 
            ? `[${minSample.toFixed(2)}, ${maxSample.toFixed(2)}]` 
            : 'N/A',
          avgValue: avgSample !== null ? avgSample.toFixed(2) : 'N/A',
          hasData: sampleCount > 0
        })
      })
      
      // Verify all channels have data
      const channelsWithData = edfData.channels.filter(ch => ch.samples && ch.samples.length > 0)
      console.log(`[loadEDFFile] Channels with data: ${channelsWithData.length}/${edfData.channels.length}`)
      
      if (channelsWithData.length === 0) {
        throw new Error('No channels with data found in EDF file')
      }
      
      if (channelsWithData.length < edfData.channels.length) {
        console.warn(`[loadEDFFile] Warning: ${edfData.channels.length - channelsWithData.length} channels have no data`)
      }
      
      // Preprocess: Trim leading zero/near-zero samples to avoid flat-line display
      // Find the first sample where at least one channel has significant signal
      const ZERO_THRESHOLD = 0.5 // µV threshold - values below this are considered "zero"
      const MIN_SIGNAL_THRESHOLD = 1.0 // µV - need at least this much signal to consider it real data
      const MIN_SAMPLES_FOR_SIGNAL = 10 // Need at least N consecutive samples above threshold
      
      // Find the minimum length across all channels with data
      const minChannelLength = Math.min(...channelsWithData.map(ch => ch.samples.length))
      
      let firstSignalIndex = 0
      let consecutiveSignalCount = 0
      
      // Scan through samples to find where real signal starts
      for (let i = 0; i < minChannelLength; i++) {
        // Check if any channel has significant signal at this index
        const hasSignal = channelsWithData.some(ch => {
          const value = Math.abs(ch.samples[i])
          return value > MIN_SIGNAL_THRESHOLD
        })
        
        if (hasSignal) {
          consecutiveSignalCount++
          // If we find enough consecutive samples with signal, mark this as the start
          if (consecutiveSignalCount >= MIN_SAMPLES_FOR_SIGNAL) {
            firstSignalIndex = i - MIN_SAMPLES_FOR_SIGNAL + 1
            break
          }
        } else {
          consecutiveSignalCount = 0
        }
      }
      
      // Also check for leading zeros (all channels near zero)
      if (firstSignalIndex === 0) {
        // Find first index where at least one channel is not near zero
        for (let i = 0; i < minChannelLength; i++) {
          const allNearZero = channelsWithData.every(ch => Math.abs(ch.samples[i]) < ZERO_THRESHOLD)
          if (!allNearZero) {
            firstSignalIndex = i
            break
          }
        }
      }
      
      // Store original duration before any trimming
      const originalDurationSec = edfData.durationSec
      let trimmedTimeOffset = 0
      
      if (firstSignalIndex > 0) {
        const sampleRate = channelsWithData[0]?.sampleRate || 250
        trimmedTimeOffset = firstSignalIndex / sampleRate
        console.log(`[loadEDFFile] Preprocessing: Trimming ${firstSignalIndex} leading samples (~${trimmedTimeOffset.toFixed(2)}s) to remove zero/near-zero data`)
        console.log(`[loadEDFFile] Preprocessing: Original duration: ${originalDurationSec.toFixed(2)}s, will preserve time context`)
        
        // Trim all channels consistently
        edfData.channels = edfData.channels.map(channel => {
          if (!channel.samples || channel.samples.length === 0) return channel
          
          const trimmedSamples = channel.samples.slice(firstSignalIndex)
          return {
            ...channel,
            samples: trimmedSamples
          }
        })
        
        // Recalculate duration based on trimmed data (for playback purposes)
        const trimmedMinSamples = Math.min(...edfData.channels.map(ch => ch.samples?.length || 0))
        if (trimmedMinSamples > 0) {
          edfData.durationSec = trimmedMinSamples / sampleRate
          console.log(`[loadEDFFile] Preprocessing: Trimmed duration: ${edfData.durationSec.toFixed(2)}s (original: ${originalDurationSec.toFixed(2)}s)`)
        }
      } else {
        console.log('[loadEDFFile] Preprocessing: No leading zero region detected; no trimming applied')
      }
      
      // New file load should allow auto-start again
      edfUserPausedRef.current = false
      
      // Store EDF data
      dispatch({ type: ActionTypes.LOAD_EDF_DATA, payload: edfData })
      
      // Store EDF state (this will also update channel arrays)
      dispatch({
        type: ActionTypes.SET_EEG_STATE,
        payload: {
          isLoaded: true,
          channels: edfData.channels,
          durationSec: edfData.durationSec, // Trimmed duration for playback
          startTimeSec: edfData.startTimeSec || 0,
          trimmedTimeOffset: trimmedTimeOffset, // Store offset to preserve original time context
        }
      })
      
      // Store file info (use original duration to preserve time context)
      const fileInfo = {
        fileName: file.name,
        fileSize: file.size,
        numChannels: edfData.header.numSignals,
        sampleRate: edfData.channels[0]?.sampleRate || 0,
        duration: originalDurationSec, // Store original duration (not trimmed)
        trimmedDuration: edfData.durationSec, // Also store trimmed duration for reference
        trimmedTimeOffset: trimmedTimeOffset, // Store offset for reference
        startDate: edfData.header.startDate,
        startTime: edfData.header.startTime,
        patientId: edfData.header.patientId,
        recordingId: edfData.header.recordingId,
      }
      dispatch({ type: ActionTypes.SET_EDF_FILE_INFO, payload: fileInfo })
      
      // Parse patient information from EDF header
      const patientInfo = parseEDFPatientInfo(edfData.header.patientId, edfData.header.recordingId)
      if (patientInfo.patientId || patientInfo.firstName || patientInfo.lastName) {
        updateSettings('patient', {
          patientId: patientInfo.patientId || state.settings.patient.patientId,
          firstName: patientInfo.firstName || state.settings.patient.firstName,
          lastName: patientInfo.lastName || state.settings.patient.lastName,
          mrn: patientInfo.mrn || state.settings.patient.mrn,
          dateOfBirth: patientInfo.dateOfBirth || state.settings.patient.dateOfBirth,
        })
      }
      
      // Adjust buffer size if needed
      if (edfData.channels.length !== 8) {
        const newBuffer = Array(edfData.channels.length).fill(null).map(() => [])
        dispatch({ type: ActionTypes.APPEND_EEG_SAMPLES, payload: newBuffer })
      }
      
      console.log('[loadEDFFile] EDF file loaded successfully')
      
      // Prominent log when EDF is loaded
      console.log('✅ EDF FILE LOADED SUCCESSFULLY', {
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        numChannels: edfData.channels.length,
        duration: `${edfData.durationSec.toFixed(2)} seconds`,
        sampleRate: `${edfData.channels[0]?.sampleRate || 'N/A'} Hz`,
        startDate: edfData.header.startDate,
        startTime: edfData.header.startTime,
        patientId: edfData.header.patientId,
        recordingId: edfData.header.recordingId
      })
      
      return edfData
    } catch (error) {
      console.error('[loadEDFFile] Error loading EDF file:', error)
      alert(`Error loading EDF file: ${error.message}\n\nCheck browser console for details.`)
      throw error
    }
  }, [state.settings.patient, updateSettings])

  const startEDFStream = useCallback(() => {
    // User explicitly (or auto) started playback
    edfUserPausedRef.current = false
    console.log('[startEDFStream] Starting EDF playback...')
    
    // Stop any existing stream
    if (edfStreamIntervalRef.current) {
      clearInterval(edfStreamIntervalRef.current)
      edfStreamIntervalRef.current = null
    }
    
    // Check if EDF data is loaded
    const currentState = stateRef.current
    if (!currentState.eegState?.isLoaded || !currentState.eegState?.channels) {
      console.error('[startEDFStream] No EDF data loaded')
      alert('Please load an EDF file first')
      return
    }
    
    const channels = currentState.eegState.channels
    
    // Verify channels have data
    const validChannels = channels.filter((ch, idx) => {
      const hasData = ch.samples && ch.samples.length > 0
      if (!hasData) {
        console.warn(`[startEDFStream] Channel ${idx} (${ch.label || `Channel-${idx}`}) has no data, skipping`)
      }
      return hasData
    })
    
    if (validChannels.length === 0) {
      console.error('[startEDFStream] No valid channels with data found')
      alert('No valid channels with data found in EDF file')
      return
    }
    
    console.log(`[startEDFStream] Verified ${validChannels.length}/${channels.length} channels have data`)
    console.log('[startEDFStream] Channels to stream:', validChannels.map((ch, idx) => {
      const origIdx = channels.indexOf(ch)
      return `${origIdx}: ${ch.label || `Channel-${origIdx}`} (${ch.samples.length} samples, ${ch.sampleRate} Hz)`
    }))
    
    // Create a map of valid channel indices for efficient lookup (must be declared before use)
    const validChannelIndices = validChannels.map(ch => channels.indexOf(ch))
    
    const durationSec = currentState.eegState.durationSec
    const sampleRate = validChannels[0]?.sampleRate || 250
    const playbackSpeed = currentState.playback.playbackSpeed || 1.0
    const trimmedTimeOffset = currentState.eegState.trimmedTimeOffset || 0 // Get trimmed offset to preserve original EDF time
    
    // Calculate playback speed based on timebase (timeScale)
    // 30mm/sec is the standard (1x speed), so we normalize to that
    const baseTimeScale = 30 // 30mm/sec = 1x speed (standard EEG paper speed)
    const currentTimeScale = currentState.settings.display.timeScale || baseTimeScale
    const timebasePlaybackSpeed = currentTimeScale / baseTimeScale // 30mm/sec = 1x, 60mm/sec = 2x, 15mm/sec = 0.5x
    const effectivePlaybackSpeed = playbackSpeed * timebasePlaybackSpeed
    
    // Optimize: Use fewer samples per update to prevent browser freezing
    // Update at ~30fps (every ~33ms) with reasonable sample chunks
    const targetFPS = 30
    const updateInterval = 1000 / targetFPS // ~33ms
    const samplesPerUpdate = Math.max(1, Math.floor((sampleRate * updateInterval * effectivePlaybackSpeed) / 1000))
    
    // Limit buffer size to prevent memory issues (keep last 60 seconds of data)
    const maxBufferDuration = 60 // seconds
    const maxBufferSamples = Math.floor(maxBufferDuration * sampleRate)
    
    let playbackTime = currentState.playback.playbackTimeSec || 0
    let sampleIndex = Math.floor(playbackTime * sampleRate)
    let lastUpdateTime = Date.now()
    
    // Performance monitoring: Track real-time vs EDF time progression
    const streamStartTime = Date.now()
    const streamStartEDFTime = playbackTime
    let lastMonitorTime = streamStartTime
    let lastMonitorEDFTime = streamStartEDFTime
    let monitorLogCount = 0
    
    // EDF Data Integrity Monitoring
    const dataIntegrityMonitor = {
      totalSamplesStreamed: 0,
      invalidSamples: 0,
      zeroSamples: 0,
      validSamples: 0,
      sampleValueChecks: [], // Store sample checks at specific indices
      timePointValidations: {}, // Validate data at specific time points
      lastValidationTime: 0
    }
    
    // Store original EDF samples for comparison (first channel only)
    const originalEDFSamples = validChannels[0]?.samples ? Array.from(validChannels[0].samples) : null
    if (originalEDFSamples) {
      console.log('[EDF DATA MONITOR] ✓ Original EDF samples stored for validation', {
        channel: validChannels[0].label || 'Channel 0',
        totalSamples: originalEDFSamples.length,
        first10Samples: originalEDFSamples.slice(0, 10).map(v => v.toFixed(4)),
        sampleRate
      })
    }
    
    console.log('[startEDFStream] Starting playback:', {
      durationSec,
      sampleRate,
      playbackSpeed,
      timeScale: currentTimeScale,
      timebasePlaybackSpeed,
      effectivePlaybackSpeed,
      updateInterval,
      samplesPerUpdate,
      maxBufferSamples,
      startTime: playbackTime,
      startSampleIndex: sampleIndex,
      trimmedTimeOffset: trimmedTimeOffset > 0 ? `${trimmedTimeOffset.toFixed(2)}s (timebase will show original EDF time)` : 'none'
    })
    
    // Verify timebase speed calculation
    if (currentTimeScale === 60) {
      console.log('[TIMEBASE MONITOR] ✓ Timebase set to 60mm/sec - Expected 2x speed')
      console.log('[TIMEBASE MONITOR] Verification:', {
        timebase: currentTimeScale,
        baseTimeScale,
        calculatedSpeed: timebasePlaybackSpeed,
        expectedSpeed: 2.0,
        isCorrect: Math.abs(timebasePlaybackSpeed - 2.0) < 0.01 ? '✓ PASS' : '✗ FAIL',
        effectivePlaybackSpeed
      })
    }
    
    // EDF Data Monitoring Initialization
    console.log('[EDF DATA MONITOR] 🔍 Starting EDF data integrity monitoring:', {
      totalChannels: validChannels.length,
      sampleRate: sampleRate + ' Hz',
      totalSamples: validChannels[0]?.samples?.length || 0,
      duration: durationSec.toFixed(2) + 's',
      monitoringEnabled: originalEDFSamples ? '✓ YES' : '✗ NO (no original data stored)',
      willValidate: originalEDFSamples ? 'Sample values, time points, sample indices' : 'Basic validation only'
    })
    
    // Decide if we're resuming from a pause (keep buffer/time) or starting fresh
    const existingBuffer = stateRef.current.eegBuffer || []
    const hasExistingBuffer = existingBuffer.length === channels.length && existingBuffer.some(ch => (ch?.length || 0) > 0)
    const isResumeFromPause = playbackTime > 0 && hasExistingBuffer
    
    let initialBuffer
    if (isResumeFromPause) {
      console.log('[startEDFStream] Resuming from pause; preserving buffer/state', {
        playbackTime,
        sampleIndex,
        channelCount: channels.length,
        bufferLengths: existingBuffer.map(ch => ch?.length || 0)
      })
      initialBuffer = existingBuffer
    } else {
      // Fresh start: clear buffer and time
      initialBuffer = Array(channels.length).fill(null).map(() => [])
      console.log('[startEDFStream] Initializing buffer for fresh start:', {
        channelCount: channels.length,
        bufferLength: initialBuffer.length,
        validChannelIndices: validChannelIndices
      })
      dispatch({ type: ActionTypes.APPEND_EEG_SAMPLES, payload: initialBuffer })
      dispatch({ type: ActionTypes.SET_CURRENT_TIME, payload: 0 })
    }
    
    // Use a local buffer to track data (more reliable than state)
    let localBuffer = initialBuffer
    const maxSamples = Math.max(...validChannels.map(ch => ch.samples.length))
    
    // Initialize filter states for each channel
    const filterStates = {}
    channels.forEach((_, idx) => {
      filterStates[idx] = new FilterState()
    })
    
    // Track last filter settings to detect changes
    let lastFilterSettings = JSON.stringify(currentState.settings.display.filters)
    
    // Use requestAnimationFrame for smoother updates
    let animationFrameId = null
    
    const streamFrame = () => {
      const now = Date.now()
      const elapsed = now - lastUpdateTime
      
      // Throttle updates to target FPS
      if (elapsed < updateInterval) {
        animationFrameId = requestAnimationFrame(streamFrame)
        return
      }
      
      lastUpdateTime = now
      
      const latestState = stateRef.current
      const currentChannels = latestState.eegState?.channels
      
      if (!currentChannels || currentChannels.length === 0) {
        console.error('[startEDFStream] Channels lost during playback')
        return
      }
      
      // Re-verify valid channels (in case state changed)
      const currentValidChannels = currentChannels.filter((ch, idx) => 
        ch.samples && ch.samples.length > 0 && validChannelIndices.includes(idx)
      )
      
      if (currentValidChannels.length === 0) {
        console.error('[startEDFStream] No valid channels available')
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }
        dispatch({ type: ActionTypes.SET_IS_STREAMING, payload: false })
        return
      }
      
      const maxTime = durationSec
      
      if (sampleIndex >= maxSamples || playbackTime >= maxTime) {
        // Final performance summary
        const totalRealTime = (Date.now() - streamStartTime) / 1000
        const totalEDFTime = playbackTime - streamStartEDFTime
        const finalSpeedRatio = totalEDFTime / totalRealTime
        const finalTimeScale = latestState.settings.display.timeScale || baseTimeScale
        const expectedSpeedRatio = finalTimeScale / baseTimeScale
        
        console.log('[startEDFStream] Reached end of EDF data', {
          sampleIndex,
          maxSamples,
          playbackTime: playbackTime.toFixed(2),
          maxTime
        })
        
        if (finalTimeScale === 60) {
          console.log('[TIMEBASE MONITOR] 📊 Final Summary (60mm/sec):', {
            totalRealTime: totalRealTime.toFixed(2) + 's',
            totalEDFTime: totalEDFTime.toFixed(2) + 's',
            finalSpeedRatio: finalSpeedRatio.toFixed(2) + 'x',
            expectedSpeedRatio: expectedSpeedRatio.toFixed(2) + 'x',
            speedAccuracy: ((1 - Math.abs(finalSpeedRatio - expectedSpeedRatio) / expectedSpeedRatio) * 100).toFixed(1) + '%',
            status: Math.abs(finalSpeedRatio - expectedSpeedRatio) < 0.1 ? '✓ PASS' : '✗ FAIL'
          })
        }
        
        // Final EDF Data Integrity Summary
        const finalIntegrityReport = {
          totalSamplesStreamed: dataIntegrityMonitor.totalSamplesStreamed,
          validSamples: dataIntegrityMonitor.validSamples,
          zeroSamples: dataIntegrityMonitor.zeroSamples,
          invalidSamples: dataIntegrityMonitor.invalidSamples,
          validPercentage: dataIntegrityMonitor.totalSamplesStreamed > 0 
            ? ((dataIntegrityMonitor.validSamples / dataIntegrityMonitor.totalSamplesStreamed) * 100).toFixed(2) + '%'
            : '0%',
          sampleValueChecks: dataIntegrityMonitor.sampleValueChecks.length,
          valueMatches: dataIntegrityMonitor.sampleValueChecks.filter(c => c.matches).length,
          valueMismatches: dataIntegrityMonitor.sampleValueChecks.filter(c => !c.matches).length,
          timePointValidations: Object.keys(dataIntegrityMonitor.timePointValidations).length,
          timePointPasses: Object.values(dataIntegrityMonitor.timePointValidations).filter(v => v.matches).length,
          finalSampleIndex: sampleIndex,
          expectedFinalIndex: Math.floor(playbackTime * sampleRate),
          sampleIndexAccuracy: Math.abs(sampleIndex - Math.floor(playbackTime * sampleRate)) <= 1 ? '✓ PASS' : '✗ FAIL'
        }
        
        console.log('[EDF DATA MONITOR] 📊 Final Data Integrity Summary:', finalIntegrityReport)
        
        // Overall status
        const hasIssues = dataIntegrityMonitor.invalidSamples > 0 || 
                         finalIntegrityReport.valueMismatches > 0 ||
                         finalIntegrityReport.sampleIndexAccuracy === '✗ FAIL'
        
        if (hasIssues) {
          console.warn('[EDF DATA MONITOR] ⚠️ Data integrity issues detected:', {
            invalidSamples: dataIntegrityMonitor.invalidSamples,
            valueMismatches: finalIntegrityReport.valueMismatches,
            sampleIndexIssue: finalIntegrityReport.sampleIndexAccuracy === '✗ FAIL'
          })
        } else {
          console.log('[EDF DATA MONITOR] ✓ All data integrity checks passed')
        }
        
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }
        dispatch({ type: ActionTypes.SET_IS_STREAMING, payload: false })
        dispatch({ type: ActionTypes.SET_PLAYBACK, payload: { isPlaying: false } })
        return
      }
      
      // Get samples for this update (limit to prevent blocking)
      // Recalculate effective playback speed in case timeScale changed during playback
      const latestTimeScale = latestState.settings.display.timeScale || baseTimeScale
      const latestTimebaseSpeed = latestTimeScale / baseTimeScale
      const latestEffectiveSpeed = playbackSpeed * latestTimebaseSpeed
      const latestSamplesPerUpdate = Math.max(1, Math.floor((sampleRate * updateInterval * latestEffectiveSpeed) / 1000))
      
      // Monitor timebase changes during playback
      if (latestTimeScale === 60 && monitorLogCount === 0) {
        console.log('[TIMEBASE MONITOR] Timebase changed to 60mm/sec during playback')
        console.log('[TIMEBASE MONITOR] Speed verification:', {
          timebase: latestTimeScale,
          timebaseSpeed: latestTimebaseSpeed,
          expectedSpeed: 2.0,
          isCorrect: Math.abs(latestTimebaseSpeed - 2.0) < 0.01 ? '✓ PASS' : '✗ FAIL',
          effectiveSpeed: latestEffectiveSpeed,
          samplesPerUpdate: latestSamplesPerUpdate
        })
      }
      
      const samplesToAdd = Math.min(latestSamplesPerUpdate, maxSamples - sampleIndex)
      // Time increment in EDF file time (accounts for playback speed)
      // At 2x speed, we advance through 2 seconds of EDF time per 1 second of real time
      const timeIncrement = samplesToAdd / sampleRate
      
      // Extract samples and add to buffer - only process valid channels
      // Ensure buffer has the correct number of channels (match currentChannels length)
      const numChannels = currentChannels.length
      const newBuffer = Array(numChannels).fill(null).map((_, channelIdx) => {
        // Skip channels without data
        if (!validChannelIndices.includes(channelIdx)) {
          return localBuffer[channelIdx] || []
        }
        
        const channel = currentChannels[channelIdx]
        if (!channel || !channel.samples) {
          console.warn(`[startEDFStream] Channel ${channelIdx} is missing samples`)
          return localBuffer[channelIdx] || []
        }
        
        const currentChannelBuffer = localBuffer[channelIdx] || []
        const newPoints = []
        
        // Get filter settings from current state
        const filterSettings = latestState.settings.display.filters || {
          highPass: 1.0,
          lowPass: 30,
          notch: 60
        }
        
        // Reset filter states if filter settings changed
        const currentFilterSettings = JSON.stringify(filterSettings)
        if (currentFilterSettings !== lastFilterSettings) {
          console.log('[startEDFStream] Filter settings changed, resetting filter states')
          Object.values(filterStates).forEach(state => state.reset())
          lastFilterSettings = currentFilterSettings
        }
        
        // Get filter state for this channel
        const filterState = filterStates[channelIdx]
        
        for (let i = 0; i < samplesToAdd && (sampleIndex + i) < channel.samples.length; i++) {
          const idx = sampleIndex + i
          // Add trimmedTimeOffset to preserve original EDF time context
          const time = playbackTime + (i / sampleRate) + trimmedTimeOffset
          let sampleValue = channel.samples[idx]
          
          // EDF Data Integrity Monitoring - Track original sample
          const originalSampleValue = sampleValue
          const expectedTime = idx / sampleRate
          
          // Validate sample value
          if (isNaN(sampleValue) || !isFinite(sampleValue)) {
            dataIntegrityMonitor.invalidSamples++
            if (dataIntegrityMonitor.invalidSamples <= 10) {
              console.warn(`[EDF DATA MONITOR] ⚠️ Invalid sample detected at index ${idx}:`, {
                sampleIndex: idx,
                expectedTime: expectedTime.toFixed(4) + 's',
                actualTime: time.toFixed(4) + 's',
                value: sampleValue,
                channel: channel.label || `Channel-${channelIdx}`
              })
            }
            continue
          }
          
          // Track zero samples
          if (Math.abs(sampleValue) < 0.001) {
            dataIntegrityMonitor.zeroSamples++
          } else {
            dataIntegrityMonitor.validSamples++
          }
          
          // Verify sample index matches expected time (for first channel only)
          if (channelIdx === validChannelIndices[0] && originalEDFSamples && idx < originalEDFSamples.length) {
            const originalValue = originalEDFSamples[idx]
            const valueMatches = Math.abs(originalValue - originalSampleValue) < 0.0001
            
            // Store validation for first few samples and periodic checks
            if (idx < 100 || idx % 1000 === 0) {
              if (!dataIntegrityMonitor.sampleValueChecks.find(c => c.index === idx)) {
                dataIntegrityMonitor.sampleValueChecks.push({
                  index: idx,
                  expectedTime: expectedTime,
                  originalValue: originalValue,
                  streamedValue: originalSampleValue,
                  matches: valueMatches,
                  time: time
                })
              }
            }
            
            // Validate at specific time points
            const timePoints = [0, 5, 10, 15, 20, 25, 30]
            timePoints.forEach(timeSec => {
              const targetIndex = Math.floor(timeSec * sampleRate)
              if (idx === targetIndex && !dataIntegrityMonitor.timePointValidations[timeSec]) {
                const originalAtTime = originalEDFSamples[targetIndex]
                const matches = Math.abs(originalAtTime - originalSampleValue) < 0.0001
                dataIntegrityMonitor.timePointValidations[timeSec] = {
                  time: timeSec,
                  sampleIndex: targetIndex,
                  originalValue: originalAtTime,
                  streamedValue: originalSampleValue,
                  matches: matches,
                  status: matches ? '✓ PASS' : '✗ FAIL'
                }
                
                if (!matches) {
                  console.warn(`[EDF DATA MONITOR] ⚠️ Time point validation failed at ${timeSec}s:`, {
                    expected: originalAtTime.toFixed(6),
                    actual: originalSampleValue.toFixed(6),
                    difference: Math.abs(originalAtTime - originalSampleValue).toFixed(6)
                  })
                }
              }
            })
          }
          
          // Apply digital filters based on current settings
          // Filters are applied in sequence: High-pass -> Low-pass -> Notch
          const filteredValue = filterState.applyFilters(sampleValue, filterSettings, sampleRate)
          sampleValue = filteredValue
          
          newPoints.push({ x: time, y: sampleValue })
          dataIntegrityMonitor.totalSamplesStreamed++
        }
        
        // Debug: log first few samples to verify data (only for first valid channel)
        if (channelIdx === validChannelIndices[0] && sampleIndex < 50 && newPoints.length > 0) {
          const firstPoint = newPoints[0]
          const yValues = newPoints.slice(0, 10).map(p => p.y)
          const yStats = {
            min: Math.min(...newPoints.map(p => p.y)),
            max: Math.max(...newPoints.map(p => p.y)),
            avg: newPoints.reduce((sum, p) => sum + p.y, 0) / newPoints.length,
            nonZeroCount: newPoints.filter(p => Math.abs(p.y) > 0.001).length
          }
          
          // Validate against original EDF data
          let validationInfo = ''
          if (originalEDFSamples && sampleIndex < originalEDFSamples.length) {
            const originalValue = originalEDFSamples[sampleIndex]
            const streamedValue = channel.samples[sampleIndex]
            const matches = Math.abs(originalValue - streamedValue) < 0.0001
            validationInfo = ` | Original EDF: ${originalValue.toFixed(6)} | Streamed: ${streamedValue.toFixed(6)} | Match: ${matches ? '✓' : '✗'}`
            
            if (!matches && sampleIndex < 10) {
              console.warn(`[EDF DATA MONITOR] ⚠️ First sample mismatch at index ${sampleIndex}:`, {
                original: originalValue.toFixed(6) + ' µV',
                streamed: streamedValue.toFixed(6) + ' µV',
                difference: Math.abs(originalValue - streamedValue).toFixed(6) + ' µV'
              })
            }
          }
          
          // Log values directly as strings to avoid [object Object] issue
          console.log(`[startEDFStream] Channel ${channelIdx} (${channel.label || `Channel-${channelIdx}`}) - Sample ${sampleIndex}:`, 
            `First point: x=${firstPoint.x.toFixed(3)}, y=${firstPoint.y.toFixed(3)}`,
            `Raw sample: ${channel.samples[sampleIndex]}`,
            `Y values (first 10): ${yValues.map(v => v.toFixed(3)).join(', ')}`,
            `Stats: min=${yStats.min.toFixed(3)}, max=${yStats.max.toFixed(3)}, avg=${yStats.avg.toFixed(3)}, nonZero=${yStats.nonZeroCount}/${newPoints.length}${validationInfo}`
          )
        }
        
        // Check for data at specific time points (0s, 10s, 20s, 30s, 40s)
        if (channelIdx === validChannelIndices[0]) {
          const timePoints = [0, 10, 20, 30, 40]
          timePoints.forEach(timeSec => {
            const targetSampleIndex = Math.floor(timeSec * sampleRate)
            if (sampleIndex <= targetSampleIndex && (sampleIndex + samplesToAdd) > targetSampleIndex) {
              const relativeIndex = targetSampleIndex - sampleIndex
              if (relativeIndex >= 0 && relativeIndex < newPoints.length) {
                const pointAtTime = newPoints[relativeIndex]
                const absValue = Math.abs(pointAtTime.y)
                if (absValue > 0.001) {
                  console.log(`[startEDFStream] ✓ Data detected at ${timeSec}s: Channel ${channelIdx}, time=${pointAtTime.x.toFixed(3)}s, value=${pointAtTime.y.toFixed(4)} µV`)
                } else {
                  console.log(`[startEDFStream] ⚠️  Near-zero data at ${timeSec}s: Channel ${channelIdx}, time=${pointAtTime.x.toFixed(3)}s, value=${pointAtTime.y.toFixed(4)} µV`)
                }
              }
            }
          })
        }
        
        // Combine with existing buffer
        let updatedBuffer = [...currentChannelBuffer, ...newPoints]
        
        // Trim buffer if it exceeds max size (keep most recent data)
        if (updatedBuffer.length > maxBufferSamples) {
          const trimCount = updatedBuffer.length - maxBufferSamples
          updatedBuffer = updatedBuffer.slice(trimCount)
        }
        
        return updatedBuffer
      })
      
      // Update local buffer
      localBuffer = newBuffer
      
      playbackTime += timeIncrement
      sampleIndex += samplesToAdd
      
      // Performance monitoring: Track actual speed ratio (real-time vs EDF time)
      const currentRealTime = Date.now()
      const realTimeElapsed = (currentRealTime - lastMonitorTime) / 1000 // seconds
      const edfTimeElapsed = playbackTime - lastMonitorEDFTime // seconds
      
      // EDF Data Integrity Reporting (every 5 seconds of EDF time)
      if (playbackTime - dataIntegrityMonitor.lastValidationTime >= 5.0) {
        const integrityStats = {
          totalSamples: dataIntegrityMonitor.totalSamplesStreamed,
          validSamples: dataIntegrityMonitor.validSamples,
          zeroSamples: dataIntegrityMonitor.zeroSamples,
          invalidSamples: dataIntegrityMonitor.invalidSamples,
          validPercentage: dataIntegrityMonitor.totalSamplesStreamed > 0 
            ? ((dataIntegrityMonitor.validSamples / dataIntegrityMonitor.totalSamplesStreamed) * 100).toFixed(2) + '%'
            : '0%',
          currentEDFTime: playbackTime.toFixed(2) + 's',
          currentSampleIndex: sampleIndex,
          expectedSampleIndex: Math.floor(playbackTime * sampleRate),
          sampleIndexMatches: Math.abs(sampleIndex - Math.floor(playbackTime * sampleRate)) <= 1 ? '✓' : '✗'
        }
        
        // Check sample value validations
        const recentChecks = dataIntegrityMonitor.sampleValueChecks.slice(-20)
        const valueMatches = recentChecks.filter(c => c.matches).length
        const valueMismatches = recentChecks.filter(c => !c.matches).length
        
        console.log('[EDF DATA MONITOR] 📊 Data Integrity Report:', integrityStats)
        
        if (recentChecks.length > 0) {
          console.log('[EDF DATA MONITOR] Sample Value Validation:', {
            checkedSamples: recentChecks.length,
            matches: valueMatches,
            mismatches: valueMismatches,
            matchRate: recentChecks.length > 0 ? ((valueMatches / recentChecks.length) * 100).toFixed(1) + '%' : '0%',
            status: valueMismatches === 0 ? '✓ PASS (all samples match original EDF)' : '⚠️ WARNING (some mismatches detected)'
          })
          
          // Show example of recent checks
          if (recentChecks.length > 0) {
            const lastCheck = recentChecks[recentChecks.length - 1]
            console.log('[EDF DATA MONITOR] Latest sample check:', {
              index: lastCheck.index,
              time: lastCheck.time.toFixed(4) + 's',
              originalValue: lastCheck.originalValue.toFixed(6) + ' µV',
              streamedValue: lastCheck.streamedValue.toFixed(6) + ' µV',
              matches: lastCheck.matches ? '✓' : '✗',
              difference: Math.abs(lastCheck.originalValue - lastCheck.streamedValue).toFixed(6) + ' µV'
            })
          }
        }
        
        // Report time point validations
        const timePointKeys = Object.keys(dataIntegrityMonitor.timePointValidations)
        if (timePointKeys.length > 0) {
          const timePointResults = timePointKeys.map(t => {
            const v = dataIntegrityMonitor.timePointValidations[t]
            return `${t}s: ${v.status}`
          }).join(', ')
          console.log('[EDF DATA MONITOR] Time Point Validations:', timePointResults)
        }
        
        // Verify sample index progression
        const expectedIndex = Math.floor(playbackTime * sampleRate)
        if (Math.abs(sampleIndex - expectedIndex) > 1) {
          console.warn('[EDF DATA MONITOR] ⚠️ Sample index mismatch:', {
            currentIndex: sampleIndex,
            expectedIndex: expectedIndex,
            difference: sampleIndex - expectedIndex,
            currentTime: playbackTime.toFixed(4) + 's',
            expectedTime: (sampleIndex / sampleRate).toFixed(4) + 's'
          })
        }
        
        dataIntegrityMonitor.lastValidationTime = playbackTime
      }
      
      // Monitor every 2 seconds of real time
      if (realTimeElapsed >= 2.0) {
        const actualSpeedRatio = edfTimeElapsed / realTimeElapsed
        const expectedSpeedRatio = latestTimebaseSpeed
        const speedError = Math.abs(actualSpeedRatio - expectedSpeedRatio)
        const isWithinTolerance = speedError < 0.1 // Allow 10% tolerance
        
        // Always log when timebase is 60mm/sec
        if (latestTimeScale === 60) {
          console.log('[TIMEBASE MONITOR] ⚡ Speed Verification (60mm/sec):', {
            realTimeElapsed: realTimeElapsed.toFixed(2) + 's',
            edfTimeElapsed: edfTimeElapsed.toFixed(2) + 's',
            actualSpeedRatio: actualSpeedRatio.toFixed(2) + 'x',
            expectedSpeedRatio: expectedSpeedRatio.toFixed(2) + 'x',
            speedError: speedError.toFixed(3),
            status: isWithinTolerance ? '✓ PASS (2x speed confirmed)' : '✗ FAIL (speed mismatch)',
            samplesPerUpdate: latestSamplesPerUpdate,
            timeIncrement: timeIncrement.toFixed(4) + 's'
          })
          
          if (!isWithinTolerance) {
            console.warn('[TIMEBASE MONITOR] ⚠️ WARNING: Speed ratio mismatch!', {
              actual: actualSpeedRatio.toFixed(2) + 'x',
              expected: expectedSpeedRatio.toFixed(2) + 'x',
              difference: (speedError * 100).toFixed(1) + '%'
            })
          }
        }
        
        // Reset monitoring counters
        lastMonitorTime = currentRealTime
        lastMonitorEDFTime = playbackTime
        monitorLogCount++
      }
      
      // Log progress every second
      if (Math.floor(playbackTime) !== Math.floor(playbackTime - timeIncrement)) {
        console.log('[startEDFStream] Streaming progress:', {
          time: playbackTime.toFixed(2),
          sampleIndex,
          bufferSize: newBuffer[0]?.length || 0,
          samplesAdded: samplesToAdd,
          timebase: latestTimeScale,
          speedRatio: latestTimebaseSpeed.toFixed(2) + 'x'
        })
      }
      
      // Always update buffer to ensure charts get data
      // Throttle time updates to ~10fps to prevent excessive re-renders
      const shouldUpdateTime = Math.floor(playbackTime * 10) !== Math.floor((playbackTime - timeIncrement) * 10)
      
      // Debug: Log buffer update details (throttled)
      if (sampleIndex < 100 || (sampleIndex % 1000 === 0)) {
        const bufferStats = {
          channelCount: newBuffer.length,
          channel0Length: newBuffer[0]?.length || 0,
          channel0First: newBuffer[0]?.[0] ? { x: newBuffer[0][0].x.toFixed(3), y: newBuffer[0][0].y.toFixed(3) } : null,
          channel0Last: newBuffer[0]?.[newBuffer[0].length - 1] ? { x: newBuffer[0][newBuffer[0].length - 1].x.toFixed(3), y: newBuffer[0][newBuffer[0].length - 1].y.toFixed(3) } : null,
          sampleIndex,
          playbackTime: playbackTime.toFixed(3),
          samplesAdded: samplesToAdd
        }
        console.log('[startEDFStream] Buffer update:', bufferStats)
      }
      
      // Always dispatch buffer updates so charts receive data
      dispatch({ type: ActionTypes.APPEND_EEG_SAMPLES, payload: newBuffer })
      
      // Only update time-related state at throttled rate
      if (shouldUpdateTime) {
        dispatch({ type: ActionTypes.SET_CURRENT_TIME, payload: playbackTime })
        dispatch({ type: ActionTypes.SET_PLAYBACK, payload: { playbackTimeSec: playbackTime } })
      }
      
      // Continue streaming
      animationFrameId = requestAnimationFrame(streamFrame)
    }
    
    // Start streaming
    animationFrameId = requestAnimationFrame(streamFrame)
    edfStreamIntervalRef.current = { cancel: () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
    }}
    
    dispatch({ type: ActionTypes.SET_IS_STREAMING, payload: true })
    dispatch({ type: ActionTypes.SET_PLAYBACK, payload: { isPlaying: true } })
    console.log('[startEDFStream] Playback started')
  }, [])

  const pauseEDFStream = useCallback(() => {
    // Prevent auto-restart after a manual pause
    edfUserPausedRef.current = true
    console.log('[pauseEDFStream] Pausing playback...')
    if (edfStreamIntervalRef.current) {
      if (edfStreamIntervalRef.current.cancel) {
        edfStreamIntervalRef.current.cancel()
      } else {
        clearInterval(edfStreamIntervalRef.current)
      }
      edfStreamIntervalRef.current = null
    }
    dispatch({ type: ActionTypes.SET_IS_STREAMING, payload: false })
    dispatch({ type: ActionTypes.SET_PLAYBACK, payload: { isPlaying: false } })
  }, [])

  const stopEDFStream = useCallback(() => {
    // Prevent auto-restart after a manual stop
    edfUserPausedRef.current = true
    console.log('[stopEDFStream] Stopping playback...')
    if (edfStreamIntervalRef.current) {
      if (edfStreamIntervalRef.current.cancel) {
        edfStreamIntervalRef.current.cancel()
      } else {
        clearInterval(edfStreamIntervalRef.current)
      }
      edfStreamIntervalRef.current = null
    }
    dispatch({ type: ActionTypes.SET_IS_STREAMING, payload: false })
    dispatch({ type: ActionTypes.SET_PLAYBACK, payload: { isPlaying: false, playbackTimeSec: 0 } })
    dispatch({ type: ActionTypes.SET_CURRENT_TIME, payload: 0 })
    
    // Clear buffer
    const newBuffer = Array(stateRef.current.eegState?.channels?.length || 8).fill(null).map(() => [])
    dispatch({ type: ActionTypes.APPEND_EEG_SAMPLES, payload: newBuffer })
  }, [])

  const resetToLiveMode = useCallback(() => {
    console.log('[resetToLiveMode] Resetting to live mode...')
    if (edfStreamIntervalRef.current) {
      clearInterval(edfStreamIntervalRef.current)
      edfStreamIntervalRef.current = null
    }
    dispatch({ type: ActionTypes.RESET_TO_LIVE_MODE })
  }, [])

  // Periodically update impedance values during streaming
  useEffect(() => {
    if (!state.isStreaming) return
    
    const impedanceInterval = setInterval(() => {
      // Update impedance values with slight random variations
      const currentState = stateRef.current
      currentState.channelImpedance.forEach((imp, idx) => {
        const variation = (Math.random() - 0.5) * 0.5 // ±0.25 kΩ variation
        const newValue = Math.max(0.5, Math.min(15, imp.value + variation))
        updateImpedance(idx, newValue)
      })
    }, 5000) // Update every 5 seconds
    
    return () => clearInterval(impedanceInterval)
  }, [state.isStreaming, updateImpedance])

  // Auto-start EDF streaming when file is loaded
  useEffect(() => {
    if (edfUserPausedRef.current) {
      return
    }
    
    if (state.eegState.isLoaded && !state.playback.isPlaying && !state.isStreaming) {
      console.log('[Auto-start] EDF file loaded, starting streaming automatically...')
      // Small delay to ensure state is fully updated
      setTimeout(() => {
        startEDFStream()
      }, 100)
    }
  }, [state.eegState.isLoaded, state.playback.isPlaying, state.isStreaming, startEDFStream])

  // Mock ischemia detection - DISABLED
  // We're using scheduled ischemia events in startMockStream instead
  // This random detection was causing alerts to pop up when settings changed
  // useEffect(() => {
  //   if (!state.isStreaming) return
  //   
  //   const interval = 2000 // Check every 2 seconds
  //   let detectionStartTime = null
  //   let lastCheckTime = state.currentTime
  //   
  //   detectionIntervalRef.current = setInterval(() => {
  //     const currentTime = state.currentTime
  //     const sensitivity = state.settings.detection.sensitivity
  //     const minDuration = state.settings.detection.minDuration
  //     
  //     // Simple mock detection: random trigger based on sensitivity
  //     const shouldDetect = Math.random() < (sensitivity * 0.1) // Scale sensitivity
  //     
  //     if (shouldDetect && !detectionStartTime) {
  //       // Start new event
  //       detectionStartTime = currentTime
  //     } else if (detectionStartTime) {
  //       // Check if we should end the event
  //       const duration = currentTime - detectionStartTime
  //       if (duration >= minDuration) {
  //         // End the event
  //         const activeEvent = state.ischemiaEvents.find(
  //           e => !e.endTime && e.startTime === detectionStartTime
  //         )
  //         
  //         if (!activeEvent) {
  //           // Create new event
  //           const event = addIschemiaEvent({
  //             startTime: detectionStartTime,
  //             confidence: 0.7 + Math.random() * 0.2,
  //           })
  //           
  //           // Trigger alert
  //           if (state.settings.alerts.onScreenNotifications) {
  //             const now = Date.now()
  //             const lastAlert = lastAlertTimeRef.current[event.id] || 0
  //             const cooldown = state.settings.alerts.cooldownPeriod * 1000
  //             
  //             if (now - lastAlert > cooldown) {
  //               // Trigger alert (will be handled by AlertBanner)
  //               window.dispatchEvent(new CustomEvent('ischemia-alert', {
  //                 detail: event,
  //               }))
  //               lastAlertTimeRef.current[event.id] = now
  //             }
  //           }
  //         } else {
  //           // Update existing event
  //           updateIschemiaEvent(activeEvent.id, {
  //             endTime: currentTime,
  //           })
  //         }
  //         
  //         detectionStartTime = null
  //       }
  //     }
  //     
  //     lastCheckTime = currentTime
  //   }, interval)
  //   
  //   return () => {
  //     if (detectionIntervalRef.current) {
  //       clearInterval(detectionIntervalRef.current)
  //     }
  //   }
  // }, [
  //   state.isStreaming,
  //   state.currentTime,
  //   state.settings.detection,
  //   state.ischemiaEvents,
  //   addIschemiaEvent,
  //   updateIschemiaEvent,
  // ])

  // Auto-start disabled - user controls streaming via buttons
  // Uncomment below to enable auto-start on device connection
  // useEffect(() => {
  //   console.log('Auto-start check:', {
  //     deviceConnected: state.settings.system.deviceConnected,
  //     isStreaming: state.isStreaming,
  //     streamIntervalExists: !!streamIntervalRef.current
  //   })
  //   
  //   if (state.settings.system.deviceConnected && !state.isStreaming && !streamIntervalRef.current) {
  //     console.log('Auto-starting stream...')
  //     setTimeout(() => {
  //       startMockStream()
  //     }, 100)
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [state.settings.system.deviceConnected])

  const value = {
    ...state,
    actions: {
      appendEEGSamples,
      startMockStream,
      stopMockStream,
      addIschemiaEvent,
      updateIschemiaEvent,
      updateSettings,
      toggleSettingsPanel,
      toggleEventLog,
      toggleCompactSidebar,
      setTheme,
      setRecording,
      setDeviceConnected,
      addAnnotation,
      updateAnnotation,
      deleteAnnotation,
      acknowledgeAlert,
      setMeasurement,
      clearMeasurement,
      setSession,
      savePreset,
      loadPreset,
      deletePreset,
      updateImpedance,
      toggleBadChannel,
      toggleCsaPanel,
      toggleQdsaPanel,
      loadEDFFile,
      startEDFStream,
      pauseEDFStream,
      stopEDFStream,
      resetToLiveMode,
    },
  }

  return <EEGContext.Provider value={value}>{children}</EEGContext.Provider>
}

// Hook to use the context
export function useEEG() {
  const context = useContext(EEGContext)
  if (!context) {
    throw new Error('useEEG must be used within EEGProvider')
  }
  return context
}

