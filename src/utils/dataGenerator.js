// Mock EEG data generator
// Simulates realistic EEG signals with various frequency components

const SAMPLE_RATE = 250 // Hz
const NUM_CHANNELS = 8

// Generate mock EEG data for a single time point
export function generateMockEEGData(time) {
  const samples = []
  
  for (let channel = 0; channel < NUM_CHANNELS; channel++) {
    let signal = 0
    
    // Add different frequency components
    // Delta (0.5-4 Hz)
    signal += 5 * Math.sin(2 * Math.PI * 2 * time + channel * 0.5)
    
    // Theta (4-8 Hz)
    signal += 3 * Math.sin(2 * Math.PI * 6 * time + channel * 0.3)
    
    // Alpha (8-13 Hz)
    signal += 4 * Math.sin(2 * Math.PI * 10 * time + channel * 0.2)
    
    // Beta (13-30 Hz)
    signal += 2 * Math.sin(2 * Math.PI * 20 * time + channel * 0.1)
    
    // Gamma (30-100 Hz) - lower amplitude
    signal += 1 * Math.sin(2 * Math.PI * 40 * time + channel * 0.05)
    
    // Add some noise
    signal += (Math.random() - 0.5) * 2
    
    // Simulate ischemia effect (reduced amplitude, frequency shift)
    if (time > 5 && time < 8) {
      signal *= 0.3 // Reduced amplitude during ischemia
      signal += 2 * Math.sin(2 * Math.PI * 1.5 * time) // More delta activity
    }
    
    // Add channel-specific variations
    signal += Math.sin(2 * Math.PI * 0.1 * time + channel) * 2
    
    samples.push(signal)
  }
  
  return samples
}

// Generate initial buffer of data
export function generateInitialBuffer(duration = 10) {
  const buffer = []
  const numSamples = duration * SAMPLE_RATE
  
  for (let i = 0; i < numSamples; i++) {
    const time = i / SAMPLE_RATE
    buffer.push({
      time,
      samples: generateMockEEGData(time)
    })
  }
  
  return buffer
}

