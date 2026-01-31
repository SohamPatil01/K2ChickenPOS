import { PrismaClient } from '@azela-pos/db';
import { emailService } from './emailService.js';

const prisma = new PrismaClient();

/**
 * Report Scheduler Service
 * Manages scheduled report generation and delivery
 * NO DATABASE SCHEMA CHANGES - Uses in-memory storage for schedules
 */

interface ReportSchedule {
  id: string;
  name: string;
  reportType: 'sales' | 'stock' | 'daily-closing' | 'cash-flow' | 'product-wise';
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm format
  recipients: string[];
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

// In-memory storage for report schedules
// In production, this could be moved to a config file or environment variables
const schedules: Map<string, ReportSchedule> = new Map();

export class ReportScheduler {
  /**
   * Add or update a schedule
   */
  async saveSchedule(schedule: ReportSchedule): Promise<ReportSchedule> {
    schedules.set(schedule.id, schedule);
    console.log(`[ReportScheduler] Schedule saved: ${schedule.name} (${schedule.frequency})`);
    return schedule;
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): ReportSchedule[] {
    return Array.from(schedules.values());
  }

  /**
   * Get schedule by ID
   */
  getSchedule(id: string): ReportSchedule | undefined {
    return schedules.get(id);
  }

  /**
   * Delete a schedule
   */
  deleteSchedule(id: string): boolean {
    return schedules.delete(id);
  }

  /**
   * Check and execute due schedules
   * This should be called periodically (e.g., every hour)
   */
  async processDueSchedules(): Promise<void> {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    for (const schedule of schedules.values()) {
      if (!schedule.enabled) continue;

      // Parse schedule time
      const [hour, minute] = schedule.time.split(':').map(Number);

      // Check if it's time to run
      const shouldRun = this.shouldRunSchedule(schedule, currentHour, currentMinute, hour, minute, now);

      if (shouldRun) {
        console.log(`[ReportScheduler] Executing schedule: ${schedule.name}`);
        await this.executeSchedule(schedule);
        schedule.lastRun = now;
        schedule.nextRun = this.calculateNextRun(schedule, now);
        schedules.set(schedule.id, schedule);
      }
    }
  }

  /**
   * Determine if schedule should run
   */
  private shouldRunSchedule(
    schedule: ReportSchedule,
    currentHour: number,
    currentMinute: number,
    scheduleHour: number,
    scheduleMinute: number,
    now: Date
  ): boolean {
    // Check if time matches (within 5-minute window to avoid missing)
    if (currentHour !== scheduleHour) return false;
    if (Math.abs(currentMinute - scheduleMinute) > 5) return false;

    // Check if already ran recently (within last hour)
    if (schedule.lastRun) {
      const hoursSinceLastRun = (now.getTime() - schedule.lastRun.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRun < 1) return false;
    }

    // Check frequency-specific conditions
    switch (schedule.frequency) {
      case 'daily':
        return true;
      
      case 'weekly':
        // Run on Mondays (day 1)
        return now.getUTCDay() === 1;
      
      case 'monthly':
        // Run on 1st of month
        return now.getUTCDate() === 1;
      
      default:
        return false;
    }
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(schedule: ReportSchedule, from: Date): Date {
    const [hour, minute] = schedule.time.split(':').map(Number);
    const next = new Date(from);
    next.setUTCHours(hour, minute, 0, 0);

    switch (schedule.frequency) {
      case 'daily':
        next.setUTCDate(next.getUTCDate() + 1);
        break;
      
      case 'weekly':
        next.setUTCDate(next.getUTCDate() + 7);
        break;
      
      case 'monthly':
        next.setUTCMonth(next.getUTCMonth() + 1);
        next.setUTCDate(1);
        break;
    }

    return next;
  }

  /**
   * Execute a scheduled report
   */
  private async executeSchedule(schedule: ReportSchedule): Promise<void> {
    try {
      // Generate date range based on frequency
      const { startDate, endDate } = this.getDateRange(schedule.frequency);

      // Generate report data (simplified - in production, call actual report generation logic)
      const reportData = await this.generateReportData(schedule.reportType, startDate, endDate);

      // Send email to recipients
      await emailService.sendReport({
        name: schedule.name,
        type: schedule.reportType,
        dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        data: reportData,
        recipients: schedule.recipients,
      });

      console.log(`[ReportScheduler] Successfully executed schedule: ${schedule.name}`);
    } catch (error) {
      console.error(`[ReportScheduler] Failed to execute schedule ${schedule.name}:`, error);
    }
  }

  /**
   * Get date range based on frequency
   */
  private getDateRange(frequency: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (frequency) {
      case 'daily':
        startDate.setUTCDate(startDate.getUTCDate() - 1);
        break;
      
      case 'weekly':
        startDate.setUTCDate(startDate.getUTCDate() - 7);
        break;
      
      case 'monthly':
        startDate.setUTCMonth(startDate.getUTCMonth() - 1);
        break;
    }

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  /**
   * Generate report data (placeholder - implement actual report logic)
   */
  private async generateReportData(reportType: string, startDate: Date, endDate: Date): Promise<any> {
    // This is a simplified implementation
    // In production, this would call the actual report generation endpoints

    console.log(`[ReportScheduler] Generating ${reportType} report for ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Return placeholder data
    return {
      reportType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Initialize default schedules
   */
  initializeDefaultSchedules(): void {
    // Example default schedules
    const defaultSchedules: ReportSchedule[] = [
      {
        id: 'daily-sales-report',
        name: 'Daily Sales Report',
        reportType: 'sales',
        frequency: 'daily',
        time: '09:00', // 9 AM UTC
        recipients: (process.env.DEFAULT_REPORT_RECIPIENTS || '').split(',').filter(Boolean),
        enabled: false, // Disabled by default
      },
      {
        id: 'weekly-stock-report',
        name: 'Weekly Stock Report',
        reportType: 'stock',
        frequency: 'weekly',
        time: '08:00', // 8 AM UTC on Mondays
        recipients: (process.env.DEFAULT_REPORT_RECIPIENTS || '').split(',').filter(Boolean),
        enabled: false,
      },
      {
        id: 'monthly-summary',
        name: 'Monthly Summary Report',
        reportType: 'daily-closing',
        frequency: 'monthly',
        time: '10:00', // 10 AM UTC on 1st of month
        recipients: (process.env.DEFAULT_REPORT_RECIPIENTS || '').split(',').filter(Boolean),
        enabled: false,
      },
    ];

    defaultSchedules.forEach(schedule => {
      if (!schedules.has(schedule.id)) {
        schedules.set(schedule.id, schedule);
      }
    });

    console.log(`[ReportScheduler] Initialized with ${schedules.size} schedules`);
  }
}

export const reportScheduler = new ReportScheduler();

// Initialize default schedules
reportScheduler.initializeDefaultSchedules();

