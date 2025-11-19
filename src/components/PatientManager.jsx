import { useState } from 'react'
import { useEEG } from '../store/EEGContext'
import './PatientManager.css'

export default function PatientManager() {
  const { settings, actions } = useEEG()
  const { patient } = settings
  const [isEditing, setIsEditing] = useState(!patient.patientId)
  const [formData, setFormData] = useState({
    patientId: patient.patientId || '',
    mrn: patient.mrn || '',
    firstName: patient.firstName || '',
    lastName: patient.lastName || '',
    dateOfBirth: patient.dateOfBirth || '',
    sessionType: patient.sessionType || 'OR',
  })

  const handleSave = () => {
    if (!formData.patientId.trim()) {
      alert('Patient ID is required')
      return
    }
    
    actions.updateSettings('patient', {
      ...formData,
      sessionDate: new Date().toISOString(),
      sessionStartTime: new Date().toISOString(),
    })
    
    actions.setSession({
      sessionId: `SESSION-${Date.now()}`,
      startTime: new Date().toISOString(),
      sessionType: formData.sessionType,
    })
    
    setIsEditing(false)
  }

  const handleCancel = () => {
    setFormData({
      patientId: patient.patientId || '',
      mrn: patient.mrn || '',
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      dateOfBirth: patient.dateOfBirth || '',
      sessionType: patient.sessionType || 'OR',
    })
    setIsEditing(false)
  }

  if (!isEditing) {
    return (
      <div className="patient-manager-display">
        <div className="patient-info-display">
          <div className="patient-name">
            {patient.firstName || patient.lastName 
              ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim()
              : 'No Patient Selected'}
          </div>
          <div className="patient-details">
            {patient.patientId && <span>ID: {patient.patientId}</span>}
            {patient.mrn && <span>MRN: {patient.mrn}</span>}
            {patient.dateOfBirth && <span>DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}</span>}
            {patient.sessionType && <span className="session-badge">{patient.sessionType}</span>}
          </div>
          {patient.sessionStartTime && (
            <div className="session-time">
              Session: {new Date(patient.sessionStartTime).toLocaleString()}
            </div>
          )}
        </div>
        <button className="edit-patient-btn" onClick={() => setIsEditing(true)}>
          Edit Patient
        </button>
      </div>
    )
  }

  return (
    <div className="patient-manager-form">
      <h3>Patient Information</h3>
      <div className="form-group">
        <label>Patient ID *</label>
        <input
          type="text"
          value={formData.patientId}
          onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
          placeholder="Enter Patient ID"
          required
        />
      </div>
      <div className="form-group">
        <label>MRN</label>
        <input
          type="text"
          value={formData.mrn}
          onChange={(e) => setFormData({ ...formData, mrn: e.target.value })}
          placeholder="Medical Record Number"
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>First Name</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            placeholder="First Name"
          />
        </div>
        <div className="form-group">
          <label>Last Name</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            placeholder="Last Name"
          />
        </div>
      </div>
      <div className="form-group">
        <label>Date of Birth</label>
        <input
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>Session Type</label>
        <select
          value={formData.sessionType}
          onChange={(e) => setFormData({ ...formData, sessionType: e.target.value })}
        >
          <option value="OR">Operating Room</option>
          <option value="ICU">Intensive Care Unit</option>
          <option value="ER">Emergency Room</option>
          <option value="Clinic">Clinic</option>
        </select>
      </div>
      <div className="form-actions">
        <button className="btn-primary" onClick={handleSave}>Save</button>
        <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
      </div>
    </div>
  )
}

