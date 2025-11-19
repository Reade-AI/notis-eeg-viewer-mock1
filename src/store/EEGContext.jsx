import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react'

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
      amplitudeScale: 5.0, // μV/mm
      timeScale: 30, // mm/sec
      timeWindow: 10, // seconds - default window for live streaming
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
    csaPanelOpen: false, // Toggle to show/hide CSA panel
    qdsaPanelOpen: false, // Toggle to show/hide Quadrant DSA panel
    theme: 'light',
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
      return {
        ...state,
        settings: {
          ...state.settings,
          [action.payload.category]: {
            ...state.settings[action.payload.category],
            ...action.payload.updates,
          },
        },
      }
    
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
  
  // Keep state ref updated
  useEffect(() => {
    stateRef.current = state
  }, [state])

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
    const sampleRate = refreshRate // samples per second
    
    // Mock ischemia event scheduling
    let nextIschemiaStart = 15 // Start first ischemia at 15 seconds
    let nextIschemiaEnd = null
    let ischemiaDuration = 5 // 5 seconds duration
    
    console.log('Stream config:', { refreshRate, interval, sampleRate, startTime: time })
    console.log('Mock ischemia will start at:', nextIschemiaStart, 'seconds')
    
    streamIntervalRef.current = setInterval(() => {
      const latestState = stateRef.current
      
      // Check if we should start a new ischemia event
      if (time >= nextIschemiaStart && !nextIschemiaEnd) {
        console.log('🩺 Mock ischemia START detected at', time.toFixed(2), 'seconds')
        const confidence = 0.75 + Math.random() * 0.15
        const severity = confidence > 0.85 ? 'critical' : confidence > 0.75 ? 'warning' : 'info'
        // Calculate mock detection criteria
        const affectedChannels = [0, 1, 2, 3, 4, 5, 6, 7] // All channels for mock
        const primaryChannels = [0, 1, 4, 5] // Most affected channels
        const relativePowerDrop = 0.35 + Math.random() * 0.15 // 35-50% drop
        const alphaDeltaRatio = 0.4 + Math.random() * 0.2 // 0.4-0.6
        const slowWaveIncrease = 0.45 + Math.random() * 0.15 // 45-60% increase
        
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
        
        nextIschemiaEnd = time + ischemiaDuration
      }
      
      // Check if we should end the current ischemia event
      if (nextIschemiaEnd && time >= nextIschemiaEnd) {
        const activeEvents = latestState.ischemiaEvents.filter(e => !e.endTime)
        if (activeEvents.length > 0) {
          const eventToEnd = activeEvents[activeEvents.length - 1]
          console.log('✅ Mock ischemia STOP detected at', time.toFixed(2), 'seconds')
          dispatch({ type: ActionTypes.UPDATE_ISCHEMIA_EVENT, payload: { id: eventToEnd.id, updates: { endTime: time } } })
        }
        nextIschemiaEnd = null
        // Schedule next ischemia event 20 seconds after this one ends
        nextIschemiaStart = time + 20
        console.log('Next mock ischemia will start at:', nextIschemiaStart.toFixed(2), 'seconds')
      }
      
      // Generate mock EEG samples
      const samples = Array(8).fill(0).map((_, i) => {
        const t = time
        let signal = 0
        
        // Check if we're in an active ischemia event
        const activeEvent = latestState.ischemiaEvents.find(
          e => !e.endTime && time >= e.startTime
        )
        
        if (activeEvent) {
          // Ischemia pattern: reduced amplitude, more delta waves
          signal += 2 * Math.sin(2 * Math.PI * 1.5 * t + i * 0.3) // Strong delta
          signal += 1 * Math.sin(2 * Math.PI * 3 * t + i * 0.2) // Some theta
          signal += 0.5 * Math.sin(2 * Math.PI * 8 * t + i * 0.1) // Reduced alpha
          signal += (Math.random() - 0.5) * 1 // Less noise
        } else {
          // Normal EEG pattern
          // Delta (0.5-4 Hz)
          signal += 5 * Math.sin(2 * Math.PI * 2 * t + i * 0.5)
          // Theta (4-8 Hz)
          signal += 3 * Math.sin(2 * Math.PI * 6 * t + i * 0.3)
          // Alpha (8-13 Hz)
          signal += 4 * Math.sin(2 * Math.PI * 10 * t + i * 0.2)
          // Beta (13-30 Hz)
          signal += 2 * Math.sin(2 * Math.PI * 20 * t + i * 0.1)
          // Gamma (30-100 Hz)
          signal += 1 * Math.sin(2 * Math.PI * 40 * t + i * 0.05)
          // Noise
          signal += (Math.random() - 0.5) * 2
        }
        
        return signal
      })
      
      const timeIncrement = 1 / sampleRate // time increment per sample
      time += timeIncrement
      
      appendEEGSamples(samples, time)
      
      // Log every second for debugging
      if (Math.floor(time) !== Math.floor(time - timeIncrement)) {
        const activeEvents = latestState.ischemiaEvents.filter(e => !e.endTime)
        console.log('Streaming at time:', time.toFixed(2), 's, buffer size:', latestState.eegBuffer[0]?.length || 0, 
                   activeEvents.length > 0 ? `[ISCHEMIA ACTIVE]` : '')
      }
    }, interval)
    
    dispatch({ type: ActionTypes.SET_IS_STREAMING, payload: true })
    console.log('Mock stream started with interval:', interval, 'ms, refresh rate:', refreshRate, 'Hz')
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

