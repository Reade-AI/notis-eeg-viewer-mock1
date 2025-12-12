# Timebase Streaming Update

## Changes Made

### 1. **UI Label Updated**
- Changed timebase label from `s/page` to `mm/sec` in `RawEEGPlot.jsx`
- This reflects the clinical EEG terminology where paper speed is measured in millimeters per second

### 2. **Streaming Rate Now Matches Timebase**

The EDF streaming rate now adjusts based on the timebase (timeScale) setting:

**Implementation:**
- **Base speed:** 30mm/sec = 1x playback speed (standard EEG paper speed)
- **Speed calculation:** `playbackSpeed = timeScale / 30`
  - 30mm/sec → 1x speed (real-time)
  - 60mm/sec → 2x speed (2x faster)
  - 15mm/sec → 0.5x speed (2x slower)

**Code Changes:**
```javascript
// Calculate playback speed based on timebase
const baseTimeScale = 30 // 30mm/sec = 1x speed
const currentTimeScale = currentState.settings.display.timeScale || baseTimeScale
const timebasePlaybackSpeed = currentTimeScale / baseTimeScale
const effectivePlaybackSpeed = playbackSpeed * timebasePlaybackSpeed

// Apply to samples per update
const samplesPerUpdate = Math.floor((sampleRate * updateInterval * effectivePlaybackSpeed) / 1000)
```

### 3. **Dynamic Timebase Adjustment**

The streaming rate updates dynamically if the timebase is changed during playback:
- Recalculates `effectivePlaybackSpeed` each frame
- Adjusts `samplesPerUpdate` accordingly
- Time progression automatically matches the new timebase

## How It Works

### Example: 30mm/sec (Default)
- Timebase: 30mm/sec
- Playback speed: 1x (real-time)
- Samples per update: ~8 samples (at 250 Hz, 30 FPS)
- Time increment: ~0.032 seconds per frame

### Example: 60mm/sec (2x Speed)
- Timebase: 60mm/sec
- Playback speed: 2x (twice real-time)
- Samples per update: ~16 samples (at 250 Hz, 30 FPS)
- Time increment: ~0.064 seconds per frame
- **Result:** EDF data streams 2x faster through time

### Example: 15mm/sec (0.5x Speed)
- Timebase: 15mm/sec
- Playback speed: 0.5x (half real-time)
- Samples per update: ~4 samples (at 250 Hz, 30 FPS)
- Time increment: ~0.016 seconds per frame
- **Result:** EDF data streams 2x slower through time

## Benefits

1. **Consistent Experience:** The timebase setting now controls both display and streaming rate
2. **Clinical Standard:** Uses standard EEG terminology (mm/sec)
3. **Flexible Playback:** Users can speed up or slow down EDF playback by adjusting timebase
4. **Real-time Matching:** At 30mm/sec, playback matches real-time (1x speed)

## Technical Details

- **Update frequency:** Still 30 FPS for smooth rendering
- **Sample rate:** Uses the EDF file's native sample rate (typically 250 Hz)
- **Time calculation:** `timeIncrement = samplesToAdd / sampleRate`
- **Speed multiplier:** Applied to `samplesPerUpdate`, not `timeIncrement`

The implementation ensures that changing the timebase immediately affects the streaming rate, providing a seamless experience where the display speed matches the data streaming speed.
