import { dailyClosingService } from '../services/dailyClosingService';

/**
 * Daily Closing Cron Job
 * Runs at 8:00 PM every day (20:00 in 24-hour format)
 * 
 * Cron expression: "0 20 * * *"
 * - 0: minute (at minute 0)
 * - 20: hour (at 8 PM / 20:00)
 * - *: any day of month
 * - *: any month
 * - *: any day of week
 */

export async function runDailyClosing() {
  console.log('[Cron] Starting daily closing job at 8 PM...');

  try {
    // Get all active stores
    const storeIds = await dailyClosingService.getStoresForAutoClosing();
    console.log(`[Cron] Found ${storeIds.length} stores to process`);

    const today = new Date();
    const results = [];

    // Process each store
    for (const storeId of storeIds) {
      try {
        console.log(`[Cron] Processing store ${storeId}...`);
        const result = await dailyClosingService.generateDailyClosing(storeId, today);
        results.push({ storeId, ...result });

        if (result.success) {
          console.log(`[Cron] ✓ Successfully closed store ${storeId}`);
        } else {
          console.warn(`[Cron] ⚠ Could not close store ${storeId}: ${result.message}`);
        }
      } catch (error) {
        console.error(`[Cron] ❌ Failed to close store ${storeId}:`, error);
        results.push({
          storeId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('[Cron] Daily closing job completed');
    console.log(`[Cron] Results: ${results.filter(r => r.success).length}/${results.length} successful`);

    return results;
  } catch (error) {
    console.error('[Cron] Daily closing job failed:', error);
    throw error;
  }
}

// Export the cron schedule
export const dailyClosingCronSchedule = '0 20 * * *'; // 8:00 PM daily

