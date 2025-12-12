# EEG/EDF Streaming Settings Guide

## Overview

This document explains what each setting does to the EEG/EDF streaming and how it affects the data flow and display.

---

## 1. **Montage (BANANA, 10-20, BIPOLAR, REFERENCE)**

### What It Does:
- **Changes channel labels** displayed on the charts
- Does NOT transform the actual data values
- Only affects how channels are named/identified

### Effect on Streaming:
- **No effect on data streaming** - data flows unchanged
- **Affects display only** - channel names change (e.g., "F3-P3" vs "F3")
- Used for clinical interpretation (different montages show different perspectives)

### Example:
- **BANANA:** Shows "F3-P3", "P3-O1", "F3-T3", etc.
- **10-20:** Shows "F3", "P3", "T3", "O1", etc.
- **BIPOLAR:** Shows "Fp1-F3", "F3-C3", "C3-P3", etc.
- **REFERENCE:** Shows "F3-A1", "P3-A1", "T3-A1", etc.

### Code Location:
- `src/utils/montages.js` - Montage definitions
- `src/components/RawEEGPlot.jsx` line 1072 - Label generation

---

## 2. **LFF (Low Frequency Filter / High-Pass Filter)**

### What It Does:
- **Removes low-frequency components** below the cutoff frequency
- Acts as a **high-pass filter** (allows high frequencies, blocks low)
- Removes slow drifts, DC offset, and very slow artifacts

### Effect on Streaming:
- **Filters data in real-time** during streaming
- Each sample passes through the filter before being added to buffer
- Filter state persists across samples (IIR filter)
- **Removes frequencies below cutoff:**
  - 0.1 Hz: Very aggressive, removes most slow drifts
  - 0.5 Hz: Moderate, removes slow drifts
  - 1.0 Hz: Standard, removes DC and very slow components
  - 5.0 Hz: Light filtering, only removes very slow components

### Technical Details:
- Uses first-order IIR high-pass filter
- Formula: `y[n] = α × (y[n-1] + x[n] - x[n-1])`
- Filter coefficient calculated from cutoff frequency and sample rate

### Example:
- **Before:** Signal has slow 0.05 Hz drift
- **After LFF 1.0 Hz:** Drift removed, signal centered around baseline

### Code Location:
- `src/utils/filters.js` - `applyHighPass()` function
- `src/store/EEGContext.jsx` line 1322 - Applied during EDF streaming
- `src/store/EEGContext.jsx` line 777 - Applied during mock streaming

---

## 3. **HFF (High Frequency Filter / Low-Pass Filter)**

### What It Does:
- **Removes high-frequency components** above the cutoff frequency
- Acts as a **low-pass filter** (allows low frequencies, blocks high)
- Removes high-frequency noise, muscle artifacts, and aliasing

### Effect on Streaming:
- **Filters data in real-time** during streaming
- Applied after high-pass filter
- **Removes frequencies above cutoff:**
  - 15 Hz: Very aggressive, only shows Delta/Theta/Alpha bands
  - 30 Hz: Standard, shows Delta/Theta/Alpha/Beta, removes Gamma
  - 50 Hz: Light filtering, shows most bands, removes very high frequencies
  - 70 Hz: Minimal filtering, shows almost all frequencies

### Technical Details:
- Uses first-order IIR low-pass filter
- Formula: `y[n] = α × x[n] + (1 - α) × y[n-1]`
- Smooths out high-frequency variations

### Example:
- **Before:** Signal has 100 Hz muscle artifact
- **After HFF 30 Hz:** Artifact removed, only frequencies ≤30 Hz remain

### Code Location:
- `src/utils/filters.js` - `applyLowPass()` function
- `src/store/EEGContext.jsx` line 1322 - Applied during EDF streaming
- `src/store/EEGContext.jsx` line 777 - Applied during mock streaming

---

## 4. **Notch Filter (50 Hz or 60 Hz)**

### What It Does:
- **Removes a specific frequency** (typically 50 Hz or 60 Hz)
- Designed to remove **power line interference**
- Very narrow band rejection around the notch frequency

### Effect on Streaming:
- **Filters data in real-time** during streaming
- Applied after high-pass and low-pass filters
- **Removes power line noise:**
  - **50 Hz:** For European/Asian power systems
  - **60 Hz:** For North American power systems
  - **Off:** No notch filtering applied

### Technical Details:
- Uses second-order IIR notch filter
- Very selective - only removes frequencies near the notch frequency
- Quality factor (Q) = 30 (narrow bandwidth)

### Example:
- **Before:** Signal has 60 Hz hum from power lines
- **After Notch 60 Hz:** 60 Hz component removed, signal cleaner

### Code Location:
- `src/utils/filters.js` - `applyNotch()` function
- `src/store/EEGContext.jsx` line 1322 - Applied during EDF streaming
- `src/store/EEGContext.jsx` line 777 - Applied during mock streaming

---

## 5. **Sensitivity (Amplitude Scale: 2.5, 5.0, 10.0, 20.0 μV/mm)**

### What It Does:
- **Controls the vertical scale (Y-axis range)** of the charts
- Determines how much amplitude change corresponds to 1mm on screen
- Higher sensitivity = more zoomed in (smaller range)
- Lower sensitivity = more zoomed out (larger range)

### Effect on Streaming:
- **No effect on data streaming** - data values unchanged
- **Affects display only** - changes Y-axis min/max values
- Controls how much of the signal is visible vertically

### Calculation:
- Standard display: ±20mm per channel
- Y-axis range: `±(20mm / 2) × amplitudeScale`
- **2.5 μV/mm:** ±25 μV range (most zoomed in, shows small signals)
- **5.0 μV/mm:** ±50 μV range (standard)
- **10.0 μV/mm:** ±100 μV range (zoomed out, shows larger signals)
- **20.0 μV/mm:** ±200 μV range (most zoomed out, shows very large signals)

### Example:
- **Before (5.0 μV/mm):** Signal with 30 μV amplitude fits on screen
- **After (2.5 μV/mm):** Same signal appears larger (more zoomed in)
- **After (10.0 μV/mm):** Same signal appears smaller (more zoomed out)

### Code Location:
- `src/components/RawEEGPlot.jsx` lines 79-84 - Y-axis calculation
- `src/components/RawEEGPlot.jsx` lines 397-398 - Y-axis min/max

---

## 6. **Timebase (mm/sec: 1-1000)**

### What It Does:
- **Controls the horizontal time scale AND streaming playback speed**
- Represents how fast the "paper" moves (like old EEG machines)
- Higher timebase = more time compressed (faster playback, more data per screen)
- Lower timebase = less time compressed (slower playback, less data per screen)

### Effect on Streaming:
- **Directly controls streaming rate:**
  - **30mm/sec = 1x speed** (real-time playback)
  - **60mm/sec = 2x speed** (data streams 2x faster)
  - **15mm/sec = 0.5x speed** (data streams 2x slower)
- **Controls visible time range:**
  - Higher timebase = more seconds visible on screen
  - Lower timebase = fewer seconds visible on screen

### Calculation:
- Playback speed: `speed = timebase / 30` (30mm/sec is baseline)
- Adjusted time window: `adjustedWindow = timeWindow × (30 / timebase)`
- Samples per update: `samplesPerUpdate = sampleRate × updateInterval × speed`

### Example:
- **30mm/sec:** 10 seconds of data visible, streams at real-time
- **60mm/sec:** 20 seconds of data visible, streams 2x faster
- **15mm/sec:** 5 seconds of data visible, streams 2x slower

### Code Location:
- `src/store/EEGContext.jsx` lines 1158-1161 - Speed calculation
- `src/store/EEGContext.jsx` lines 1263-1269 - Applied to streaming
- `src/components/RawEEGPlot.jsx` lines 72-77 - Display calculation

---

## 7. **Time Window (seconds: 5-120)**

### What It Does:
- **Controls how many seconds of data are visible** on screen at once
- Determines the horizontal time range displayed
- Works together with timebase to calculate actual visible range

### Effect on Streaming:
- **No direct effect on streaming rate** - data streams at same rate
- **Affects display only** - controls visible time range
- Larger window = more history visible, smaller window = less history visible
- Buffer still maintains last 60 seconds regardless of window size

### Calculation:
- Adjusted window: `adjustedWindow = timeWindow × (30 / timeScale)`
- X-axis range: `[maxTime - offset - adjustedWindow, maxTime - offset]`

### Example:
- **10 seconds:** Shows last 10 seconds of data
- **30 seconds:** Shows last 30 seconds of data
- **60 seconds:** Shows last 60 seconds of data

### Code Location:
- `src/components/RawEEGPlot.jsx` lines 72-77 - Window calculation
- `src/components/RawEEGPlot.jsx` lines 242-273 - X-axis range calculation

---

## Filter Application Order

During streaming, filters are applied in this sequence:

1. **Raw Sample** (from EDF file or mock generator)
2. **↓ High-Pass Filter (LFF)** - Removes low frequencies
3. **↓ Low-Pass Filter (HFF)** - Removes high frequencies
4. **↓ Notch Filter** - Removes 50/60 Hz
5. **↓ Filtered Sample** (added to buffer)
6. **↓ Display** (with sensitivity and timebase/timeWindow applied)

---

## Settings Interaction

### Example Scenario: All Settings Combined

**Settings:**
- Montage: BANANA
- LFF: 1.0 Hz
- HFF: 30 Hz
- Notch: 60 Hz
- Sensitivity: 5.0 μV/mm
- Timebase: 30mm/sec
- Time Window: 10 seconds

**What Happens:**
1. **Data streams** at 1x speed (30mm/sec = real-time)
2. **Each sample filtered:**
   - High-pass removes <1 Hz (drifts)
   - Low-pass removes >30 Hz (noise, muscle)
   - Notch removes 60 Hz (power line)
3. **Filtered data** added to buffer
4. **Chart displays:**
   - Y-axis: ±50 μV range (5.0 μV/mm × 20mm / 2)
   - X-axis: Last 10 seconds visible
   - Labels: "F3-P3", "P3-O1", etc. (BANANA montage)

---

## Summary Table

| Setting | Effect on Streaming | Effect on Display | Data Modified? |
|---------|-------------------|------------------|----------------|
| **Montage** | None | Channel labels | No |
| **LFF (High-Pass)** | Filters data | Smoother signal | Yes |
| **HFF (Low-Pass)** | Filters data | Less noise | Yes |
| **Notch** | Filters data | Removes 50/60 Hz | Yes |
| **Sensitivity** | None | Y-axis range | No |
| **Timebase** | Controls speed | X-axis scale | No (affects rate) |
| **Time Window** | None | Visible range | No |

---

## Key Takeaways

1. **Filters (LFF, HFF, Notch):** Actually modify the data during streaming
2. **Sensitivity:** Only affects display scale, not data values
3. **Timebase:** Controls both streaming speed AND display scale
4. **Time Window:** Only affects visible range, not streaming
5. **Montage:** Only affects labels, not data

All settings work together to provide a complete, filtered, and properly scaled view of the EEG data.
