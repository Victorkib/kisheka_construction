/**
 * Email Templates
 * Templates for various system emails
 */

import { sendEmail } from './email-service';

/**
 * Sends email notification for critical discrepancy
 * @param {Object} options - Email options
 * @param {Object} options.discrepancy - Discrepancy data
 * @param {Object} options.recipient - User receiving the email
 * @param {string} options.projectName - Project name
 * @returns {Promise<Object>} Send result
 */
export async function sendDiscrepancyEmail({ discrepancy, recipient, projectName }) {
  const { materialName, supplierName, severity, metrics, alerts } = discrepancy;

  // Build alert details
  const alertParts = [];
  if (alerts.variance) {
    alertParts.push(
      `Variance: ${metrics.variance.toFixed(2)} units (${metrics.variancePercentage.toFixed(2)}%)`
    );
  }
  if (alerts.loss) {
    alertParts.push(
      `Loss: ${metrics.loss.toFixed(2)} units (${metrics.lossPercentage.toFixed(2)}%)`
    );
  }
  if (alerts.wastage) {
    alertParts.push(`Wastage: ${metrics.wastage.toFixed(2)}%`);
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const subject = `🚨 CRITICAL: Material Discrepancy Alert - ${materialName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Critical Discrepancy Alert</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Critical Discrepancy Alert</h1>
      </div>
      
      <div style="background: #fff; border: 2px solid #ef4444; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; margin-bottom: 20px;">
          Dear ${recipient.firstName || recipient.email},
        </p>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          A <strong style="color: #ef4444;">CRITICAL</strong> material discrepancy has been detected that requires immediate attention.
        </p>
        
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 4px;">
          <h2 style="color: #991b1b; margin-top: 0; font-size: 20px;">Material Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 150px;">Material:</td>
              <td style="padding: 8px 0;">${materialName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Supplier:</td>
              <td style="padding: 8px 0;">${supplierName || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Project:</td>
              <td style="padding: 8px 0;">${projectName || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Severity:</td>
              <td style="padding: 8px 0;">
                <span style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 12px;">
                  ${severity}
                </span>
              </td>
            </tr>
          </table>
        </div>efi
        
        <div style="background: #fff7ed; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
          <h2 style="color: #92400e; margin-top: 0; font-size: 20px;">Discrepancy Details</h2>
          <ul style="margin: 10px 0; padding-left: 20px;">
            ${alertParts.map(part => `<li style="margin: 8px 0;">${part}</li>`).join('')}
          </ul>
          <p style="margin-top: 15px; font-size: 18px; font-weight: bold; color: #991b1b;">
            Total Cost Impact: ${formatCurrency(metrics.totalDiscrepancyCost)}
          </p>
        </div>
        
        <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 4px;">
          <h2 style="color: #1e40af; margin-top: 0; font-size: 20px;">Recommended Actions</h2>
          <ol style="margin: 10px 0; padding-left: 20px;">
            <li style="margin: 8px 0;">Review the material details in the system</li>
            <li style="margin: 8px 0;">Investigate the cause of the discrepancy</li>
            <li style="margin: 8px 0;">Contact the supplier if variance is the issue</li>
            <li style="margin: 8px 0;">Update the discrepancy status in the system</li>
            <li style="margin: 8px 0;">Document resolution notes</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/analytics/wastage" 
             style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View in Dashboard
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          This is an automated alert from the Kisheka Construction Accountability System.
          <br>
          Please do not reply to this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
CRITICAL DISCREPANCY ALERT

Dear ${recipient.firstName || recipient.email},

A CRITICAL material discrepancy has been detected that requires immediate attention.

Material Details:
- Material: ${materialName}
- Supplier: ${supplierName || 'N/A'}
- Project: ${projectName || 'N/A'}
- Severity: ${severity}

Discrepancy Details:
${alertParts.map(part => `- ${part}`).join('\n')}

Total Cost Impact: ${formatCurrency(metrics.totalDiscrepancyCost)}

Recommended Actions:
1. Review the material details in the system
2. Investigate the cause of the discrepancy
3. Contact the supplier if variance is the issue
4. Update the discrepancy status in the system
5. Document resolution notes

View in Dashboard: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/analytics/wastage

This is an automated alert from the Kisheka Construction Accountability System.
Please do not reply to this email.
  `;

  return await sendEmail({
    to: recipient.email,
    toName: recipient.firstName || recipient.email,
    subject,
    text: text.trim(),
    html: html.trim(),
  });
}

