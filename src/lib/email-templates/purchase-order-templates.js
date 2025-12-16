/**
 * Purchase Order Email Templates
 * Templates for purchase order-related emails
 */

import { sendEmail } from '../email-service';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Send purchase order email to supplier
 * @param {Object} options - Email options
 * @param {Object} options.supplier - Supplier object
 * @param {Object} options.purchaseOrder - Purchase order object
 * @param {string} options.responseToken - Token for response links
 * @param {Object} [options.project] - Project object (optional)
 * @param {Object} [options.batch] - Batch object (optional, for bulk orders)
 * @returns {Promise<Object>} Send result
 */
export async function sendPurchaseOrderEmail({ supplier, purchaseOrder, responseToken, project = null, batch = null }) {
  const {
    purchaseOrderNumber,
    materialName,
    description,
    quantityOrdered,
    unit,
    unitCost,
    totalCost,
    deliveryDate,
    terms,
    notes
  } = purchaseOrder;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const responseUrl = `${APP_URL}/purchase-orders/respond/${responseToken}`;
  const acceptUrl = `${responseUrl}?action=accept`;
  const rejectUrl = `${responseUrl}?action=reject`;
  const modifyUrl = `${responseUrl}?action=modify`;
  // Get PO ID - handle both ObjectId and string formats
  const poId = purchaseOrder._id?.toString ? purchaseOrder._id.toString() : (purchaseOrder._id || '');
  const downloadUrl = poId ? `${APP_URL}/api/purchase-orders/${poId}/download?token=${responseToken}` : responseUrl;

  const subject = `New Purchase Order: ${purchaseOrderNumber}`;

  // Build materials breakdown for bulk orders
  let materialsBreakdownHtml = '';
  let materialsBreakdownText = '';
  if (purchaseOrder.isBulkOrder && purchaseOrder.materials && Array.isArray(purchaseOrder.materials)) {
    materialsBreakdownHtml = `
      <div style="margin-top: 15px;">
        <h3 style="color: #1f2937; margin-bottom: 10px; font-size: 14px;">Materials Breakdown:</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Material</th>
              <th style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Quantity</th>
              <th style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Unit Cost</th>
              <th style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${purchaseOrder.materials.map((m, idx) => `
              <tr style="${idx % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f9fafb;'}">
                <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${m.materialName || m.name || 'N/A'}</td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb;">${m.quantity || m.quantityNeeded || 0} ${m.unit || ''}</td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb;">${formatCurrency(m.unitCost || 0)}</td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${formatCurrency(m.totalCost || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    materialsBreakdownText = purchaseOrder.materials.map((m, idx) => 
      `  ${idx + 1}. ${m.materialName || m.name || 'N/A'}: ${m.quantity || m.quantityNeeded || 0} ${m.unit || ''} @ ${formatCurrency(m.unitCost || 0)} = ${formatCurrency(m.totalCost || 0)}`
    ).join('\n');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #2563eb; margin-top: 0;">New Purchase Order</h1>
        <p>Hello ${supplier.contactPerson || supplier.name},</p>
        <p>You have received a new purchase order from <strong>Kisheka Construction</strong>.</p>
        ${project ? `<p><strong>Project:</strong> ${project.projectName || 'N/A'}${project.location ? ` - ${project.location}` : ''}</p>` : ''}
        ${batch ? `<p><strong>Batch:</strong> ${batch.batchNumber || 'N/A'}${batch.batchName ? ` - ${batch.batchName}` : ''}</p>` : ''}
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #1f2937; margin-top: 0;">Order Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 150px;">Order Number:</td>
            <td style="padding: 8px 0;">${purchaseOrderNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Material:</td>
            <td style="padding: 8px 0;">${materialName}</td>
          </tr>
          ${description ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Description:</td>
            <td style="padding: 8px 0;">${description}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Quantity:</td>
            <td style="padding: 8px 0;">${quantityOrdered} ${unit}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Unit Cost:</td>
            <td style="padding: 8px 0;">${formatCurrency(unitCost)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Total Cost:</td>
            <td style="padding: 8px 0; color: #2563eb; font-weight: bold; font-size: 1.1em;">${formatCurrency(totalCost)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Delivery Date:</td>
            <td style="padding: 8px 0;">${formatDate(deliveryDate)}</td>
          </tr>
          ${terms ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Terms:</td>
            <td style="padding: 8px 0;">${terms}</td>
          </tr>
          ` : ''}
          ${notes ? `
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Notes:</td>
            <td style="padding: 8px 0;">${notes}</td>
          </tr>
          ` : ''}
        </table>
        ${materialsBreakdownHtml}
      </div>

      <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #1e40af;">How to Respond</h3>
        <p style="margin-bottom: 10px;">Please respond to this order by clicking one of the buttons below:</p>
        <div style="margin: 20px 0;">
          <a href="${acceptUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px; margin-bottom: 10px;">Accept Order</a>
          <a href="${rejectUrl}" style="display: inline-block; background-color: #ef4444; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px; margin-bottom: 10px;">Reject Order</a>
          <a href="${modifyUrl}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 10px;">Modify Order</a>
        </div>
        <p style="font-size: 14px; margin-top: 15px;">
          Or copy and paste this link into your browser:<br>
          <a href="${responseUrl}" style="color: #2563eb; word-break: break-all;">${responseUrl}</a>
        </p>
        <p style="font-size: 14px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #bfdbfe;">
          <strong>📄 Download PDF:</strong> You can download a complete PDF copy of this purchase order from the response page or by clicking <a href="${downloadUrl}" style="color: #2563eb;">here</a>.
        </p>
      </div>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 14px;">
          <strong>⏰ Important:</strong> Please respond to this order as soon as possible. If you have any questions, please contact us.
        </p>
      </div>

      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 12px; color: #6b7280; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: bold; margin-bottom: 5px;">Contact Information:</p>
        <p style="margin: 2px 0;">Kisheka Construction</p>
        <p style="margin: 2px 0;">Email: ${process.env.COMPANY_EMAIL || 'info@kisheka.com'}</p>
        ${process.env.COMPANY_PHONE ? `<p style="margin: 2px 0;">Phone: ${process.env.COMPANY_PHONE}</p>` : ''}
        ${process.env.COMPANY_ADDRESS ? `<p style="margin: 2px 0;">Address: ${process.env.COMPANY_ADDRESS}</p>` : ''}
      </div>

      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">
          This is an automated message from Kisheka Construction System.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
New Purchase Order: ${purchaseOrderNumber}

Hello ${supplier.contactPerson || supplier.name},

You have received a new purchase order from Kisheka Construction.

${project ? `Project: ${project.projectName || 'N/A'}${project.location ? ` - ${project.location}` : ''}\n` : ''}${batch ? `Batch: ${batch.batchNumber || 'N/A'}${batch.batchName ? ` - ${batch.batchName}` : ''}\n` : ''}
Order Details:
- Order Number: ${purchaseOrderNumber}
- Material: ${materialName}
${description ? `- Description: ${description}` : ''}
- Quantity: ${quantityOrdered} ${unit}
- Unit Cost: ${formatCurrency(unitCost)}
- Total Cost: ${formatCurrency(totalCost)}
- Delivery Date: ${formatDate(deliveryDate)}
${terms ? `- Terms: ${terms}` : ''}
${notes ? `- Notes: ${notes}` : ''}
${materialsBreakdownText ? `\nMaterials Breakdown:\n${materialsBreakdownText}` : ''}

How to Respond:
Please respond to this order by visiting one of these links:

Accept Order: ${acceptUrl}
Reject Order: ${rejectUrl}
Modify Order: ${modifyUrl}

Or visit: ${responseUrl}

Download PDF: ${downloadUrl}

Important: Please respond to this order as soon as possible.

Contact Information:
Kisheka Construction
Email: ${process.env.COMPANY_EMAIL || 'info@kisheka.com'}
${process.env.COMPANY_PHONE ? `Phone: ${process.env.COMPANY_PHONE}` : ''}
${process.env.COMPANY_ADDRESS ? `Address: ${process.env.COMPANY_ADDRESS}` : ''}

This is an automated message from Kisheka Construction System.
  `.trim();

  return sendEmail({
    to: supplier.email,
    toName: supplier.contactPerson || supplier.name,
    subject,
    text,
    html
  });
}

/**
 * Send purchase order reminder email
 * @param {Object} options - Email options
 * @param {Object} options.supplier - Supplier object
 * @param {Object} options.purchaseOrder - Purchase order object
 * @param {string} options.responseToken - Token for response links
 * @returns {Promise<Object>} Send result
 */
export async function sendPurchaseOrderReminderEmail({ supplier, purchaseOrder, responseToken }) {
  const { purchaseOrderNumber, materialName, quantityOrdered, unit, totalCost } = purchaseOrder;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const responseUrl = `${APP_URL}/purchase-orders/respond/${responseToken}`;

  const subject = `Reminder: Purchase Order ${purchaseOrderNumber} Pending Response`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
        <h1 style="color: #d97706; margin-top: 0;">Reminder: Purchase Order Pending</h1>
        <p>Hello ${supplier.contactPerson || supplier.name},</p>
        <p>This is a reminder that purchase order <strong>${purchaseOrderNumber}</strong> is still pending your response.</p>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #1f2937; margin-top: 0;">Order Summary</h2>
        <p><strong>Material:</strong> ${materialName}</p>
        <p><strong>Quantity:</strong> ${quantityOrdered} ${unit}</p>
        <p><strong>Total Cost:</strong> ${formatCurrency(totalCost)}</p>
      </div>

      <div style="background-color: #dbeafe; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 20px;">
        <p style="margin: 0;">
          <a href="${responseUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Respond to Order
          </a>
        </p>
        <p style="font-size: 14px; margin-top: 15px;">
          Or copy this link: <a href="${responseUrl}" style="color: #2563eb; word-break: break-all;">${responseUrl}</a>
        </p>
      </div>

      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">
          This is an automated reminder from Kisheka Construction System.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
Reminder: Purchase Order ${purchaseOrderNumber} Pending Response

Hello ${supplier.contactPerson || supplier.name},

This is a reminder that purchase order ${purchaseOrderNumber} is still pending your response.

Order Summary:
- Material: ${materialName}
- Quantity: ${quantityOrdered} ${unit}
- Total Cost: ${formatCurrency(totalCost)}

Please respond by visiting: ${responseUrl}

This is an automated reminder from Kisheka Construction System.
  `.trim();

  return sendEmail({
    to: supplier.email,
    toName: supplier.contactPerson || supplier.name,
    subject,
    text,
    html
  });
}

