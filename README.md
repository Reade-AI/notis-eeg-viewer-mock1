# EEG Ischemia Viewer

A comprehensive React.js application for real-time EEG monitoring with ischemia detection, designed for use in OR/ER/ICU environments.

## Features

### Core Functionality

1. **Real-time Raw EEG Visualization**
   - Multi-channel waveform display (8 channels)
   - Individual charts per channel in a grid layout
   - Configurable amplitude and time scaling
   - Channel visibility toggles
   - Color modes (channel colors or grayscale)
   - Digital filters (HP/LP/Notch)

2. **Spectrogram Analysis**
   - Per-channel frequency-domain visualization
   - Configurable FFT size, window length, and frequency range
   - Adjustable colormap, intensity, and contrast
   - Real-time updates synchronized with EEG data

3. **Ischemia Detection & Visualization**
   - Automatic ischemia event detection (mock implementation)
   - Visual indicators:
     - Red vertical lines marking start and end of events
     - Red highlighting of EEG segments during ischemia
     - Confidence scores
   - Configurable sensitivity and thresholds
   - Minimum duration requirements

4. **Comprehensive Settings Panel**
   - **Display Settings**: Channel visibility, scaling, filters, color modes
   - **Spectrogram Settings**: FFT parameters, frequency range, colormap
   - **Detection Settings**: Sensitivity, thresholds, visualization options
   - **Alert Settings**: Audio/visual notifications, severity levels
   - **Recording Settings**: Start/stop recording, replay, export
   - **Patient Settings**: Patient ID, MRN, session type, device config
   - **System Settings**: Refresh rate, buffer size, device connectivity

5. **Alert System**
   - On-screen notifications for ischemia events
   - Audio alerts (configurable volume)
   - Severity-based filtering
   - Cooldown periods to prevent alert fatigue

6. **Status Monitoring**
   - Device connection status
   - Streaming status
   - Recording status
   - Patient information display

7. **Theme Support**
   - Light and dark modes
   - Smooth theme transitions
   - Theme-aware color schemes throughout

## Architecture

### State Management

The application uses React Context API for centralized state management:

- **EEGContext**: Manages all application state including:
  - EEG data buffer (time-series for 8 channels)
  - Ischemia events
  - Settings (display, spectrogram, detection, alerts, etc.)
  - UI state (theme, panel visibility)

### Component Structure

```
src/
├── store/
│   └── EEGContext.jsx       # Centralized state management
├── components/
│   ├── HeaderBar.jsx        # Top status bar with patient info
│   ├── RawEEGPlot.jsx       # Multi-channel waveform viewer
│   ├── Spectrogram.jsx      # Frequency-domain visualization
│   ├── SettingsPanel.jsx    # Comprehensive settings interface
│   └── AlertBanner.jsx      # Ischemia event notifications
├── utils/
│   └── dataGenerator.js     # Mock EEG data generation
├── App.jsx                  # Main application component
└── main.jsx                 # Application entry point
```

### Data Flow

1. **Mock Stream**: `EEGContext` generates mock EEG samples at configurable refresh rate
2. **Detection**: Mock ischemia detection runs periodically, creating events based on sensitivity settings
3. **Visualization**: Components subscribe to context updates and render accordingly
4. **Settings**: All settings are stored in context and immediately affect visualization

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The application will start on `http://localhost:5173`

## Usage

### Basic Operation

1. **Start Monitoring**: The application automatically starts streaming when the device is connected (simulated)
2. **View Waveforms**: Left panel shows real-time EEG waveforms for all visible channels
3. **View Spectrograms**: Right panel shows frequency-domain analysis
4. **Configure Settings**: Click the settings icon (⚙️) in the header to open the settings panel
5. **Monitor Alerts**: Ischemia events trigger on-screen and audio alerts (if enabled)

### Settings Configuration

#### Display Settings
- Toggle channel visibility to focus on specific channels
- Adjust amplitude scale (μV/mm) and time scale (mm/sec)
- Configure digital filters (High Pass, Low Pass, Notch)
- Switch between channel colors and grayscale modes

#### Spectrogram Settings
- Select channel for detailed analysis
- Adjust FFT size and window length for resolution vs. latency tradeoff
- Configure frequency range and colormap
- Fine-tune intensity and contrast

#### Detection Settings
- Adjust sensitivity slider (0-100%)
- Configure detection thresholds
- Set minimum event duration
- Toggle visualization features (lines, red segments, confidence)

#### Alert Settings
- Enable/disable audio and visual alerts
- Configure volume and repeat intervals
- Set severity level filters
- Adjust cooldown periods

## Mock Data

The application includes a mock data generator that simulates:
- 8 EEG channels with realistic frequency components (Delta, Theta, Alpha, Beta, Gamma)
- Ischemia effects (reduced amplitude, frequency shifts)
- Real-time streaming at configurable rates

## Integration with Real Data

To integrate with real EEG hardware:

1. **Replace Data Source**: Update `EEGContext.jsx` to connect to your EEG API/stream
2. **Implement Real Detection**: Replace mock detection logic with your ML model or signal processing pipeline
3. **Device Integration**: Update device connection logic in system settings
4. **Export Functions**: Implement actual export functionality in recording settings

## Technologies

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Chart.js / react-chartjs-2** - Waveform visualization
- **Canvas API** - Spectrogram rendering
- **Context API** - State management

## Browser Support

Modern browsers with ES6+ support:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

MIT
