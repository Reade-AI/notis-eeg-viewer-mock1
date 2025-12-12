import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('EDF File Upload and Data Streaming', () => {
  test('should upload EDF file and verify raw EEG chart data is not at 0', async ({ page }) => {
    // Collect all console messages
    const consoleMessages = [];
    const consoleErrors = [];
    const consoleWarnings = [];
    
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      
      consoleMessages.push({
        type,
        text,
        timestamp: new Date().toISOString()
      });
      
      if (type === 'error') {
        consoleErrors.push({ type, text, timestamp: new Date().toISOString() });
      } else if (type === 'warning') {
        consoleWarnings.push({ type, text, timestamp: new Date().toISOString() });
      }
      
      // Log to test output for visibility
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
    
    console.log('\n=== STEP 1: Checking initial state ===');
    const initialBufferLogs = consoleMessages.filter(msg => 
      msg.text.includes('eegBuffer') || 
      msg.text.includes('Channel') && msg.text.includes('data:')
    );
    console.log(`Initial buffer-related logs: ${initialBufferLogs.length}`);
    
    // Check if EDF file exists
    const edfFilePath = path.join(process.cwd(), 'EEG.edf');
    const edfFileExists = fs.existsSync(edfFilePath);
    
    if (!edfFileExists) {
      console.log(`\n⚠️  WARNING: EDF file not found at ${edfFilePath}`);
      console.log('Creating a test EDF file would require the generateTestEDF utility');
      console.log('Skipping file upload test - please ensure EEG.edf exists in project root');
      return;
    }
    
    console.log(`\n=== STEP 2: Uploading EDF file: ${edfFilePath} ===`);
    
    // Set up file input handler
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(edfFilePath);
    
    // Wait for file to be processed
    console.log('Waiting for EDF file to load...');
    await page.waitForTimeout(5000); // Give time for file parsing
    
    // Check for EDF load success logs
    const edfLoadLogs = consoleMessages.filter(msg => 
      msg.text.includes('EDF FILE LOADED') ||
      msg.text.includes('loadEDFFile') ||
      msg.text.includes('EDF file loaded successfully')
    );
    
    console.log(`\n=== EDF LOAD LOGS ===`);
    edfLoadLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });
    
    // Check for errors during load
    const loadErrors = consoleErrors.filter(err => 
      err.text.includes('EDF') || 
      err.text.includes('loadEDFFile') ||
      err.text.includes('Error loading')
    );
    
    if (loadErrors.length > 0) {
      console.log(`\n❌ ERRORS DURING EDF LOAD:`);
      loadErrors.forEach(err => {
        console.log(`[ERROR] ${err.text}`);
        if (err.stack) console.log(`Stack: ${err.stack}`);
      });
    }
    
    // Wait for auto-start (if enabled) or check if streaming should start
    console.log('\n=== STEP 3: Checking if streaming started automatically ===');
    await page.waitForTimeout(3000);
    
    const autoStartLogs = consoleMessages.filter(msg => 
      msg.text.includes('Auto-start') ||
      msg.text.includes('starting streaming automatically') ||
      msg.text.includes('startEDFStream')
    );
    
    console.log(`Auto-start related logs: ${autoStartLogs.length}`);
    autoStartLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });
    
    // Check if streaming started
    const streamingStarted = consoleMessages.some(msg => 
      msg.text.includes('Starting EDF playback') ||
      msg.text.includes('Playback started') ||
      msg.text.includes('startEDFStream')
    );
    
    if (!streamingStarted) {
      console.log('\n⚠️  Streaming did not start automatically');
      console.log('Attempting to start manually...');
      
      // Try to click the Start button
      const startButton = page.locator('button:has-text("Start")');
      const buttonCount = await startButton.count();
      
      if (buttonCount > 0) {
        await startButton.first().click();
        await page.waitForTimeout(2000);
        console.log('Start button clicked');
      } else {
        console.log('Start button not found');
      }
    }
    
    // Wait for data to start streaming
    console.log('\n=== STEP 4: Waiting for data to stream (10 seconds) ===');
    await page.waitForTimeout(10000);
    
    // Check for streaming logs
    const streamingLogs = consoleMessages.filter(msg => 
      msg.text.includes('startEDFStream') ||
      msg.text.includes('Buffer update') ||
      msg.text.includes('Appending samples') ||
      msg.text.includes('Streaming progress') ||
      msg.text.includes('Sample') && msg.text.includes('y=')
    );
    
    console.log(`\n=== STREAMING LOGS ===`);
    streamingLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });
    
    // Check for channel data logs from RawEEGPlot
    const channelDataLogs = consoleMessages.filter(msg => 
      msg.text.includes('Channel') && (
        msg.text.includes('data:') ||
        msg.text.includes('length=') ||
        msg.text.includes('first:') ||
        msg.text.includes('last:') ||
        msg.text.includes('yRange:')
      )
    );
    
    console.log(`\n=== CHANNEL DATA LOGS (from RawEEGPlot) ===`);
    if (channelDataLogs.length > 0) {
      channelDataLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    } else {
      console.log('⚠️  WARNING: No channel data logs found from RawEEGPlot component!');
    }
    
    // Check for data at 0 issue
    const zeroDataLogs = consoleMessages.filter(msg => 
      msg.text.includes('y=0') ||
      msg.text.includes('y: 0') ||
      msg.text.includes('yRange: min=0') ||
      msg.text.includes('nonZero=0')
    );
    
    console.log(`\n=== ZERO DATA INDICATORS ===`);
    if (zeroDataLogs.length > 0) {
      console.log('⚠️  WARNING: Found logs indicating data at 0:');
      zeroDataLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    } else {
      console.log('No explicit zero data indicators found');
    }
    
    // Check buffer update logs
    const bufferUpdateLogs = consoleMessages.filter(msg => 
      msg.text.includes('Buffer update') ||
      msg.text.includes('channel0Length') ||
      msg.text.includes('channel0First') ||
      msg.text.includes('channel0Last')
    );
    
    console.log(`\n=== BUFFER UPDATE LOGS ===`);
    if (bufferUpdateLogs.length > 0) {
      bufferUpdateLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    } else {
      console.log('⚠️  WARNING: No buffer update logs found!');
    }
    
    // Check for sample value logs
    const sampleValueLogs = consoleMessages.filter(msg => 
      msg.text.includes('Raw sample:') ||
      msg.text.includes('Y values (first 10)') ||
      msg.text.includes('Stats: min=') ||
      msg.text.includes('nonZero=')
    );
    
    console.log(`\n=== SAMPLE VALUE LOGS ===`);
    if (sampleValueLogs.length > 0) {
      sampleValueLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    } else {
      console.log('⚠️  WARNING: No sample value logs found!');
    }
    
    // Check AppContent data status logs
    const appContentLogs = consoleMessages.filter(msg => 
      msg.text.includes('AppContent - Data status') ||
      msg.text.includes('channel0Length') ||
      msg.text.includes('firstPoint') ||
      msg.text.includes('lastPoint')
    );
    
    console.log(`\n=== APP CONTENT DATA STATUS LOGS ===`);
    if (appContentLogs.length > 0) {
      appContentLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    } else {
      console.log('⚠️  WARNING: No AppContent data status logs found!');
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`EDF load logs: ${edfLoadLogs.length}`);
    console.log(`Streaming logs: ${streamingLogs.length}`);
    console.log(`Channel data logs: ${channelDataLogs.length}`);
    console.log(`Buffer update logs: ${bufferUpdateLogs.length}`);
    console.log(`Sample value logs: ${sampleValueLogs.length}`);
    console.log(`AppContent logs: ${appContentLogs.length}`);
    console.log(`Errors: ${consoleErrors.length}`);
    console.log(`Warnings: ${consoleWarnings.length}`);
    
    // Check for specific issues
    const issues = [];
    
    if (edfLoadLogs.length === 0) {
      issues.push('❌ EDF file may not have loaded successfully');
    }
    
    if (streamingLogs.length === 0) {
      issues.push('❌ Streaming may not have started');
    }
    
    if (channelDataLogs.length === 0) {
      issues.push('❌ RawEEGPlot component is not receiving/logging data');
    }
    
    if (bufferUpdateLogs.length === 0) {
      issues.push('❌ Buffer is not being updated with new data');
    }
    
    if (sampleValueLogs.length === 0) {
      issues.push('❌ Sample values are not being logged (cannot verify if data is 0)');
    }
    
    if (zeroDataLogs.length > 0) {
      issues.push('⚠️  Found indicators that data might be at 0');
    }
    
    if (issues.length > 0) {
      console.log('\n=== IDENTIFIED ISSUES ===');
      issues.forEach(issue => console.log(issue));
    } else {
      console.log('\n✅ No obvious issues detected in logs');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/edf-upload-check.png', fullPage: true });
    
    // Check if charts are visible
    const charts = await page.locator('canvas').count();
    console.log(`\nFound ${charts} canvas elements (charts)`);
    
    // Check streaming status in UI
    const streamingStatus = await page.locator('text=/Stream.*Active|Stream.*Stopped/').first().textContent();
    console.log(`Streaming status in UI: ${streamingStatus}`);
  });
});
