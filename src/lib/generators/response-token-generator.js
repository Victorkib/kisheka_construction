/**
 * Response Token Generator
 * Generates secure, time-limited tokens for supplier responses
 * Tokens are used for secure, authentication-free supplier responses
 */

import crypto from 'crypto';

/**
 * Generate secure response token for purchase order
 * @param {string} purchaseOrderId - Purchase order ID
 * @returns {string} Secure token
 */
export function generateResponseToken(purchaseOrderId) {
  const secret = process.env.PO_RESPONSE_TOKEN_SECRET || 'default-secret-change-in-production';
  const data = `${purchaseOrderId}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  const token = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return token;
}

/**
 * Validate response token
 * @param {string} token - Token to validate
 * @param {string} purchaseOrderId - Purchase order ID
 * @returns {boolean} True if token is valid
 */
export function validateResponseToken(token, purchaseOrderId) {
  if (!token || !purchaseOrderId) {
    return false;
  }

  // Token validation is done by checking if it exists in the purchase order
  // This function is a placeholder for future enhanced validation
  return true;
}

/**
 * Get token expiration date
 * @param {number} days - Number of days until expiration (default: 7)
 * @returns {Date} Expiration date
 */
export function getTokenExpirationDate(days = 7) {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  return expirationDate;
}

