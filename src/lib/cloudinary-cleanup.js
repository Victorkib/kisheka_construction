/**
 * Cloudinary Cleanup Utility
 * 
 * Provides functions to extract public_ids from Cloudinary URLs
 * and delete assets from Cloudinary when entities are permanently deleted
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
if (
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Extract public_id from a Cloudinary URL
 * @param {string} url - Cloudinary URL (e.g., https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/file.jpg)
 * @returns {string|null} - Public ID or null if not a valid Cloudinary URL
 */
export function extractPublicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  try {
    // Cloudinary URL patterns:
    // https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/{transformations}/{public_id}.{format}
    // https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{public_id}.{format}
    
    const cloudinaryPattern = /res\.cloudinary\.com\/[^/]+\/([^/]+)\/upload\/(?:v\d+\/)?(?:[^/]+\/)*(.+?)(?:\.[^.]+)?$/;
    const match = url.match(cloudinaryPattern);
    
    if (match && match[2]) {
      // Remove file extension if present
      const publicId = match[2].replace(/\.[^.]+$/, '');
      return publicId;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting public_id from URL:', error);
    return null;
  }
}

/**
 * Delete a single asset from Cloudinary
 * @param {string} publicId - Cloudinary public_id
 * @param {string} resourceType - Resource type: 'image', 'video', 'raw', 'auto' (default: 'auto')
 * @returns {Promise<boolean>} - True if deleted successfully, false otherwise
 */
export async function deleteCloudinaryAsset(publicId, resourceType = 'auto') {
  if (!publicId) return false;

  try {
    if (
      !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      console.warn('Cloudinary not configured, skipping asset deletion');
      return false;
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true, // Invalidate CDN cache
    });

    if (result.result === 'ok' || result.result === 'not found') {
      return true; // 'not found' is also OK - asset already deleted
    }

    console.warn(`Cloudinary delete result: ${result.result} for public_id: ${publicId}`);
    return false;
  } catch (error) {
    console.error(`Error deleting Cloudinary asset ${publicId}:`, error);
    return false;
  }
}

/**
 * Delete a Cloudinary asset from a URL
 * @param {string} url - Cloudinary URL
 * @param {string} resourceType - Resource type (default: 'auto')
 * @returns {Promise<boolean>} - True if deleted successfully
 */
export async function deleteCloudinaryAssetFromUrl(url, resourceType = 'auto') {
  const publicId = extractPublicIdFromUrl(url);
  if (!publicId) {
    console.warn(`Could not extract public_id from URL: ${url}`);
    return false;
  }

  return await deleteCloudinaryAsset(publicId, resourceType);
}

/**
 * Delete multiple Cloudinary assets
 * @param {string[]} urls - Array of Cloudinary URLs
 * @param {string} resourceType - Resource type (default: 'auto')
 * @returns {Promise<{success: number, failed: number, errors: string[]}>}
 */
export async function deleteMultipleCloudinaryAssets(urls, resourceType = 'auto') {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return results;
  }

  // Filter out null/undefined/empty strings
  const validUrls = urls.filter((url) => url && typeof url === 'string');

  if (validUrls.length === 0) {
    return results;
  }

  // Delete assets in parallel (but limit concurrency to avoid rate limits)
  const deletePromises = validUrls.map(async (url) => {
    try {
      const deleted = await deleteCloudinaryAssetFromUrl(url, resourceType);
      if (deleted) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push(`Failed to delete: ${url}`);
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`Error deleting ${url}: ${error.message}`);
    }
  });

  await Promise.all(deletePromises);

  return results;
}

/**
 * Extract and delete Cloudinary assets from a material record
 * @param {object} material - Material document
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function deleteMaterialCloudinaryAssets(material) {
  if (!material) return { success: 0, failed: 0 };

  const urls = [];

  // Collect all Cloudinary URLs from material
  if (material.receiptFileUrl) urls.push(material.receiptFileUrl);
  if (material.receiptUrl) urls.push(material.receiptUrl);
  if (material.invoiceFileUrl) urls.push(material.invoiceFileUrl);
  if (material.deliveryNoteFileUrl) urls.push(material.deliveryNoteFileUrl);
  
  // Handle photos array
  if (material.photos && Array.isArray(material.photos)) {
    material.photos.forEach((photo) => {
      if (photo.url) urls.push(photo.url);
    });
  }

  // Remove duplicates
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  return await deleteMultipleCloudinaryAssets(uniqueUrls);
}

/**
 * Extract and delete Cloudinary assets from an expense record
 * @param {object} expense - Expense document
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function deleteExpenseCloudinaryAssets(expense) {
  if (!expense) return { success: 0, failed: 0 };

  const urls = [];

  // Collect all Cloudinary URLs from expense
  if (expense.receiptFileUrl) urls.push(expense.receiptFileUrl);
  if (expense.receiptUrl) urls.push(expense.receiptUrl);
  
  // Handle receipts array
  if (expense.receipts && Array.isArray(expense.receipts)) {
    expense.receipts.forEach((receipt) => {
      if (receipt.fileUrl) urls.push(receipt.fileUrl);
      if (receipt.url) urls.push(receipt.url);
    });
  }

  // Remove duplicates
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  return await deleteMultipleCloudinaryAssets(uniqueUrls);
}

/**
 * Extract and delete Cloudinary assets from an initial expense record
 * @param {object} initialExpense - Initial expense document
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function deleteInitialExpenseCloudinaryAssets(initialExpense) {
  if (!initialExpense) return { success: 0, failed: 0 };

  const urls = [];

  // Collect all Cloudinary URLs from initial expense
  if (initialExpense.receiptFileUrl) urls.push(initialExpense.receiptFileUrl);
  if (initialExpense.receiptUrl) urls.push(initialExpense.receiptUrl);
  
  // Handle supportingDocuments array
  if (initialExpense.supportingDocuments && Array.isArray(initialExpense.supportingDocuments)) {
    initialExpense.supportingDocuments.forEach((doc) => {
      if (doc.fileUrl) urls.push(doc.fileUrl);
      if (doc.url) urls.push(doc.url);
    });
  }

  // Remove duplicates
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  return await deleteMultipleCloudinaryAssets(uniqueUrls);
}

/**
 * Extract and delete Cloudinary assets from an investor record
 * @param {object} investor - Investor document
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function deleteInvestorCloudinaryAssets(investor) {
  if (!investor) return { success: 0, failed: 0 };

  const urls = [];

  // Collect all Cloudinary URLs from investor contributions
  if (investor.contributions && Array.isArray(investor.contributions)) {
    investor.contributions.forEach((contribution) => {
      if (contribution.receiptUrl) urls.push(contribution.receiptUrl);
    });
  }

  // Remove duplicates
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  return await deleteMultipleCloudinaryAssets(uniqueUrls);
}

/**
 * Extract and delete Cloudinary assets from a project record
 * @param {object} project - Project document
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function deleteProjectCloudinaryAssets(project) {
  if (!project) return { success: 0, failed: 0 };

  const urls = [];

  // Collect all Cloudinary URLs from project documents
  if (project.documents && Array.isArray(project.documents)) {
    project.documents.forEach((doc) => {
      if (doc.fileUrl) urls.push(doc.fileUrl);
      if (doc.url) urls.push(doc.url);
    });
  }

  // Remove duplicates
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  return await deleteMultipleCloudinaryAssets(uniqueUrls);
}

