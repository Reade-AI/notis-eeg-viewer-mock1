import { test, expect } from '@playwright/test';

test.describe('EEG Data Streaming', () => {
  test('should capture console logs and check if data is streaming on raw EEG charts', async ({ page }) => {
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
    
    // Wait for the app to load (check for header or main content)
    await page.waitForSelector('.app, .header-bar, .raw-eeg-plot', { timeout: 10000 });
    
    // Wait a bit for initial rendering
    await page.waitForTimeout(2000);
    
    // Check if the app loaded successfully
    const appLoaded = await page.locator('.app').count() > 0;
    expect(appLoaded).toBeTruthy();
    
    // Look for streaming indicators in the UI
    const streamingIndicator = await page.locator('text=/Streaming|Live|isStreaming/i').count();
    console.log(`Found ${streamingIndicator} streaming indicators in UI`);
    
    // Wait for potential data to start streaming (give it 5 seconds)
    console.log('Waiting 5 seconds for data to potentially start streaming...');
    await page.waitForTimeout(5000);
    
    // Check for console logs related to streaming
    const streamingLogs = consoleMessages.filter(msg => 
      msg.text.includes('Streaming') || 
      msg.text.includes('stream') ||
      msg.text.includes('Appending samples') ||
      msg.text.includes('buffer') ||
      msg.text.includes('EEG') ||
      msg.text.includes('Channel') ||
      msg.text.includes('data')
    );
    
    console.log('\n=== STREAMING-RELATED CONSOLE LOGS ===');
    streamingLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });
    
    // Check for console logs related to data status
    const dataStatusLogs = consoleMessages.filter(msg => 
      msg.text.includes('Data status') ||
      msg.text.includes('channelData') ||
      msg.text.includes('length=') ||
      msg.text.includes('buffer size') ||
      msg.text.includes('AppContent')
    );
    
    console.log('\n=== DATA STATUS CONSOLE LOGS ===');
    dataStatusLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });
    
    // Check for errors
    console.log('\n=== CONSOLE ERRORS ===');
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(err => {
        console.log(`[ERROR] ${err.text}`);
        if (err.stack) {
          console.log(`Stack: ${err.stack}`);
        }
      });
    } else {
      console.log('No console errors found');
    }
    
    // Check for warnings
    console.log('\n=== CONSOLE WARNINGS ===');
    if (consoleWarnings.length > 0) {
      consoleWarnings.forEach(warn => {
        console.log(`[WARNING] ${warn.text}`);
      });
    } else {
      console.log('No console warnings found');
    }
    
    // Look for specific logs about data not streaming
    const noDataLogs = consoleMessages.filter(msg => 
      msg.text.includes('not streaming') ||
      msg.text.includes('no data') ||
      msg.text.includes('empty') ||
      msg.text.includes('length=0') ||
      msg.text.includes('buffer size: 0')
    );
    
    console.log('\n=== NO DATA / NOT STREAMING LOGS ===');
    if (noDataLogs.length > 0) {
      noDataLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    } else {
      console.log('No explicit "no data" logs found');
    }
    
    // Check if mock stream is being started
    const mockStreamLogs = consoleMessages.filter(msg => 
      msg.text.includes('Starting mock stream') ||
      msg.text.includes('Mock stream') ||
      msg.text.includes('startMockStream') ||
      msg.text.includes('Stream config')
    );
    
    console.log('\n=== MOCK STREAM LOGS ===');
    if (mockStreamLogs.length > 0) {
      mockStreamLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    } else {
      console.log('⚠️  WARNING: No mock stream start logs found - stream may not be starting!');
    }
    
    // Check for channel data logs
    const channelDataLogs = consoleMessages.filter(msg => 
      msg.text.includes('Channel') && (
        msg.text.includes('data:') ||
        msg.text.includes('length=') ||
        msg.text.includes('first:') ||
        msg.text.includes('last:')
      )
    );
    
    console.log('\n=== CHANNEL DATA LOGS ===');
    if (channelDataLogs.length > 0) {
      channelDataLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    } else {
      console.log('⚠️  WARNING: No channel data logs found - charts may not be receiving data!');
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Streaming-related logs: ${streamingLogs.length}`);
    console.log(`Data status logs: ${dataStatusLogs.length}`);
    console.log(`Channel data logs: ${channelDataLogs.length}`);
    console.log(`Mock stream logs: ${mockStreamLogs.length}`);
    console.log(`Errors: ${consoleErrors.length}`);
    console.log(`Warnings: ${consoleWarnings.length}`);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'e2e/screenshots/data-streaming-check.png', fullPage: true });
    
    // Check if there are any charts visible
    const charts = await page.locator('canvas').count();
    console.log(`\nFound ${charts} canvas elements (charts)`);
    
    // Check if there's any data in the charts by looking at the page content
    const pageContent = await page.content();
    const hasDataIndicators = pageContent.includes('Raw EEG') || pageContent.includes('Channel');
    console.log(`Page contains EEG-related content: ${hasDataIndicators}`);
  });
  
  test('should check if mock stream can be manually started', async ({ page }) => {
    const consoleMessages = [];
    
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
      console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    });
    
    await page.goto('/');
    await page.waitForSelector('.app', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Try to find and click a start/play button if it exists
    // This would be in the settings panel or header
    const startButton = page.locator('button:has-text("Start"), button:has-text("Play"), button:has-text("Stream")');
    const buttonCount = await startButton.count();
    
    if (buttonCount > 0) {
      console.log('Found start/stream button, clicking...');
      await startButton.first().click();
      await page.waitForTimeout(3000);
      
      // Check for streaming logs after clicking
      const streamingLogs = consoleMessages.filter(msg => 
        msg.text.includes('Starting mock stream') ||
        msg.text.includes('Stream config') ||
        msg.text.includes('Appending samples')
      );
      
      console.log(`\nFound ${streamingLogs.length} streaming-related logs after button click`);
      streamingLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    } else {
      console.log('No start/stream button found - checking if auto-start is enabled');
    }
    
    // Wait a bit more to see if data appears
    await page.waitForTimeout(5000);
    
    // Check for any data-related logs
    const dataLogs = consoleMessages.filter(msg => 
      msg.text.includes('Appending samples') ||
      msg.text.includes('buffer') ||
      msg.text.includes('Channel') && msg.text.includes('data:')
    );
    
    console.log(`\nTotal data-related logs: ${dataLogs.length}`);
    if (dataLogs.length === 0) {
      console.log('⚠️  WARNING: No data streaming detected!');
    }
  });
});
