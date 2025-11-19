import { useState } from 'react'
import { useEEG } from '../store/EEGContext'
import './PresetManager.css'

export default function PresetManager() {
  const { settings, presets, actions } = useEEG()
  const [presetName, setPresetName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      alert('Please enter a preset name')
      return
    }

    actions.savePreset({
      name: presetName,
      settings: {
        display: settings.display,
        spectrogram: settings.spectrogram,
        detection: settings.detection,
        alerts: settings.alerts,
      },
    })

    setPresetName('')
    setIsSaving(false)
  }

  const handleLoadPreset = (preset) => {
    if (confirm(`Load preset "${preset.name}"? This will overwrite current settings.`)) {
      actions.loadPreset(preset)
    }
  }

  const handleDeletePreset = (presetId) => {
    if (confirm('Delete this preset?')) {
      actions.deletePreset(presetId)
    }
  }

  return (
    <div className="preset-manager">
      <div className="preset-header">
        <h3>Preset Configurations</h3>
        <button className="save-preset-btn" onClick={() => setIsSaving(!isSaving)}>
          {isSaving ? 'Cancel' : '+ Save Preset'}
        </button>
      </div>

      {isSaving && (
        <div className="preset-form">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Enter preset name (e.g., ICU Monitoring)"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSavePreset()
              }
            }}
          />
          <button className="btn-primary" onClick={handleSavePreset}>Save</button>
        </div>
      )}

      <div className="presets-list">
        {presets.saved.length === 0 ? (
          <div className="no-presets">No saved presets</div>
        ) : (
          presets.saved.map((preset) => (
            <div key={preset.id} className="preset-item">
              <div className="preset-info">
                <div className="preset-name">{preset.name}</div>
                <div className="preset-date">
                  {new Date(preset.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="preset-actions">
                <button className="load-btn" onClick={() => handleLoadPreset(preset)}>
                  Load
                </button>
                <button className="delete-btn" onClick={() => handleDeletePreset(preset.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="preset-templates">
        <h4>Quick Templates</h4>
        <div className="template-buttons">
          <button
            className="template-btn"
            onClick={() => {
              actions.updateSettings('display', {
                timeScale: 30,
                timeWindow: 10,
                amplitudeScale: 5,
              })
              actions.updateSettings('alerts', {
                severityLevels: { critical: true, warning: true, info: false },
              })
            }}
          >
            ICU Default
          </button>
          <button
            className="template-btn"
            onClick={() => {
              actions.updateSettings('display', {
                timeScale: 15,
                timeWindow: 20,
                amplitudeScale: 10,
              })
              actions.updateSettings('alerts', {
                severityLevels: { critical: true, warning: true, info: true },
              })
            }}
          >
            OR Monitoring
          </button>
          <button
            className="template-btn"
            onClick={() => {
              actions.updateSettings('display', {
                timeScale: 30,
                timeWindow: 30,
                amplitudeScale: 7.5,
              })
              actions.updateSettings('alerts', {
                severityLevels: { critical: true, warning: false, info: false },
              })
            }}
          >
            Clinic Review
          </button>
        </div>
      </div>
    </div>
  )
}

