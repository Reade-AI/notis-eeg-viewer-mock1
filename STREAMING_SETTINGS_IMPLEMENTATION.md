# EEG Streaming Settings Implementation

## Overview

All UI settings now control the EEG streaming behavior. The streaming respects:
1. **Montage** (BANANA, 10-20, BIPOLAR, REFERENCE)
2. **LFF** (Low Frequency Filter / High-Pass Filter)
3. **HFF** (High Frequency Filter / Low-Pass Filter)
4. **Notch Filter** (50 Hz or 60 Hz)
5. **Sensitivity** (Amplitude Scale in μV/mm)
6. **Timebase** (mm/sec - controls streaming rate)
7. **Time Window** (seconds - controls visible range)

## Implementation Details

### 1. Digital Filters Applied During Streaming

**Location:** `src/utils/filters.js` (new file)

**Filters Implemented:**
- **High-Pass Filter (LFF):** Removes low frequencies below cutoff
- **Low-Pass Filter (HFF):** Removes high frequencies above cutoff
- **Notch Filter:** Removes specific frequency (50/60 Hz for power line noise)

**Filter Application:**
- Filters are applied **during streaming** in real-time
- Each channel maintains its own filter state
- Filters are applied in sequence: High-pass → Low-pass → Notch
- Filter states persist across samples for proper IIR filtering

**Code Location:**
- EDF Streaming: `src/store/EEGContext.jsx` lines 1298-1318
- Mock Streaming: `src/store/EEGContext.jsx` lines 743-776

### 2. Sensitivity (Amplitude Scale) Applied to Y-Axis

**Location:** `src/components/RawEEGPlot.jsx`

**Implementation:**
- Y-axis range now calculated from `amplitudeScale` setting
- Formula: `yAxisMax = (displayRangeMM / 2) * amplitudeScale`
- Standard display: ±20mm per channel
- Example: 5.0 μV/mm → ±50 μV range, 2.5 μV/mm → ±25 μV range

**Code Location:**
- `src/components/RawEEGPlot.jsx` lines 78-82 (calculation)
- `src/components/RawEEGPlot.jsx` lines 390-391 (Y-axis min/max)

### 3. Timebase Controls Streaming Rate

**Location:** `src/store/EEGContext.jsx`

**Implementation:**
- Timebase (timeScale) now controls playback speed
- 30mm/sec = 1x speed (real-time)
- 60mm/sec = 2x speed (2x faster)
- 15mm/sec = 0.5x speed (2x slower)
- Formula: `playbackSpeed = timeScale / 30`

**Code Location:**
- `src/store/EEGContext.jsx` lines 1156-1161 (calculation)
- `src/store/EEGContext.jsx` lines 1263-1269 (application)

### 4. Time Window Controls Visible Range

**Location:** `src/components/RawEEGPlot.jsx`

**Implementation:**
- Time Window setting controls how much data is visible
- Works with Timebase to calculate adjusted time window
- Formula: `adjustedTimeWindow = timeWindow * (30 / timeScale)`
- Chart X-axis min/max calculated from timeWindow and timeOffset

**Code Location:**
- `src/components/RawEEGPlot.jsx` lines 72-77 (calculation)
- `src/components/RawEEGPlot.jsx` lines 242-273 (X-axis range)

### 5. Montage Affects Display Labels

**Location:** `src/utils/montages.js`, `src/components/RawEEGPlot.jsx`

**Implementation:**
- Montage setting changes channel labels
- BANANA, 10-20, BIPOLAR, REFERENCE all supported
- Labels update immediately when montage changes
- Montage is primarily for display/naming (not data transformation)

**Code Location:**
- `src/components/RawEEGPlot.jsx` line 1072 (label generation)

## Settings Flow

### During EDF Streaming:

1. **Data Extraction:**
   - Samples extracted from EDF file at rate controlled by timebase
   - Sample rate from EDF file (typically 250 Hz)

2. **Filter Application:**
   - Each sample passes through filters in sequence
   - High-pass → Low-pass → Notch
   - Filter state maintained per channel

3. **Buffer Update:**
   - Filtered samples added to buffer with timestamps
   - Buffer respects timeWindow setting (keeps last 60 seconds)

4. **Display:**
   - Chart uses amplitudeScale for Y-axis range
   - Chart uses timeWindow and timeScale for X-axis range
   - Montage affects channel labels

### During Mock Streaming:

1. **Signal Generation:**
   - Mock EEG signals generated with frequency components
   - Signals include Delta, Theta, Alpha, Beta, Gamma bands

2. **Filter Application:**
   - Same filter pipeline as EDF streaming
   - Filters applied to generated signals

3. **Buffer Update:**
   - Same as EDF streaming

4. **Display:**
   - Same as EDF streaming

## Settings Summary

| Setting | Applied To | Effect |
|---------|-----------|--------|
| **Montage** | Display | Changes channel labels (F3-P3, etc.) |
| **LFF (High-Pass)** | Streaming | Removes frequencies below cutoff |
| **HFF (Low-Pass)** | Streaming | Removes frequencies above cutoff |
| **Notch** | Streaming | Removes 50/60 Hz power line noise |
| **Sensitivity** | Display | Controls Y-axis range (amplitude scale) |
| **Timebase** | Streaming | Controls playback speed (30mm/sec = 1x) |
| **Time Window** | Display | Controls visible time range |

## Technical Notes

### Filter Implementation

- Uses IIR (Infinite Impulse Response) filters for real-time processing
- Filter states persist across samples for proper frequency response
- Filters reset when streaming starts
- Filter coefficients calculated from cutoff frequencies and sample rate

### Performance Considerations

- Filters applied during streaming (not post-processing)
- Minimal performance impact (simple IIR calculations)
- Filter states stored per channel
- No additional memory overhead for filtered data

### Settings Persistence

- All settings stored in `EEGContext` state
- Settings persist during streaming
- Settings can be changed during streaming (filters reapply immediately)
- Settings reset when switching between EDF and mock streaming

## Testing

To verify settings are applied:

1. **Filters:** Change LFF/HFF/Notch and observe signal changes
2. **Sensitivity:** Change sensitivity and observe Y-axis range changes
3. **Timebase:** Change timebase and observe streaming speed changes
4. **Time Window:** Change time window and observe visible range changes
5. **Montage:** Change montage and observe label changes

All settings should take effect immediately during streaming.
