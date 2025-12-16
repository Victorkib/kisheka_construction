/**
 * URL Shortener Utility
 * Generates short URLs for purchase order response links
 * Uses first 8 characters of response token as short code
 */

/**
 * Generate short URL from response token
 * @param {string} token - Full response token
 * @returns {string} Short URL
 */
export function generateShortUrl(token) {
  if (!token || token.length < 8) {
    throw new Error('Token must be at least 8 characters long');
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const shortCode = token.substring(0, 8); // Use first 8 chars of token
  return `${baseUrl}/po/${shortCode}`;
}

/**
 * Extract short code from short URL
 * @param {string} shortUrl - Short URL
 * @returns {string} Short code (first 8 chars of token)
 */
export function extractShortCode(shortUrl) {
  const match = shortUrl.match(/\/po\/([a-zA-Z0-9]{8})/);
  return match ? match[1] : null;
}

