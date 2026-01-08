/**
 * Supplier Finding Algorithm
 * 
 * Advanced supplier matching and recommendation system for finding alternative suppliers
 * when a purchase order is rejected or when exploring supplier options.
 * 
 * Supports three modes:
 * - Simple: Basic list of all active suppliers (works with minimal data)
 * - Hybrid: Simple list + algorithm suggestions when data available
 * - Smart: Algorithm-based recommendations (requires rich data)
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Find simple alternative suppliers (Simple Mode)
 * Returns all active suppliers excluding the current one, with optional search filtering.
 * Works with minimal data - no algorithm needed.
 * 
 * @param {Object} options - Search options
 * @param {string} options.currentSupplierId - Current supplier ID to exclude
 * @param {number} options.limit - Maximum number of results (default: 50)
 * @param {string} options.searchQuery - Optional search query for name/email/phone
 * @returns {Promise<Array>} Array of suppliers with basic information
 */
export async function findSimpleAlternativeSuppliers({
  currentSupplierId,
  limit = 50,
  searchQuery = null
}) {
  try {
    // Validate inputs
    if (!currentSupplierId) {
      throw new Error('currentSupplierId is required');
    }

    if (!ObjectId.isValid(currentSupplierId)) {
      throw new Error('Invalid currentSupplierId format');
    }

    // Validate and sanitize limit
    const sanitizedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);

    const db = await getDatabase();
    
    // Build search criteria
    const searchCriteria = {
      status: 'active',
      _id: { $ne: new ObjectId(currentSupplierId) },
      deletedAt: null
    };
    
    // Add search filter if provided
    if (searchQuery && searchQuery.trim()) {
      const trimmedQuery = searchQuery.trim();
      // Escape special regex characters for safety
      const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchCriteria.$or = [
        { name: { $regex: escapedQuery, $options: 'i' } },
        { email: { $regex: escapedQuery, $options: 'i' } },
        { phone: { $regex: escapedQuery, $options: 'i' } },
        { contactPerson: { $regex: escapedQuery, $options: 'i' } }
      ];
    }
    
    // Find suppliers
    const suppliers = await db.collection('suppliers')
      .find(searchCriteria)
      .sort({ name: 1 }) // Alphabetical sorting
      .limit(sanitizedLimit)
      .toArray();
    
    // Validate results
    if (!Array.isArray(suppliers)) {
      console.error('Suppliers query returned non-array result');
      return [];
    }
    
    // Format response with only essential data
    return suppliers
      .filter(supplier => supplier && supplier._id && supplier.name) // Filter out invalid entries
      .map(supplier => ({
        id: supplier._id,
        _id: supplier._id, // Keep both for compatibility
        name: supplier.name || 'Unknown Supplier',
        email: supplier.email || null,
        phone: supplier.phone || null,
        contactPerson: supplier.contactPerson || null,
        communicationChannels: {
          email: supplier.emailEnabled !== false, // Default to true
          sms: supplier.smsEnabled !== false, // Default to true
          push: supplier.pushNotificationsEnabled !== false // Default to true
        },
        specialties: Array.isArray(supplier.specialties) ? supplier.specialties : [],
        rating: supplier.rating || null,
        notes: supplier.notes || null,
        address: supplier.address || null,
        businessType: supplier.businessType || null
      }));
  } catch (error) {
    console.error('Error finding simple alternative suppliers:', error);
    throw error;
  }
}

/**
 * Calculate supplier data quality score
 * Determines how much data is available for algorithm-based recommendations.
 * Returns score 0-100 and recommended mode.
 * 
 * @param {Object} supplier - Supplier document
 * @param {Object} materialRequest - Material request document (optional)
 * @param {Object} db - Database connection
 * @returns {Promise<Object>} Data quality assessment
 */
export async function calculateSupplierDataQuality(supplier, materialRequest, db) {
  try {
    // Validate inputs
    if (!supplier || (!supplier._id && !supplier.id)) {
      return {
        total: 0,
        factors: {
          orderHistory: 0,
          categoryData: 0,
          specialtyData: 0,
          locationData: 0,
          pricingData: 0
        },
        recommendedMode: 'simple'
      };
    }

    if (!db) {
      console.error('Database connection not provided to calculateSupplierDataQuality');
      return {
        total: 0,
        factors: {
          orderHistory: 0,
          categoryData: 0,
          specialtyData: 0,
          locationData: 0,
          pricingData: 0
        },
        recommendedMode: 'simple'
      };
    }

    let quality = 0;
    const factors = {
      orderHistory: 0,
      categoryData: 0,
      specialtyData: 0,
      locationData: 0,
      pricingData: 0
    };
    
    const supplierId = supplier._id || supplier.id;
    
    // Validate supplier ID
    if (!ObjectId.isValid(supplierId)) {
      return {
        total: 0,
        factors,
        recommendedMode: 'simple'
      };
    }
    
    // Check order history (40% weight)
    const orderCount = await db.collection('purchase_orders').countDocuments({
      supplierId: supplierId,
      status: { $in: ['order_accepted', 'delivered'] }
    });
    
    if (orderCount > 0) {
      factors.orderHistory = Math.min(40 + (orderCount > 10 ? 10 : 0), 50);
      quality += factors.orderHistory;
    }
    
    // Check category assignments (20% weight)
    // Note: categoryIds may not exist in schema, so we check safely
    if (supplier.categoryIds && Array.isArray(supplier.categoryIds) && supplier.categoryIds.length > 0) {
      factors.categoryData = 20;
      quality += factors.categoryData;
    }
    
    // Check material specialties (20% weight)
    // Note: materialSpecialties may not exist in schema, so we check safely
    if (supplier.materialSpecialties && Array.isArray(supplier.materialSpecialties) && supplier.materialSpecialties.length > 0) {
      factors.specialtyData = 20;
      quality += factors.specialtyData;
    }
    
    // Check location data (10% weight)
    if (supplier.location && (supplier.location.address || supplier.location.coordinates)) {
      factors.locationData = 10;
      quality += factors.locationData;
    }
    
    // Check pricing history (10% weight)
    if (supplier.pricingHistory && Object.keys(supplier.pricingHistory).length > 0) {
      factors.pricingData = 10;
      quality += factors.pricingData;
    }
    
    // Determine recommended mode based on quality
    let recommendedMode = 'simple';
    if (quality >= 70) {
      recommendedMode = 'smart';
    } else if (quality >= 30) {
      recommendedMode = 'hybrid';
    }
    
    return {
      total: Math.min(quality, 100),
      factors,
      recommendedMode
    };
  } catch (error) {
    console.error('Error calculating supplier data quality:', error);
    // Return safe defaults on error
    return {
      total: 0,
      factors: {
        orderHistory: 0,
        categoryData: 0,
        specialtyData: 0,
        locationData: 0,
        pricingData: 0
      },
      recommendedMode: 'simple'
    };
  }
}

/**
 * Select recommended mode based on data quality
 * @param {number} dataQuality - Data quality score (0-100)
 * @returns {string} Recommended mode: 'simple' | 'hybrid' | 'smart'
 */
export function selectRecommendedMode(dataQuality) {
  if (dataQuality < 30) return 'simple';
  if (dataQuality < 70) return 'hybrid';
  return 'smart';
}

/**
 * Find alternative suppliers for a rejected purchase order
 * @param {Object} options - Search options
 * @param {string} options.materialRequestId - Material request ID
 * @param {string} options.currentSupplierId - Current supplier ID to exclude
 * @param {string} options.rejectionReason - Original rejection reason
 * @param {number} options.quantity - Required quantity
 * @param {number} options.maxPrice - Maximum acceptable price (optional)
 * @param {Date} options.requiredBy - Required delivery date (optional)
 * @param {number} options.limit - Maximum number of results (default: 10)
 * @returns {Promise<Array>} Array of alternative suppliers with scores
 */
export async function findAlternativeSuppliers({
  materialRequestId,
  currentSupplierId,
  rejectionReason,
  quantity,
  maxPrice,
  requiredBy,
  limit = 10
}) {
  try {
    const db = await getDatabase();

    // Get material request details
    const materialRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(materialRequestId)
    });

    if (!materialRequest) {
      throw new Error('Material request not found');
    }

    // Build supplier search criteria
    const searchCriteria = {
      status: 'active',
      _id: { $ne: new ObjectId(currentSupplierId) }
    };

    // Add material-specific filtering
    if (materialRequest.categoryId) {
      searchCriteria.categoryIds = materialRequest.categoryId;
    }

    // Add location-based filtering (if project location is known)
    if (materialRequest.projectId) {
      const project = await db.collection('projects').findOne({
        _id: materialRequest.projectId
      });
      
      if (project && project.location) {
        // Add geographic preference (suppliers within reasonable distance)
        searchCriteria.location = { $exists: true };
      }
    }

    // Find potential suppliers
    const potentialSuppliers = await db.collection('suppliers')
      .find(searchCriteria)
      .limit(limit * 3) // Get more candidates for better filtering
      .toArray();

    // Score and rank suppliers
    const scoredSuppliers = await scoreSuppliers({
      suppliers: potentialSuppliers,
      materialRequest,
      quantity,
      maxPrice,
      requiredBy,
      rejectionReason,
      db
    });

    // Sort by score (highest first) and return top results
    return scoredSuppliers
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

  } catch (error) {
    console.error('Error finding alternative suppliers:', error);
    throw error;
  }
}

/**
 * Get smart supplier suggestions based on human-centric factors
 * @param {Object} options - Options for smart suggestions
 * @returns {Promise<Array>} Suppliers with smart suggestions
 */
export async function getSmartSupplierSuggestions({
  suppliers,
  materialRequest,
  projectId,
  rejectionReason,
  db
}) {
  const suggestions = [];

  for (const supplier of suppliers) {
    const suggestion = {
      ...supplier,
      recommendationReasons: [],
      priority: 0
    };

    // 1. Recent Performance (highest priority)
    const recentOrders = await db.collection('purchase_orders').find({
      supplierId: supplier._id,
      status: { $in: ['delivered', 'order_accepted'] },
      createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
    }).sort({ createdAt: -1 }).limit(5).toArray();

    if (recentOrders.length > 0) {
      const successRate = recentOrders.filter(order => order.status === 'delivered').length / recentOrders.length;
      if (successRate >= 0.9) {
        suggestion.recommendationReasons.push({
          type: 'recent_performance',
          text: `Excellent recent performance (${Math.round(successRate * 100)}% success rate)`,
          priority: 3
        });
        suggestion.priority += 3;
      }
    }

    // 2. Material Specialization
    const materialOrders = await db.collection('purchase_orders').find({
      supplierId: supplier._id,
      materialName: materialRequest.materialName,
      status: { $in: ['delivered', 'order_accepted'] }
    }).limit(10).toArray();

    if (materialOrders.length >= 3) {
      suggestion.recommendationReasons.push({
        type: 'material_specialization',
        text: `Specializes in ${materialRequest.materialName}`,
        priority: 2
      });
      suggestion.priority += 2;
    }

    // 3. Project Proximity
    const project = await db.collection('projects').findOne({ _id: projectId });
    if (project && supplier.location) {
      // Simple distance check - in real implementation, use geolocation API
      const sameCity = supplier.location.toLowerCase().includes(project.location?.toLowerCase() || '');
      if (sameCity) {
        suggestion.recommendationReasons.push({
          type: 'location_proximity',
          text: `Located in ${project.location}`,
          priority: 1
        });
        suggestion.priority += 1;
      }
    }

    // 4. Current Availability
    if (supplier.availabilityStatus === 'available') {
      suggestion.recommendationReasons.push({
        type: 'availability',
        text: 'Currently available for new orders',
        priority: 2
      });
      suggestion.priority += 2;
    }

    // 5. Communication Preferences Match
    if (supplier.communicationChannels) {
      const channels = Object.keys(supplier.communicationChannels).filter(key => supplier.communicationChannels[key]);
      if (channels.length >= 2) {
        suggestion.recommendationReasons.push({
          type: 'communication',
          text: `Multiple communication channels: ${channels.join(', ')}`,
          priority: 1
        });
        suggestion.priority += 1;
      }
    }

    // Sort recommendation reasons by priority
    suggestion.recommendationReasons.sort((a, b) => b.priority - a.priority);
    
    suggestions.push(suggestion);
  }

  // Sort suppliers by priority score
  return suggestions.sort((a, b) => b.priority - a.priority);
}

/**
 * Score suppliers based on multiple factors
 * @param {Object} options - Scoring options
 * @returns {Promise<Array>} Suppliers with scores
 */
async function scoreSuppliers({
  suppliers,
  materialRequest,
  quantity,
  maxPrice,
  requiredBy,
  rejectionReason,
  db
}) {
  const scoredSuppliers = [];

  for (const supplier of suppliers) {
    let score = 0;
    const scoringFactors = {};

    // 1. Material compatibility (40% weight)
    const materialScore = await calculateMaterialCompatibilityScore({
      supplier,
      materialRequest,
      db
    });
    scoringFactors.materialCompatibility = materialScore;
    score += materialScore * 0.4;

    // 2. Price competitiveness (25% weight)
    const priceScore = calculatePriceCompetitivenessScore({
      supplier,
      materialRequest,
      maxPrice,
      quantity,
      db
    });
    scoringFactors.priceCompetitiveness = priceScore;
    score += priceScore * 0.25;

    // 3. Delivery capability (20% weight)
    const deliveryScore = calculateDeliveryCapabilityScore({
      supplier,
      materialRequest,
      quantity,
      requiredBy,
      db
    });
    scoringFactors.deliveryCapability = deliveryScore;
    score += deliveryScore * 0.2;

    // 4. Historical performance (15% weight)
    const performanceScore = await calculatePerformanceScore({
      supplier,
      materialRequest,
      rejectionReason,
      db
    });
    scoringFactors.historicalPerformance = performanceScore;
    score += performanceScore * 0.15;

    scoredSuppliers.push({
      ...supplier,
      score: Math.round(score * 100) / 100, // Round to 2 decimal places
      scoringFactors,
      recommendation: generateRecommendation(score, scoringFactors),
      estimatedPrice: await estimateSupplierPrice(supplier, materialRequest, quantity, db),
      estimatedDelivery: await estimateDeliveryTime(supplier, materialRequest, quantity, db)
    });
  }

  return scoredSuppliers;
}

/**
 * Calculate material compatibility score
 * @param {Object} options - Scoring options
 * @returns {number} Score 0-100
 */
async function calculateMaterialCompatibilityScore({
  supplier,
  materialRequest,
  db
}) {
  let score = 50; // Base score

  // Check if supplier specializes in this material category
  if (supplier.categoryIds && supplier.categoryIds.includes(materialRequest.categoryId)) {
    score += 30;
  }

  // Check supplier's material expertise
  if (supplier.materialSpecialties && supplier.materialSpecialties.length > 0) {
    const materialMatch = supplier.materialSpecialties.some(specialty =>
      specialty.toLowerCase().includes(materialRequest.materialName.toLowerCase()) ||
      materialRequest.materialName.toLowerCase().includes(specialty.toLowerCase())
    );
    if (materialMatch) {
      score += 20;
    }
  }

  // Check past orders for similar materials
  const similarOrders = await db.collection('purchase_orders').countDocuments({
    supplierId: supplier._id,
    status: { $in: ['order_accepted', 'delivered'] },
    materialName: { $regex: materialRequest.materialName, $options: 'i' }
  });

  if (similarOrders > 0) {
    score += Math.min(similarOrders * 5, 20); // Max 20 points for experience
  }

  return Math.min(score, 100);
}

/**
 * Calculate price competitiveness score
 * @param {Object} options - Scoring options
 * @returns {number} Score 0-100
 */
function calculatePriceCompetitivenessScore({
  supplier,
  materialRequest,
  maxPrice,
  quantity,
  db
}) {
  let score = 50; // Base score

  // If supplier has pricing history for this material
  if (supplier.pricingHistory && supplier.pricingHistory[materialRequest.materialName]) {
    const historicalPrice = supplier.pricingHistory[materialRequest.materialName];
    const pricePerUnit = historicalPrice.unitCost;
    
    if (maxPrice && pricePerUnit <= maxPrice) {
      score += 30; // Within budget
    }

    // Compare with market average (if available)
    if (historicalPrice.marketAverage) {
      const priceDifference = ((historicalPrice.marketAverage - pricePerUnit) / historicalPrice.marketAverage) * 100;
      if (priceDifference > 0) {
        score += Math.min(priceDifference, 20); // Below market average
      } else if (priceDifference > -10) {
        score += 10; // Slightly above market average but reasonable
      }
    }
  }

  // Volume discounts
  if (quantity >= 100 && supplier.volumeDiscounts) {
    score += 10;
  }

  return Math.min(score, 100);
}

/**
 * Calculate delivery capability score
 * @param {Object} options - Scoring options
 * @returns {number} Score 0-100
 */
function calculateDeliveryCapabilityScore({
  supplier,
  materialRequest,
  quantity,
  requiredBy,
  db
}) {
  let score = 50; // Base score

  // Check supplier's delivery capacity
  if (supplier.deliveryCapacity) {
    if (supplier.deliveryCapacity.maxQuantity >= quantity) {
      score += 20;
    }
  }

  // Check if supplier can meet delivery timeline
  if (requiredBy && supplier.averageDeliveryTime) {
    const daysUntilRequired = Math.ceil((requiredBy - new Date()) / (1000 * 60 * 60 * 24));
    if (daysUntilRequired >= supplier.averageDeliveryTime) {
      score += 20;
    } else if (daysUntilRequired >= supplier.averageDeliveryTime * 0.8) {
      score += 10; // Close but might be tight
    }
  }

  // Check supplier's delivery reliability
  if (supplier.deliveryReliability) {
    score += supplier.deliveryReliability * 10; // 0-10 points based on reliability
  }

  return Math.min(score, 100);
}

/**
 * Calculate historical performance score
 * @param {Object} options - Scoring options
 * @returns {number} Score 0-100
 */
async function calculatePerformanceScore({
  supplier,
  materialRequest,
  rejectionReason,
  db
}) {
  let score = 50; // Base score

  // Calculate acceptance rate
  const totalOrders = await db.collection('purchase_orders').countDocuments({
    supplierId: supplier._id
  });

  const acceptedOrders = await db.collection('purchase_orders').countDocuments({
    supplierId: supplier._id,
    status: { $in: ['order_accepted', 'delivered'] }
  });

  if (totalOrders > 0) {
    const acceptanceRate = (acceptedOrders / totalOrders) * 100;
    score += (acceptanceRate / 100) * 30; // 0-30 points based on acceptance rate
  }

  // Check for similar rejection reasons
  if (rejectionReason) {
    const similarRejections = await db.collection('purchase_orders').countDocuments({
      supplierId: supplier._id,
      rejectionReason
    });

    if (similarRejections === 0) {
      score += 20; // Bonus for not having similar rejections
    } else {
      score -= similarRejections * 5; // Penalty for similar rejections
    }
  }

  // Check average delivery time performance
  if (supplier.averageDeliveryTime && supplier.targetDeliveryTime) {
    const onTimeRate = supplier.targetDeliveryTime / supplier.averageDeliveryTime;
    if (onTimeRate >= 1) {
      score += 10;
    } else if (onTimeRate >= 0.8) {
      score += 5;
    }
  }

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Generate recommendation based on score and factors
 * @param {number} score - Overall score
 * @param {Object} factors - Scoring factors
 * @returns {string} Recommendation text
 */
function generateRecommendation(score, factors) {
  if (score >= 80) {
    return 'Highly recommended - Excellent match across all criteria';
  } else if (score >= 65) {
    return 'Good option - Strong candidate with minor considerations';
  } else if (score >= 50) {
    return 'Acceptable - May work with some adjustments';
  } else {
    return 'Not recommended - Significant risks or limitations';
  }
}

/**
 * Estimate supplier price for material
 * @param {Object} supplier - Supplier object
 * @param {Object} materialRequest - Material request
 * @param {number} quantity - Required quantity
 * @param {Object} db - Database connection

 * @returns {Promise} Estimated price
 */
async function estimateSupplierPrice(supplier, materialRequest, quantity, db) {
  // Use supplier's pricing history
  if (supplier.pricingHistory && supplier.pricingHistory[materialRequest.materialName]) {
    const historicalPricing = supplier.pricingHistory[materialRequest.materialName];
    let estimatedUnitCost = historicalPricing.unitCost;

    // Apply volume discount if applicable
    if (quantity >= 100 && supplier.volumeDiscounts) {
      estimatedUnitCost *= (1 - supplier.volumeDiscounts);
    }

    return {
      unitCost: estimatedUnitCost,
      totalCost: estimatedUnitCost * quantity,
      confidence: 'high',
      source: 'historical_pricing'
    };
  }

  // Fallback to market average if available
  if (supplier.marketPricing && supplier.marketPricing[materialRequest.materialName]) {
    const marketPricing = supplier.marketPricing[materialRequest.materialName];
    return {
      unitCost: marketPricing.averagePrice,
      totalCost: marketPricing.averagePrice * quantity,
      confidence: 'medium',
      source: 'market_average'
    };
  }

  // No pricing data available
  return {
    unitCost: null,
    totalCost: null,
    confidence: 'low',
    source: 'no_data'
  };
}

/**
 * Estimate delivery time for supplier
 * @param {Object} supplier - Supplier object
 * @param {Object} materialRequest - Material request
 * @param {number} quantity - Required quantity
 * @param {Object} db - Database connection
 * @returns {Object} Estimated delivery time
 */
async function estimateDeliveryTime(supplier, materialRequest, quantity, db) {
  let estimatedDays = supplier.averageDeliveryTime || 14; // Default 14 days

  // Adjust for quantity
  if (quantity > 1000) {
    estimatedDays *= 1.5; // Large quantities take longer
  } else if (quantity < 10) {
    estimatedDays *= 0.8; // Small quantities are faster
  }

  // Check historical data for similar orders
  const similarOrders = await db.collection('purchase_orders')
    .find({
      supplierId: supplier._id,
      materialName: materialRequest.materialName,
      status: 'delivered'
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();

  if (similarOrders.length > 0) {
    const avgDeliveryTime = similarOrders.reduce((sum, order) => {
      if (order.createdAt && order.fulfilledAt) {
        return sum + (order.fulfilledAt - order.createdAt) / (1000 * 60 * 60 * 24);
      }
      return sum;
    }, 0) / similarOrders.length;

    if (avgDeliveryTime > 0) {
      estimatedDays = avgDeliveryTime;
    }
  }

  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + Math.ceil(estimatedDays));

  return {
    estimatedDays: Math.ceil(estimatedDays),
    estimatedDate,
    confidence: similarOrders.length > 0 ? 'high' : 'medium'
  };
}

/**
 * Get supplier alternatives for a specific material category
 * @param {string} categoryId - Material category ID
 * @param {string} excludeSupplierId - Supplier to exclude
 * @param {number} limit - Maximum results
 * @returns {Promise<Array>} Alternative suppliers
 */
export async function getSupplierAlternatives(categoryId, excludeSupplierId, limit = 5) {
  try {
    const db = await getDatabase();

    const suppliers = await db.collection('suppliers')
      .find({
        status: 'active',
        categoryIds: categoryId,
        _id: { $ne: new ObjectId(excludeSupplierId) }
      })
      .limit(limit)
      .toArray();

    return suppliers.map(supplier => ({
      ...supplier,
      recommendation: 'Alternative supplier for this material category'
    }));

  } catch (error) {
    console.error('Error getting supplier alternatives:', error);
    throw error;
  }
}

export {
  findSimpleAlternativeSuppliers,
  calculateSupplierDataQuality,
  selectRecommendedMode,
  findAlternativeSuppliers,
  getSmartSupplierSuggestions,
  scoreSuppliers,
  calculateMaterialCompatibilityScore,
  calculatePriceCompetitivenessScore,
  calculateDeliveryCapabilityScore,
  calculateReliabilityScore,
  estimateDeliveryTime,
  estimatePricing,
  getSupplierAlternatives
};
