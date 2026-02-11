/**
 * Error Report API Endpoint
 * Receives error reports and sends email to developer
 * 
 * Route: POST /api/error-report
 */

import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email-service';

function getErrorReportEmail() {
  return process.env.ERROR_REPORT_EMAIL || 'qinalexander56@gmail.com';
}

function isErrorReportEnabled() {
  return process.env.ERROR_REPORT_ENABLED !== 'false';
}

export async function POST(request) {
  try {
    if (!isErrorReportEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Error reporting is disabled' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      errorMessage,
      errorStack,
      errorType,
      userDescription,
      stepsToReproduce,
      url,
      userAgent,
      screenSize,
      timestamp,
      user,
      project,
      componentStack,
      additionalInfo,
    } = body;

    // Validate required fields
    if (!errorMessage && !userDescription) {
      return NextResponse.json(
        { success: false, error: 'Error message or user description is required' },
        { status: 400 }
      );
    }

    // Sanitize data (remove sensitive information)
    const sanitizedData = {
      errorMessage: sanitizeString(errorMessage || 'No error message provided'),
      errorStack: sanitizeString(errorStack || ''),
      errorType: sanitizeString(errorType || 'unknown'),
      userDescription: sanitizeString(userDescription || ''),
      stepsToReproduce: sanitizeString(stepsToReproduce || ''),
      url: sanitizeString(url || ''),
      userAgent: sanitizeString(userAgent || ''),
      screenSize: sanitizeString(screenSize || ''),
      timestamp: sanitizeString(timestamp || new Date().toISOString()),
      user: user ? {
        id: user.id || user._id || 'unknown',
        email: user.email || 'unknown',
        role: user.role || 'unknown',
        name: user.name || 'unknown',
      } : null,
      project: project ? {
        id: project.id || project._id || 'unknown',
      } : null,
      componentStack: sanitizeString(componentStack || ''),
      additionalInfo: sanitizeString(additionalInfo || ''),
    };

    // Create email content
    const emailSubject = `[Doshaki Error Report] ${sanitizedData.errorType} - ${new Date(sanitizedData.timestamp).toLocaleString()}`;
    
    const emailText = formatErrorReportText(sanitizedData);
    const emailHtml = formatErrorReportHtml(sanitizedData);

    // Send email
    try {
      await sendEmail({
        to: getErrorReportEmail(),
        toName: 'Doshaki Developer',
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      });

      // Optionally store in database for tracking (commented out - requires MongoDB connection)
      // Uncomment and configure if you want to store error reports in database
      /*
      try {
        const { connectToDatabase } = await import('@/lib/mongodb');
        const { db } = await connectToDatabase();
        await db.collection('error_reports').insertOne({
          ...sanitizedData,
          reportedAt: new Date(),
          emailSent: true,
        });
      } catch (dbError) {
        console.error('Failed to store error report in database:', dbError);
        // Don't fail the request if DB storage fails
      }
      */

      return NextResponse.json({
        success: true,
        message: 'Error report sent successfully',
      });
    } catch (emailError) {
      console.error('Failed to send error report email:', emailError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send error report',
          details: emailError.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing error report:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process error report',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Sanitize string to remove sensitive data
 */
function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  
  // Remove potential sensitive patterns
  return str
    .replace(/password["\s:=]+[^\s"']+/gi, 'password: [REDACTED]')
    .replace(/token["\s:=]+[^\s"']+/gi, 'token: [REDACTED]')
    .replace(/api[_-]?key["\s:=]+[^\s"']+/gi, 'api_key: [REDACTED]')
    .replace(/secret["\s:=]+[^\s"']+/gi, 'secret: [REDACTED]')
    .substring(0, 10000); // Limit length
}

/**
 * Format error report as plain text
 */
function formatErrorReportText(data) {
  return `
Doshaki Construction - Error Report
====================================

Error Type: ${data.errorType}
Timestamp: ${new Date(data.timestamp).toLocaleString()}
URL: ${data.url}

Error Message:
${data.errorMessage}

${data.errorStack ? `Stack Trace:\n${data.errorStack}` : ''}

${data.componentStack ? `Component Stack:\n${data.componentStack}` : ''}

User Description:
${data.userDescription || 'No description provided'}

Steps to Reproduce:
${data.stepsToReproduce || 'Not provided'}

User Information:
${data.user ? `- ID: ${data.user.id}\n- Email: ${data.user.email}\n- Role: ${data.user.role}\n- Name: ${data.user.name}` : 'Not logged in'}

Project Context:
${data.project ? `- Project ID: ${data.project.id}` : 'No project context'}

Browser/Device:
- User Agent: ${data.userAgent}
- Screen Size: ${data.screenSize}

${data.additionalInfo ? `Additional Info:\n${data.additionalInfo}` : ''}

---
This is an automated error report from Doshaki Construction System.
  `.trim();
}

/**
 * Format error report as HTML
 */
function formatErrorReportHtml(data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error Report - Doshaki Construction</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 24px;">⚠️ Error Report - Doshaki Construction</h1>
  </div>

  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #1f2937; margin-top: 0;">Error Summary</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 150px;">Error Type:</td>
        <td style="padding: 8px 0;">${escapeHtml(data.errorType)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Timestamp:</td>
        <td style="padding: 8px 0;">${escapeHtml(new Date(data.timestamp).toLocaleString())}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">URL:</td>
        <td style="padding: 8px 0;"><a href="${escapeHtml(data.url)}" style="color: #2563eb;">${escapeHtml(data.url)}</a></td>
      </tr>
    </table>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #1f2937; margin-top: 0;">Error Message</h2>
    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; font-family: monospace; white-space: pre-wrap; word-break: break-all;">
      ${escapeHtml(data.errorMessage)}
    </div>
  </div>

  ${data.errorStack ? `
  <details style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <summary style="cursor: pointer; font-weight: bold; color: #1f2937; margin-bottom: 10px;">Stack Trace</summary>
    <pre style="background-color: #f3f4f6; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all;">${escapeHtml(data.errorStack)}</pre>
  </details>
  ` : ''}

  ${data.componentStack ? `
  <details style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <summary style="cursor: pointer; font-weight: bold; color: #1f2937; margin-bottom: 10px;">Component Stack</summary>
    <pre style="background-color: #f3f4f6; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all;">${escapeHtml(data.componentStack)}</pre>
  </details>
  ` : ''}

  ${data.userDescription ? `
  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #1f2937; margin-top: 0;">User Description</h2>
    <p style="white-space: pre-wrap;">${escapeHtml(data.userDescription)}</p>
  </div>
  ` : ''}

  ${data.stepsToReproduce ? `
  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #1f2937; margin-top: 0;">Steps to Reproduce</h2>
    <p style="white-space: pre-wrap;">${escapeHtml(data.stepsToReproduce)}</p>
  </div>
  ` : ''}

  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #1f2937; margin-top: 0;">User Information</h2>
    ${data.user ? `
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 150px;">User ID:</td>
        <td style="padding: 8px 0;">${escapeHtml(data.user.id)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Email:</td>
        <td style="padding: 8px 0;">${escapeHtml(data.user.email)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Role:</td>
        <td style="padding: 8px 0;">${escapeHtml(data.user.role)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Name:</td>
        <td style="padding: 8px 0;">${escapeHtml(data.user.name)}</td>
      </tr>
    </table>
    ` : '<p>User not logged in</p>'}
  </div>

  ${data.project ? `
  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #1f2937; margin-top: 0;">Project Context</h2>
    <p>Project ID: <strong>${escapeHtml(data.project.id)}</strong></p>
  </div>
  ` : ''}

  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #1f2937; margin-top: 0;">Browser/Device Information</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 150px;">User Agent:</td>
        <td style="padding: 8px 0; font-size: 12px; word-break: break-all;">${escapeHtml(data.userAgent)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">Screen Size:</td>
        <td style="padding: 8px 0;">${escapeHtml(data.screenSize)}</td>
      </tr>
    </table>
  </div>

  ${data.additionalInfo ? `
  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h2 style="color: #1f2937; margin-top: 0;">Additional Information</h2>
    <p style="white-space: pre-wrap;">${escapeHtml(data.additionalInfo)}</p>
  </div>
  ` : ''}

  <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 12px; color: #6b7280; text-align: center;">
    <p style="margin: 0;">This is an automated error report from Doshaki Construction System.</p>
    <p style="margin: 10px 0 0 0;">Generated at ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}
