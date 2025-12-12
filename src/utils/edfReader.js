/**
 * EDF File Reader Utility
 * Reads EDF (European Data Format) files and extracts EEG data
 */

/**
 * Parse patient information from EDF patient ID field
 * EDF format: patientId field (80 bytes) can contain structured info
 * Common formats:
 * - "PatientID Name Sex Birthdate"
 * - "PatientID Name Sex DOB"
 * - "PatientID MRN Name"
 * - "PatientID Name"
 */
export function parseEDFPatientInfo(patientIdString, recordingIdString = '') {
  const patientInfo = {
    patientId: '',
    mrn: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    recordingId: recordingIdString || ''
  }
  
  if (!patientIdString || patientIdString.trim() === '') {
    return patientInfo
  }
  
  // Clean the patient ID string
  const cleaned = patientIdString.trim()
  
  // Try to parse common EDF patient ID formats
  // Format 1: "PatientID Name Sex Birthdate" (e.g., "12345 John Doe M 01-JAN-1980")
  // Format 2: "PatientID MRN Name" (e.g., "12345 MRN123456 John Doe")
  // Format 3: "PatientID Name" (e.g., "12345 John Doe")
  
  // Split by spaces
  const parts = cleaned.split(/\s+/).filter(p => p.length > 0)
  
  if (parts.length === 0) {
    // If empty, use the whole string as patient ID
    patientInfo.patientId = cleaned
    return patientInfo
  }
  
  // First part is usually the patient ID
  patientInfo.patientId = parts[0]
  
  // Try to identify date patterns (DD-MMM-YYYY, YYYY-MM-DD, DD/MM/YYYY, etc.)
  const datePatterns = [
    /(\d{2})-([A-Z]{3})-(\d{4})/i,  // DD-MMM-YYYY
    /(\d{4})-(\d{2})-(\d{2})/,      // YYYY-MM-DD
    /(\d{2})\/(\d{2})\/(\d{4})/,    // DD/MM/YYYY
    /(\d{2})-(\d{2})-(\d{4})/,      // DD-MM-YYYY
  ]
  
  let dateIndex = -1
  let dateMatch = null
  
  for (let i = 0; i < parts.length; i++) {
    for (const pattern of datePatterns) {
      const match = parts[i].match(pattern)
      if (match) {
        dateIndex = i
        dateMatch = match
        break
      }
    }
    if (dateMatch) break
  }
  
  // Try to identify gender (M, F, Male, Female)
  let genderIndex = -1
  const genderPatterns = [/^M$|^MALE$/i, /^F$|^FEMALE$/i]
  for (let i = 0; i < parts.length; i++) {
    if (genderPatterns.some(p => p.test(parts[i]))) {
      genderIndex = i
      patientInfo.gender = parts[i].toUpperCase()
      break
    }
  }
  
  // Parse date if found
  if (dateMatch && dateIndex >= 0) {
    try {
      let dateStr = parts[dateIndex]
      // Convert DD-MMM-YYYY to ISO format
      if (dateMatch[2] && dateMatch[2].match(/[A-Z]{3}/i)) {
        const months = {
          'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
          'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
          'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
        }
        const month = months[dateMatch[2].toUpperCase()]
        if (month) {
          dateStr = `${dateMatch[3]}-${month}-${dateMatch[1].padStart(2, '0')}`
        }
      }
      // Try to parse as date
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        patientInfo.dateOfBirth = date.toISOString().split('T')[0] // YYYY-MM-DD format
      }
    } catch (e) {
      console.warn('Could not parse date from EDF patient ID:', parts[dateIndex])
    }
  }
  
  // Extract name parts (everything except patient ID, date, and gender)
  const nameParts = []
  for (let i = 1; i < parts.length; i++) {
    if (i !== dateIndex && i !== genderIndex) {
      // Check if it looks like an MRN (often numeric or alphanumeric)
      if (i === 1 && /^[A-Z0-9-]+$/i.test(parts[i]) && parts[i].length > 5 && parts[i].length < 20) {
        // Could be MRN
        patientInfo.mrn = parts[i]
      } else {
        nameParts.push(parts[i])
      }
    }
  }
  
  // Parse name (assume first name and last name)
  if (nameParts.length > 0) {
    if (nameParts.length === 1) {
      patientInfo.firstName = nameParts[0]
    } else {
      patientInfo.firstName = nameParts[0]
      patientInfo.lastName = nameParts.slice(1).join(' ')
    }
  }
  
  // If no MRN found but recording ID might contain it
  if (!patientInfo.mrn && recordingIdString) {
    // Sometimes MRN is in recording ID
    const mrnMatch = recordingIdString.match(/MRN[:\s]*([A-Z0-9-]+)/i)
    if (mrnMatch) {
      patientInfo.mrn = mrnMatch[1]
    }
  }
  
  return patientInfo
}

export async function readEDFFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        console.log('[readEDFFile] Starting to parse EDF file:', file.name, 'Size:', file.size, 'bytes')
        const arrayBuffer = e.target.result
        const dataView = new DataView(arrayBuffer)
        
        // Parse EDF header (256 bytes)
        console.log('[readEDFFile] Parsing EDF header...')
        const header = parseEDFHeader(dataView)
        console.log('[readEDFFile] Header parsed:', {
          numSignals: header.numSignals,
          numDataRecords: header.numDataRecords,
          duration: header.duration,
          totalDuration: header.numDataRecords * header.duration
        })
        
        // Parse EDF data records
        console.log('[readEDFFile] Parsing EDF records...')
        const records = parseEDFRecords(dataView, header)
        console.log('[readEDFFile] Records parsed:', {
          numRecords: records.length,
          firstRecordSamples: records[0]?.samples?.length,
          firstRecordTime: records[0]?.time
        })
        
        // Extract channels to Float32Array format
        console.log('[readEDFFile] Extracting channels to Float32Array...')
        const channels = extractChannels(records, header)
        console.log('[readEDFFile] Channels extracted:', {
          numChannels: channels.length,
          firstChannel: channels[0] ? {
            label: channels[0].label,
            sampleRate: channels[0].sampleRate,
            samplesLength: channels[0].samples?.length,
            samplesType: channels[0].samples?.constructor?.name
          } : null
        })
        
        const durationSec = header.numDataRecords * header.duration
        
        // Calculate actual duration from sample data for verification
        const actualDurationSec = channels.length > 0 && channels[0]?.samples?.length > 0 && channels[0]?.sampleRate > 0
          ? channels[0].samples.length / channels[0].sampleRate
          : durationSec
        
        const result = {
          header,
          records,
          channels,
          durationSec,
          startTimeSec: 0
        }
        
        console.log('[readEDFFile] EDF file parsed successfully:', {
          numChannels: channels.length,
          headerDurationSec: durationSec,
          headerDurationFormatted: `${Math.floor(durationSec / 3600)}:${Math.floor((durationSec % 3600) / 60).toString().padStart(2, '0')}:${(durationSec % 60).toFixed(1)}`,
          actualDurationSec: actualDurationSec,
          actualDurationFormatted: `${Math.floor(actualDurationSec / 3600)}:${Math.floor((actualDurationSec % 3600) / 60).toString().padStart(2, '0')}:${(actualDurationSec % 60).toFixed(1)}`,
          numDataRecords: header.numDataRecords,
          recordDuration: header.duration,
          totalSamples: channels[0]?.samples?.length || 0,
          sampleRate: channels[0]?.sampleRate || 0,
          durationMismatch: Math.abs(durationSec - actualDurationSec) > 1 ? '⚠️ WARNING: Header duration does not match actual data duration!' : '✓ OK'
        })
        
        resolve(result)
      } catch (error) {
        console.error('[readEDFFile] Error parsing EDF file:', error)
        console.error('[readEDFFile] Error stack:', error.stack)
        reject(error)
      }
    }
    
    reader.onerror = (error) => {
      console.error('[readEDFFile] FileReader error:', error)
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}

function parseEDFHeader(dataView) {
  // EDF header is 256 bytes
  const header = {}
  
  // Read header fields (all are ASCII strings)
  header.version = readString(dataView, 0, 8).trim()
  header.patientId = readString(dataView, 8, 80).trim()
  header.recordingId = readString(dataView, 88, 80).trim()
  header.startDate = readString(dataView, 168, 8).trim()
  header.startTime = readString(dataView, 176, 8).trim()
  header.headerBytes = parseInt(readString(dataView, 184, 8).trim())
  header.reserved = readString(dataView, 192, 44).trim()
  header.numDataRecords = parseInt(readString(dataView, 236, 8).trim())
  header.duration = parseFloat(readString(dataView, 244, 8).trim())
  header.numSignals = parseInt(readString(dataView, 252, 4).trim())
  
  // EDF signal headers are stored in interleaved format:
  // All labels together (16 bytes each), then all transducers, etc.
  header.signals = []
  const signalHeaderStart = 256
  const numSignals = header.numSignals
  
  // Field sizes in EDF format
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
  
  // Labels (16 bytes each)
  const labelOffset = currentOffset
  currentOffset += numSignals * LABEL_SIZE
  
  // Transducers (80 bytes each)
  const transducerOffset = currentOffset
  currentOffset += numSignals * TRANSDUCER_SIZE
  
  // Physical dimension (8 bytes each)
  const physDimOffset = currentOffset
  currentOffset += numSignals * PHYS_DIM_SIZE
  
  // Physical min (8 bytes each)
  const physMinOffset = currentOffset
  currentOffset += numSignals * PHYS_MIN_SIZE
  
  // Physical max (8 bytes each)
  const physMaxOffset = currentOffset
  currentOffset += numSignals * PHYS_MAX_SIZE
  
  // Digital min (8 bytes each)
  const digitalMinOffset = currentOffset
  currentOffset += numSignals * DIGITAL_MIN_SIZE
  
  // Digital max (8 bytes each)
  const digitalMaxOffset = currentOffset
  currentOffset += numSignals * DIGITAL_MAX_SIZE
  
  // Prefiltering (80 bytes each)
  const prefilterOffset = currentOffset
  currentOffset += numSignals * PREFILTER_SIZE
  
  // Number of samples (8 bytes each)
  const numSamplesOffset = currentOffset
  currentOffset += numSignals * NUM_SAMPLES_SIZE
  
  // Reserved (32 bytes each)
  const reservedOffset = currentOffset
  
  // Read signal information
  for (let i = 0; i < numSignals; i++) {
    const signal = {
      label: readString(dataView, labelOffset + (i * LABEL_SIZE), LABEL_SIZE).trim(),
      transducer: readString(dataView, transducerOffset + (i * TRANSDUCER_SIZE), TRANSDUCER_SIZE).trim(),
      physicalDimension: readString(dataView, physDimOffset + (i * PHYS_DIM_SIZE), PHYS_DIM_SIZE).trim(),
      physicalMin: parseFloat(readString(dataView, physMinOffset + (i * PHYS_MIN_SIZE), PHYS_MIN_SIZE).trim()),
      physicalMax: parseFloat(readString(dataView, physMaxOffset + (i * PHYS_MAX_SIZE), PHYS_MAX_SIZE).trim()),
      digitalMin: parseInt(readString(dataView, digitalMinOffset + (i * DIGITAL_MIN_SIZE), DIGITAL_MIN_SIZE).trim()),
      digitalMax: parseInt(readString(dataView, digitalMaxOffset + (i * DIGITAL_MAX_SIZE), DIGITAL_MAX_SIZE).trim()),
      prefiltering: readString(dataView, prefilterOffset + (i * PREFILTER_SIZE), PREFILTER_SIZE).trim(),
      numSamples: parseInt(readString(dataView, numSamplesOffset + (i * NUM_SAMPLES_SIZE), NUM_SAMPLES_SIZE).trim()),
      reserved: readString(dataView, reservedOffset + (i * RESERVED_SIZE), RESERVED_SIZE).trim()
    }
    header.signals.push(signal)
  }
  
  return header
}

function parseEDFRecords(dataView, header) {
  const records = []
  const headerSize = header.headerBytes
  const samplesPerRecord = header.signals.reduce((sum, sig) => sum + sig.numSamples, 0)
  const bytesPerRecord = samplesPerRecord * 2 // Each sample is 2 bytes (int16)
  
  for (let recordIndex = 0; recordIndex < header.numDataRecords; recordIndex++) {
    const recordOffset = headerSize + (recordIndex * bytesPerRecord)
    const record = {
      index: recordIndex,
      time: recordIndex * header.duration,
      samples: []
    }
    
    let sampleOffset = recordOffset
    for (let signalIndex = 0; signalIndex < header.numSignals; signalIndex++) {
      const signal = header.signals[signalIndex]
      const signalSamples = []
      
      for (let i = 0; i < signal.numSamples; i++) {
        // Read int16 (little-endian)
        const digitalValue = dataView.getInt16(sampleOffset, true)
        
        // Convert to physical value (usually in microvolts for EEG)
        const physicalValue = convertToPhysical(
          digitalValue,
          signal.digitalMin,
          signal.digitalMax,
          signal.physicalMin,
          signal.physicalMax
        )
        
        signalSamples.push(physicalValue)
        sampleOffset += 2
        
        // Debug first few samples of first signal and some later samples
        if (signalIndex === 0) {
          if (i < 5 || (i >= 100 && i < 105) || (i >= 1000 && i < 1005)) {
            console.log(`[EDF Reader] Record ${recordIndex}, Signal ${signalIndex}, Sample ${i}: digital=${digitalValue}, physical=${physicalValue.toFixed(4)}, range=[${signal.digitalMin},${signal.digitalMax}]->[${signal.physicalMin},${signal.physicalMax}]`)
          }
        }
      }
      
      record.samples.push(signalSamples)
    }
    
    records.push(record)
  }
  
  return records
}

/**
 * Extract channels from EDF records and convert to Float32Array format
 * Returns channel data with Float32Array samples in µV
 */
function extractChannels(records, header) {
  const numChannels = header.signals.length
  
  if (numChannels === 0) {
    throw new Error('EDF file has no signals/channels')
  }
  
  // Calculate actual sample rate from first signal
  const firstSignal = header.signals[0]
  if (!firstSignal || !firstSignal.numSamples || !header.duration || header.duration <= 0) {
    throw new Error(`Invalid EDF header: numSamples=${firstSignal?.numSamples}, duration=${header.duration}`)
  }
  
  const sampleRate = firstSignal.numSamples / header.duration
  
  if (!isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`Invalid sample rate calculated: ${sampleRate} (numSamples=${firstSignal.numSamples}, duration=${header.duration})`)
  }
  
  console.log('[extractChannels] Sample rate:', sampleRate, 'Hz')
  
  // First pass: collect all samples to determine total count per channel
  const channelSampleCounts = Array(numChannels).fill(0)
  records.forEach((record) => {
    record.samples.forEach((signalSamples, channelIndex) => {
      channelSampleCounts[channelIndex] += signalSamples.length
    })
  })
  
  // Create Float32Array for each channel
  const channels = channelSampleCounts.map((count, idx) => ({
    label: header.signals[idx].label || `Channel ${idx}`,
    sampleRate: sampleRate,
    samples: new Float32Array(count)
  }))
  
  // Statistics for debugging
  const channelStats = Array(numChannels).fill(null).map(() => ({
    min: Infinity,
    max: -Infinity,
    sum: 0,
    count: 0
  }))
  
  // Second pass: fill Float32Arrays with converted samples
  const sampleIndices = Array(numChannels).fill(0)
  
  try {
    records.forEach((record, recordIndex) => {
      if (!record || !record.samples || !Array.isArray(record.samples)) {
        console.warn(`[EDF Reader] Invalid record at index ${recordIndex}`)
        return
      }
      
      record.samples.forEach((signalSamples, channelIndex) => {
        if (channelIndex >= numChannels) {
          console.warn(`[EDF Reader] Channel index ${channelIndex} exceeds number of channels ${numChannels}`)
          return
        }
        
        const signalInfo = header.signals[channelIndex]
        const channel = channels[channelIndex]
        
        if (!channel || !channel.samples) {
          console.error(`[EDF Reader] Channel ${channelIndex} is invalid`)
          return
        }
        
        let currentIndex = sampleIndices[channelIndex]
        
        // Check bounds
        if (currentIndex >= channel.samples.length) {
          console.warn(`[EDF Reader] Sample index ${currentIndex} exceeds array length ${channel.samples.length} for channel ${channelIndex}`)
          return
        }
        
        // Determine unit conversion factor based on physical dimension
        const dim = (signalInfo?.physicalDimension || '').trim().toLowerCase()
        let unitScale = 1 // default: already in µV
        
        if (dim === 'uv' || dim === 'µv' || dim === 'microv' || dim === 'microvolts') {
          unitScale = 1 // Already in microvolts
        } else if (dim === 'mv' || dim === 'milliv' || dim === 'millivolts') {
          unitScale = 1_000 // mV → µV
        } else if (dim === 'v' || dim === 'volts' || dim === 'volt') {
          unitScale = 1_000_000 // V → µV
        } else {
          // If dimension is unknown or empty, assume it's already in µV (common for EEG)
          if (dim && dim.length > 0) {
            console.warn(`[EDF Reader] Unknown physical dimension "${dim}" for channel ${channelIndex} (${signalInfo?.label || 'unknown'}), assuming µV`)
          }
          unitScale = 1
        }
        
        // Convert and store samples
        if (!Array.isArray(signalSamples)) {
          console.warn(`[EDF Reader] Signal samples for channel ${channelIndex} is not an array`)
          return
        }
        
        signalSamples.forEach((sample) => {
          // Check bounds before storing
          if (currentIndex >= channel.samples.length) {
            console.warn(`[EDF Reader] Exceeded array bounds for channel ${channelIndex} at index ${currentIndex}`)
            return
          }
          
          // Convert sample to microvolts
          const microvoltSample = sample * unitScale
          
          // Store in Float32Array
          channel.samples[currentIndex] = microvoltSample
          
          // Track statistics (now in µV)
          if (!isNaN(microvoltSample) && isFinite(microvoltSample)) {
            const stats = channelStats[channelIndex]
            stats.min = Math.min(stats.min, microvoltSample)
            stats.max = Math.max(stats.max, microvoltSample)
            stats.sum += microvoltSample
            stats.count++
          }
          
          currentIndex++
        })
        
        sampleIndices[channelIndex] = currentIndex
      })
    })
  } catch (error) {
    console.error('[EDF Reader] Error in second pass (filling Float32Arrays):', error)
    throw error
  }
  
  // Log statistics for first few channels (now all in µV)
  console.log('[EDF Reader] Channel statistics (all values normalized to µV, stored as Float32Array):')
  channelStats.slice(0, Math.min(8, numChannels)).forEach((stats, idx) => {
    const mean = stats.count > 0 ? stats.sum / stats.count : 0
    const signalInfo = header.signals[idx]
    const dim = (signalInfo?.physicalDimension || '').trim()
    const nonZeroCount = channels[idx]?.samples ? Array.from(channels[idx].samples).filter(v => Math.abs(v) > 0.001).length : 0
    const firstFewSamples = channels[idx]?.samples ? Array.from(channels[idx].samples.slice(0, 10)) : []
    const midSamples = channels[idx]?.samples && channels[idx].samples.length > 1000 ? Array.from(channels[idx].samples.slice(1000, 1010)) : []
    
    // Check data at specific time points: 0s, 10s, 20s, 30s, 40s
    const timePoints = [0, 10, 20, 30, 40]
    const timePointData = {}
    const channelSampleRate = channels[idx]?.sampleRate || sampleRate
    if (channels[idx]?.samples && channels[idx].samples.length > 0) {
      timePoints.forEach(timeSec => {
        const sampleIndex = Math.floor(timeSec * channelSampleRate)
        if (sampleIndex < channels[idx].samples.length) {
          const samplesAtTime = Array.from(channels[idx].samples.slice(sampleIndex, Math.min(sampleIndex + 10, channels[idx].samples.length)))
          const statsAtTime = {
            min: Math.min(...samplesAtTime),
            max: Math.max(...samplesAtTime),
            avg: samplesAtTime.reduce((sum, v) => sum + v, 0) / samplesAtTime.length,
            nonZero: samplesAtTime.filter(v => Math.abs(v) > 0.001).length,
            samples: samplesAtTime.slice(0, 5).map(v => v.toFixed(4))
          }
          timePointData[timeSec] = statsAtTime
        }
      })
    }
    
    console.log(`  Channel ${idx} (${signalInfo?.label || 'unknown'}):`, 
      `min=${stats.min.toFixed(4)} µV`,
      `max=${stats.max.toFixed(4)} µV`,
      `mean=${mean.toFixed(4)} µV`,
      `range=${(stats.max - stats.min).toFixed(4)} µV`,
      `nonZero=${nonZeroCount}/${stats.count}`,
      `first10=[${firstFewSamples.map(v => v.toFixed(4)).join(', ')}]`,
      midSamples.length > 0 ? `mid10=[${midSamples.map(v => v.toFixed(4)).join(', ')}]` : '',
      `physicalRange=[${signalInfo?.physicalMin}, ${signalInfo?.physicalMax}] ${dim}`,
      `digitalRange=[${signalInfo?.digitalMin}, ${signalInfo?.digitalMax}]`
    )
    
    // Log time point analysis
    console.log(`  [Time Point Analysis] Channel ${idx} (${signalInfo?.label || 'unknown'}):`)
    Object.keys(timePointData).forEach(timeSec => {
      const data = timePointData[timeSec]
      console.log(`    At ${timeSec}s: min=${data.min.toFixed(4)}, max=${data.max.toFixed(4)}, avg=${data.avg.toFixed(4)}, nonZero=${data.nonZero}/10, samples=[${data.samples.join(', ')}]`)
    })
    
    // Check if first 30 seconds are all zeros/near-zero
    if (channels[idx]?.samples && channels[idx].samples.length > 0) {
      const channelSampleRate = channels[idx]?.sampleRate || sampleRate
      const samples30Sec = Math.floor(30 * channelSampleRate)
      const first30SecSamples = Array.from(channels[idx].samples.slice(0, Math.min(samples30Sec, channels[idx].samples.length)))
      const first30SecNonZero = first30SecSamples.filter(v => Math.abs(v) > 0.001).length
      const first30SecMax = first30SecSamples.length > 0 ? Math.max(...first30SecSamples.map(v => Math.abs(v))) : 0
      
      if (first30SecNonZero === 0 || first30SecMax < 0.01) {
        console.warn(`  ⚠️  Channel ${idx}: First 30 seconds appear to be all zeros/near-zero (max abs value: ${first30SecMax.toFixed(4)} µV, non-zero samples: ${first30SecNonZero}/${first30SecSamples.length})`)
      } else {
        console.log(`  ✓ Channel ${idx}: First 30 seconds contain data (max abs value: ${first30SecMax.toFixed(4)} µV, non-zero samples: ${first30SecNonZero}/${first30SecSamples.length})`)
      }
    }
  })
  
  return channels
}

function convertToPhysical(digital, digitalMin, digitalMax, physicalMin, physicalMax) {
  // Handle edge cases
  if (digitalMax === digitalMin) return 0
  if (isNaN(digital) || isNaN(digitalMin) || isNaN(digitalMax) || isNaN(physicalMin) || isNaN(physicalMax)) {
    console.warn('Invalid conversion parameters:', { digital, digitalMin, digitalMax, physicalMin, physicalMax })
    return 0
  }
  
  // EDF conversion formula: physical = (digital - digitalMin) / (digitalMax - digitalMin) * (physicalMax - physicalMin) + physicalMin
  const physical = ((digital - digitalMin) / (digitalMax - digitalMin)) * (physicalMax - physicalMin) + physicalMin
  
  return physical
}

function readString(dataView, offset, length) {
  let str = ''
  for (let i = 0; i < length; i++) {
    const byte = dataView.getUint8(offset + i)
    if (byte === 0) break
    str += String.fromCharCode(byte)
  }
  return str
}

