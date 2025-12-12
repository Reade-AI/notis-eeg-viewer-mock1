import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Ischemia Event Monitoring', () => {
  test('should monitor EDF streaming until ischemia start and stop events are detected', async ({ page }) => {
    // Collect all console messages
    const consoleMessages = [];
    const consoleErrors = [];
    const ischemiaEvents = [];
    
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
      }
      
      // Detect ischemia events in console logs
      if (text.includes('Mock ischemia START') || text.includes('🩺 Mock ischemia START')) {
        const match = text.match(/at\s+([\d.]+)\s+seconds/);
        if (match) {
          ischemiaEvents.push({
            type: 'start',
            time: parseFloat(match[1]),
            timestamp: new Date().toISOString(),
            log: text
          });
          console.log(`\n🔴 ISCHEMIA START DETECTED at ${match[1]}s`);
        }
      }
      
      if (text.includes('Mock ischemia STOP') || text.includes('✅ Mock ischemia STOP')) {
        const match = text.match(/at\s+([\d.]+)\s+seconds/);
        if (match) {
          ischemiaEvents.push({
            type: 'stop',
            time: parseFloat(match[1]),
            timestamp: new Date().toISOString(),
            log: text
          });
          console.log(`\n✅ ISCHEMIA STOP DETECTED at ${match[1]}s`);
        }
      }
      
      // Also check for ischemia event additions/updates
      if (text.includes('ADD_ISCHEMIA_EVENT') || text.includes('UPDATE_ISCHEMIA_EVENT')) {
        console.log(`[${type.toUpperCase()}] ${text}`);
      }
    });

    // Collect page errors
    page.on('pageerror', error => {
      consoleErrors.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Navigate to the app
    await page.goto('/');
    await page.waitForSelector('.app, .header-bar', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    console.log('\n=== STEP 1: Uploading EDF file ===');
    
    // Check if EDF file exists
    const edfFilePath = path.join(process.cwd(), 'EEG.edf');
    const edfFileExists = fs.existsSync(edfFilePath);
    
    if (!edfFileExists) {
      console.log(`\n⚠️  EDF file not found at ${edfFilePath}`);
      console.log('Skipping test - please ensure EEG.edf exists in project root');
      return;
    }
    
    // Upload EDF file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(edfFilePath);
    console.log('EDF file uploaded, waiting for load...');
    await page.waitForTimeout(5000);
    
    // Check for successful load
    const edfLoadLogs = consoleMessages.filter(msg => 
      msg.text.includes('EDF FILE LOADED') ||
      msg.text.includes('EDF file loaded successfully')
    );
    
    if (edfLoadLogs.length === 0) {
      console.log('⚠️  EDF file may not have loaded successfully');
    } else {
      console.log('✅ EDF file loaded successfully');
    }
    
    console.log('\n=== STEP 2: Starting EDF streaming ===');
    
    // Wait a bit for auto-start, or click Start button
    await page.waitForTimeout(2000);
    
    const streamingStarted = consoleMessages.some(msg => 
      msg.text.includes('Starting EDF playback') ||
      msg.text.includes('Playback started')
    );
    
    if (!streamingStarted) {
      console.log('Streaming did not start automatically, clicking Start button...');
      const startButton = page.locator('button:has-text("Start")');
      const buttonCount = await startButton.count();
      
      if (buttonCount > 0) {
        await startButton.first().click();
        await page.waitForTimeout(2000);
        console.log('✅ Start button clicked');
      }
    } else {
      console.log('✅ Streaming started automatically');
    }
    
    // Verify streaming is active
    const streamingActive = consoleMessages.some(msg => 
      msg.text.includes('Playback started') ||
      msg.text.includes('Streaming progress')
    );
    
    if (!streamingActive) {
      console.log('⚠️  Streaming may not be active');
    }
    
    console.log('\n=== STEP 3: Monitoring for ischemia events (up to 60 seconds) ===');
    console.log('Waiting for ischemia START and STOP events...\n');
    
    // Monitor for up to 60 seconds or until we see both start and stop
    const maxWaitTime = 60000; // 60 seconds
    const checkInterval = 1000; // Check every second
    const startTime = Date.now();
    let lastEventTime = 0;
    let consecutiveNoProgressCount = 0;
    
    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(checkInterval);
      
      const currentTime = Date.now();
      const elapsed = (currentTime - startTime) / 1000;
      
      // Check for new ischemia events
      const startEvents = ischemiaEvents.filter(e => e.type === 'start');
      const stopEvents = ischemiaEvents.filter(e => e.type === 'stop');
      
      // Check streaming progress
      const recentStreamingLogs = consoleMessages.filter(msg => {
        const msgTime = new Date(msg.timestamp).getTime();
        return msgTime > lastEventTime && (
          msg.text.includes('Streaming progress') ||
          msg.text.includes('Buffer update') ||
          msg.text.includes('Appending samples')
        );
      });
      
      if (recentStreamingLogs.length > 0) {
        lastEventTime = Date.now();
        consecutiveNoProgressCount = 0;
      } else {
        consecutiveNoProgressCount++;
      }
      
      // Log progress every 5 seconds
      if (Math.floor(elapsed) % 5 === 0 && Math.floor(elapsed) !== Math.floor((elapsed - 1))) {
        console.log(`[${elapsed.toFixed(0)}s] Monitoring... Start events: ${startEvents.length}, Stop events: ${stopEvents.length}`);
        
        // Show recent streaming activity
        const recentLogs = consoleMessages.slice(-5).filter(msg => 
          msg.text.includes('Streaming') || 
          msg.text.includes('Buffer') ||
          msg.text.includes('Sample')
        );
        if (recentLogs.length > 0) {
          console.log(`  Recent activity: ${recentLogs.length} logs`);
        }
      }
      
      // Check if we have both start and stop events
      if (startEvents.length > 0 && stopEvents.length > 0) {
        console.log('\n✅ SUCCESS: Both ischemia START and STOP events detected!');
        break;
      }
      
      // Warn if no progress for 10 seconds
      if (consecutiveNoProgressCount > 10) {
        console.log('⚠️  No streaming progress detected for 10 seconds');
        consecutiveNoProgressCount = 0; // Reset counter
      }
      
      // Check for errors
      if (consoleErrors.length > 0) {
        const recentErrors = consoleErrors.filter(err => {
          const errTime = new Date(err.timestamp).getTime();
          return errTime > startTime;
        });
        if (recentErrors.length > 0) {
          console.log(`\n⚠️  ${recentErrors.length} error(s) detected during monitoring`);
          recentErrors.forEach(err => {
            console.log(`  [ERROR] ${err.text}`);
          });
        }
      }
    }
    
    const totalElapsed = (Date.now() - startTime) / 1000;
    
    console.log(`\n=== MONITORING COMPLETE (${totalElapsed.toFixed(1)}s elapsed) ===`);
    
    // Final ischemia event summary
    const startEvents = ischemiaEvents.filter(e => e.type === 'start');
    const stopEvents = ischemiaEvents.filter(e => e.type === 'stop');
    
    console.log(`\n=== ISCHEMIA EVENT SUMMARY ===`);
    console.log(`Total events detected: ${ischemiaEvents.length}`);
    console.log(`Start events: ${startEvents.length}`);
    console.log(`Stop events: ${stopEvents.length}`);
    
    if (startEvents.length > 0) {
      console.log(`\n--- START EVENTS ---`);
      startEvents.forEach((event, idx) => {
        console.log(`  ${idx + 1}. Time: ${event.time.toFixed(2)}s, Detected at: ${event.timestamp}`);
      });
    }
    
    if (stopEvents.length > 0) {
      console.log(`\n--- STOP EVENTS ---`);
      stopEvents.forEach((event, idx) => {
        console.log(`  ${idx + 1}. Time: ${event.time.toFixed(2)}s, Detected at: ${event.timestamp}`);
      });
    }
    
    // Check for ischemia events in the UI state
    console.log(`\n=== CHECKING UI STATE FOR ISCHEMIA EVENTS ===`);
    
    // Try to get ischemia events from the page context
    const uiIschemiaEvents = await page.evaluate(() => {
      // Try to access the React context or state
      // This is a best-effort attempt to get events from the UI
      const eventElements = document.querySelectorAll('[class*="ischemia"], [class*="alert"], [class*="notification"]');
      return {
        count: eventElements.length,
        elements: Array.from(eventElements).map(el => ({
          text: el.textContent?.substring(0, 100),
          className: el.className
        }))
      };
    });
    
    console.log(`UI elements with ischemia-related classes: ${uiIschemiaEvents.count}`);
    
    // Check for ischemia-related console logs
    const ischemiaLogs = consoleMessages.filter(msg => 
      msg.text.includes('ischemia') ||
      msg.text.includes('Ischemia') ||
      msg.text.includes('ISCHEMIA') ||
      msg.text.includes('ADD_ISCHEMIA_EVENT') ||
      msg.text.includes('UPDATE_ISCHEMIA_EVENT')
    );
    
    console.log(`\n=== ISCHEMIA-RELATED CONSOLE LOGS (${ischemiaLogs.length} total) ===`);
    if (ischemiaLogs.length > 0) {
      // Show first 10 and last 10
      const toShow = ischemiaLogs.length > 20 
        ? [...ischemiaLogs.slice(0, 10), ...ischemiaLogs.slice(-10)]
        : ischemiaLogs;
      
      toShow.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
      
      if (ischemiaLogs.length > 20) {
        console.log(`... (${ischemiaLogs.length - 20} more logs) ...`);
      }
    }
    
    // Check streaming status
    const streamingLogs = consoleMessages.filter(msg => 
      msg.text.includes('Streaming progress') ||
      msg.text.includes('Buffer update') ||
      msg.text.includes('Playback')
    );
    
    console.log(`\n=== STREAMING STATUS ===`);
    console.log(`Total streaming logs: ${streamingLogs.length}`);
    if (streamingLogs.length > 0) {
      const lastStreamingLog = streamingLogs[streamingLogs.length - 1];
      console.log(`Last streaming log: ${lastStreamingLog.text}`);
    }
    
    // Final assessment
    console.log(`\n=== FINAL ASSESSMENT ===`);
    
    if (startEvents.length > 0 && stopEvents.length > 0) {
      console.log('✅ SUCCESS: Both ischemia START and STOP events were detected');
      console.log(`   - First start at: ${startEvents[0].time.toFixed(2)}s`);
      console.log(`   - First stop at: ${stopEvents[0].time.toFixed(2)}s`);
      if (startEvents.length > 1 || stopEvents.length > 1) {
        console.log(`   - Total: ${startEvents.length} start(s), ${stopEvents.length} stop(s)`);
      }
    } else if (startEvents.length > 0) {
      console.log('⚠️  PARTIAL: Ischemia START events detected, but no STOP events');
      console.log(`   - Start events: ${startEvents.length}`);
      console.log(`   - First start at: ${startEvents[0].time.toFixed(2)}s`);
      console.log(`   - Monitoring may need to continue longer to see STOP events`);
    } else if (stopEvents.length > 0) {
      console.log('⚠️  PARTIAL: Ischemia STOP events detected, but no START events');
      console.log(`   - Stop events: ${stopEvents.length}`);
      console.log(`   - This is unusual - START should come before STOP`);
    } else {
      console.log('❌ NO ISCHEMIA EVENTS DETECTED');
      console.log('   - Possible reasons:');
      console.log('     1. EDF file does not contain ischemia events');
      console.log('     2. Ischemia detection is not enabled');
      console.log('     3. Monitoring time was insufficient');
      console.log('     4. Ischemia events are generated differently for EDF files');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/ischemia-monitoring-final.png', fullPage: true });
    
    // Check if streaming is still active
    const isStreaming = await page.locator('text=/Stream.*Active/').count() > 0;
    console.log(`\nStreaming status in UI: ${isStreaming ? 'Active' : 'Stopped'}`);
    
    // Summary statistics
    console.log(`\n=== SUMMARY STATISTICS ===`);
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Total errors: ${consoleErrors.length}`);
    console.log(`Total ischemia events detected: ${ischemiaEvents.length}`);
    console.log(`Monitoring duration: ${totalElapsed.toFixed(1)}s`);
    console.log(`Streaming logs: ${streamingLogs.length}`);
  });
});
