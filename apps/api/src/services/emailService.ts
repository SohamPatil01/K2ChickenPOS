/**
 * Email Service
 * Sends email notifications for alerts and reports
 * NOTE: This is a basic implementation. Configure with your email provider.
 */

interface EmailConfig {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private enabled: boolean;

  constructor() {
    // Check if email is configured
    this.enabled = !!(process.env.EMAIL_HOST && process.env.EMAIL_FROM);
    
    if (!this.enabled) {
      console.log('[EmailService] Email not configured. Notifications will be logged only.');
    }
  }

  /**
   * Send an email
   */
  async sendEmail(config: EmailConfig): Promise<boolean> {
    if (!this.enabled) {
      console.log('[EmailService] Would send email:', {
        to: config.to,
        subject: config.subject,
      });
      return false;
    }

    try {
      // TODO: Implement actual email sending using your preferred service
      // Options: SendGrid, AWS SES, Nodemailer with SMTP, etc.
      
      console.log('[EmailService] Sending email:', {
        from: config.from,
        to: config.to,
        subject: config.subject,
      });

      // Placeholder for actual email sending logic
      // Example with nodemailer:
      /*
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: config.from,
        to: config.to.join(', '),
        subject: config.subject,
        html: config.html,
        text: config.text,
      });
      */

      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send alert notification
   */
  async sendAlertNotification(alert: {
    type: string;
    severity: string;
    title: string;
    message: string;
    timestamp: Date;
  }): Promise<boolean> {
    const severityEmoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${alert.severity === 'critical' ? '#dc2626' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6'}; 
                    color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .alert-type { display: inline-block; background: rgba(0,0,0,0.1); padding: 4px 12px; border-radius: 4px; font-size: 12px; }
          .timestamp { color: #6b7280; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${severityEmoji} ${alert.title}</h1>
            <span class="alert-type">${alert.type.toUpperCase()}</span>
          </div>
          <div class="content">
            <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
            <p><strong>Message:</strong></p>
            <p>${alert.message}</p>
            <p class="timestamp">Timestamp: ${alert.timestamp.toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      ${severityEmoji} ${alert.title}
      
      Type: ${alert.type}
      Severity: ${alert.severity}
      
      ${alert.message}
      
      Timestamp: ${alert.timestamp.toLocaleString()}
    `;

    return this.sendEmail({
      from: process.env.EMAIL_FROM || 'noreply@k2chickenpos.com',
      to: (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
      subject: `${severityEmoji} K2 POS Alert: ${alert.title}`,
      html,
      text,
    });
  }

  /**
   * Send daily closing summary
   */
  async sendDailyClosingSummary(summary: {
    date: string;
    totalSales: number;
    totalRevenue: number;
    cashSales: number;
    cardSales: number;
    upiSales: number;
    warnings: string[];
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; }
          .stat { display: flex; justify-between; padding: 12px; background: white; margin: 8px 0; border-radius: 6px; }
          .stat-label { font-weight: 600; }
          .stat-value { color: #10b981; font-weight: bold; }
          .warnings { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin-top: 20px; border-radius: 4px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Daily Closing Summary</h1>
            <p>${summary.date}</p>
          </div>
          <div class="content">
            <div class="stat">
              <span class="stat-label">Total Sales:</span>
              <span class="stat-value">${summary.totalSales}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Total Revenue:</span>
              <span class="stat-value">₹${summary.totalRevenue.toLocaleString()}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Cash Sales:</span>
              <span class="stat-value">₹${summary.cashSales.toLocaleString()}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Card Sales:</span>
              <span class="stat-value">₹${summary.cardSales.toLocaleString()}</span>
            </div>
            <div class="stat">
              <span class="stat-label">UPI Sales:</span>
              <span class="stat-value">₹${summary.upiSales.toLocaleString()}</span>
            </div>
            
            ${summary.warnings.length > 0 ? `
              <div class="warnings">
                <h3>⚠️ Warnings:</h3>
                <ul>
                  ${summary.warnings.map(w => `<li>${w}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>K2 Chicken POS - Automated Daily Closing</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      from: process.env.EMAIL_FROM || 'noreply@k2chickenpos.com',
      to: (process.env.DAILY_CLOSING_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
      subject: `📊 Daily Closing Summary - ${summary.date}`,
      html,
    });
  }

  /**
   * Send report
   */
  async sendReport(report: {
    name: string;
    type: string;
    dateRange: string;
    data: any;
    recipients: string[];
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📈 ${report.name}</h1>
            <p>${report.dateRange}</p>
          </div>
          <div class="content">
            <p>Your scheduled report is ready.</p>
            <p><strong>Report Type:</strong> ${report.type}</p>
            <p><strong>Period:</strong> ${report.dateRange}</p>
            <p>Please log in to the system to view the full report details.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      from: process.env.EMAIL_FROM || 'noreply@k2chickenpos.com',
      to: report.recipients,
      subject: `📈 ${report.name} - ${report.dateRange}`,
      html,
    });
  }
}

export const emailService = new EmailService();

