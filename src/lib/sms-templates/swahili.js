/**
 * Swahili (Kiswahili) SMS Message Templates
 * Translations for all SMS messages in the system
 */

/**
 * Generate Swahili SMS message for purchase order
 * @param {Object} options - Purchase order details
 * @returns {string} Formatted SMS message in Swahili
 */
export function generatePurchaseOrderSMSSwahili({ purchaseOrderNumber, materialName, quantity, unit, totalCost, shortLink, deliveryDate = null, unitCost = null }) {
  const deliveryDateStr = deliveryDate 
    ? new Date(deliveryDate).toLocaleDateString('sw-KE', { month: 'short', day: 'numeric' })
    : null;
  
  let message = `PO MPYA: ${purchaseOrderNumber}\nBidhaa: ${materialName}\nKiasi: ${quantity} ${unit}`;
  
  if (unitCost !== null && unitCost > 0) {
    message += `\nBei ya kitengo: KES ${unitCost.toLocaleString()}`;
  }
  
  message += `\nJumla: KES ${totalCost.toLocaleString()}`;
  
  if (deliveryDateStr) {
    message += `\nUwasilishaji: ${deliveryDateStr}`;
  }
  
  message += `\nJibu: KUBALI/KATA au 1/2\nMaelezo: ${shortLink || 'Wasiliana nasi'}`;
  
  // Truncate if too long
  if (message.length > 160) {
    const baseLength = message.length - materialName.length;
    const maxMaterialLength = Math.max(10, 160 - baseLength - 10);
    const truncatedMaterial = materialName.length > maxMaterialLength 
      ? materialName.substring(0, maxMaterialLength) + '...'
      : materialName;
    
    message = `PO MPYA: ${purchaseOrderNumber}\nBidhaa: ${truncatedMaterial}\nKiasi: ${quantity} ${unit}`;
    
    if (unitCost !== null && unitCost > 0) {
      message += `\nBei ya kitengo: KES ${unitCost.toLocaleString()}`;
    }
    
    message += `\nJumla: KES ${totalCost.toLocaleString()}`;
    
    if (deliveryDateStr) {
      message += `\nUwasilishaji: ${deliveryDateStr}`;
    }
    
    message += `\nJibu: KUBALI/KATA au 1/2\nMaelezo: ${shortLink || 'Wasiliana nasi'}`;
  }
  
  return message;
}

/**
 * Generate Swahili SMS message for bulk purchase order
 * @param {Object} options - Purchase order details
 * @returns {string|Array<string>} Single message or array of messages in Swahili
 */
export function generateBulkPurchaseOrderSMSSwahili({ purchaseOrderNumber, materials, totalCost, shortLink, deliveryDate = null, enableMultiPart = true }) {
  if (!materials || !Array.isArray(materials) || materials.length === 0) {
    return generatePurchaseOrderSMSSwahili({
      purchaseOrderNumber,
      materialName: 'Bidhaa nyingi',
      quantity: 0,
      unit: 'vitu',
      totalCost,
      shortLink,
      deliveryDate
    });
  }

  const deliveryDateStr = deliveryDate 
    ? new Date(deliveryDate).toLocaleDateString('sw-KE', { month: 'short', day: 'numeric' })
    : null;

  const truncateName = (name, maxLength = 20) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  };

  const formatMaterialLine = (material, index, showCost = false) => {
    const name = truncateName(material.materialName || material.name || `Bidhaa ${index + 1}`, 18);
    const qty = material.quantity || material.quantityNeeded || 0;
    const unit = material.unit || '';
    const cost = showCost && material.unitCost ? ` @ KES ${material.unitCost.toLocaleString()}` : '';
    return `${index + 1}. ${name}: ${qty} ${unit}${cost}`;
  };

  const materialCount = materials.length;

  // 1-2 materials: Single message with full details
  if (materialCount <= 2) {
    let message = `PO MPYA: ${purchaseOrderNumber}\n`;
    
    materials.forEach((material, index) => {
      message += formatMaterialLine(material, index, true) + '\n';
    });
    
    message += `Jumla: KES ${totalCost.toLocaleString()}`;
    
    if (deliveryDateStr) {
      message += `\nUwasilishaji: ${deliveryDateStr}`;
    }
    
    message += `\nJibu: KUBALI/KATA au 1/2\nMaelezo: ${shortLink || 'Wasiliana nasi'}`;

    if (message.length > 160) {
      message = `PO MPYA: ${purchaseOrderNumber}\n`;
      materials.forEach((material, index) => {
        message += formatMaterialLine(material, index, false) + '\n';
      });
      message += `Jumla: KES ${totalCost.toLocaleString()}`;
      if (deliveryDateStr) {
        message += `\nUwasilishaji: ${deliveryDateStr}`;
      }
      message += `\nJibu: KUBALI/KATA au 1/2\nMaelezo: ${shortLink || 'Wasiliana nasi'}`;
    }

    return message;
  }
  
  // 3-4 materials: Single message abbreviated
  if (materialCount <= 4) {
    let message = `PO MPYA: ${purchaseOrderNumber}\nBidhaa:\n`;
    
    materials.forEach((material, index) => {
      message += `• ${formatMaterialLine(material, index, false).substring(3)}\n`;
    });
    
    message += `Jumla: KES ${totalCost.toLocaleString()}`;
    
    if (deliveryDateStr) {
      message += `\nUwasilishaji: ${deliveryDateStr}`;
    }
    
    message += `\nJibu: KUBALI/KATA au 1/2\nMaelezo: ${shortLink || 'Wasiliana nasi'}`;

    if (message.length > 160) {
      const maxNameLength = 10;
      message = message.replace(/•\s+([^:]+):/g, (match, name) => {
        const truncated = truncateName(name, maxNameLength);
        return match.replace(name, truncated);
      });
    }

    if (message.length > 160 && deliveryDateStr) {
      message = message.replace(`\nUwasilishaji: ${deliveryDateStr}`, '');
    }

    return message;
  }

  // 5+ materials: Multi-part SMS
  if (enableMultiPart) {
    const messages = [];
    
    // Part 1: Summary
    const summaryMessage = `PO-${purchaseOrderNumber}: Bidhaa ${materialCount}\nJumla: KES ${totalCost.toLocaleString()}\nUwasilishaji: ${deliveryDateStr || 'Bado'}\nAngalia ujumbe ${Math.ceil(materialCount / 4)} ujao kwa maelezo.\nJibu: KUBALI ZOTE au orodha ya bidhaa za KUBALI/KATA`;
    messages.push(summaryMessage);

    // Part 2-N: Material details
    const materialsPerMessage = 4;
    for (let i = 0; i < materials.length; i += materialsPerMessage) {
      const materialBatch = materials.slice(i, i + materialsPerMessage);
      const partNumber = Math.floor(i / materialsPerMessage) + 2;
      const totalParts = Math.ceil(materials.length / materialsPerMessage) + 1;
      
      let materialMessage = `PO-${purchaseOrderNumber} Bidhaa (${partNumber}/${totalParts}):\n`;
      
      materialBatch.forEach((material, batchIndex) => {
        const globalIndex = i + batchIndex + 1;
        const name = truncateName(material.materialName || material.name || `Bidhaa ${globalIndex}`, 20);
        const qty = material.quantity || material.quantityNeeded || 0;
        const unit = material.unit || '';
        const cost = material.unitCost ? ` @ KES ${material.unitCost.toLocaleString()}` : '';
        materialMessage += `${globalIndex}. ${name}: ${qty} ${unit}${cost}\n`;
      });

      materialMessage += `\nJibu: KUBALI ZOTE au KUBALI 1,3,5 KATA 2,4 nk`;

      if (materialMessage.length > 160) {
        materialMessage = `PO-${purchaseOrderNumber} Bidhaa (${partNumber}/${totalParts}):\n`;
        materialBatch.forEach((material, batchIndex) => {
          const globalIndex = i + batchIndex + 1;
          const name = truncateName(material.materialName || material.name || `Bidhaa ${globalIndex}`, 18);
          const qty = material.quantity || material.quantityNeeded || 0;
          const unit = material.unit || '';
          materialMessage += `${globalIndex}. ${name}: ${qty} ${unit}\n`;
        });
        materialMessage += `\nJibu: KUBALI ZOTE au KUBALI 1,3,5 KATA 2,4 nk`;
      }

      messages.push(materialMessage);
    }

    return messages;
  } else {
    // Fallback single message
    const materialsToShow = Math.min(3, materialCount);
    const materialNames = materials.slice(0, materialsToShow).map(m => 
      truncateName(m.materialName || m.name || 'Bidhaa', 15)
    ).join(', ');
    
    const remainingCount = materialCount - materialsToShow;
    const moreText = remainingCount > 0 ? ` +${remainingCount} zaidi` : '';
    
    let message = `PO MPYA: ${purchaseOrderNumber}\nBidhaa ${materialCount}:\n${materialNames}${moreText}\nJumla: KES ${totalCost.toLocaleString()}`;
    
    if (deliveryDateStr) {
      message += `\nUwasilishaji: ${deliveryDateStr}`;
    }
    
    message += `\nJibu: KUBALI/KATA au 1/2\nOrodha kamili: ${shortLink || 'Wasiliana nasi'}`;

    return message;
  }
}

/**
 * Generate Swahili confirmation SMS
 * @param {Object} options - Confirmation details
 * @returns {string} Formatted confirmation SMS in Swahili
 */
export function generateConfirmationSMSSwahili({ purchaseOrderNumber, action, deliveryDate }) {
  const actionText = action === 'accept' ? 'IMEKUBALIWA' : action === 'reject' ? 'IMEKATALIWA' : 'IMEBORESHEWA';
  
  let message = `Asante! ${purchaseOrderNumber} ${actionText}.`;
  
  if (action === 'accept' && deliveryDate) {
    const dateStr = new Date(deliveryDate).toLocaleDateString('sw-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    message += ` Uwasilishaji unatarajiwa: ${dateStr}.`;
  }
  
  message += ' Tutawasiliana hivi karibuni.';
  return message;
}

/**
 * Generate Swahili modification approval SMS
 * @param {Object} options - Modification approval details
 * @returns {string} Formatted SMS in Swahili
 */
export function generateModificationApprovalSMSSwahili({ purchaseOrderNumber, modifications, autoCommit = false, deliveryDate = null }) {
  let message = `Ubadilishaji wa ${purchaseOrderNumber} umekubaliwa.`;
  
  const changes = [];
  if (modifications.unitCost !== undefined) {
    changes.push(`Bei: KES ${modifications.unitCost.toLocaleString()}`);
  }
  if (modifications.quantityOrdered !== undefined) {
    changes.push(`Kiasi: ${modifications.quantityOrdered}`);
  }
  if (modifications.deliveryDate || deliveryDate) {
    const dateStr = new Date(modifications.deliveryDate || deliveryDate).toLocaleDateString('sw-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    changes.push(`Uwasilishaji: ${dateStr}`);
  }
  
  if (changes.length > 0) {
    message += `\nMpya: ${changes.join(', ')}.`;
  }
  
  if (autoCommit) {
    message += `\nAgizo sasa LIMEKUBALIWA. Tafadhali thibitisha tarehe ya uwasilishaji.`;
  } else {
    message += `\nTafadhali thibitisha unaweza kuwasilisha kwa tarehe mpya.`;
  }
  
  message += `\nJibu THIBITISHA au wasiliana nasi.`;
  
  return message;
}

/**
 * Generate Swahili modification rejection SMS
 * @param {Object} options - Modification rejection details
 * @returns {string} Formatted SMS in Swahili
 */
export function generateModificationRejectionSMSSwahili({ purchaseOrderNumber, rejectionReason, originalTerms, alternativeOffer = null }) {
  let message = `Ubadilishaji wa ${purchaseOrderNumber} haujakubaliwa.`;
  
  if (rejectionReason) {
    message += `\nSababu: ${rejectionReason}.`;
  }
  
  if (originalTerms) {
    message += `\nMasharti ya awali:`;
    if (originalTerms.unitCost) {
      message += ` Bei: KES ${originalTerms.unitCost.toLocaleString()}`;
    }
    if (originalTerms.quantityOrdered) {
      message += ` Kiasi: ${originalTerms.quantityOrdered}`;
    }
    if (originalTerms.deliveryDate) {
      const dateStr = new Date(originalTerms.deliveryDate).toLocaleDateString('sw-KE', {
        month: 'short',
        day: 'numeric'
      });
      message += ` Uwasilishaji: ${dateStr}`;
    }
  }
  
  if (alternativeOffer) {
    message += `\nChaguo jingine: ${alternativeOffer}`;
  } else {
    message += `\nJe, unaweza kukubali masharti ya awali?`;
  }
  
  message += `\nJibu: KUBALI/KATA au 1/2 au wasiliana nasi.`;
  
  return message;
}

/**
 * Generate Swahili delivery confirmation SMS
 * @param {Object} options - Delivery confirmation details
 * @returns {string} Formatted SMS in Swahili
 */
export function generateDeliveryConfirmationSMSSwahili({ purchaseOrderNumber, materialName, quantityReceived, unit, deliveryDate, status = 'approved' }) {
  let message = `Uwasilishaji umehakikiwa: ${purchaseOrderNumber}`;
  
  if (materialName) {
    const truncatedName = materialName.length > 25 ? materialName.substring(0, 22) + '...' : materialName;
    message += `\nKilichopokelewa: ${quantityReceived} ${unit} ${truncatedName}`;
  } else {
    message += `\nKilichopokelewa: ${quantityReceived} ${unit}`;
  }
  
  if (deliveryDate) {
    const dateStr = new Date(deliveryDate).toLocaleDateString('sw-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    message += `\nTarehe: ${dateStr}`;
  }
  
  const statusText = status === 'approved' ? 'IMERIDHIKISHA' : 'IMEKATALIWA';
  message += `\nHali: ${statusText}`;
  
  if (status === 'approved') {
    message += `\nIfuatayo: Tafadhali wasilisha ankara kwa malipo.`;
  } else {
    message += `\nTafadhali wasiliana nasi kwa ufafanuzi.`;
  }
  
  message += `\nAsante!`;
  
  return message;
}

/**
 * Generate Swahili reminder SMS
 * @param {Object} options - Reminder details
 * @returns {string} Formatted reminder SMS in Swahili
 */
export function generateReminderSMSSwahili({ purchaseOrderNumber, contactPhone }) {
  return `Kikumbusho: PO-${purchaseOrderNumber} inasubiri jibu. Jibu: KUBALI/KATA au 1/2 au wasiliana ${contactPhone}`;
}

/**
 * Generate Swahili SMS for material verification issues
 * @param {Object} options - Verification issue details
 * @returns {string} Formatted verification issue SMS in Swahili
 */
export function generateMaterialVerificationSMSSwahili({ purchaseOrderNumber, materialName, issueType, issueDescription, expectedQuantity = null, actualQuantity = null, actionRequired = null, contactPhone = null }) {
  const issueTypeLabels = {
    quantity: 'Suala la Kiasi',
    quality: 'Suala la Ubora',
    specification: 'Suala la Vipimo',
    damage: 'Uharibifu',
    missing: 'Vitu Vilivyopotea',
    other: 'Suala la Uthibitishaji'
  };
  
  let message = `Suala la Uthibitishaji: ${purchaseOrderNumber}\nBidhaa: ${materialName}\nSuala: ${issueTypeLabels[issueType] || issueTypeLabels.other}`;
  
  if (issueDescription) {
    message += `\nMaelezo: ${issueDescription}`;
  }
  
  if (expectedQuantity !== null && actualQuantity !== null) {
    message += `\nInatarajiwa: ${expectedQuantity}, Imepokelewa: ${actualQuantity}`;
  } else if (expectedQuantity !== null) {
    message += `\nInatarajiwa: ${expectedQuantity}`;
  }
  
  if (actionRequired) {
    message += `\nHatua: ${actionRequired}`;
  } else {
    message += `\nTafadhali wasiliana nasi ili kutatua suala hili.`;
  }
  
  if (contactPhone) {
    message += `\nWasiliana: ${contactPhone}`;
  }
  
  return message;
}

/**
 * Generate Swahili SMS for order cancellation
 * @param {Object} options - Cancellation details
 * @returns {string} Formatted cancellation SMS in Swahili
 */
export function generateOrderCancellationSMSSwahili({ purchaseOrderNumber, reason = null }) {
  let message = `Agizo limefutwa: ${purchaseOrderNumber}`;
  if (reason) {
    const truncatedReason = reason.length > 60 ? reason.substring(0, 57) + '...' : reason;
    message += `\nSababu: ${truncatedReason}`;
  }
  message += `\nTunasikitika kwa usumbufu wowote.`;
  message += `\nTutawasiliana nasi kwa maagizo ya baadaye.`;
  return message;
}

/**
 * Generate Swahili error SMS
 * @param {Object} options - Error details
 * @returns {string} Formatted error SMS in Swahili
 */
export function generateErrorSMSSwahili({ errorType, purchaseOrderNumber = null, suggestion = null }) {
  let message = 'Samahani, kuna tatizo.';
  
  switch (errorType) {
    case 'po_not_found':
      message = `Samahani, hatukuweza kupata agizo lako la ununuzi.`;
      if (purchaseOrderNumber) {
        message += ` Nambari: ${purchaseOrderNumber}.`;
      }
      message += ` Tafadhali wasiliana nasi moja kwa moja.`;
      break;
    
    case 'invalid_response':
      message = `Jibu lako halikukubalika.`;
      if (suggestion) {
        message += ` ${suggestion}`;
      } else {
        message += ` Tafadhali tumia: KUBALI, KATA, au BADILISHA.`;
      }
      break;
    
    case 'token_expired':
      message = `Kiungo cha jibu kimeisha muda.`;
      message += ` Tafadhali wasiliana nasi kwa agizo jipya.`;
      break;
    
    case 'already_responded':
      message = `Umekwisha jibu agizo hili.`;
      message += ` Ikiwa unahitaji mabadiliko, tafadhali wasiliana nasi.`;
      break;
    
    default:
      message = `Samahani, kuna tatizo la kiufundi.`;
      message += ` Tafadhali wasiliana nasi kwa msaada.`;
  }
  
  return message;
}

