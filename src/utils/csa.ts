// @ts-ignore - fft-js uses CommonJS
import * as fftjs from 'fft-js'
const { fft } = fftjs

export interface CSAConfig {
  windowSeconds: number
  stepSeconds: number
  maxFreqHz: number
  numFreqBins: number
}

export interface CSASlice {
  timeSec: number
  freqBins: Float32Array
  sef95Hz: number
}

export interface CSAResult {
  slices: CSASlice[]
  freqAxisHz: number[]
}

const DEFAULT_CONFIG: CSAConfig = {
  windowSeconds: 2,
  stepSeconds: 1,
  maxFreqHz: 30,
  numFreqBins: 64,
}

/**
 * Apply Hamming window to a signal segment
 */
function applyHammingWindow(signal: Float32Array): Float32Array {
  const windowed = new Float32Array(signal.length)
  for (let i = 0; i < signal.length; i++) {
    const windowValue = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (signal.length - 1))
    windowed[i] = signal[i] * windowValue
  }
  return windowed
}

/**
 * Compute log-spaced frequency bins
 */
function createLogFreqBins(maxFreqHz: number, numBins: number): number[] {
  const fMin = 0.1
  const fMax = maxFreqHz
  const bins: number[] = []
  
  for (let i = 0; i < numBins; i++) {
    const ratio = i / (numBins - 1)
    const freq = fMin * Math.pow(fMax / fMin, ratio)
    bins.push(freq)
  }
  
  return bins
}

/**
 * Map frequency to bin index using log spacing
 */
function freqToBinIndex(freq: number, freqAxis: number[]): number {
  if (freq <= freqAxis[0]) return 0
  if (freq >= freqAxis[freqAxis.length - 1]) return freqAxis.length - 1
  
  // Binary search for closest bin
  let left = 0
  let right = freqAxis.length - 1
  
  while (right - left > 1) {
    const mid = Math.floor((left + right) / 2)
    if (freqAxis[mid] < freq) {
      left = mid
    } else {
      right = mid
    }
  }
  
  // Return the closer bin
  return Math.abs(freq - freqAxis[left]) < Math.abs(freq - freqAxis[right]) ? left : right
}

/**
 * Compute Spectral Edge Frequency (SEF95)
 */
function computeSEF95(powerSpectrum: Float32Array, freqArray: number[], maxFreqHz: number): number {
  // Find indices within 0-maxFreqHz range
  const validIndices: number[] = []
  const validPowers: number[] = []
  
  for (let i = 0; i < freqArray.length && i < powerSpectrum.length; i++) {
    if (freqArray[i] <= maxFreqHz) {
      validIndices.push(i)
      validPowers.push(powerSpectrum[i])
    }
  }
  
  if (validPowers.length === 0) return 0
  
  const totalPower = validPowers.reduce((sum, p) => sum + p, 0)
  if (totalPower === 0) return 0
  
  const targetPower = 0.95 * totalPower
  let cumulativePower = 0
  
  for (let i = 0; i < validIndices.length; i++) {
    cumulativePower += validPowers[i]
    if (cumulativePower >= targetPower) {
      return freqArray[validIndices[i]]
    }
  }
  
  return freqArray[validIndices[validIndices.length - 1]] || 0
}

/**
 * Compute CSA (Compressed Spectral Array) for a signal
 */
export function computeCSA(
  signal: Float32Array,
  samplingRate: number,
  config?: Partial<CSAConfig>
): CSAResult {
  const cfg: CSAConfig = { ...DEFAULT_CONFIG, ...config }
  
  const windowSamples = Math.floor(cfg.windowSeconds * samplingRate)
  const stepSamples = Math.floor(cfg.stepSeconds * samplingRate)
  
  console.log('[computeCSA] Input:', {
    signalLength: signal.length,
    samplingRate,
    windowSamples,
    stepSamples,
    minRequired: windowSamples
  })
  
  if (windowSamples < 2 || signal.length < windowSamples) {
    console.warn('[computeCSA] Insufficient data:', {
      signalLength: signal.length,
      windowSamples,
      required: windowSamples
    })
    return { slices: [], freqAxisHz: [] }
  }
  
  // Create log-spaced frequency axis
  const freqAxisHz = createLogFreqBins(cfg.maxFreqHz, cfg.numFreqBins)
  
  const slices: CSASlice[] = []
  
  // Process overlapping windows
  for (let startIdx = 0; startIdx <= signal.length - windowSamples; startIdx += stepSamples) {
    const window = signal.slice(startIdx, startIdx + windowSamples)
    
    // Apply Hamming window
    const windowed = applyHammingWindow(window)
    
    // Zero-pad to next power of 2 for FFT
    const fftSize = Math.pow(2, Math.ceil(Math.log2(windowSamples)))
    const padded = new Float32Array(fftSize)
    windowed.forEach((val, i) => { padded[i] = val })
    
    // Convert to complex array for FFT
    const complex = padded.map(val => [val, 0])
    
    // Compute FFT
    const fftResult = fft(complex)
    
    // Compute power spectrum (only positive frequencies)
    const numFreqPoints = Math.floor(fftSize / 2)
    const powerSpectrum = new Float32Array(numFreqPoints)
    const freqResolution = samplingRate / fftSize
    
    for (let i = 0; i < numFreqPoints; i++) {
      const real = fftResult[i][0]
      const imag = fftResult[i][1]
      const power = real * real + imag * imag
      powerSpectrum[i] = power
    }
    
    // Map to log-spaced bins
    const freqBins = new Float32Array(cfg.numFreqBins)
    
    for (let i = 0; i < numFreqPoints; i++) {
      const freq = i * freqResolution
      if (freq > cfg.maxFreqHz) break
      
      const binIdx = freqToBinIndex(freq, freqAxisHz)
      if (binIdx >= 0 && binIdx < cfg.numFreqBins) {
        // Use log power
        const logPower = Math.log10(powerSpectrum[i] + 1e-12)
        freqBins[binIdx] += logPower
      }
    }
    
    // Compute SEF95 from power spectrum
    const freqArray = Array.from({ length: numFreqPoints }, (_, i) => i * freqResolution)
    const sef95Hz = computeSEF95(powerSpectrum, freqArray, cfg.maxFreqHz)
    
    // Center time of this window
    const timeSec = (startIdx + windowSamples / 2) / samplingRate
    
    slices.push({
      timeSec,
      freqBins,
      sef95Hz,
    })
  }
  
  // Normalize log power across all slices for this channel
  if (slices.length > 0) {
    let minLogPower = Infinity
    let maxLogPower = -Infinity
    
    slices.forEach(slice => {
      slice.freqBins.forEach(power => {
        if (power > 0) {
          minLogPower = Math.min(minLogPower, power)
          maxLogPower = Math.max(maxLogPower, power)
        }
      })
    })
    
    const range = maxLogPower - minLogPower || 1
    
    slices.forEach(slice => {
      for (let i = 0; i < slice.freqBins.length; i++) {
        if (slice.freqBins[i] > 0) {
          slice.freqBins[i] = (slice.freqBins[i] - minLogPower) / range
        }
      }
    })
  }
  
  return { slices, freqAxisHz }
}

/**
 * DSA Configuration - uses linear frequency scale and preserves absolute power
 */
export interface DSAConfig {
  windowSeconds: number
  stepSeconds: number
  maxFreqHz: number
  freqResolutionHz?: number // Optional: frequency resolution (default: 0.5 Hz)
}

export interface DSASlice {
  timeSec: number
  powerSpectrum: Float32Array // Power spectral density in dB μV²/Hz
  freqAxisHz: number[] // Linear frequency axis
  sef95Hz: number
  minPower: number // Min power in dB μV²/Hz for this slice
  maxPower: number // Max power in dB μV²/Hz for this slice
}

export interface DSAResult {
  slices: DSASlice[]
  freqAxisHz: number[] // Linear frequency axis
  globalMinPower: number // Global min power in dB μV²/Hz across all slices
  globalMaxPower: number // Global max power in dB μV²/Hz across all slices
}

const DEFAULT_DSA_CONFIG: DSAConfig = {
  windowSeconds: 2,
  stepSeconds: 1,
  maxFreqHz: 30,
  freqResolutionHz: 0.5, // 0.5 Hz resolution for full density
}

/**
 * Compute DSA (Density Spectral Array) for a signal
 * DSA shows power spectral density in dB μV²/Hz
 * Power is normalized by frequency resolution to get spectral density, then converted to dB
 */
export function computeDSA(
  signal: Float32Array,
  samplingRate: number,
  config?: Partial<DSAConfig>
): DSAResult {
  const cfg: DSAConfig = { ...DEFAULT_DSA_CONFIG, ...config }
  
  const windowSamples = Math.floor(cfg.windowSeconds * samplingRate)
  const stepSamples = Math.floor(cfg.stepSeconds * samplingRate)
  
  if (windowSamples < 2 || signal.length < windowSamples) {
    return { slices: [], freqAxisHz: [], globalMinPower: -100, globalMaxPower: 0 }
  }
  
  // Create linear frequency axis (0 to maxFreqHz with specified resolution)
  const freqResolution = cfg.freqResolutionHz || 0.5
  const numFreqBins = Math.ceil(cfg.maxFreqHz / freqResolution) + 1
  const freqAxisHz: number[] = []
  for (let i = 0; i < numFreqBins; i++) {
    freqAxisHz.push(i * freqResolution)
  }
  
  const slices: DSASlice[] = []
  let globalMinPower = Infinity
  let globalMaxPower = -Infinity
  
  // Process overlapping windows
  for (let startIdx = 0; startIdx <= signal.length - windowSamples; startIdx += stepSamples) {
    const window = signal.slice(startIdx, startIdx + windowSamples)
    
    // Apply Hamming window
    const windowed = applyHammingWindow(window)
    
    // Zero-pad to next power of 2 for FFT
    const fftSize = Math.pow(2, Math.ceil(Math.log2(windowSamples)))
    const padded = new Float32Array(fftSize)
    windowed.forEach((val, i) => { padded[i] = val })
    
    // Convert to complex array for FFT
    const complex = padded.map(val => [val, 0])
    
    // Compute FFT
    const fftResult = fft(complex)
    
    // Compute power spectrum (only positive frequencies, in μV²)
    const numFreqPoints = Math.floor(fftSize / 2)
    const powerSpectrum = new Float32Array(numFreqBins)
    const fftFreqResolution = samplingRate / fftSize
    
    // Map FFT frequencies to linear frequency bins
    for (let i = 0; i < numFreqPoints; i++) {
      const freq = i * fftFreqResolution
      if (freq > cfg.maxFreqHz) break
      
      const real = fftResult[i][0]
      const imag = fftResult[i][1]
      const power = real * real + imag * imag // Power in μV² (assuming input is in μV)
      
      // Find the closest bin in linear frequency axis
      const binIdx = Math.round(freq / freqResolution)
      if (binIdx >= 0 && binIdx < numFreqBins) {
        powerSpectrum[binIdx] += power
      }
    }
    
    // Convert to power spectral density (μV²/Hz) by dividing by frequency resolution
    // Then convert to dB: 10 * log10(powerDensity)
    const powerSpectralDensity = new Float32Array(numFreqBins)
    for (let i = 0; i < numFreqBins; i++) {
      if (powerSpectrum[i] > 0) {
        // Normalize by frequency resolution to get spectral density
        const psd = powerSpectrum[i] / freqResolution
        // Convert to dB: 10 * log10(psd)
        // Use a small epsilon to avoid log(0)
        const dbPower = 10 * Math.log10(Math.max(psd, 1e-10))
        powerSpectralDensity[i] = dbPower
      } else {
        powerSpectralDensity[i] = -100 // Set to minimum dB value for zero power
      }
    }
    
    // Compute SEF95 from original FFT power spectrum
    const fftPowerSpectrum = new Float32Array(numFreqPoints)
    const fftFreqArray: number[] = []
    for (let i = 0; i < numFreqPoints; i++) {
      const freq = i * fftFreqResolution
      if (freq > cfg.maxFreqHz) break
      const real = fftResult[i][0]
      const imag = fftResult[i][1]
      fftPowerSpectrum[i] = real * real + imag * imag
      fftFreqArray.push(freq)
    }
    const sef95Hz = computeSEF95(fftPowerSpectrum, fftFreqArray, cfg.maxFreqHz)
    
    // Find min/max power for this slice (in dB)
    let minPower = Infinity
    let maxPower = -Infinity
    for (let i = 0; i < powerSpectralDensity.length; i++) {
      const dbPower = powerSpectralDensity[i]
      if (isFinite(dbPower)) {
        minPower = Math.min(minPower, dbPower)
        maxPower = Math.max(maxPower, dbPower)
      }
    }
    
    if (minPower < Infinity) {
      globalMinPower = Math.min(globalMinPower, minPower)
      globalMaxPower = Math.max(globalMaxPower, maxPower)
    }
    
    // Center time of this window
    const timeSec = (startIdx + windowSamples / 2) / samplingRate
    
    slices.push({
      timeSec,
      powerSpectrum: powerSpectralDensity, // Power spectral density in dB μV²/Hz
      freqAxisHz: freqAxisHz.slice(), // Copy of frequency axis
      sef95Hz,
      minPower: minPower < Infinity ? minPower : -100,
      maxPower: maxPower > -Infinity ? maxPower : 0,
    })
  }
  
  // Clamp global power range to reasonable dB values
  const clampedMinPower = globalMinPower < Infinity ? Math.max(globalMinPower, -100) : -100
  const clampedMaxPower = globalMaxPower > -Infinity ? Math.min(globalMaxPower, 0) : 0
  
  return {
    slices,
    freqAxisHz,
    globalMinPower: clampedMinPower,
    globalMaxPower: clampedMaxPower > clampedMinPower ? clampedMaxPower : clampedMinPower + 1,
  }
}

