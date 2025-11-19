# Testing Instructions for NOTIS EEG Viewer

## Overview

This is a mock ischemia detection viewer for operating room (OR) use. The application simulates real-time EEG monitoring with automatic ischemia detection.

---

## Access Information

**Application URL:** [Your deployment URL will be here]

**Test Environment:** Mock 1 - Simulated EEG data with automatic ischemia events

---

## Quick Start Guide

### 1. Initial Setup

1. **Open the application** in a modern web browser (Chrome, Firefox, Edge, Safari)
2. **Patient Information:**
   - Click the "Edit Patient Information" icon (pencil icon) in the header
   - Enter test patient information:
     - Patient ID: `TEST-001`
     - MRN: `MRN123456`
     - First Name: `Test`
     - Last Name: `Patient`
     - Date of Birth: `01/01/1980`
     - Session Type: `Operating Room`
   - Click "Save"

### 2. Start Monitoring

1. **Click the "▶ Start" button** in the header
2. The EEG stream will begin automatically
3. You should see:
   - Raw EEG waveforms updating in real-time
   - Spectrogram charts updating
   - Recording timer counting up

### 3. Observe Ischemia Detection

- **Automatic Detection:** The system will automatically detect ischemia events starting at approximately 15 seconds
- **Alert Notification:** 
  - Click the bell icon (🔔) in the header to see ischemia alerts
  - Alerts will show start time, end time, duration, and confidence
- **Visual Indicators:**
  - Ischemia regions are highlighted in red on the raw EEG charts
  - Red vertical lines mark ischemia start/end times

### 4. Explore Features

#### Raw EEG Controls:
- **Montage:** Change between BANANA, 10-20, BIPOLAR, REFERENCE
- **Filters:** Adjust Low Frequency Filter (LFF), High Frequency Filter (HFF), Notch Filter
- **Sensitivity:** Change amplitude scale (2.5, 5.0, 10.0, 20.0 μV/mm)
- **Timebase:** Adjust time scale (s/page)
- **Time Window:** Change visible time window (5-120 seconds)
- **Timeline Navigation:** Use the slider to navigate through recorded data

#### Spectrogram:
- **CSA Button:** Toggle Compressed Spectral Array view
- **QDSA Button:** Toggle Quadrant DSA view
- Hover over spectrograms to see time and frequency information

#### Additional Panels:
- **Compact Sidebar:** Click hamburger menu (☰) to show compact EEG views
- **Event Log:** Click list icon (📋) to see chronological event log
- **Settings:** Click gear icon (⚙️) to access all settings

---

## Test Scenarios

### Scenario 1: Basic Monitoring
1. Start the stream
2. Observe normal EEG activity for 10 seconds
3. Wait for automatic ischemia detection (around 15 seconds)
4. Review the ischemia alert in the notification dropdown
5. Click on the alert to navigate to the ischemia event

### Scenario 2: Navigation and Review
1. Start the stream and let it run for 30+ seconds
2. Click "⏹ Stop" to stop recording
3. Use the timeline slider to navigate back to the start
4. Review the ischemia events that occurred
5. Adjust time window to see more/less data at once

### Scenario 3: Settings and Filters
1. Open Settings panel (⚙️ icon)
2. Explore different tabs:
   - **Display:** Adjust channel visibility, amplitude scale, filters
   - **Spectrogram:** Change FFT size, frequency range, colormap
   - **Detection:** Adjust sensitivity and thresholds
   - **Alerts:** Configure alert settings
3. Apply changes and observe effects on the display

### Scenario 4: Channel Management
1. Double-click on any EEG channel to mark it as "bad"
2. Observe the channel label changes to show "[BAD]"
3. The channel will be filtered from display
4. Double-click again to unmark

### Scenario 5: Patient Information
1. Click "Edit Patient Information" icon
2. Update patient details
3. Verify changes are saved and displayed in header
4. Test modal can be closed with X button or Cancel

---

## What to Test

### Functionality
- [ ] Patient information entry and editing
- [ ] Stream start/stop/pause controls
- [ ] Real-time EEG waveform display
- [ ] Ischemia detection and alerts
- [ ] Timeline navigation (slider)
- [ ] Time window and timebase adjustments
- [ ] Filter settings (LFF, HFF, Notch)
- [ ] Montage switching
- [ ] Sensitivity adjustments
- [ ] Spectrogram display and controls
- [ ] CSA/QDSA toggles
- [ ] Event log display
- [ ] Settings panel functionality
- [ ] Bad channel marking
- [ ] Dark/light mode toggle

### User Experience
- [ ] Interface is intuitive and easy to navigate
- [ ] Controls are responsive
- [ ] Visual feedback is clear
- [ ] Alerts are noticeable
- [ ] Information is easy to find
- [ ] Layout works on different screen sizes

### Clinical Workflow
- [ ] Can quickly identify ischemia events
- [ ] Patient information is easily accessible
- [ ] Settings can be adjusted during monitoring
- [ ] Historical data can be reviewed
- [ ] Events can be correlated with timeline

---

## Known Limitations (Mock Environment)

1. **Simulated Data:** All EEG data is simulated, not from real patients
2. **Automatic Events:** Ischemia events are automatically generated at fixed intervals
3. **No Real Device:** No actual EEG device connection
4. **Export Disabled:** Export functionality has been temporarily disabled
5. **No Baseline:** Baseline establishment feature not yet implemented

---

## Feedback Collection

Please provide feedback on:

1. **Usability:** Is the interface easy to use? Any confusing elements?
2. **Functionality:** Do all features work as expected? Any bugs?
3. **Clinical Relevance:** Does this meet your clinical needs? What's missing?
4. **Performance:** Is the application responsive? Any lag or freezing?
5. **Visual Design:** Is the display clear? Any visibility issues?
6. **Workflow:** Does it fit your workflow? What would improve it?

---

## Browser Compatibility

Tested and recommended browsers:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)

**Minimum Requirements:**
- Modern browser with JavaScript enabled
- Screen resolution: 1280x720 or higher
- Internet connection (for initial load)

---

## Support

For issues or questions:
- Check the browser console (F12) for error messages
- Review the feedback document: `NEUROLOGIST_FEEDBACK.md`
- Document any bugs with:
  - Steps to reproduce
  - Expected behavior
  - Actual behavior
  - Browser and OS information

---

## Test Duration

Recommended testing time: **30-60 minutes**

This allows you to:
- Explore all major features
- Test different scenarios
- Observe multiple ischemia events
- Provide comprehensive feedback

---

## Thank You!

Your feedback is valuable for improving this application for clinical use. Please test thoroughly and provide detailed feedback.

