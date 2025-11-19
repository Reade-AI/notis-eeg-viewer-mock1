import { useState } from 'react'
import { useEEG } from '../store/EEGContext'
import { jsPDF } from 'jspdf'
import './ExportTools.css'

export default function ExportTools() {
  const { eegBuffer, ischemiaEvents, annotations, settings, session } = useEEG()
  const [exportFormat, setExportFormat] = useState('edf')
  const [isExporting, setIsExporting] = useState(false)

  const exportEDF = async () => {
    setIsExporting(true)
    try {
      // Basic EDF export structure
      // Note: Full EDF implementation would require proper header and data encoding
      const header = {
        version: '0',
        patientId: settings.patient.patientId || 'UNKNOWN',
        recordingId: session.sessionId || 'RECORDING',
        startDate: session.startTime || new Date().toISOString(),
        numSignals: 8,
        numDataRecords: Math.floor((eegBuffer[0]?.length || 0) / 250), // Assuming 250 Hz sample rate
        duration: 1, // seconds per data record
        numSamples: Array(8).fill(250), // samples per data record per channel
      }

      // Convert EEG buffer to EDF format
      // This is a simplified version - full EDF requires binary encoding
      const data = eegBuffer.map((channel, idx) => ({
        channel: idx,
        label: `CH${idx + 1}`,
        samples: channel.map(point => point.y),
        timestamps: channel.map(point => point.x),
      }))

      // Create JSON export (simplified - real EDF is binary)
      const exportData = {
        header,
        data,
        events: ischemiaEvents,
        annotations,
        metadata: {
          patient: settings.patient,
          session: session,
          exportDate: new Date().toISOString(),
        },
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5) // Format: 2025-11-19_12-30-45
      a.download = `eeg_export_${timestamp}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Export failed: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  const exportPDF = async () => {
    setIsExporting(true)
    try {
      // Create new PDF document
      const doc = new jsPDF()
      let yPosition = 20
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 20
      const lineHeight = 7
      const sectionSpacing = 15

      // Helper function to add a new page if needed
      const checkNewPage = (requiredSpace) => {
        if (yPosition + requiredSpace > pageHeight - margin) {
          doc.addPage()
          yPosition = margin
          return true
        }
        return false
      }

      // Title
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('EEG Session Report', margin, yPosition)
      yPosition += lineHeight * 2

      // Patient Information Section
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Patient Information', margin, yPosition)
      yPosition += lineHeight

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      
      const patientInfo = [
        ['Patient ID:', settings.patient.patientId || 'N/A'],
        ['MRN:', settings.patient.mrn || 'N/A'],
        ['Name:', `${settings.patient.firstName || ''} ${settings.patient.lastName || ''}`.trim() || 'N/A'],
        ['Session Type:', settings.patient.sessionType || 'N/A'],
        ['Session Date:', session.startTime ? new Date(session.startTime).toLocaleString() : new Date().toLocaleString()],
        ['Export Date:', new Date().toLocaleString()],
      ]

      patientInfo.forEach(([label, value]) => {
        checkNewPage(lineHeight * 2)
        doc.setFont('helvetica', 'bold')
        doc.text(label, margin, yPosition)
        doc.setFont('helvetica', 'normal')
        doc.text(value, margin + 50, yPosition)
        yPosition += lineHeight
      })

      yPosition += sectionSpacing

      // Ischemia Events Section
      checkNewPage(lineHeight * 3)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Ischemia Events', margin, yPosition)
      yPosition += lineHeight

      if (ischemiaEvents.length > 0) {
        // Table headers
        checkNewPage(lineHeight * 2)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        const headers = ['Start Time', 'End Time', 'Duration', 'Confidence', 'Severity']
        const colWidths = [35, 35, 30, 35, 30]
        let xPos = margin
        
        headers.forEach((header, idx) => {
          doc.text(header, xPos, yPosition)
          xPos += colWidths[idx]
        })
        yPosition += lineHeight

        // Draw line under headers
        doc.setLineWidth(0.5)
        doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2)
        yPosition += 3

        // Table rows
        doc.setFont('helvetica', 'normal')
        ischemiaEvents.forEach((event) => {
          checkNewPage(lineHeight * 2)
          
          const startTime = typeof event.startTime === 'number' ? event.startTime.toFixed(2) + 's' : 'N/A'
          const endTime = event.endTime && typeof event.endTime === 'number' ? event.endTime.toFixed(2) + 's' : 'Ongoing'
          const duration = event.endTime && typeof event.endTime === 'number' && typeof event.startTime === 'number'
            ? (event.endTime - event.startTime).toFixed(2) + 's'
            : 'N/A'
          const confidence = typeof event.confidence === 'number' ? (event.confidence * 100).toFixed(1) + '%' : 'N/A'
          const severity = event.severity || 'info'

          const rowData = [startTime, endTime, duration, confidence, severity]
          xPos = margin
          
          rowData.forEach((data, idx) => {
            doc.text(data, xPos, yPosition)
            xPos += colWidths[idx]
          })
          yPosition += lineHeight
        })
      } else {
        checkNewPage(lineHeight)
        doc.setFont('helvetica', 'normal')
        doc.text('No ischemia events recorded', margin, yPosition)
        yPosition += lineHeight
      }

      yPosition += sectionSpacing

      // Annotations Section
      checkNewPage(lineHeight * 3)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Annotations', margin, yPosition)
      yPosition += lineHeight

      if (annotations.length > 0) {
        // Table headers
        checkNewPage(lineHeight * 2)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        const headers = ['Time', 'Type', 'Text']
        const colWidths = [30, 40, pageWidth - margin * 2 - 70]
        let xPos = margin
        
        headers.forEach((header, idx) => {
          doc.text(header, xPos, yPosition)
          xPos += colWidths[idx]
        })
        yPosition += lineHeight

        // Draw line under headers
        doc.setLineWidth(0.5)
        doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2)
        yPosition += 3

        // Table rows
        doc.setFont('helvetica', 'normal')
        annotations.forEach((ann) => {
          const timestamp = typeof ann.timestamp === 'number' ? ann.timestamp.toFixed(2) + 's' : 'N/A'
          const type = ann.type || 'N/A'
          const text = ann.text || 'N/A'
          
          // Split long text into multiple lines if needed
          const maxTextWidth = colWidths[2]
          const textLines = doc.splitTextToSize(text, maxTextWidth)
          const rowHeight = lineHeight * Math.max(1, textLines.length)
          
          checkNewPage(rowHeight + lineHeight)
          
          // Draw timestamp and type
          doc.text(timestamp, margin, yPosition)
          doc.text(type, margin + colWidths[0], yPosition)
          
          // Draw text (potentially multi-line)
          textLines.forEach((line, lineIdx) => {
            doc.text(line, margin + colWidths[0] + colWidths[1], yPosition + (lineIdx * lineHeight))
          })
          
          yPosition += rowHeight
        })
      } else {
        checkNewPage(lineHeight)
        doc.setFont('helvetica', 'normal')
        doc.text('No annotations recorded', margin, yPosition)
        yPosition += lineHeight
      }

      // Save the PDF with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5) // Format: 2025-11-19_12-30-45
      const patientId = settings.patient.patientId || 'unknown'
      const fileName = `eeg_report_${patientId}_${timestamp}.pdf`
      
      // Use jsPDF's save method directly (most reliable for filename)
      try {
        console.log('Using jsPDF save() method for:', fileName)
        doc.save(fileName)
        console.log('PDF save() called successfully for:', fileName)
        console.log('PDF exported successfully:', fileName)
      } catch (saveError) {
        console.error('jsPDF save() failed:', saveError)
        
        // Fallback: Use blob URL with explicit filename handling
        try {
          console.log('Attempting blob URL download fallback')
          const pdfBlob = doc.output('blob')
          console.log('PDF blob created, size:', pdfBlob.size, 'bytes')
          
          if (!pdfBlob || pdfBlob.size === 0) {
            throw new Error('Failed to generate PDF blob - PDF is empty')
          }
          
          const blobUrl = URL.createObjectURL(pdfBlob)
          console.log('Blob URL created:', blobUrl)
          
          const link = document.createElement('a')
          link.href = blobUrl
          link.download = fileName
          link.setAttribute('download', fileName)
          link.setAttribute('type', 'application/pdf')
          link.style.display = 'none'
          
          document.body.appendChild(link)
          
          setTimeout(() => {
            try {
              // Set download attribute again right before click
              link.setAttribute('download', fileName)
              link.download = fileName
              
              const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1
              })
              
              link.dispatchEvent(clickEvent)
              link.click()
              
              console.log('Blob download triggered for:', fileName)
              
              setTimeout(() => {
                if (link.parentNode) {
                  document.body.removeChild(link)
                }
                URL.revokeObjectURL(blobUrl)
              }, 1000)
              
              console.log('PDF exported successfully:', fileName)
            } catch (clickError) {
              console.error('Error triggering download click:', clickError)
              if (link.parentNode) {
                document.body.removeChild(link)
              }
              URL.revokeObjectURL(blobUrl)
              throw clickError
            }
          }, 100)
        } catch (blobError) {
          console.error('Blob download also failed:', blobError)
          throw new Error('Failed to download PDF: ' + saveError.message)
        }
      }
    } catch (error) {
      console.error('PDF export error:', error)
      alert('PDF export failed: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  const exportScreenshot = () => {
    // This would capture the current view
    // For full implementation, use html2canvas library
    alert('Screenshot export - Use browser print (Ctrl/Cmd+P) to save as PDF')
  }

  const handleExport = () => {
    if (exportFormat === 'edf') {
      exportEDF()
    } else if (exportFormat === 'pdf') {
      exportPDF()
    } else if (exportFormat === 'screenshot') {
      exportScreenshot()
    }
  }

  return (
    <div className="export-tools">
      <h3>Export Data</h3>
      <div className="export-options">
        <div className="form-group">
          <label>Export Format</label>
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
            <option value="edf">EDF (JSON format)</option>
            <option value="pdf">PDF Report</option>
            <option value="screenshot">Screenshot</option>
          </select>
        </div>
        <button 
          className="export-btn" 
          onClick={handleExport}
          disabled={isExporting || (exportFormat === 'edf' && (!eegBuffer[0] || eegBuffer[0].length === 0))}
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
      <div className="export-info">
        <p><strong>Available Data:</strong></p>
        <ul>
          <li>EEG Channels: {eegBuffer[0]?.length || 0} samples</li>
          <li>Ischemia Events: {ischemiaEvents.length}</li>
          <li>Annotations: {annotations.length}</li>
        </ul>
      </div>
    </div>
  )
}

