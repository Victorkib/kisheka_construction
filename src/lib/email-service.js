/**
 * Email Service
 * Handles email sending with Gmail (primary) and Mailjet (secondary fallback)
 * 
 * Configuration:
 * - Gmail: Uses nodemailer with Gmail SMTP
 * - Mailjet: Uses Mailjet API as fallback
 */

import nodemailer from 'nodemailer';

/**
 * Create Gmail transporter
 */
function createGmailTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not regular password)
    },
  });
}

/**
 * Send email via Mailjet (fallback)
 */
async function sendViaMailjet(options) {
  if (!process.env.MJ_APIKEY_PUBLIC || !process.env.MJ_APIKEY_PRIVATE) {
    throw new Error('Mailjet credentials not configured');
  }

  // Dynamic import for Mailjet (ES module)
  let Mailjet;
  try {
    const mailjetModule = await import('node-mailjet');
    Mailjet = mailjetModule.default || mailjetModule;
  } catch (error) {
    // Fallback to require if dynamic import fails
    Mailjet = require('node-mailjet');
  }

  const mailjet = Mailjet.apiConnect(
    process.env.MJ_APIKEY_PUBLIC,
    process.env.MJ_APIKEY_PRIVATE
  );

  const request = mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: {
          Email: options.from || process.env.EMAIL_FROM || process.env.GMAIL_USER,
          Name: options.fromName || process.env.EMAIL_FROM_NAME || 'Doshaki Construction',
        },
        To: [
          {
            Email: options.to,
            Name: options.toName || options.to,
          },
        ],
        Subject: options.subject,
        TextPart: options.text,
        HTMLPart: options.html || options.text,
      },
    ],
  });

  return request;
}

/**
 * Send email with Gmail primary, Mailjet fallback
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.toName - Recipient name (optional)
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content (optional)
 * @param {string} options.from - Sender email (optional, uses GMAIL_USER or EMAIL_FROM)
 * @param {string} options.fromName - Sender name (optional)
 * @returns {Promise<Object>} Send result
 */
export async function sendEmail(options) {
  const { to, toName, subject, text, html, from, fromName } = options;

  if (!to || !subject || !text) {
    throw new Error('Missing required email fields: to, subject, text');
  }

  const emailOptions = {
    from: from || process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@kisheka.com',
    fromName: fromName || process.env.EMAIL_FROM_NAME || 'Doshaki Construction',
    to,
    toName,
    subject,
    text,
    html: html || text,
  };

  // Try Gmail first
  try {
    const transporter = createGmailTransporter();
    if (transporter) {
      const result = await transporter.sendMail({
        from: `"${emailOptions.fromName}" <${emailOptions.from}>`,
        to: emailOptions.toName ? `"${emailOptions.toName}" <${emailOptions.to}>` : emailOptions.to,
        subject: emailOptions.subject,
        text: emailOptions.text,
        html: emailOptions.html,
      });

      console.log('Email sent via Gmail:', result.messageId);
      return {
        success: true,
        provider: 'gmail',
        messageId: result.messageId,
      };
    }
  } catch (error) {
    console.error('Gmail send error:', error);
    // Fall through to Mailjet
  }

  // Fallback to Mailjet
  try {
    const result = await sendViaMailjet(emailOptions);
    console.log('Email sent via Mailjet:', result.body);
    return {
      success: true,
      provider: 'mailjet',
      messageId: result.body.Messages[0].To[0].MessageID,
    };
  } catch (error) {
    console.error('Mailjet send error:', error);
    throw new Error(`Failed to send email via both providers: ${error.message}`);
  }
}

/**
 * Send user invitation email
 * @param {Object} options - Invitation options
 * @param {string} options.email - Recipient email
 * @param {string} options.inviterName - Name of person sending invitation
 * @param {string} options.role - Assigned role
 * @param {string} options.token - Invitation token
 * @param {string} options.expiresAt - Expiration date
 * @returns {Promise<Object>} Send result
 */
export async function sendInvitationEmail(options) {
  const { email, inviterName, role, token, expiresAt } = options;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const invitationUrl = `${appUrl}/auth/register?token=${token}`;

  const roleDisplay = {
    owner: 'Owner',
    investor: 'Investor',
    pm: 'Project Manager',
    project_manager: 'Project Manager',
    supervisor: 'Supervisor',
    site_clerk: 'Clerk',
    accountant: 'Accountant',
    supplier: 'Supplier',
  }[role] || role;

  const expiresDate = new Date(expiresAt).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitation to Doshaki Construction</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #2563eb; margin-top: 0;">You've been invited!</h1>
        <p>Hello,</p>
        <p><strong>${inviterName}</strong> has invited you to join the <strong>Doshaki Construction</strong> system as a <strong>${roleDisplay}</strong>.</p>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #1f2937; margin-top: 0;">What's next?</h2>
        <p>Click the button below to accept the invitation and create your account:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invitationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
        </div>
        <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
          Or copy and paste this link into your browser:<br>
          <a href="${invitationUrl}" style="color: #2563eb; word-break: break-all;">${invitationUrl}</a>
        </p>
      </div>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 14px;">
          <strong>⏰ Important:</strong> This invitation expires on <strong>${expiresDate}</strong>. Please accept it before then.
        </p>
      </div>

      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
        <p style="margin: 10px 0 0 0;">
          This is an automated message from Doshaki Construction System.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
You've been invited to Doshaki Construction!

${inviterName} has invited you to join the Doshaki Construction system as a ${roleDisplay}.

To accept this invitation, click the link below or copy it into your browser:
${invitationUrl}

Important: This invitation expires on ${expiresDate}. Please accept it before then.

If you didn't expect this invitation, you can safely ignore this email.

This is an automated message from Doshaki Construction System.
  `.trim();

  return sendEmail({
    to: email,
    subject: `Invitation to join Doshaki Construction as ${roleDisplay}`,
    text,
    html,
  });
}

/**
 * Send role change notification email
 * @param {Object} options - Notification options
 * @param {string} options.email - Recipient email
 * @param {string} options.userName - User name
 * @param {string} options.oldRole - Previous role
 * @param {string} options.newRole - New role
 * @param {string} options.changedBy - Name of person who made the change
 * @param {string} options.reason - Reason for change (optional)
 * @returns {Promise<Object>} Send result
 */
export async function sendRoleChangeEmail(options) {
  const { email, userName, oldRole, newRole, changedBy, reason } = options;

  const roleDisplay = (role) => {
    const map = {
      owner: 'Owner',
      investor: 'Investor',
      pm: 'Project Manager',
      project_manager: 'Project Manager',
      supervisor: 'Supervisor',
      site_clerk: 'Clerk',
      accountant: 'Accountant',
      supplier: 'Supplier',
    };
    return map[role] || role;
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Role Updated - Doshaki Construction</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #2563eb; margin-top: 0;">Your Role Has Been Updated</h1>
        <p>Hello ${userName || 'there'},</p>
        <p>Your role in the Doshaki Construction system has been updated.</p>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #1f2937; margin-top: 0;">Role Change Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 120px;">Previous Role:</td>
            <td style="padding: 8px 0;">${roleDisplay(oldRole)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">New Role:</td>
            <td style="padding: 8px 0; color: #2563eb; font-weight: bold;">${roleDisplay(newRole)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Changed By:</td>
            <td style="padding: 8px 0;">${changedBy}</td>
          </tr>
          ${reason ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Reason:</td>
            <td style="padding: 8px 0;">${reason}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 14px;">
          <strong>ℹ️ Note:</strong> You may need to log out and log back in to see your new permissions take effect.
        </p>
      </div>

      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">
          This is an automated notification from Doshaki Construction System.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
Your Role Has Been Updated

Hello ${userName || 'there'},

Your role in the Doshaki Construction system has been updated.

Role Change Details:
- Previous Role: ${roleDisplay(oldRole)}
- New Role: ${roleDisplay(newRole)}
- Changed By: ${changedBy}
${reason ? `- Reason: ${reason}` : ''}

Note: You may need to log out and log back in to see your new permissions take effect.

This is an automated notification from Doshaki Construction System.
  `.trim();

  return sendEmail({
    to: email,
    subject: 'Your Role Has Been Updated - Doshaki Construction',
    text,
    html,
  });
}

