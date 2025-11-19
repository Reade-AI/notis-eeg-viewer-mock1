import { useState } from 'react'
import { useEEG } from '../store/EEGContext'
import PresetManager from './PresetManager'
import AnnotationPanel from './AnnotationPanel'
import MeasurementTools from './MeasurementTools'
import './SettingsPanel.css'

export default function SettingsPanel() {
  const { settings, ui, actions } = useEEG()
  const [activeTab, setActiveTab] = useState('display')

  if (!ui || !ui.settingsPanelOpen) return null

  const tabs = [
    { id: 'display', label: 'Display' },
    { id: 'spectrogram', label: 'Spectrogram' },
    { id: 'detection', label: 'Detection' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'recording', label: 'Recording' },
    { id: 'patient', label: 'Patient' },
    { id: 'system', label: 'System' },
    { id: 'presets', label: 'Presets' },
    { id: 'annotations', label: 'Annotations' },
    { id: 'measurements', label: 'Measurements' },
  ]

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
        <button
          className="settings-close"
          onClick={actions.toggleSettingsPanel}
          aria-label="Close settings"
        >
          ×
        </button>
      </div>

      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === 'display' && <DisplaySettings />}
        {activeTab === 'spectrogram' && <SpectrogramSettings />}
        {activeTab === 'detection' && <DetectionSettings />}
        {activeTab === 'alerts' && <AlertsSettings />}
        {activeTab === 'recording' && <RecordingSettings />}
        {activeTab === 'patient' && <PatientSettings />}
        {activeTab === 'system' && <SystemSettings />}
        {activeTab === 'presets' && <PresetManager />}
        {activeTab === 'annotations' && <AnnotationPanel />}
        {activeTab === 'measurements' && <MeasurementTools />}
      </div>
    </div>
  )
}

function DisplaySettings() {
  const { settings, actions } = useEEG()
  const { display } = settings

  return (
    <div className="settings-section">
      <h3>Raw EEG Display Settings</h3>

      <div className="setting-group">
        <label>Channel Visibility</label>
        <div className="channel-visibility-grid">
          {['F3-P3', 'P3-O1', 'F3-T3', 'T3-O1', 'F4-P4', 'P4-O2', 'F4-T4', 'T4-O2'].map((name, idx) => (
            <label key={idx} className="checkbox-label">
              <input
                type="checkbox"
                checked={display.channelVisibility[idx]}
                onChange={(e) => {
                  const newVisibility = [...display.channelVisibility]
                  newVisibility[idx] = e.target.checked
                  actions.updateSettings('display', { channelVisibility: newVisibility })
                }}
              />
              {name}
            </label>
          ))}
        </div>
      </div>

      <div className="setting-group">
        <label>Amplitude Scale (μV/mm)</label>
        <input
          type="number"
          step="0.1"
          min="0.1"
          max="20"
          value={display.amplitudeScale}
          onChange={(e) => actions.updateSettings('display', { amplitudeScale: parseFloat(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Time Scale (mm/sec)</label>
        <input
          type="number"
          step="1"
          min="10"
          max="100"
          value={display.timeScale}
          onChange={(e) => actions.updateSettings('display', { timeScale: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Time Window (seconds)</label>
        <input
          type="number"
          step="1"
          min="5"
          max="60"
          value={display.timeWindow}
          onChange={(e) => actions.updateSettings('display', { timeWindow: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Filters</label>
        <div className="filter-inputs">
          <div>
            <label>High Pass (Hz)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={display.filters.highPass}
              onChange={(e) => actions.updateSettings('display', {
                filters: { ...display.filters, highPass: parseFloat(e.target.value) }
              })}
            />
          </div>
          <div>
            <label>Low Pass (Hz)</label>
            <input
              type="number"
              step="1"
              min="10"
              max="100"
              value={display.filters.lowPass}
              onChange={(e) => actions.updateSettings('display', {
                filters: { ...display.filters, lowPass: parseInt(e.target.value) }
              })}
            />
          </div>
          <div>
            <label>Notch (Hz)</label>
            <input
              type="number"
              step="1"
              min="50"
              max="60"
              value={display.filters.notch}
              onChange={(e) => actions.updateSettings('display', {
                filters: { ...display.filters, notch: parseInt(e.target.value) }
              })}
            />
          </div>
        </div>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={display.baselineStabilization}
            onChange={(e) => actions.updateSettings('display', { baselineStabilization: e.target.checked })}
          />
          Baseline Stabilization
        </label>
      </div>

      <div className="setting-group">
        <label>Color Mode</label>
        <select
          value={display.colorMode}
          onChange={(e) => actions.updateSettings('display', { colorMode: e.target.value })}
        >
          <option value="channel">Channel Colors</option>
          <option value="grayscale">Grayscale</option>
        </select>
      </div>
    </div>
  )
}

function SpectrogramSettings() {
  const { settings, actions } = useEEG()
  const { spectrogram } = settings

  return (
    <div className="settings-section">
      <h3>Spectrogram Settings</h3>

      <div className="setting-group">
        <label>Selected Channel</label>
        <select
          value={spectrogram.selectedChannel}
          onChange={(e) => actions.updateSettings('spectrogram', { selectedChannel: parseInt(e.target.value) })}
        >
          {['F3-P3', 'P3-O1', 'F3-T3', 'T3-O1', 'F4-P4', 'P4-O2', 'F4-T4', 'T4-O2'].map((name, idx) => (
            <option key={idx} value={idx}>{name}</option>
          ))}
        </select>
      </div>

      <div className="setting-group">
        <label>Time Window (seconds)</label>
        <input
          type="number"
          step="1"
          min="10"
          max="300"
          value={spectrogram.timeWindow}
          onChange={(e) => actions.updateSettings('spectrogram', { timeWindow: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Frequency Range (Hz)</label>
        <div className="range-inputs">
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={spectrogram.frequencyRange[0]}
            onChange={(e) => actions.updateSettings('spectrogram', {
              frequencyRange: [parseInt(e.target.value), spectrogram.frequencyRange[1]]
            })}
          />
          <span>to</span>
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            value={spectrogram.frequencyRange[1]}
            onChange={(e) => actions.updateSettings('spectrogram', {
              frequencyRange: [spectrogram.frequencyRange[0], parseInt(e.target.value)]
            })}
          />
        </div>
      </div>

      <div className="setting-group">
        <label>FFT Size</label>
        <select
          value={spectrogram.fftSize}
          onChange={(e) => actions.updateSettings('spectrogram', { fftSize: parseInt(e.target.value) })}
        >
          <option value="128">128</option>
          <option value="256">256</option>
          <option value="512">512</option>
          <option value="1024">1024</option>
        </select>
      </div>

      <div className="setting-group">
        <label>Window Length (seconds)</label>
        <input
          type="number"
          step="0.1"
          min="0.1"
          max="5"
          value={spectrogram.windowLength}
          onChange={(e) => actions.updateSettings('spectrogram', { windowLength: parseFloat(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Smoothing</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={spectrogram.smoothing}
          onChange={(e) => actions.updateSettings('spectrogram', { smoothing: parseFloat(e.target.value) })}
        />
        <span className="setting-value">{spectrogram.smoothing.toFixed(1)}</span>
      </div>

      <div className="setting-group">
        <label>Colormap</label>
        <select
          value={spectrogram.colormap}
          onChange={(e) => actions.updateSettings('spectrogram', { colormap: e.target.value })}
        >
          <option value="jet">Jet</option>
          <option value="hot">Hot</option>
          <option value="cool">Cool</option>
        </select>
      </div>

      <div className="setting-group">
        <label>Intensity</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={spectrogram.intensity}
          onChange={(e) => actions.updateSettings('spectrogram', { intensity: parseFloat(e.target.value) })}
        />
        <span className="setting-value">{spectrogram.intensity.toFixed(1)}</span>
      </div>

      <div className="setting-group">
        <label>Contrast</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={spectrogram.contrast}
          onChange={(e) => actions.updateSettings('spectrogram', { contrast: parseFloat(e.target.value) })}
        />
        <span className="setting-value">{spectrogram.contrast.toFixed(1)}</span>
      </div>
    </div>
  )
}

function DetectionSettings() {
  const { settings, actions } = useEEG()
  const { detection } = settings

  return (
    <div className="settings-section">
      <h3>Ischemia Detection Settings</h3>

      <div className="setting-group">
        <label>Sensitivity</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={detection.sensitivity}
          onChange={(e) => actions.updateSettings('detection', { sensitivity: parseFloat(e.target.value) })}
        />
        <span className="setting-value">{(detection.sensitivity * 100).toFixed(0)}%</span>
      </div>

      <div className="setting-group">
        <label>Thresholds</label>
        <div className="threshold-inputs">
          <div>
            <label>Relative Power Drop</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={detection.thresholds.relativePowerDrop}
              onChange={(e) => actions.updateSettings('detection', {
                thresholds: { ...detection.thresholds, relativePowerDrop: parseFloat(e.target.value) }
              })}
            />
          </div>
          <div>
            <label>Alpha-Delta Ratio</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={detection.thresholds.alphaDeltaRatio}
              onChange={(e) => actions.updateSettings('detection', {
                thresholds: { ...detection.thresholds, alphaDeltaRatio: parseFloat(e.target.value) }
              })}
            />
          </div>
          <div>
            <label>Slow Wave Increase</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={detection.thresholds.slowWaveIncrease}
              onChange={(e) => actions.updateSettings('detection', {
                thresholds: { ...detection.thresholds, slowWaveIncrease: parseFloat(e.target.value) }
              })}
            />
          </div>
          <div>
            <label>Burst Suppression</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={detection.thresholds.burstSuppression}
              onChange={(e) => actions.updateSettings('detection', {
                thresholds: { ...detection.thresholds, burstSuppression: parseFloat(e.target.value) }
              })}
            />
          </div>
        </div>
      </div>

      <div className="setting-group">
        <label>Minimum Duration (seconds)</label>
        <input
          type="number"
          step="1"
          min="1"
          max="60"
          value={detection.minDuration}
          onChange={(e) => actions.updateSettings('detection', { minDuration: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Recovery Criteria</label>
        <select
          value={detection.recoveryCriteria}
          onChange={(e) => actions.updateSettings('detection', { recoveryCriteria: e.target.value })}
        >
          <option value="auto">Automatic</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <div className="setting-group">
        <label>Visualization</label>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={detection.visualization.showStartEndLines}
              onChange={(e) => actions.updateSettings('detection', {
                visualization: { ...detection.visualization, showStartEndLines: e.target.checked }
              })}
            />
            Show Start/End Lines
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={detection.visualization.showRedSegment}
              onChange={(e) => actions.updateSettings('detection', {
                visualization: { ...detection.visualization, showRedSegment: e.target.checked }
              })}
            />
            Show Red Segment
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={detection.visualization.showConfidence}
              onChange={(e) => actions.updateSettings('detection', {
                visualization: { ...detection.visualization, showConfidence: e.target.checked }
              })}
            />
            Show Confidence Scores
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={detection.visualization.showModelExplanation}
              onChange={(e) => actions.updateSettings('detection', {
                visualization: { ...detection.visualization, showModelExplanation: e.target.checked }
              })}
            />
            Show Model Explanation
          </label>
        </div>
      </div>
    </div>
  )
}

function AlertsSettings() {
  const { settings, actions } = useEEG()
  const { alerts } = settings

  return (
    <div className="settings-section">
      <h3>Alert Settings</h3>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={alerts.audioEnabled}
            onChange={(e) => actions.updateSettings('alerts', { audioEnabled: e.target.checked })}
          />
          Enable Audio Alerts
        </label>
      </div>

      <div className="setting-group">
        <label>Audio Volume</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={alerts.audioVolume}
          onChange={(e) => actions.updateSettings('alerts', { audioVolume: parseFloat(e.target.value) })}
        />
        <span className="setting-value">{(alerts.audioVolume * 100).toFixed(0)}%</span>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={alerts.onScreenNotifications}
            onChange={(e) => actions.updateSettings('alerts', { onScreenNotifications: e.target.checked })}
          />
          On-Screen Notifications
        </label>
      </div>

      <div className="setting-group">
        <label>Repeat Interval (seconds)</label>
        <input
          type="number"
          step="1"
          min="0"
          max="300"
          value={alerts.repeatInterval}
          onChange={(e) => actions.updateSettings('alerts', { repeatInterval: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Severity Levels</label>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={alerts.severityLevels.critical}
              onChange={(e) => actions.updateSettings('alerts', {
                severityLevels: { ...alerts.severityLevels, critical: e.target.checked }
              })}
            />
            Critical
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={alerts.severityLevels.warning}
              onChange={(e) => actions.updateSettings('alerts', {
                severityLevels: { ...alerts.severityLevels, warning: e.target.checked }
              })}
            />
            Warning
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={alerts.severityLevels.info}
              onChange={(e) => actions.updateSettings('alerts', {
                severityLevels: { ...alerts.severityLevels, info: e.target.checked }
              })}
            />
            Info
          </label>
        </div>
      </div>

      <div className="setting-group">
        <label>Cooldown Period (seconds)</label>
        <input
          type="number"
          step="1"
          min="0"
          max="300"
          value={alerts.cooldownPeriod}
          onChange={(e) => actions.updateSettings('alerts', { cooldownPeriod: parseInt(e.target.value) })}
        />
      </div>
    </div>
  )
}

function RecordingSettings() {
  const { settings, actions } = useEEG()

  return (
    <div className="settings-section">
      <h3>Recording & Replay Settings</h3>

      <div className="setting-group">
        <button
          className={`action-button ${settings.recording.isRecording ? 'stop' : 'start'}`}
          onClick={() => actions.setRecording(!settings.recording.isRecording)}
        >
          {settings.recording.isRecording ? '⏹ Stop Recording' : '⏺ Start Recording'}
        </button>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.recording.autoStart}
            onChange={(e) => actions.updateSettings('recording', { autoStart: e.target.checked })}
          />
          Auto-start Recording
        </label>
      </div>

      <div className="setting-group">
        <label>Buffer Size (seconds)</label>
        <input
          type="number"
          step="60"
          min="60"
          max="7200"
          value={settings.recording.bufferSize}
          onChange={(e) => actions.updateSettings('recording', { bufferSize: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Replay Controls</label>
        <div className="button-group">
          <button className="action-button secondary">Replay Last 30s</button>
          <button className="action-button secondary">Replay Last 5min</button>
        </div>
      </div>

      <div className="setting-group">
        <label>Export Options</label>
        <div className="button-group">
          <button className="action-button secondary">Export Raw EEG</button>
          <button className="action-button secondary">Export Event Timeline</button>
          <button className="action-button secondary">Export Spectrogram</button>
        </div>
      </div>
    </div>
  )
}

function PatientSettings() {
  const { settings, actions } = useEEG()
  const { patient } = settings

  return (
    <div className="settings-section">
      <h3>Patient & Session Settings</h3>

      <div className="setting-group">
        <label>Patient ID</label>
        <input
          type="text"
          value={patient.patientId}
          onChange={(e) => actions.updateSettings('patient', { patientId: e.target.value })}
          placeholder="Enter Patient ID"
        />
      </div>

      <div className="setting-group">
        <label>MRN</label>
        <input
          type="text"
          value={patient.mrn}
          onChange={(e) => actions.updateSettings('patient', { mrn: e.target.value })}
          placeholder="Enter MRN"
        />
      </div>

      <div className="setting-group">
        <label>Session Type</label>
        <select
          value={patient.sessionType}
          onChange={(e) => actions.updateSettings('patient', { sessionType: e.target.value })}
        >
          <option value="OR">OR</option>
          <option value="ICU">ICU</option>
          <option value="ER">ER</option>
        </select>
      </div>

      <div className="setting-group">
        <label>Device Type</label>
        <input
          type="text"
          value={patient.deviceType}
          onChange={(e) => actions.updateSettings('patient', { deviceType: e.target.value })}
          placeholder="Standard"
        />
      </div>

      <div className="setting-group">
        <label>Electrode Configuration</label>
        <select
          value={patient.electrodeConfig}
          onChange={(e) => actions.updateSettings('patient', { electrodeConfig: e.target.value })}
        >
          <option value="10-20">10-20</option>
          <option value="10-10">10-10</option>
          <option value="10-5">10-5</option>
        </select>
      </div>

      <div className="setting-group">
        <label>Impedance Threshold (kΩ)</label>
        <input
          type="number"
          step="0.1"
          min="1"
          max="20"
          value={patient.impedanceThreshold}
          onChange={(e) => actions.updateSettings('patient', { impedanceThreshold: parseFloat(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={patient.artifactSuppression}
            onChange={(e) => actions.updateSettings('patient', { artifactSuppression: e.target.checked })}
          />
          Artifact Suppression
        </label>
      </div>
    </div>
  )
}

function SystemSettings() {
  const { settings, actions } = useEEG()
  const { system } = settings

  return (
    <div className="settings-section">
      <h3>System Settings</h3>

      <div className="setting-group">
        <label>Refresh Rate (Hz)</label>
        <input
          type="number"
          step="1"
          min="1"
          max="60"
          value={system.refreshRate}
          onChange={(e) => actions.updateSettings('system', { refreshRate: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Buffer Size (seconds)</label>
        <input
          type="number"
          step="60"
          min="60"
          max="7200"
          value={system.bufferSize}
          onChange={(e) => actions.updateSettings('system', { bufferSize: parseInt(e.target.value) })}
        />
      </div>

      <div className="setting-group">
        <label>Mode</label>
        <select
          value={system.mode}
          onChange={(e) => actions.updateSettings('system', { mode: e.target.value })}
        >
          <option value="realtime">Real-time</option>
          <option value="lowlatency">Low-latency</option>
        </select>
      </div>

      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={system.deviceConnected}
            onChange={(e) => actions.setDeviceConnected(e.target.checked)}
          />
          Device Connected
        </label>
      </div>
    </div>
  )
}

