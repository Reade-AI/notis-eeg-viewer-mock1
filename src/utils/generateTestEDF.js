/**
 * Generate a test EDF file for testing EDF loading and streaming
 * This creates a minimal valid EDF file with sample EEG data
 */

/**
 * Write a string to a DataView at a specific offset
 */
function writeString(dataView, offset, length, str) {
  const bytes = new Uint8Array(dataView.buffer, offset, length)
  const encoder = new TextEncoder()
  const encoded = encoder.encode(str.padEnd(length, ' ').substring(0, length))
  bytes.set(encoded)
}

/**
 * Write a number as a string to a DataView (right-aligned, padded with spaces)
 */
function writeNumber(dataView, offset, length, num) {
  const numStr = num.toString()
  writeString(dataView, offset, length, numStr.padStart(length, ' '))
}

/**
 * Generate a test EDF file
 */
export function generateTestEDF() {
  // EDF file structure:
  // - Header (256 bytes)
  // - Signal headers (256 bytes per signal)
  // - Data records
  
  const numSignals = 8 // 8 EEG channels
  const numRecords = 30 // 30 data records (30 seconds)
  const recordDuration = 1.0 // 1 second per record
  const samplesPerRecord = 256 // 256 samples per second per channel
  
  // Calculate sizes
  const headerSize = 256
  const signalHeaderSize = 256 * numSignals
  const recordSize = samplesPerRecord * numSignals * 2 // 2 bytes per sample (int16)
  const totalSize = headerSize + signalHeaderSize + (numRecords * recordSize)
  
  // Create buffer
  const buffer = new ArrayBuffer(totalSize)
  const dataView = new DataView(buffer)
  
  let offset = 0
  
  // ===== EDF HEADER (256 bytes) =====
  
  // Version (8 bytes): "0       "
  writeString(dataView, offset, 8, '0')
  offset += 8
  
  // Patient ID (80 bytes)
  const patientID = 'TEST-001 Test Patient M 01-JAN-1980'
  writeString(dataView, offset, 80, patientID)
  offset += 80
  
  // Recording ID (80 bytes)
  const recordingID = '01.01.24 10:30:00 Test Recording'
  writeString(dataView, offset, 80, recordingID)
  offset += 80
  
  // Start date (8 bytes): "dd.mm.yy"
  writeString(dataView, offset, 8, '01.01.24')
  offset += 8
  
  // Start time (8 bytes): "hh.mm.ss"
  writeString(dataView, offset, 8, '10.30.00')
  offset += 8
  
  // Header bytes (8 bytes) - will be calculated after signal headers
  writeString(dataView, offset, 8, '        ')
  offset += 8
  
  // Reserved (44 bytes)
  writeString(dataView, offset, 44, '')
  offset += 44
  
  // Number of data records (8 bytes)
  writeNumber(dataView, offset, 8, numRecords)
  offset += 8
  
  // Duration of data record (8 bytes)
  writeNumber(dataView, offset, 8, recordDuration)
  offset += 8
  
  // Number of signals (4 bytes)
  writeNumber(dataView, offset, 4, numSignals)
  offset += 4
  
  // ===== SIGNAL HEADERS (interleaved format) =====
  
  const channelLabels = [
    'F3-P3',
    'F4-P4', 
    'T3-O1',
    'T4-O2',
    'F7-T3',
    'F8-T4',
    'P3-O1',
    'P4-O2'
  ]
  
  const signalHeaderStart = offset
  
  // Field sizes
  const LABEL_SIZE = 16
  const TRANSDUCER_SIZE = 80
  const PHYS_DIM_SIZE = 8
  const PHYS_MIN_SIZE = 8
  const PHYS_MAX_SIZE = 8
  const DIGITAL_MIN_SIZE = 8
  const DIGITAL_MAX_SIZE = 8
  const PREFILTER_SIZE = 80
  const NUM_SAMPLES_SIZE = 8
  const RESERVED_SIZE = 32
  
  // Calculate offsets for each field type
  let currentOffset = signalHeaderStart
  
  // 1. Labels (16 bytes each, all signals)
  const labelOffset = currentOffset
  for (let i = 0; i < numSignals; i++) {
    writeString(dataView, labelOffset + (i * LABEL_SIZE), LABEL_SIZE, channelLabels[i])
  }
  currentOffset += numSignals * LABEL_SIZE
  
  // 2. Transducers (80 bytes each, all signals)
  const transducerOffset = currentOffset
  for (let i = 0; i < numSignals; i++) {
    writeString(dataView, transducerOffset + (i * TRANSDUCER_SIZE), TRANSDUCER_SIZE, 'Ag/AgCl electrode')
  }
  currentOffset += numSignals * TRANSDUCER_SIZE
  
  // 3. Physical dimension (8 bytes each, all signals)
  const physDimOffset = currentOffset
  for (let i = 0; i < numSignals; i++) {
    writeString(dataView, physDimOffset + (i * PHYS_DIM_SIZE), PHYS_DIM_SIZE, 'uV')
  }
  currentOffset += numSignals * PHYS_DIM_SIZE
  
  // 4. Physical minimum (8 bytes each, all signals)
  const physMinOffset = currentOffset
  for (let i = 0; i < numSignals; i++) {
    writeNumber(dataView, physMinOffset + (i * PHYS_MIN_SIZE), PHYS_MIN_SIZE, -3276.8)
  }
  currentOffset += numSignals * PHYS_MIN_SIZE
  
  // 5. Physical maximum (8 bytes each, all signals)
  const physMaxOffset = currentOffset
  for (let i = 0; i < numSignals; i++) {
    writeNumber(dataView, physMaxOffset + (i * PHYS_MAX_SIZE), PHYS_MAX_SIZE, 3276.7)
  }
  currentOffset += numSignals * PHYS_MAX_SIZE
  
  // 6. Digital minimum (8 bytes each, all signals)
  const digitalMinOffset = currentOffset
  for (let i = 0; i < numSignals; i++) {
    writeNumber(dataView, digitalMinOffset + (i * DIGITAL_MIN_SIZE), DIGITAL_MIN_SIZE, -32768)
  }
  currentOffset += numSignals * DIGITAL_MIN_SIZE
  
  // 7. Digital maximum (8 bytes each, all signals)
  const digitalMaxOffset = currentOffset
  for (let i = 0; i < numSignals; i++) {
    writeNumber(dataView, digitalMaxOffset + (i * DIGITAL_MAX_SIZE), DIGITAL_MAX_SIZE, 32767)
  }
  currentOffset += numSignals * DIGITAL_MAX_SIZE
  
  // 8. Prefiltering (80 bytes each, all signals)
  const prefilterOffset = currentOffset
  for (let i = 0; i < numSignals; i++) {
    writeString(dataView, prefilterOffset + (i * PREFILTER_SIZE), PREFILTER_SIZE, 'HP:0.1Hz LP:70Hz')
  }
  currentOffset += numSignals * PREFILTER_SIZE
  
  // 9. Number of samples (8 bytes each, all signals) - CRITICAL FIELD
  const numSamplesOffset = currentOffset
  for (let i = 0; i < numSignals; i++) {
    writeNumber(dataView, numSamplesOffset + (i * NUM_SAMPLES_SIZE), NUM_SAMPLES_SIZE, samplesPerRecord)
  }
  currentOffset += numSignals * NUM_SAMPLES_SIZE
  
  // 10. Reserved (32 bytes each, all signals)
  const reservedOffset = currentOffset
  for (let i = 0; i < numSignals; i++) {
    writeString(dataView, reservedOffset + (i * RESERVED_SIZE), RESERVED_SIZE, '')
  }
  currentOffset += numSignals * RESERVED_SIZE
  
  // Update offset for data records
  offset = currentOffset
  
  // Now update the header bytes field with the actual size
  const actualHeaderSize = offset
  writeNumber(dataView, 184, 8, actualHeaderSize)
  
  // ===== DATA RECORDS =====
  // EDF format: For each record, all samples for signal 0, then all samples for signal 1, etc.
  
  for (let record = 0; record < numRecords; record++) {
    // For each signal/channel
    for (let channel = 0; channel < numSignals; channel++) {
      // Generate all samples for this signal in this record
      for (let sample = 0; sample < samplesPerRecord; sample++) {
        const time = (record * recordDuration) + (sample / samplesPerRecord)
        
        // Generate a simple sine wave with different frequencies per channel
        const frequency = 10 + (channel * 2) // 10, 12, 14, 16, 18, 20, 22, 24 Hz
        const amplitude = 50 + (channel * 10) // Different amplitudes
        let value = amplitude * Math.sin(2 * Math.PI * frequency * time)
        
        // Add some noise
        const noise = (Math.random() - 0.5) * 10
        value += noise
        
        // Convert to digital value (scale to int16 range)
        const digitalValue = Math.round((value / 3276.7) * 32767)
        const clampedValue = Math.max(-32768, Math.min(32767, digitalValue))
        
        // Write as int16 (little-endian)
        dataView.setInt16(offset, clampedValue, true)
        offset += 2
      }
    }
  }
  
  return buffer
}

/**
 * Create a downloadable EDF file
 */
export function downloadTestEDF() {
  const buffer = generateTestEDF()
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'test_eeg.edf'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  console.log('Test EDF file generated and downloaded!')
}

