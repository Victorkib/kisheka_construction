import { sendEmail } from '../email-service';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Send owner/request-side alert when supplier responds to a purchase order.
 */
export async function sendOwnerSupplierResponseEmail({
  recipientUser,
  purchaseOrder,
  action,
  responseData = {}
}) {
  if (!recipientUser?.email) {
    throw new Error('Recipient email is required');
  }

  const actionLabelMap = {
    accept: 'Accepted',
    reject: 'Rejected',
    modify: 'Requested Modifications',
    partial: 'Partially Responded'
  };
  const actionLabel = actionLabelMap[action] || 'Responded';
  const poNumber = purchaseOrder.purchaseOrderNumber || 'Unknown PO';
  const supplierName = purchaseOrder.supplierName || 'Supplier';
  const poUrl = `${APP_URL}/purchase-orders/${purchaseOrder._id?.toString?.() || purchaseOrder._id || ''}`;

  const details = [];
  if (responseData.notes) details.push(`Notes: ${responseData.notes}`);
  if (responseData.rejectionReason) details.push(`Rejection Reason: ${responseData.rejectionReason}`);
  if (responseData.rejectionSubcategory) details.push(`Rejection Subcategory: ${responseData.rejectionSubcategory}`);
  if (typeof responseData.acceptedCount === 'number') details.push(`Accepted Materials: ${responseData.acceptedCount}`);
  if (typeof responseData.rejectedCount === 'number') details.push(`Rejected Materials: ${responseData.rejectedCount}`);
  if (typeof responseData.modifiedCount === 'number') details.push(`Modified Materials: ${responseData.modifiedCount}`);
  const detailsHtml = details.length > 0
    ? `<ul style="margin: 8px 0 0 18px;">${details.map(d => `<li>${d}</li>`).join('')}</ul>`
    : '<p style="margin: 8px 0 0 0;">No extra details were provided.</p>';

  const subject = `Supplier ${actionLabel}: ${poNumber}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937;">Supplier Response Update</h2>
      <p>Hello ${recipientUser.firstName || recipientUser.email},</p>
      <p><strong>${supplierName}</strong> has <strong>${actionLabel.toLowerCase()}</strong> purchase order <strong>${poNumber}</strong>.</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin: 14px 0;">
        <p style="margin: 0;"><strong>Action:</strong> ${actionLabel}</p>
        ${detailsHtml}
      </div>
      <p><a href="${poUrl}" style="display: inline-block; background-color: #2563eb; color: #fff; padding: 10px 16px; text-decoration: none; border-radius: 6px;">View Purchase Order</a></p>
      <p style="font-size: 12px; color: #6b7280;">Automated message from Doshaki Construction.</p>
    </body>
    </html>
  `;

  const text = `
Supplier Response Update

Hello ${recipientUser.firstName || recipientUser.email},

${supplierName} has ${actionLabel.toLowerCase()} purchase order ${poNumber}.
Action: ${actionLabel}
${details.length > 0 ? details.map(d => `- ${d}`).join('\n') : 'No extra details were provided.'}

View PO: ${poUrl}
  `.trim();

  return sendEmail({
    to: recipientUser.email,
    toName: `${recipientUser.firstName || ''} ${recipientUser.lastName || ''}`.trim() || recipientUser.email,
    subject,
    text,
    html
  });
}

/**
 * Send supplier email when owner/PM confirms delivery.
 */
export async function sendSupplierDeliveryConfirmedEmail({
  supplier,
  purchaseOrder,
  deliverySummary = {}
}) {
  if (!supplier?.email) {
    throw new Error('Supplier email is required');
  }

  const poNumber = purchaseOrder.purchaseOrderNumber || 'Unknown PO';
  const deliveryDate = deliverySummary.deliveryDate || new Date();
  const dateText = new Date(deliveryDate).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const supplierName = supplier.contactPerson || supplier.name || 'Supplier';
  const confirmedBy = deliverySummary.confirmedBy || 'Project team';
  const projectName = deliverySummary.projectName || purchaseOrder.projectName || 'your project';
  const itemSummary = deliverySummary.itemSummary || purchaseOrder.materialName || `${purchaseOrder.quantityOrdered || ''} ${purchaseOrder.unit || ''}`.trim();

  const receivedItems = Array.isArray(deliverySummary.items) && deliverySummary.items.length > 0
    ? deliverySummary.items
    : Array.isArray(purchaseOrder.materials) && purchaseOrder.materials.length > 0
      ? purchaseOrder.materials.map((material) => ({
          name: material.materialName || material.name || 'Material',
          quantity: material.quantity || material.quantityNeeded || null,
          unit: material.unit || ''
        }))
      : [{
          name: purchaseOrder.materialName || 'Material',
          quantity: purchaseOrder.quantityOrdered || null,
          unit: purchaseOrder.unit || ''
        }];

  const receivedItemsText = receivedItems
    .map((item) => {
      const qty = item.quantity !== null && item.quantity !== undefined ? `${item.quantity}` : '';
      const unit = item.unit ? ` ${item.unit}` : '';
      return `- ${item.name}${qty ? ` (${qty}${unit})` : ''}`;
    })
    .join('\n');
  const receivedItemsHtml = `<ul style="margin: 8px 0 0 18px; padding: 0;">${receivedItems
    .map((item) => {
      const qty = item.quantity !== null && item.quantity !== undefined ? `${item.quantity}` : '';
      const unit = item.unit ? ` ${item.unit}` : '';
      return `<li style="margin: 0 0 6px 0;">${item.name}${qty ? ` (${qty}${unit})` : ''}</li>`;
    })
    .join('')}</ul>`;

  const subject = `Goods Receipt Confirmed: ${poNumber}`;
  const text = `
Goods Receipt Confirmed

Hello ${supplierName},

We have confirmed receipt of the goods you delivered for purchase order ${poNumber}.

Project: ${projectName}
Confirmed On: ${dateText}
Confirmed By: ${confirmedBy}

Received Items:
${receivedItemsText || `- ${itemSummary}`}

Thank you for your delivery. You may proceed with invoice/payment follow-up as agreed.
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937;">Goods Receipt Confirmed</h2>
      <p>Hello ${supplierName},</p>
      <p>We have confirmed receipt of the goods you delivered for purchase order <strong>${poNumber}</strong>.</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin: 14px 0;">
        <p style="margin: 0;"><strong>Project:</strong> ${projectName}</p>
        <p style="margin: 4px 0 0 0;"><strong>Confirmed On:</strong> ${dateText}</p>
        <p style="margin: 4px 0 0 0;"><strong>Confirmed By:</strong> ${confirmedBy}</p>
        <div style="margin-top: 10px;">
          <p style="margin: 0;"><strong>Received Items:</strong></p>
          ${receivedItemsHtml}
        </div>
      </div>
      <p>Thank you for your delivery. You may proceed with invoice/payment follow-up as agreed.</p>
      <p style="font-size: 12px; color: #6b7280;">Automated message from Doshaki Construction.</p>
    </body>
    </html>
  `;

  return sendEmail({
    to: supplier.email,
    toName: supplier.contactPerson || supplier.name || supplier.email,
    subject,
    text,
    html
  });
}

