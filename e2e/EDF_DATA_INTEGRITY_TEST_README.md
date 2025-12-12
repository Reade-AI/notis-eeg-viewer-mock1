# EDF Data Integrity E2E Test

## Overview

This end-to-end test verifies that EDF files are loaded and streamed correctly with comprehensive data integrity monitoring.

## Test File

`e2e/edf-data-integrity.spec.js`

## What It Tests

### Test 1: EDF Data Streaming Integrity

1. **EDF File Upload**
   - Verifies EDF file exists
   - Uploads the file to the application
   - Waits for file parsing (up to 60 seconds for large files)
   - Verifies successful load

2. **Data Integrity Monitoring**
   - Checks for `[EDF DATA MONITOR]` console logs
   - Verifies monitoring initialization
   - Looks for data integrity reports (every 5 seconds of EDF time)
   - Checks for sample value validations
   - Verifies time point validations

3. **Streaming Verification**
   - Verifies streaming starts (auto or manual)
   - Monitors streaming progress logs
   - Checks for buffer updates
   - Verifies sample data is being processed

4. **Error Detection**
   - Checks for critical errors
   - Verifies no data corruption warnings
   - Ensures no EDF-related errors

### Test 2: Timebase 60mm/sec Speed Verification

1. **Timebase Setting**
   - Sets timebase to 60mm/sec
   - Verifies timebase monitoring logs

2. **Speed Verification**
   - Monitors for `[TIMEBASE MONITOR]` logs
   - Checks for 2x speed verification
   - Verifies pass/fail status

## Console Log Monitoring

The test monitors these console log prefixes:

- `[EDF DATA MONITOR]` - Data integrity monitoring
- `[TIMEBASE MONITOR]` - Timebase speed monitoring  
- `[startEDFStream]` - Streaming progress
- `[loadEDFFile]` - File loading
- `[readEDFFile]` - File parsing

## Expected Results

### Pass Criteria

1. ✓ EDF file loads successfully
2. ✓ Streaming starts (auto or manual)
3. ✓ Data integrity monitoring is active
4. ✓ No critical errors
5. ✓ Sample data is being processed

### Optional (May Need Longer Test)

- Data integrity reports (appear every 5 seconds of EDF time)
- Sample value validations
- Time point validations

## Running the Test

```bash
# Run the test
npm run test:e2e -- e2e/edf-data-integrity.spec.js

# Run with UI (interactive)
npm run test:e2e:ui -- e2e/edf-data-integrity.spec.js

# Run in headed mode (see browser)
npm run test:e2e:headed -- e2e/edf-data-integrity.spec.js
```

## Test Duration

- **Test 1**: ~30-40 seconds (depends on EDF file size)
- **Test 2**: ~20-25 seconds

Total: ~50-65 seconds

## Output Files

- `e2e/screenshots/edf-data-integrity-check.png` - Screenshot of test
- `e2e/screenshots/timebase-60mm-speed-check.png` - Timebase test screenshot
- `e2e/EDF_DATA_INTEGRITY_RESULTS.md` - Detailed test report

## Requirements

- EDF file must exist at project root: `EEG.edf`
- Dev server must be running on `http://localhost:5173`
- Playwright must be installed: `npm install`

## Troubleshooting

### Test Times Out

- Large EDF files may take longer to parse
- Increase timeout in test if needed
- Check if dev server is running

### No Data Integrity Logs

- Monitoring only appears when streaming starts
- May need to wait longer for reports (every 5 seconds of EDF time)
- Check browser console manually

### Streaming Doesn't Start

- Check if auto-start is enabled
- Test will try to click Start button manually
- Verify EDF file loaded successfully first
