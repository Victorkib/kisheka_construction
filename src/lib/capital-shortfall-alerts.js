/**
 * Capital Shortfall Alert Service
 * Scheduled service to check for predicted capital shortfalls and send email alerts
 * 
 * Usage: Node script or API endpoint for scheduled execution
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { sendEmail } from '@/lib/email-service';
import { formatCurrency } from '@/lib/financial-helpers';

/**
 * Check all projects for capital shortfall risks
 * Run this daily via cron or scheduled task
 */
export async function checkCapitalShortfallAlerts() {
  const db = await getDatabase();
  
  // Get all active projects
  const projects = await db.collection('projects').find({
    status: { $in: ['active', 'in_progress'] },
    deletedAt: null
  }).toArray();

  const alerts = [];

  for (const project of projects) {
    const projectId = project._id.toString();
    
    // Get project finances
    const projectFinances = await db.collection('project_finances').findOne({
      projectId: new ObjectId(projectId)
    });

    if (!projectFinances) continue;

    const availableCapital = projectFinances.capitalBalance || 0;
    const totalInvested = projectFinances.totalInvested || 0;
    
    // Skip if no capital invested
    if (totalInvested === 0) continue;

    // Get all floors for this project
    const floors = await db.collection('floors').find({
      projectId: new ObjectId(projectId),
      deletedAt: null
    }).toArray();

    for (const floor of floors) {
      const capitalAllocation = floor.capitalAllocation || { total: 0, remaining: 0 };
      const actualCost = floor.actualCost || 0;
      
      const capitalRemaining = capitalAllocation.remaining !== undefined
        ? capitalAllocation.remaining
        : capitalAllocation.total - (capitalAllocation.used || 0) - (capitalAllocation.committed || 0);

      // Calculate daily spending rate
      const daysSinceCreation = floor.createdAt
        ? Math.max(1, (new Date() - new Date(floor.createdAt)) / (1000 * 60 * 60 * 24))
        : 1;
      
      const dailySpendingRate = actualCost / daysSinceCreation;

      // Skip if no spending yet
      if (dailySpendingRate === 0) continue;

      // Predict days until shortfall
      const daysUntilShortfall = capitalRemaining / dailySpendingRate;

      // Determine alert level
      let alertLevel = null;
      let alertMessage = '';

      if (daysUntilShortfall < 3) {
        alertLevel = 'critical';
        alertMessage = `CRITICAL: Floor ${floor.name || `Floor ${floor.floorNumber}`} will run out of capital in ${Math.round(daysUntilShortfall)} days`;
      } else if (daysUntilShortfall < 7) {
        alertLevel = 'high';
        alertMessage = `HIGH PRIORITY: Floor ${floor.name || `Floor ${floor.floorNumber}`} will run out of capital in ${Math.round(daysUntilShortfall)} days`;
      } else if (daysUntilShortfall < 14) {
        alertLevel = 'medium';
        alertMessage = `Floor ${floor.name || `Floor ${floor.floorNumber}`} will run out of capital in ${Math.round(daysUntilShortfall)} days`;
      }

      if (alertLevel) {
        alerts.push({
          projectId,
          projectName: project.projectName,
          floorId: floor._id.toString(),
          floorName: floor.name || `Floor ${floor.floorNumber}`,
          alertLevel,
          alertMessage,
          daysUntilShortfall: Math.round(daysUntilShortfall),
          capitalRemaining,
          dailySpendingRate: Math.round(dailySpendingRate),
          recommendedAction: formatCurrency(dailySpendingRate * 30) + ' needed for 30-day buffer'
        });
      }
    }
  }

  // Send alerts
  if (alerts.length > 0) {
    await sendShortfallAlertEmails(alerts);
  }

  return {
    projectsChecked: projects.length,
    alertsGenerated: alerts.length,
    alerts
  };
}

/**
 * Send email alerts for capital shortfalls
 */
async function sendShortfallAlertEmails(alerts) {
  // Group alerts by project
  const alertsByProject = alerts.reduce((acc, alert) => {
    if (!acc[alert.projectId]) {
      acc[alert.projectId] = {
        project: alert.projectName,
        alerts: []
      };
    }
    acc[alert.projectId].alerts.push(alert);
    return acc;
  }, {});

  // Get users who should receive alerts (PM, Owner, Accountant)
  const db = await getDatabase();
  const users = await db.collection('users').find({
    role: { $in: ['owner', 'pm', 'project_manager', 'accountant'] },
    status: 'active'
  }).toArray();

  for (const [projectId, projectData] of Object.entries(alertsByProject)) {
    const criticalAlerts = projectData.alerts.filter(a => a.alertLevel === 'critical');
    const highAlerts = projectData.alerts.filter(a => a.alertLevel === 'high');
    const mediumAlerts = projectData.alerts.filter(a => a.alertLevel === 'medium');

    const emailBody = generateAlertEmail(projectData, criticalAlerts, highAlerts, mediumAlerts);

    for (const user of users) {
      // Check if user has access to this project (simplified - in production, check project membership)
      await sendEmail({
        to: user.email,
        subject: `🚨 Capital Shortfall Alert - ${projectData.project}`,
        html: emailBody,
        text: generateAlertEmailText(projectData, criticalAlerts, highAlerts, mediumAlerts)
      });
    }
  }
}

/**
 * Generate HTML email body
 */
function generateAlertEmail(projectData, critical, high, medium) {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .alert-critical { background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 10px 0; }
    .alert-high { background: #fff7ed; border-left: 4px solid #ea580c; padding: 15px; margin: 10px 0; }
    .alert-medium { background: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 10px 0; }
    .button { display: inline-block; background: #1e40af; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
    .stat { background: white; padding: 10px; border-radius: 6px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; }
    .stat-label { font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">🚨 Capital Shortfall Alert</h1>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">${projectData.project}</p>
    </div>
    <div class="content">
      <p>This is an automated alert about predicted capital shortfalls for floors in <strong>${projectData.project}</strong>.</p>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value" style="color: #dc2626;">${critical.length}</div>
          <div class="stat-label">Critical (&lt;3 days)</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: #ea580c;">${high.length}</div>
          <div class="stat-label">High (3-7 days)</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: #2563eb;">${medium.length}</div>
          <div class="stat-label">Medium (7-14 days)</div>
        </div>
        <div class="stat">
          <div class="stat-value" style="color: #6b7280;">${projectData.alerts.length}</div>
          <div class="stat-label">Total Alerts</div>
        </div>
      </div>

      ${critical.length > 0 ? `
        <h3 style="color: #dc2626; margin-top: 20px;">🔴 Critical Alerts</h3>
        ${critical.map(alert => `
          <div class="alert-critical">
            <strong>${alert.floorName}</strong><br>
            ${alert.alertMessage}<br>
            <small>Remaining: ${formatCurrency(alert.capitalRemaining)} | Daily spend: ${formatCurrency(alert.dailySpendingRate)}</small><br>
            <strong>Recommended: ${alert.recommendedAction}</strong>
          </div>
        `).join('')}
      ` : ''}

      ${high.length > 0 ? `
        <h3 style="color: #ea580c; margin-top: 20px;">🟠 High Priority Alerts</h3>
        ${high.map(alert => `
          <div class="alert-high">
            <strong>${alert.floorName}</strong><br>
            ${alert.alertMessage}<br>
            <small>Remaining: ${formatCurrency(alert.capitalRemaining)} | Daily spend: ${formatCurrency(alert.dailySpendingRate)}</small><br>
            <strong>Recommended: ${alert.recommendedAction}</strong>
          </div>
        `).join('')}
      ` : ''}

      ${medium.length > 0 ? `
        <h3 style="color: #2563eb; margin-top: 20px;">🔵 Medium Priority Alerts</h3>
        ${medium.map(alert => `
          <div class="alert-medium">
            <strong>${alert.floorName}</strong><br>
            ${alert.alertMessage}<br>
            <small>Remaining: ${formatCurrency(alert.capitalRemaining)} | Daily spend: ${formatCurrency(alert.dailySpendingRate)}</small>
          </div>
        `).join('')}
      ` : ''}

      <a href="${process.env.NEXT_PUBLIC_APP_URL}/floors/dashboard?projectId=${projectId}" class="button">
        View Floor Dashboard
      </a>

      <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">
        This is an automated alert from the Kisheka Construction Management System.<br>
        To adjust alert settings, contact your system administrator.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate plain text email body
 */
function generateAlertEmailText(projectData, critical, high, medium) {
  let text = `CAPITAL SHORTFALL ALERT - ${projectData.project}\n\n`;
  text += `Total Alerts: ${projectData.alerts.length} (Critical: ${critical.length}, High: ${high.length}, Medium: ${medium.length})\n\n`;

  if (critical.length > 0) {
    text += '🔴 CRITICAL ALERTS:\n';
    critical.forEach(alert => {
      text += `- ${alert.floorName}: ${alert.alertMessage}\n`;
      text += `  Remaining: ${formatCurrency(alert.capitalRemaining)} | Daily spend: ${formatCurrency(alert.dailySpendingRate)}\n`;
      text += `  Recommended: ${alert.recommendedAction}\n\n`;
    });
  }

  if (high.length > 0) {
    text += '🟠 HIGH PRIORITY ALERTS:\n';
    high.forEach(alert => {
      text += `- ${alert.floorName}: ${alert.alertMessage}\n`;
      text += `  Remaining: ${formatCurrency(alert.capitalRemaining)} | Daily spend: ${formatCurrency(alert.dailySpendingRate)}\n\n`;
    });
  }

  if (medium.length > 0) {
    text += '🔵 MEDIUM PRIORITY ALERTS:\n';
    medium.forEach(alert => {
      text += `- ${alert.floorName}: ${alert.alertMessage}\n`;
    });
  }

  text += `\nView dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/floors/dashboard?projectId=${projectData.alerts[0]?.projectId}`;

  return text;
}

// Export for use as API endpoint
export async function GET() {
  try {
    const result = await checkCapitalShortfallAlerts();
    return Response.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Capital shortfall check error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
