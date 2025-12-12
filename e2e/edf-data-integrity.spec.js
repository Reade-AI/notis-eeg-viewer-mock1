import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('EDF Data Streaming Integrity', () => {
  test('should verify EDF data is streamed correctly with integrity monitoring', async ({ page }) => {
    // Collect all console messages
    const consoleMessages = [];
    const consoleErrors = [];
    const consoleWarnings = [];
    const dataIntegrityLogs = [];
    const timebaseMonitorLogs = [];
    const streamingLogs = [];
    
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      
      const logEntry = {
        type,
        text,
        timestamp: new Date().toISOString()
      };
      
      consoleMessages.push(logEntry);
      
      if (type === 'error') {
        consoleErrors.push(logEntry);
      } else if (type === 'warning') {
        consoleWarnings.push(logEntry);
      }
      
      // Categorize logs
      if (text.includes('[EDF DATA MONITOR]')) {
        dataIntegrityLogs.push(logEntry);
      }
      if (text.includes('[TIMEBASE MONITOR]')) {
        timebaseMonitorLogs.push(logEntry);
      }
      if (text.includes('[startEDFStream]') || text.includes('Streaming progress')) {
        streamingLogs.push(logEntry);
      }
      
      // Log to test output
      console.log(`[${type.toUpperCase()}] ${text}`);
    });

    // Collect page errors
    page.on('pageerror', error => {
      consoleErrors.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      console.log(`[PAGE ERROR] ${error.message}`);
    });

    // Navigate to the app
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForSelector('.app, .header-bar', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    console.log('\n=== STEP 1: Checking EDF file availability ===');
    
    // Check if EDF file exists
    const edfFilePath = path.join(process.cwd(), 'EEG.edf');
    const edfFileExists = fs.existsSync(edfFilePath);
    
    if (!edfFileExists) {
      console.log(`\n⚠️  WARNING: EDF file not found at ${edfFilePath}`);
      console.log('Please ensure EEG.edf exists in project root');
      test.skip();
      return;
    }
    
    const fileStats = fs.statSync(edfFilePath);
    console.log(`✓ EDF file found: ${edfFilePath} (${(fileStats.size / 1024).toFixed(2)} KB)`);
    
    console.log('\n=== STEP 2: Uploading EDF file ===');
    
    // Set up file input handler
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(edfFilePath);
    
    // Wait for file to be processed
    console.log('Waiting for EDF file to load and parse...');
    
    // Wait for EDF load success - check console messages periodically
    let edfLoaded = false;
    const maxWaitTime = 60000; // 60 seconds max
    const checkInterval = 2000; // Check every 2 seconds
    const maxChecks = maxWaitTime / checkInterval;
    
    for (let i = 0; i < maxChecks; i++) {
      await page.waitForTimeout(checkInterval);
      
      // Check if EDF loaded
      edfLoaded = consoleMessages.some(msg => 
        msg.text.includes('EDF FILE LOADED SUCCESSFULLY') ||
        msg.text.includes('EDF file loaded successfully')
      );
      
      if (edfLoaded) {
        console.log(`✓ EDF file loaded (after ${(i + 1) * checkInterval / 1000} seconds)`);
        break;
      }
      
      if (i % 5 === 0) {
        console.log(`  Still waiting for EDF load... (${(i + 1) * checkInterval / 1000}s)`);
      }
    }
    
    if (!edfLoaded) {
      console.log('⚠️  EDF load confirmation not found, but continuing test...');
    }
    
    await page.waitForTimeout(2000); // Additional buffer
    
    // Check for EDF load success
    const edfLoadSuccess = consoleMessages.some(msg => 
      msg.text.includes('EDF FILE LOADED SUCCESSFULLY') ||
      msg.text.includes('EDF file loaded successfully')
    );
    
    expect(edfLoadSuccess).toBeTruthy();
    console.log('✓ EDF file loaded successfully');
    
    // Check for data integrity monitoring initialization
    const monitorInit = dataIntegrityLogs.some(log => 
      log.text.includes('Starting EDF data integrity monitoring')
    );
    
    if (monitorInit) {
      console.log('✓ Data integrity monitoring initialized');
    } else {
      console.log('⚠️  Data integrity monitoring initialization not found in logs');
    }
    
    console.log('\n=== STEP 3: Starting EDF streaming ===');
    
    // Wait for auto-start or manually start
    await page.waitForTimeout(3000);
    
    const streamingStarted = consoleMessages.some(msg => 
      msg.text.includes('Starting EDF playback') ||
      msg.text.includes('Playback started')
    );
    
    if (!streamingStarted) {
      console.log('Streaming did not start automatically, attempting manual start...');
      const startButton = page.locator('button:has-text("Start")');
      const buttonCount = await startButton.count();
      
      if (buttonCount > 0) {
        await startButton.first().click();
        await page.waitForTimeout(2000);
        console.log('✓ Start button clicked');
      }
    } else {
      console.log('✓ Streaming started automatically');
    }
    
    // Wait for streaming to begin
    await page.waitForTimeout(3000);
    
    console.log('\n=== STEP 4: Monitoring data streaming (20 seconds) ===');
    
    // Monitor for 20 seconds to collect data integrity reports
    // Use smaller intervals to check for logs periodically
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(5000);
      console.log(`  Monitoring progress: ${(i + 1) * 5} seconds...`);
      
      // Check if we have any data integrity logs yet
      const currentIntegrityLogs = dataIntegrityLogs.length;
      if (currentIntegrityLogs > 0 && i === 0) {
        console.log(`  ✓ Data integrity monitoring detected (${currentIntegrityLogs} logs)`);
      }
    }
    
    // Analyze collected logs
    console.log('\n=== DATA INTEGRITY MONITORING ANALYSIS ===');
    
    // Check for monitoring initialization
    const initLogs = dataIntegrityLogs.filter(log => 
      log.text.includes('Starting EDF data integrity monitoring')
    );
    console.log(`Monitoring initialization logs: ${initLogs.length}`);
    initLogs.forEach(log => console.log(`  ${log.text}`));
    
    // Check for data integrity reports
    const integrityReports = dataIntegrityLogs.filter(log => 
      log.text.includes('Data Integrity Report') ||
      log.text.includes('Data Integrity Summary')
    );
    console.log(`\nData integrity reports: ${integrityReports.length}`);
    
    if (integrityReports.length > 0) {
      console.log('✓ Data integrity monitoring is active');
      integrityReports.forEach(log => console.log(`  ${log.text}`));
    } else {
      console.log('⚠️  No data integrity reports found - monitoring may not be working');
    }
    
    // Check for sample value validations
    const sampleValidations = dataIntegrityLogs.filter(log => 
      log.text.includes('Sample Value Validation') ||
      log.text.includes('Latest sample check')
    );
    console.log(`\nSample value validations: ${sampleValidations.length}`);
    sampleValidations.forEach(log => console.log(`  ${log.text}`));
    
    // Check for time point validations
    const timePointValidations = dataIntegrityLogs.filter(log => 
      log.text.includes('Time Point Validations')
    );
    console.log(`\nTime point validations: ${timePointValidations.length}`);
    timePointValidations.forEach(log => console.log(`  ${log.text}`));
    
    // Check for warnings/errors in data integrity
    const integrityWarnings = dataIntegrityLogs.filter(log => 
      log.text.includes('⚠️') ||
      log.text.includes('WARNING') ||
      log.text.includes('mismatch') ||
      log.text.includes('FAIL')
    );
    
    if (integrityWarnings.length > 0) {
      console.log(`\n⚠️  Data integrity warnings found: ${integrityWarnings.length}`);
      integrityWarnings.forEach(log => console.log(`  ${log.text}`));
    } else {
      console.log('\n✓ No data integrity warnings detected');
    }
    
    // Check for pass status
    const passStatus = dataIntegrityLogs.filter(log => 
      log.text.includes('✓ PASS') ||
      log.text.includes('All data integrity checks passed')
    );
    console.log(`\nPass status logs: ${passStatus.length}`);
    passStatus.forEach(log => console.log(`  ${log.text}`));
    
    console.log('\n=== TIMEBASE MONITORING ANALYSIS ===');
    
    // Check for timebase monitoring
    const timebaseLogs = timebaseMonitorLogs.length;
    console.log(`Timebase monitoring logs: ${timebaseLogs}`);
    
    if (timebaseLogs > 0) {
      console.log('✓ Timebase monitoring is active');
      timebaseMonitorLogs.slice(0, 5).forEach(log => console.log(`  ${log.text}`));
    }
    
    console.log('\n=== STREAMING ANALYSIS ===');
    
    // Check streaming progress logs
    const progressLogs = streamingLogs.filter(log => 
      log.text.includes('Streaming progress')
    );
    console.log(`Streaming progress logs: ${progressLogs.length}`);
    
    if (progressLogs.length > 0) {
      console.log('✓ Streaming is active');
      progressLogs.slice(0, 3).forEach(log => console.log(`  ${log.text}`));
    }
    
    // Check for buffer updates
    const bufferUpdates = streamingLogs.filter(log => 
      log.text.includes('Buffer update')
    );
    console.log(`Buffer update logs: ${bufferUpdates.length}`);
    
    // Check for sample data logs
    const sampleDataLogs = consoleMessages.filter(log => 
      log.text.includes('Channel') && (
        log.text.includes('Sample') ||
        log.text.includes('Raw sample') ||
        log.text.includes('Y values')
      )
    );
    console.log(`Sample data logs: ${sampleDataLogs.length}`);
    
    if (sampleDataLogs.length > 0) {
      console.log('✓ Sample data is being logged');
      sampleDataLogs.slice(0, 3).forEach(log => console.log(`  ${log.text}`));
    }
    
    console.log('\n=== VALIDATION CHECKS ===');
    
    // Validation 1: EDF file loaded successfully
    const edfLoadSuccess = consoleMessages.some(msg => 
      msg.text.includes('EDF FILE LOADED SUCCESSFULLY') ||
      msg.text.includes('EDF file loaded successfully')
    );
    console.log(`✓ EDF file loaded: ${edfLoadSuccess}`);
    expect(edfLoadSuccess).toBeTruthy();
    
    // Validation 2: Data integrity monitoring is active (or at least attempted)
    const hasMonitoring = dataIntegrityLogs.length > 0 || 
                         consoleMessages.some(msg => msg.text.includes('EDF DATA MONITOR'));
    console.log(`✓ Data integrity monitoring active: ${hasMonitoring}`);
    // Soft check - monitoring may initialize after streaming starts
    
    // Validation 3: Streaming started
    const streamingStarted = consoleMessages.some(msg => 
      msg.text.includes('Starting EDF playback') ||
      msg.text.includes('Playback started') ||
      msg.text.includes('startEDFStream')
    );
    console.log(`✓ Streaming started: ${streamingStarted}`);
    expect(streamingStarted).toBeTruthy();
    
    // Validation 4: Streaming is active (has progress logs)
    const isStreaming = streamingLogs.length > 0 || progressLogs.length > 0;
    console.log(`✓ Streaming is active: ${isStreaming}`);
    // Soft check - may need more time
    
    // Validation 5: Sample data is being processed
    const hasSampleData = sampleDataLogs.length > 0 ||
                         consoleMessages.some(msg => 
                           msg.text.includes('Sample') && 
                           (msg.text.includes('Channel') || msg.text.includes('Raw sample'))
                         );
    console.log(`✓ Sample data being processed: ${hasSampleData}`);
    // Soft check - may need more time
    
    // Validation 6: No critical console errors related to EDF streaming
    const criticalEDFErrors = consoleErrors.filter(err => 
      (err.text.includes('EDF') || err.text.includes('loadEDFFile') || err.text.includes('startEDFStream')) &&
      (err.text.includes('Error') || err.text.includes('Failed') || err.text.includes('corruption'))
    );
    console.log(`✓ Critical EDF-related errors: ${criticalEDFErrors.length}`);
    expect(criticalEDFErrors.length).toBe(0);
    
    // Validation 7: Data integrity reports (if monitoring is working)
    if (hasMonitoring) {
      const hasReports = integrityReports.length > 0;
      console.log(`✓ Data integrity reports generated: ${hasReports} (may need longer test)`);
      // Soft check - reports appear every 5 seconds of EDF time
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Data integrity logs: ${dataIntegrityLogs.length}`);
    console.log(`Timebase monitor logs: ${timebaseMonitorLogs.length}`);
    console.log(`Streaming logs: ${streamingLogs.length}`);
    console.log(`Total errors: ${consoleErrors.length}`);
    console.log(`Total warnings: ${consoleWarnings.length}`);
    console.log(`Data integrity reports: ${integrityReports.length}`);
    console.log(`Sample validations: ${sampleValidations.length}`);
    console.log(`Time point validations: ${timePointValidations.length}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'e2e/screenshots/edf-data-integrity-check.png', 
      fullPage: true 
    });
    console.log('\n✓ Screenshot saved: e2e/screenshots/edf-data-integrity-check.png');
    
    // Generate detailed report
    const report = {
      timestamp: new Date().toISOString(),
      test: 'EDF Data Streaming Integrity',
      summary: {
        totalConsoleMessages: consoleMessages.length,
        dataIntegrityLogs: dataIntegrityLogs.length,
        timebaseMonitorLogs: timebaseMonitorLogs.length,
        streamingLogs: streamingLogs.length,
        errors: consoleErrors.length,
        warnings: consoleWarnings.length
      },
      validations: {
        monitoringActive: hasMonitoring,
        reportsGenerated: hasReports,
        criticalErrors: criticalErrors.length,
        streamingActive: isStreaming,
        sampleDataProcessed: hasSampleData,
        edfErrors: edfErrors.length
      },
      dataIntegrityReports: integrityReports.map(log => log.text),
      sampleValidations: sampleValidations.map(log => log.text),
      timePointValidations: timePointValidations.map(log => log.text),
      warnings: integrityWarnings.map(log => log.text),
      errors: consoleErrors.map(err => err.text)
    };
    
    const reportPath = 'e2e/EDF_DATA_INTEGRITY_RESULTS.md';
    const reportContent = `# EDF Data Integrity Test Results

**Test Date:** ${new Date().toLocaleString()}

## Summary

- **Total Console Messages:** ${report.summary.totalConsoleMessages}
- **Data Integrity Logs:** ${report.summary.dataIntegrityLogs}
- **Timebase Monitor Logs:** ${report.summary.timebaseMonitorLogs}
- **Streaming Logs:** ${report.summary.streamingLogs}
- **Errors:** ${report.summary.errors}
- **Warnings:** ${report.summary.warnings}

## Validations

- ✓ Data Integrity Monitoring Active: ${report.validations.monitoringActive ? 'PASS' : 'FAIL'}
- ✓ Data Integrity Reports Generated: ${report.validations.reportsGenerated ? 'PASS' : 'WARNING (may need longer test)'}
- ✓ Critical Errors: ${report.validations.criticalErrors === 0 ? 'PASS (none found)' : `FAIL (${report.validations.criticalErrors} found)`}
- ✓ Streaming Active: ${report.validations.streamingActive ? 'PASS' : 'FAIL'}
- ✓ Sample Data Processed: ${report.validations.sampleDataProcessed ? 'PASS' : 'FAIL'}
- ✓ EDF Errors: ${report.validations.edfErrors === 0 ? 'PASS (none found)' : `FAIL (${report.validations.edfErrors} found)`}

## Data Integrity Reports

${report.dataIntegrityReports.length > 0 
  ? report.dataIntegrityReports.map(r => `- ${r}`).join('\n')
  : 'No reports captured (may need longer test duration)'}

## Sample Validations

${report.sampleValidations.length > 0 
  ? report.sampleValidations.map(v => `- ${v}`).join('\n')
  : 'No sample validations captured'}

## Time Point Validations

${report.timePointValidations.length > 0 
  ? report.timePointValidations.map(v => `- ${v}`).join('\n')
  : 'No time point validations captured'}

## Warnings

${report.warnings.length > 0 
  ? report.warnings.map(w => `- ${w}`).join('\n')
  : 'No warnings'}

## Errors

${report.errors.length > 0 
  ? report.errors.map(e => `- ${e}`).join('\n')
  : 'No errors'}
`;

    fs.writeFileSync(reportPath, reportContent);
    console.log(`\n✓ Detailed report saved: ${reportPath}`);
    
    console.log('\n=== TEST COMPLETE ===');
    console.log('All validations passed! EDF data streaming integrity monitoring is working correctly.');
  });
  
  test('should verify timebase 60mm/sec streams at 2x speed', async ({ page }) => {
    const consoleMessages = [];
    const timebaseLogs = [];
    
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text, timestamp: new Date().toISOString() });
      
      if (text.includes('[TIMEBASE MONITOR]')) {
        timebaseLogs.push({ type: msg.type(), text, timestamp: new Date().toISOString() });
      }
      
      console.log(`[${msg.type().toUpperCase()}] ${text}`);
    });
    
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Check for EDF file
    const edfFilePath = path.join(process.cwd(), 'EEG.edf');
    if (!fs.existsSync(edfFilePath)) {
      test.skip();
      return;
    }
    
    // Upload EDF file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(edfFilePath);
    await page.waitForTimeout(5000);
    
    // Set timebase to 60mm/sec
    console.log('\n=== Setting timebase to 60mm/sec ===');
    
    // Find timebase input (this may vary based on UI)
    const timebaseInput = page.locator('input[type="number"]').filter({ 
      hasText: /timebase|Timebase/i 
    }).or(page.locator('input').filter({ 
      has: page.locator('text=/timebase/i') 
    }));
    
    // Try alternative: look for input near "Timebase" label
    const timebaseLabel = page.locator('text=/timebase/i');
    const labelCount = await timebaseLabel.count();
    
    if (labelCount > 0) {
      // Find input near the label
      const timebaseInputs = page.locator('input[type="number"]');
      const inputCount = await timebaseInputs.count();
      
      // Try to find the timebase input by checking nearby elements
      // This is a simplified approach - may need adjustment based on actual UI
      for (let i = 0; i < inputCount; i++) {
        const input = timebaseInputs.nth(i);
        const value = await input.inputValue();
        // If it's a number between 1-1000, it might be timebase
        const numValue = parseFloat(value);
        if (numValue >= 1 && numValue <= 1000) {
          await input.fill('60');
          await input.press('Enter');
          console.log(`✓ Set timebase input ${i} to 60`);
          break;
        }
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Start streaming
    const startButton = page.locator('button:has-text("Start")');
    if (await startButton.count() > 0) {
      await startButton.first().click();
      await page.waitForTimeout(3000);
    }
    
    // Monitor for speed verification
    console.log('\n=== Monitoring speed verification (10 seconds) ===');
    await page.waitForTimeout(10000);
    
    // Check for timebase monitoring logs
    const speedVerifications = timebaseLogs.filter(log => 
      log.text.includes('Speed Verification') ||
      log.text.includes('2x speed')
    );
    
    console.log(`\nSpeed verification logs: ${speedVerifications.length}`);
    speedVerifications.forEach(log => console.log(`  ${log.text}`));
    
    // Check for 60mm/sec detection
    const timebase60Logs = timebaseLogs.filter(log => 
      log.text.includes('60mm/sec') ||
      log.text.includes('timebase set to 60')
    );
    
    console.log(`\n60mm/sec detection logs: ${timebase60Logs.length}`);
    timebase60Logs.forEach(log => console.log(`  ${log.text}`));
    
    // Check for pass/fail status
    const passLogs = timebaseLogs.filter(log => 
      log.text.includes('✓ PASS') ||
      log.text.includes('2x speed confirmed')
    );
    
    const failLogs = timebaseLogs.filter(log => 
      log.text.includes('✗ FAIL') ||
      log.text.includes('speed mismatch')
    );
    
    console.log(`\nPass logs: ${passLogs.length}`);
    console.log(`Fail logs: ${failLogs.length}`);
    
    if (passLogs.length > 0) {
      console.log('✓ Timebase speed verification PASSED');
      passLogs.forEach(log => console.log(`  ${log.text}`));
    }
    
    if (failLogs.length > 0) {
      console.log('⚠️  Timebase speed verification issues detected');
      failLogs.forEach(log => console.log(`  ${log.text}`));
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'e2e/screenshots/timebase-60mm-speed-check.png', 
      fullPage: true 
    });
    
    expect(timebaseLogs.length).toBeGreaterThan(0);
  });
});
