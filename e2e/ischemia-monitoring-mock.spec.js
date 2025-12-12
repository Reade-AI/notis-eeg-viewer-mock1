import { test, expect } from '@playwright/test';

test.describe('Ischemia Event Monitoring - Mock Stream', () => {
  test('should monitor mock streaming until ischemia start and stop events are detected', async ({ page }) => {
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
    });

    // Navigate to the app
    await page.goto('/');
    await page.waitForSelector('.app, .header-bar', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    console.log('\n=== STEP 1: Starting Mock Stream ===');
    
    // Click Start button to start mock stream
    const startButton = page.locator('button:has-text("Start")');
    const buttonCount = await startButton.count();
    
    if (buttonCount > 0) {
      await startButton.first().click();
      await page.waitForTimeout(2000);
      console.log('✅ Start button clicked');
    } else {
      console.log('⚠️  Start button not found');
    }
    
    // Verify streaming started
    const streamingStarted = consoleMessages.some(msg => 
      msg.text.includes('Starting mock stream') ||
      msg.text.includes('Mock stream started')
    );
    
    if (streamingStarted) {
      console.log('✅ Mock streaming started');
    } else {
      console.log('⚠️  Mock streaming may not have started');
    }
    
    // Check for ischemia schedule log
    const scheduleLogs = consoleMessages.filter(msg => 
      msg.text.includes('Mock ischemia will start at')
    );
    
    if (scheduleLogs.length > 0) {
      scheduleLogs.forEach(log => {
        console.log(`📅 ${log.text}`);
      });
    }
    
    console.log('\n=== STEP 2: Monitoring for ischemia events (up to 30 seconds) ===');
    console.log('Waiting for ischemia START and STOP events...\n');
    
    // Monitor for up to 30 seconds or until we see both start and stop
    const maxWaitTime = 30000; // 30 seconds (ischemia starts at 15s, ends at 20s)
    const checkInterval = 500; // Check every 500ms
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      await page.waitForTimeout(checkInterval);
      
      const elapsed = (Date.now() - startTime) / 1000;
      
      // Check for new ischemia events
      const startEvents = ischemiaEvents.filter(e => e.type === 'start');
      const stopEvents = ischemiaEvents.filter(e => e.type === 'stop');
      
      // Log progress every 2 seconds
      if (Math.floor(elapsed * 2) !== Math.floor((elapsed - 0.5) * 2)) {
        console.log(`[${elapsed.toFixed(1)}s] Monitoring... Start: ${startEvents.length}, Stop: ${stopEvents.length}`);
      }
      
      // Check if we have both start and stop events
      if (startEvents.length > 0 && stopEvents.length > 0) {
        console.log('\n✅ SUCCESS: Both ischemia START and STOP events detected!');
        break;
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
        console.log(`  ${idx + 1}. Time: ${event.time.toFixed(2)}s`);
        console.log(`     Log: ${event.log}`);
      });
    }
    
    if (stopEvents.length > 0) {
      console.log(`\n--- STOP EVENTS ---`);
      stopEvents.forEach((event, idx) => {
        console.log(`  ${idx + 1}. Time: ${event.time.toFixed(2)}s`);
        console.log(`     Log: ${event.log}`);
      });
    }
    
    // Check for ischemia-related console logs
    const ischemiaLogs = consoleMessages.filter(msg => 
      msg.text.includes('ischemia') ||
      msg.text.includes('Ischemia') ||
      msg.text.includes('ADD_ISCHEMIA_EVENT') ||
      msg.text.includes('UPDATE_ISCHEMIA_EVENT')
    );
    
    console.log(`\n=== ISCHEMIA-RELATED CONSOLE LOGS (${ischemiaLogs.length} total) ===`);
    if (ischemiaLogs.length > 0) {
      ischemiaLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    }
    
    // Final assessment
    console.log(`\n=== FINAL ASSESSMENT ===`);
    
    if (startEvents.length > 0 && stopEvents.length > 0) {
      console.log('✅ SUCCESS: Both ischemia START and STOP events were detected');
      console.log(`   - First start at: ${startEvents[0].time.toFixed(2)}s`);
      console.log(`   - First stop at: ${stopEvents[0].time.toFixed(2)}s`);
      const duration = stopEvents[0].time - startEvents[0].time;
      console.log(`   - Duration: ${duration.toFixed(2)}s`);
    } else if (startEvents.length > 0) {
      console.log('⚠️  PARTIAL: Ischemia START event detected, but no STOP event yet');
      console.log(`   - Start at: ${startEvents[0].time.toFixed(2)}s`);
      console.log(`   - Monitoring may need to continue longer`);
    } else {
      console.log('❌ NO ISCHEMIA EVENTS DETECTED');
      console.log('   - Expected start at ~15 seconds');
      console.log('   - Expected stop at ~20 seconds');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/ischemia-monitoring-mock-final.png', fullPage: true });
    
    // Summary statistics
    console.log(`\n=== SUMMARY STATISTICS ===`);
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Total errors: ${consoleErrors.length}`);
    console.log(`Total ischemia events detected: ${ischemiaEvents.length}`);
    console.log(`Monitoring duration: ${totalElapsed.toFixed(1)}s`);
  });
});
