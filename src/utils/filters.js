/**
 * Digital Filter Utilities for EEG Signal Processing
 * Implements IIR (Infinite Impulse Response) filters for real-time processing
 */

/**
 * Apply a high-pass filter (removes low frequencies)
 * Uses a simple first-order IIR high-pass filter
 * 
 * @param {number} sample - Current sample value
 * @param {number} prevSample - Previous sample value
 * @param {number} prevOutput - Previous filter output
 * @param {number} cutoffFreq - Cutoff frequency in Hz
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {number} Filtered sample value
 */
export function applyHighPass(sample, prevSample, prevOutput, cutoffFreq, sampleRate) {
  if (cutoffFreq <= 0 || cutoffFreq >= sampleRate / 2) {
    return sample // No filtering if cutoff is invalid
  }
  
  // Calculate filter coefficient (RC time constant)
  const rc = 1.0 / (2.0 * Math.PI * cutoffFreq)
  const dt = 1.0 / sampleRate
  const alpha = rc / (rc + dt)
  
  // High-pass filter: y[n] = alpha * (y[n-1] + x[n] - x[n-1])
  return alpha * (prevOutput + sample - prevSample)
}

/**
 * Apply a low-pass filter (removes high frequencies)
 * Uses a simple first-order IIR low-pass filter
 * 
 * @param {number} sample - Current sample value
 * @param {number} prevOutput - Previous filter output
 * @param {number} cutoffFreq - Cutoff frequency in Hz
 * @param {number} sampleRate - Sample rate in Hz
 * @returns {number} Filtered sample value
 */
export function applyLowPass(sample, prevOutput, cutoffFreq, sampleRate) {
  if (cutoffFreq <= 0 || cutoffFreq >= sampleRate / 2) {
    return sample // No filtering if cutoff is invalid
  }
  
  // Calculate filter coefficient
  const rc = 1.0 / (2.0 * Math.PI * cutoffFreq)
  const dt = 1.0 / sampleRate
  const alpha = dt / (rc + dt)
  
  // Low-pass filter: y[n] = alpha * x[n] + (1 - alpha) * y[n-1]
  return alpha * sample + (1 - alpha) * prevOutput
}

/**
 * Apply a notch filter (removes specific frequency, e.g., 60 Hz power line noise)
 * Uses a second-order IIR notch filter
 * 
 * @param {number} sample - Current sample value
 * @param {number} prevSample - Previous sample value
 * @param {number} prevPrevSample - Sample before previous
 * @param {number} prevOutput - Previous filter output
 * @param {number} prevPrevOutput - Output before previous
 * @param {number} notchFreq - Notch frequency in Hz (e.g., 60 for 60 Hz)
 * @param {number} sampleRate - Sample rate in Hz
 * @param {number} quality - Quality factor (bandwidth), default 30
 * @returns {number} Filtered sample value
 */
export function applyNotch(sample, prevSample, prevPrevSample, prevOutput, prevPrevOutput, notchFreq, sampleRate, quality = 30) {
  if (notchFreq <= 0 || notchFreq >= sampleRate / 2) {
    return sample // No filtering if notch frequency is invalid
  }
  
  // Calculate filter coefficients for a notch filter
  const w0 = 2 * Math.PI * notchFreq / sampleRate
  const bw = w0 / quality // Bandwidth
  const cosw0 = Math.cos(w0)
  const sinw0 = Math.sin(w0)
  const alpha = sinw0 * Math.sinh(Math.log(2) / 2 * bw * w0 / sinw0)
  
  const b0 = 1
  const b1 = -2 * cosw0
  const b2 = 1
  const a0 = 1 + alpha
  const a1 = -2 * cosw0
  const a2 = 1 - alpha
  
  // Normalize coefficients
  const norm = a0
  const b0n = b0 / norm
  const b1n = b1 / norm
  const b2n = b2 / norm
  const a1n = a1 / norm
  const a2n = a2 / norm
  
  // Notch filter: y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
  return b0n * sample + b1n * prevSample + b2n * prevPrevSample - a1n * prevOutput - a2n * prevPrevOutput
}

/**
 * Filter state for maintaining filter history across samples
 */
export class FilterState {
  constructor() {
    // High-pass filter state
    this.highPass = {
      prevSample: 0,
      prevOutput: 0
    }
    
    // Low-pass filter state
    this.lowPass = {
      prevOutput: 0
    }
    
    // Notch filter state
    this.notch = {
      prevSample: 0,
      prevPrevSample: 0,
      prevOutput: 0,
      prevPrevOutput: 0
    }
  }
  
  /**
   * Apply all filters in sequence: High-pass -> Low-pass -> Notch
   * 
   * @param {number} sample - Raw sample value
   * @param {Object} filterSettings - Filter settings { highPass, lowPass, notch }
   * @param {number} sampleRate - Sample rate in Hz
   * @returns {number} Fully filtered sample value
   */
  applyFilters(sample, filterSettings, sampleRate) {
    let filtered = sample
    
    // Apply high-pass filter if enabled (> 0)
    if (filterSettings.highPass > 0) {
      filtered = applyHighPass(
        filtered,
        this.highPass.prevSample,
        this.highPass.prevOutput,
        filterSettings.highPass,
        sampleRate
      )
      this.highPass.prevSample = sample
      this.highPass.prevOutput = filtered
    }
    
    // Apply low-pass filter if enabled (> 0 and < Nyquist)
    if (filterSettings.lowPass > 0 && filterSettings.lowPass < sampleRate / 2) {
      filtered = applyLowPass(
        filtered,
        this.lowPass.prevOutput,
        filterSettings.lowPass,
        sampleRate
      )
      this.lowPass.prevOutput = filtered
    }
    
    // Apply notch filter if enabled (> 0)
    if (filterSettings.notch > 0) {
      filtered = applyNotch(
        filtered,
        this.notch.prevSample,
        this.notch.prevPrevSample,
        this.notch.prevOutput,
        this.notch.prevPrevOutput,
        filterSettings.notch,
        sampleRate
      )
      // Update notch filter state
      this.notch.prevPrevSample = this.notch.prevSample
      this.notch.prevSample = sample
      this.notch.prevPrevOutput = this.notch.prevOutput
      this.notch.prevOutput = filtered
    }
    
    return filtered
  }
  
  /**
   * Reset all filter states (useful when starting new stream or changing filters)
   */
  reset() {
    this.highPass = { prevSample: 0, prevOutput: 0 }
    this.lowPass = { prevOutput: 0 }
    this.notch = {
      prevSample: 0,
      prevPrevSample: 0,
      prevOutput: 0,
      prevPrevOutput: 0
    }
  }
}
