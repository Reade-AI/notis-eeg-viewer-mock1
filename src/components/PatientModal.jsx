import { useState, useEffect } from 'react'
import { useEEG } from '../store/EEGContext'
import './PatientModal.css'

export default function PatientModal({ isOpen, onClose }) {
  const { settings, actions } = useEEG()
  const { patient } = settings
  const [formData, setFormData] = useState({
    patientId: '',
    mrn: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    sessionType: 'OR',
  })

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        patientId: patient.patientId || '',
        mrn: patient.mrn || '',
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        dateOfBirth: patient.dateOfBirth || '',
        sessionType: patient.sessionType || 'OR',
      })
    }
  }, [isOpen, patient])

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
    
    onClose()
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
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Patient Information</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
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
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

