/**
 * SMS Service - Africa's Talking Integration
 * Handles SMS sending and webhook processing for supplier communications
 * 
 * Configuration:
 * - Africa's Talking API for SMS delivery
 * - Webhook support for SMS replies
 * - Keyword recognition for automated processing
 */

const AFRICASTALKING_API_KEY = process.env.AFRICASTALKING_API_KEY;
const AFRICASTALKING_USERNAME = process.env.AFRICASTALKING_USERNAME;
const AFRICASTALKING_SENDER_ID = process.env.AFRICASTALKING_SENDER_ID || 'KISHEKA';
const SMS_ENABLED = process.env.SMS_ENABLED === 'true' || false;

/**
 * Send SMS via Africa's Talking
 * @param {Object} options - SMS options
 * @param {string} options.to - Recipient phone number (with country code, e.g., +254712345678)
 * @param {string} options.message - SMS message content
 * @returns {Promise<Object>} Send result with messageId
 */
export async function sendSMS({ to, message }) {
  if (!SMS_ENABLED) {
    console.log('SMS is disabled. Skipping SMS send.');
    return {
      success: false,
      error: 'SMS is disabled',
      skipped: true
    };
  }

  if (!AFRICASTALKING_API_KEY || !AFRICASTALKING_USERNAME) {
    console.error('Africa\'s Talking credentials not configured');
    throw new Error('Africa\'s Talking credentials not configured');
  }

  if (!to || !message) {
    throw new Error('Recipient phone number and message are required');
  }

  try {
    // Format phone number (ensure it starts with +)
    const formattedPhone = to.startsWith('+') ? to : `+${to}`;

    const response = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'ApiKey': AFRICASTALKING_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        username: AFRICASTALKING_USERNAME,
        to: formattedPhone,
        message: message,
        from: AFRICASTALKING_SENDER_ID
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Africa\'s Talking API error:', errorText);
      throw new Error(`SMS send failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check response structure
    if (data.SMSMessageData?.Recipients?.[0]?.statusCode === 101) {
      return {
        success: true,
        messageId: data.SMSMessageData.Recipients[0].messageId,
        provider: 'africas_talking',
        status: data.SMSMessageData.Recipients[0].status
      };
    } else {
      const errorMessage = data.SMSMessageData?.Recipients?.[0]?.status || 'SMS send failed';
      console.error('SMS send error:', errorMessage);
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('SMS send error:', error);
    throw error;
  }
}

/**
 * Parse SMS reply for purchase order confirmation
 * Extracts action (accept/reject/modify) and purchase order number from SMS text
 * @param {string} smsText - SMS message text
 * @returns {Object} Parsed result with action and optional PO number
 */
export function parseSMSReply(smsText) {
  if (!smsText || typeof smsText !== 'string') {
    return { action: null, purchaseOrderNumber: null };
  }

  const text = smsText.toUpperCase().trim();
  
  // Keywords for actions
  const acceptKeywords = ['ACCEPT', 'YES', 'OK', 'CONFIRM', 'APPROVE'];
  const rejectKeywords = ['REJECT', 'NO', 'DECLINE', 'CANCEL', 'REFUSE'];
  const modifyKeywords = ['MODIFY', 'CHANGE', 'UPDATE', 'EDIT'];

  // Extract purchase order number (format: PO-YYYYMMDD-001 or PO-001)
  const poMatch = text.match(/PO[-\s]?(\d{8}-\d{3}|\d{3})/i);
  const purchaseOrderNumber = poMatch ? poMatch[0].replace(/[-\s]/g, '-') : null;

  // Determine action
  let action = null;
  if (acceptKeywords.some(keyword => text.includes(keyword))) {
    action = 'accept';
  } else if (rejectKeywords.some(keyword => text.includes(keyword))) {
    action = 'reject';
  } else if (modifyKeywords.some(keyword => text.includes(keyword))) {
    action = 'modify';
  }

  return {
    action,
    purchaseOrderNumber,
    originalText: smsText
  };
}

/**
 * Generate SMS message for purchase order
 * @param {Object} options - Purchase order details
 * @param {string} options.purchaseOrderNumber - PO number
 * @param {string} options.materialName - Material name
 * @param {number} options.quantity - Quantity ordered
 * @param {string} options.unit - Unit of measurement
 * @param {number} options.totalCost - Total cost
 * @param {string} options.responseToken - Token for response link
 * @param {string} options.shortLink - Short URL for full details
 * @returns {string} Formatted SMS message
 */
export function generatePurchaseOrderSMS({ purchaseOrderNumber, materialName, quantity, unit, totalCost, shortLink, deliveryDate = null, unitCost = null }) {
  // Format delivery date if provided
  const deliveryDateStr = deliveryDate 
    ? new Date(deliveryDate).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })
    : null;
  
  // Build message with delivery date if available
  let message = `New PO: ${purchaseOrderNumber}\nMaterial: ${materialName}\nQty: ${quantity} ${unit}`;
  
  if (unitCost !== null && unitCost > 0) {
    message += `\nUnit: KES ${unitCost.toLocaleString()}`;
  }
  
  message += `\nTotal: KES ${totalCost.toLocaleString()}`;
  
  if (deliveryDateStr) {
    message += `\nDelivery: ${deliveryDateStr}`;
  }
  
  message += `\nReply ACCEPT/REJECT\nDetails: ${shortLink || 'Contact us'}`;
  
  // If message is too long, truncate material name
  if (message.length > 160) {
    const baseLength = message.length - materialName.length;
    const maxMaterialLength = Math.max(10, 160 - baseLength - 10);
    const truncatedMaterial = materialName.length > maxMaterialLength 
      ? materialName.substring(0, maxMaterialLength) + '...'
      : materialName;
    
    // Rebuild message with truncated material
    message = `New PO: ${purchaseOrderNumber}\nMaterial: ${truncatedMaterial}\nQty: ${quantity} ${unit}`;
    
    if (unitCost !== null && unitCost > 0) {
      message += `\nUnit: KES ${unitCost.toLocaleString()}`;
    }
    
    message += `\nTotal: KES ${totalCost.toLocaleString()}`;
    
    if (deliveryDateStr) {
      message += `\nDelivery: ${deliveryDateStr}`;
    }
    
    message += `\nReply ACCEPT/REJECT\nDetails: ${shortLink || 'Contact us'}`;
  }
  
  return message;
}

/**
 * Generate SMS reminder message
 * @param {Object} options - Reminder details
 * @param {string} options.purchaseOrderNumber - PO number
 * @param {string} options.contactPhone - Contact phone for questions
 * @returns {string} Formatted reminder SMS
 */
export function generateReminderSMS({ purchaseOrderNumber, contactPhone }) {
  return `Reminder: PO-${purchaseOrderNumber} pending response. Reply ACCEPT/REJECT or contact ${contactPhone}`;
}

/**
 * Generate SMS confirmation message
 * @param {Object} options - Confirmation details
 * @param {string} options.purchaseOrderNumber - PO number
 * @param {string} options.action - Action taken (accept/reject)
 * @param {Date} options.deliveryDate - Expected delivery date (optional)
 * @returns {string} Formatted confirmation SMS
 */
export function generateConfirmationSMS({ purchaseOrderNumber, action, deliveryDate }) {
  const actionText = action === 'accept' ? 'ACCEPTED' : action === 'reject' ? 'REJECTED' : 'UPDATED';
  let message = `Thank you! PO-${purchaseOrderNumber} ${actionText}.`;
  
  if (action === 'accept' && deliveryDate) {
    const dateStr = new Date(deliveryDate).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    message += ` Delivery expected: ${dateStr}.`;
  }
  
  message += ' We\'ll contact you soon.';
  return message;
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid format
 */
export function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, '');
  
  // Check if starts with + and has 10-15 digits after country code
  const phoneRegex = /^\+[1-9]\d{9,14}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Format phone number with country code
 * @param {string} phone - Phone number
 * @param {string} defaultCountryCode - Default country code (e.g., +254 for Kenya)
 * @returns {string} Formatted phone number
 */
export function formatPhoneNumber(phone, defaultCountryCode = '+254') {
  if (!phone) {
    return null;
  }

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  // If already has country code, return as is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // If starts with 0, replace with country code
  if (cleaned.startsWith('0')) {
    return defaultCountryCode + cleaned.substring(1);
  }

  // If starts with country code without +, add +
  if (cleaned.startsWith(defaultCountryCode.replace('+', ''))) {
    return '+' + cleaned;
  }

  // Otherwise, prepend country code
  return defaultCountryCode + cleaned;
}

