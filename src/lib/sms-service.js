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

    // const africasTalkingUrl = 'https://api.africastalking.com/version1/messaging';
    const africasTalkingUrl = 'https://api.sandbox.africastalking.com/version1/messaging';
    const response = await fetch(africasTalkingUrl, {
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
      console.error('API Key (first 10 chars):', AFRICASTALKING_API_KEY?.substring(0, 10) + '...');
      console.error('Username:', AFRICASTALKING_USERNAME);
      console.error('Sender ID:', AFRICASTALKING_SENDER_ID);
      console.error('Response Status:', response.status, response.statusText);
      
      // Try to parse error response as JSON
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = JSON.stringify(errorJson, null, 2);
      } catch (e) {
        // Not JSON, use as-is
      }
      
      throw new Error(`SMS send failed: ${response.status} ${response.statusText}. Details: ${errorDetails}`);
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
 * Extracts action (accept/reject/modify), purchase order number, rejection reasons, and modification details from SMS text
 * @param {string} smsText - SMS message text
 * @returns {Object} Parsed result with action, PO number, rejection reason, and modification details
 */
export function parseSMSReply(smsText) {
  if (!smsText || typeof smsText !== 'string') {
    return { 
      action: null, 
      purchaseOrderNumber: null,
      rejectionReason: null,
      rejectionSubcategory: null,
      modificationDetails: null,
      confidence: 0
    };
  }

  // Remove emojis and special characters that might interfere
  const cleanedText = smsText.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
  const text = cleanedText.toUpperCase().trim();
  
  // Keywords for actions (with common typos)
  const acceptKeywords = ['ACCEPT', 'ACEPT', 'ACEPPT', 'ACCEPTED', 'YES', 'OK', 'OKAY', 'CONFIRM', 'CONFIRMED', 'APPROVE', 'APPROVED'];
  const rejectKeywords = ['REJECT', 'REJCT', 'REJECTED', 'NO', 'DECLINE', 'DECLINED', 'CANCEL', 'CANCELLED', 'REFUSE', 'REFUSED'];
  const modifyKeywords = ['MODIFY', 'MODFY', 'CHANGE', 'CHANGED', 'UPDATE', 'UPDATED', 'EDIT', 'EDITED', 'ADJUST', 'ADJUSTED'];

  // Extract purchase order number (format: PO-YYYYMMDD-001 or PO-001)
  const poMatch = text.match(/PO[-\s]?(\d{8}-\d{3}|\d{3})/i);
  const purchaseOrderNumber = poMatch ? poMatch[0].replace(/[-\s]/g, '-') : null;

  // Determine action with priority (accept > reject > modify)
  let action = null;
  let confidence = 0.5; // Default confidence
  
  // Check for negation words that might reverse the action
  const negationWords = ['NOT', "DON'T", "WON'T", 'NEVER', 'CANT', "CAN'T"];
  const hasNegation = negationWords.some(word => text.includes(word));
  
  if (acceptKeywords.some(keyword => text.includes(keyword))) {
    if (hasNegation && text.indexOf('NOT') < text.indexOf('ACCEPT')) {
      action = 'reject'; // "NOT ACCEPT" = reject
      confidence = 0.8;
    } else {
      action = 'accept';
      confidence = 0.9;
    }
  } else if (rejectKeywords.some(keyword => text.includes(keyword))) {
    if (hasNegation && text.indexOf('NOT') < text.indexOf('REJECT')) {
      action = 'accept'; // "NOT REJECT" = accept
      confidence = 0.8;
    } else {
      action = 'reject';
      confidence = 0.9;
    }
  } else if (modifyKeywords.some(keyword => text.includes(keyword))) {
    action = 'modify';
    confidence = 0.85;
  }

  // Extract rejection reason from text
  let rejectionReason = null;
  let rejectionSubcategory = null;
  let rejectionConfidence = 0;
  
  if (action === 'reject') {
    const rejectionPatterns = {
      // Price-related
      price_too_high: {
        keywords: ['PRICE', 'COST', 'EXPENSIVE', 'TOO HIGH', 'TOO MUCH', 'CHEAPER', 'LOWER PRICE', 'BUDGET'],
        subcategories: {
          market_rates_higher: ['MARKET', 'RATES'],
          material_costs_increased: ['MATERIAL COST', 'RAW MATERIAL'],
          labor_costs_high: ['LABOR', 'WORKER', 'MANPOWER'],
          overhead_costs: ['OVERHEAD', 'OPERATIONAL'],
          insufficient_profit_margin: ['PROFIT', 'MARGIN'],
          currency_fluctuation: ['CURRENCY', 'EXCHANGE', 'RATE']
        }
      },
      // Availability
      unavailable: {
        keywords: ['UNAVAILABLE', 'OUT OF STOCK', 'NO STOCK', 'NOT AVAILABLE', 'DONT HAVE', "DON'T HAVE", 'CANT GET', "CAN'T GET", 'DISCONTINUED'],
        subcategories: {
          out_of_stock: ['OUT OF STOCK', 'NO STOCK', 'STOCK'],
          material_discontinued: ['DISCONTINUED', 'NO LONGER'],
          seasonal_unavailable: ['SEASONAL', 'SEASON'],
          supplier_shortage: ['SHORTAGE', 'SHORT'],
          manufacturing_delay: ['MANUFACTURING', 'PRODUCTION', 'DELAY'],
          shipping_constraints: ['SHIPPING', 'TRANSPORT', 'LOGISTICS']
        }
      },
      // Timeline
      timeline: {
        keywords: ['TIME', 'DELIVERY', 'DEADLINE', 'TOO SOON', 'TOO FAST', 'LATE', 'DELAY', 'SCHEDULE', 'RUSH'],
        subcategories: {
          delivery_date_too_soon: ['TOO SOON', 'TOO FAST', 'RUSH', 'URGENT'],
          insufficient_production_time: ['PRODUCTION TIME', 'MAKE TIME'],
          logistics_delay: ['LOGISTICS', 'TRANSPORT', 'SHIPPING'],
          weather_related_delays: ['WEATHER', 'RAIN', 'STORM'],
          current_workload_too_high: ['WORKLOAD', 'BUSY', 'FULL'],
          staff_shortage: ['STAFF', 'WORKER', 'MANPOWER']
        }
      },
      // Specifications
      specifications: {
        keywords: ['SPECIFICATION', 'SPEC', 'QUALITY', 'STANDARD', 'GRADE', 'CERTIFICATION', 'TESTING', 'REQUIREMENT'],
        subcategories: {
          cannot_meet_quality_standards: ['QUALITY', 'STANDARD'],
          technical_specifications_unmet: ['TECHNICAL', 'SPEC'],
          material_grade_unavailable: ['GRADE', 'TYPE'],
          custom_requirements_impossible: ['CUSTOM', 'SPECIAL'],
          certification_requirements: ['CERTIFICATION', 'CERTIFIED'],
          testing_requirements: ['TESTING', 'TEST']
        }
      },
      // Quantity
      quantity: {
        keywords: ['QUANTITY', 'QTY', 'AMOUNT', 'TOO MUCH', 'TOO MANY', 'MINIMUM', 'MAXIMUM', 'CAPACITY'],
        subcategories: {
          below_minimum_order_quantity: ['MINIMUM', 'MIN'],
          exceeds_production_capacity: ['CAPACITY', 'MAXIMUM', 'MAX'],
          batch_size_constraints: ['BATCH', 'BULK'],
          storage_limitations: ['STORAGE', 'SPACE'],
          can_only_partial_fulfill: ['PARTIAL', 'SOME', 'ONLY']
        }
      },
      // Business policy
      business_policy: {
        keywords: ['POLICY', 'TERM', 'CONTRACT', 'PAYMENT', 'INSURANCE', 'LICENSE', 'GEOGRAPHIC'],
        subcategories: {
          unacceptable_payment_terms: ['PAYMENT', 'TERM'],
          contract_terms_unacceptable: ['CONTRACT', 'AGREEMENT'],
          insurance_requirements: ['INSURANCE'],
          licensing_restrictions: ['LICENSE', 'PERMIT'],
          geographic_service_limits: ['GEOGRAPHIC', 'AREA', 'LOCATION'],
          client_specific_restrictions: ['CLIENT', 'CUSTOMER']
        }
      },
      // External factors
      external_factors: {
        keywords: ['REGULATORY', 'MARKET', 'FORCE MAJEURE', 'TRANSPORTATION', 'SUPPLY CHAIN', 'ECONOMIC'],
        subcategories: {
          regulatory_changes: ['REGULATORY', 'REGULATION'],
          market_volatility: ['MARKET', 'VOLATILITY'],
          force_majeure: ['FORCE MAJEURE', 'DISASTER'],
          transportation_issues: ['TRANSPORTATION', 'TRANSPORT'],
          supply_chain_disruption: ['SUPPLY CHAIN', 'CHAIN'],
          economic_conditions: ['ECONOMIC', 'ECONOMY']
        }
      }
    };

    // Find matching rejection reason
    for (const [reasonId, pattern] of Object.entries(rejectionPatterns)) {
      const mainMatch = pattern.keywords.some(keyword => text.includes(keyword));
      if (mainMatch) {
        rejectionReason = reasonId;
        rejectionConfidence = 0.7;
        
        // Try to find subcategory
        for (const [subcatKey, subcatKeywords] of Object.entries(pattern.subcategories)) {
          if (subcatKeywords.some(keyword => text.includes(keyword))) {
            rejectionSubcategory = pattern.subcategories[subcatKey];
            rejectionConfidence = 0.85;
            break;
          }
        }
        break;
      }
    }

    // If no specific reason found, default to 'other'
    if (!rejectionReason) {
      rejectionReason = 'other';
      rejectionSubcategory = 'not_specified';
      rejectionConfidence = 0.3;
    }
  }

  // Extract modification details
  let modificationDetails = null;
  if (action === 'modify') {
    modificationDetails = {
      unitCost: null,
      quantityOrdered: null,
      deliveryDate: null,
      notes: null
    };

    // Extract price/cost modifications
    const priceMatch = text.match(/(?:PRICE|COST|UNIT)[\s:]*KES?[\s:]*(\d+(?:[.,]\d+)?)/i);
    if (priceMatch) {
      modificationDetails.unitCost = parseFloat(priceMatch[1].replace(/,/g, ''));
    }

    // Extract quantity modifications
    const qtyMatch = text.match(/(?:QTY|QUANTITY|QTY)[\s:]*(\d+(?:[.,]\d+)?)/i);
    if (qtyMatch) {
      modificationDetails.quantityOrdered = parseFloat(qtyMatch[1].replace(/,/g, ''));
    }

    // Extract date modifications (various formats)
    const dateFormats = [
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/, // DD-MM-YYYY or DD/MM/YYYY
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, // YYYY-MM-DD or YYYY/MM/DD
      /(?:DATE|DELIVERY)[\s:]*(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/i
    ];
    
    for (const dateFormat of dateFormats) {
      const dateMatch = text.match(dateFormat);
      if (dateMatch) {
        try {
          let year, month, day;
          if (dateMatch[0].length > 8) {
            // YYYY-MM-DD format
            year = parseInt(dateMatch[1]);
            month = parseInt(dateMatch[2]) - 1;
            day = parseInt(dateMatch[3]);
          } else {
            // DD-MM-YYYY format
            day = parseInt(dateMatch[1]);
            month = parseInt(dateMatch[2]) - 1;
            year = parseInt(dateMatch[3]);
            if (year < 100) year += 2000; // Assume 2000s for 2-digit years
          }
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            modificationDetails.deliveryDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          // Invalid date, skip
        }
        break;
      }
    }

    // Extract notes (everything after MODIFY keyword)
    const modifyIndex = text.indexOf('MODIFY');
    if (modifyIndex !== -1) {
      const notesText = cleanedText.substring(smsText.toUpperCase().indexOf('MODIFY') + 6).trim();
      if (notesText && notesText.length > 0) {
        modificationDetails.notes = notesText.substring(0, 500); // Limit to 500 chars
      }
    }
  }

  return {
    action,
    purchaseOrderNumber,
    rejectionReason,
    rejectionSubcategory,
    modificationDetails,
    confidence: action === 'reject' ? rejectionConfidence : confidence,
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
 * Generate SMS message for bulk purchase order with detailed material information
 * @param {Object} options - Purchase order details
 * @param {string} options.purchaseOrderNumber - PO number
 * @param {Array<Object>} options.materials - Array of material objects with materialName, quantity, unit, unitCost, totalCost
 * @param {number} options.totalCost - Total cost for all materials
 * @param {string} options.shortLink - Short URL for full details
 * @param {Date} options.deliveryDate - Delivery date (optional)
 * @returns {string} Formatted SMS message optimized for bulk orders
 */
export function generateBulkPurchaseOrderSMS({ purchaseOrderNumber, materials, totalCost, shortLink, deliveryDate = null }) {
  if (!materials || !Array.isArray(materials) || materials.length === 0) {
    // Fallback to generic message if no materials
    return generatePurchaseOrderSMS({
      purchaseOrderNumber,
      materialName: 'Multiple materials',
      quantity: 0,
      unit: 'items',
      totalCost,
      shortLink,
      deliveryDate
    });
  }

  // Format delivery date if provided
  const deliveryDateStr = deliveryDate 
    ? new Date(deliveryDate).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })
    : null;

  // Helper function to truncate material name if too long
  const truncateName = (name, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  };

  // Helper function to format material line
  const formatMaterialLine = (material, index, showCost = false) => {
    const name = truncateName(material.materialName || material.name || `Material ${index + 1}`, 18);
    const qty = material.quantity || material.quantityNeeded || 0;
    const unit = material.unit || '';
    const cost = showCost && material.unitCost ? ` @ KES ${material.unitCost.toLocaleString()}` : '';
    return `${index + 1}. ${name}: ${qty} ${unit}${cost}`;
  };

  let message = '';
  const materialCount = materials.length;

  // Strategy 1: 1-2 materials - Show full details with costs
  if (materialCount <= 2) {
    message = `New PO: ${purchaseOrderNumber}\n`;
    
    materials.forEach((material, index) => {
      message += formatMaterialLine(material, index, true) + '\n';
    });
    
    message += `Total: KES ${totalCost.toLocaleString()}`;
    
    if (deliveryDateStr) {
      message += `\nDelivery: ${deliveryDateStr}`;
    }
    
    message += `\nReply ACCEPT/REJECT\nDetails: ${shortLink || 'Contact us'}`;
  }
  // Strategy 2: 3-4 materials - Show abbreviated list without costs
  else if (materialCount <= 4) {
    message = `New PO: ${purchaseOrderNumber}\nMaterials:\n`;
    
    materials.forEach((material, index) => {
      message += `• ${formatMaterialLine(material, index, false).substring(3)}\n`; // Remove "1. " prefix, use bullet
    });
    
    message += `Total: KES ${totalCost.toLocaleString()}`;
    
    if (deliveryDateStr) {
      message += `\nDelivery: ${deliveryDateStr}`;
    }
    
    message += `\nReply ACCEPT/REJECT\nDetails: ${shortLink || 'Contact us'}`;
  }
  // Strategy 3: 5+ materials - Show summary with key materials
  else {
    // Show first 3-4 material names, then "and X more"
    const materialsToShow = Math.min(3, materialCount);
    const materialNames = materials.slice(0, materialsToShow).map(m => 
      truncateName(m.materialName || m.name || 'Material', 15)
    ).join(', ');
    
    const remainingCount = materialCount - materialsToShow;
    const moreText = remainingCount > 0 ? ` +${remainingCount} more` : '';
    
    message = `New PO: ${purchaseOrderNumber}\n${materialCount} materials:\n${materialNames}${moreText}\nTotal: KES ${totalCost.toLocaleString()}`;
    
    if (deliveryDateStr) {
      message += `\nDelivery: ${deliveryDateStr}`;
    }
    
    message += `\nReply ACCEPT/REJECT\nFull list: ${shortLink || 'Contact us'}`;
  }

  // If message is still too long, apply intelligent truncation
  if (message.length > 160) {
    // Try removing unit costs if present (Strategy 1)
    if (materialCount <= 2) {
      message = `New PO: ${purchaseOrderNumber}\n`;
      materials.forEach((material, index) => {
        message += formatMaterialLine(material, index, false) + '\n';
      });
      message += `Total: KES ${totalCost.toLocaleString()}`;
      if (deliveryDateStr) {
        message += `\nDelivery: ${deliveryDateStr}`;
      }
      message += `\nReply ACCEPT/REJECT\nDetails: ${shortLink || 'Contact us'}`;
    }
    
    // If still too long, truncate material names more aggressively
    if (message.length > 160) {
      const maxNameLength = materialCount <= 2 ? 12 : 10;
      message = message.replace(/\d+\.\s+([^:]+):/g, (match, name) => {
        const truncated = truncateName(name, maxNameLength);
        return match.replace(name, truncated);
      });
    }
    
    // Last resort: Remove delivery date if still too long
    if (message.length > 160 && deliveryDateStr) {
      message = message.replace(`\nDelivery: ${deliveryDateStr}`, '');
    }
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
 * @param {string} options.purchaseOrderNumber - PO number (already includes "PO-" prefix, e.g., "PO-20260104-003")
 * @param {string} options.action - Action taken (accept/reject)
 * @param {Date} options.deliveryDate - Expected delivery date (optional)
 * @returns {string} Formatted confirmation SMS
 */
export function generateConfirmationSMS({ purchaseOrderNumber, action, deliveryDate }) {
  const actionText = action === 'accept' ? 'ACCEPTED' : action === 'reject' ? 'REJECTED' : 'UPDATED';
  
  // purchaseOrderNumber already includes "PO-" prefix, so don't add it again
  // Format: "PO-20260104-003" (not "20260104-003")
  let message = `Thank you! ${purchaseOrderNumber} ${actionText}.`;
  
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

