/**
 * Supplier Performance Metrics
 * 
 * Comprehensive supplier performance tracking and analytics system
 * for monitoring supplier reliability, quality, and efficiency.
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Performance metric categories and weights
 */
export const PERFORMANCE_CATEGORIES = {
  RELIABILITY: { weight: 0.35, name: 'Reliability' },
  QUALITY: { weight: 0.25, name: 'Quality' },
  TIMELINESS: { weight: 0.20, name: 'Timeliness' },
  COMMUNICATION: { weight: 0.10, name: 'Communication' },
  PRICE_COMPETITIVENESS: { weight: 0.10, name: 'Price Competitiveness' }
};

/**
 * Calculate comprehensive supplier performance score
 * @param {string} supplierId - Supplier ID
 * @param {Object} options - Calculation options
 * @param {Date} options.startDate - Start date for analysis
 * @param {Date} options.endDate - End date for analysis
 * @param {boolean} options.includeHistorical - Include historical data
 * @returns {Promise<Object>} Performance metrics and scores
 */
export async function calculateSupplierPerformance(supplierId, options = {}) {
  try {
    const db = await getDatabase();
    const { startDate, endDate, includeHistorical = true } = options;

    // Get supplier information
    const supplier = await db.collection('suppliers').findOne({
      _id: new ObjectId(supplierId),
      status: 'active'
    });

    if (!supplier) {
      throw new Error('Supplier not found or inactive');
    }

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = startDate;
      if (endDate) dateFilter.createdAt.$lte = endDate;
    }

    // Get all purchase orders for this supplier
    const orders = await db.collection('purchase_orders')
      .find({
        supplierId: new ObjectId(supplierId),
        ...dateFilter,
        deletedAt: null
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Calculate performance metrics
    const reliability = calculateReliabilityMetrics(orders);
    const quality = calculateQualityMetrics(orders, db);
    const timeliness = calculateTimelinessMetrics(orders);
    const communication = calculateCommunicationMetrics(orders);
    const priceCompetitiveness = await calculatePriceCompetitivenessMetrics(supplier, orders, db);

    // Calculate weighted overall score
    const overallScore = (
      reliability.score * PERFORMANCE_CATEGORIES.RELIABILITY.weight +
      quality.score * PERFORMANCE_CATEGORIES.QUALITY.weight +
      timeliness.score * PERFORMANCE_CATEGORIES.TIMELINESS.weight +
      communication.score * PERFORMANCE_CATEGORIES.COMMUNICATION.weight +
      priceCompetitiveness.score * PERFORMANCE_CATEGORIES.PRICE_COMPETITIVENESS.weight
    );

    // Generate performance trends
    const trends = await calculatePerformanceTrends(supplierId, db);

    // Get performance recommendations
    const recommendations = generatePerformanceRecommendations({
      reliability,
      quality,
      timeliness,
      communication,
      priceCompetitiveness,
      overallScore
    });

    return {
      supplierId,
      supplierName: supplier.name,
      calculationDate: new Date(),
      period: { startDate, endDate },
      totalOrders: orders.length,
      overallScore: Math.round(overallScore * 100) / 100,
      categories: {
        reliability: { ...reliability, weight: PERFORMANCE_CATEGORIES.RELIABILITY.weight },
        quality: { ...quality, weight: PERFORMANCE_CATEGORIES.QUALITY.weight },
        timeliness: { ...timeliness, weight: PERFORMANCE_CATEGORIES.TIMELINESS.weight },
        communication: { ...communication, weight: PERFORMANCE_CATEGORIES.COMMUNICATION.weight },
        priceCompetitiveness: { ...priceCompetitiveness, weight: PERFORMANCE_CATEGORIES.PRICE_COMPETITIVENESS.weight }
      },
      trends,
      recommendations,
      grade: getPerformanceGrade(overallScore),
      lastUpdated: new Date()
    };

  } catch (error) {
    console.error('Error calculating supplier performance:', error);
    throw error;
  }
}

/**
 * Calculate reliability metrics
 * @param {Array} orders - Purchase orders
 * @returns {Object} Reliability metrics
 */
function calculateReliabilityMetrics(orders) {
  const totalOrders = orders.length;
  if (totalOrders === 0) {
    return { score: 0, acceptanceRate: 0, rejectionRate: 0, modificationRate: 0, totalOrders: 0 };
  }

  const acceptedOrders = orders.filter(order => order.status === 'order_accepted' || order.status === 'delivered').length;
  const rejectedOrders = orders.filter(order => order.status === 'order_rejected').length;
  const modifiedOrders = orders.filter(order => order.status === 'order_modified').length;

  const acceptanceRate = (acceptedOrders / totalOrders) * 100;
  const rejectionRate = (rejectedOrders / totalOrders) * 100;
  const modificationRate = (modifiedOrders / totalOrders) * 100;

  // Calculate reliability score based on acceptance rate and low rejection rate
  let score = (acceptanceRate * 0.7) + ((100 - rejectionRate) * 0.3);
  
  // Penalty for high modification rate
  if (modificationRate > 20) {
    score -= (modificationRate - 20) * 0.5;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    acceptanceRate: Math.round(acceptanceRate * 100) / 100,
    rejectionRate: Math.round(rejectionRate * 100) / 100,
    modificationRate: Math.round(modificationRate * 100) / 100,
    totalOrders,
    acceptedOrders,
    rejectedOrders,
    modifiedOrders
  };
}

/**
 * Calculate quality metrics
 * @param {Array} orders - Purchase orders
 * @param {Object} db - Database connection
 * @returns {Object} Quality metrics
 */
async function calculateQualityMetrics(orders, db) {
  const totalOrders = orders.length;
  if (totalOrders === 0) {
    return { score: 0, fulfillmentRate: 0, qualityIssues: 0, totalOrders: 0 };
  }

  const fulfilledOrders = orders.filter(order => order.status === 'delivered').length;
  const fulfillmentRate = (fulfilledOrders / totalOrders) * 100;

  // Get material entries linked to these orders to check quality issues
  const linkedMaterials = await db.collection('materials')
    .find({
      sourcePurchaseOrderId: { $in: orders.map(order => order._id) }
    })
    .toArray();

  const qualityIssues = linkedMaterials.filter(material => 
    material.qualityIssues && material.qualityIssues.length > 0
  ).length;

  // Calculate quality score based on fulfillment rate and low quality issues
  let score = (fulfillmentRate * 0.8) + ((100 - (qualityIssues / totalOrders) * 100) * 0.2);

  return {
    score: Math.max(0, Math.min(100, score)),
    fulfillmentRate: Math.round(fulfillmentRate * 100) / 100,
    qualityIssues,
    totalOrders,
    fulfilledOrders,
    qualityIssueRate: totalOrders > 0 ? Math.round((qualityIssues / totalOrders) * 10000) / 100 : 0
  };
}

/**
 * Calculate timeliness metrics
 * @param {Array} orders - Purchase orders
 * @returns {Object} Timeliness metrics
 */
function calculateTimelinessMetrics(orders) {
  const deliveredOrders = orders.filter(order => 
    order.status === 'delivered' && order.createdAt && order.fulfilledAt
  );

  if (deliveredOrders.length === 0) {
    return { score: 0, onTimeDeliveryRate: 0, averageDeliveryTime: 0, totalDeliveredOrders: 0 };
  }

  const deliveryTimes = deliveredOrders.map(order => {
    const deliveryTime = (order.fulfilledAt - order.createdAt) / (1000 * 60 * 60 * 24); // days
    const promisedTime = order.deliveryDate ? 
      (order.deliveryDate - order.createdAt) / (1000 * 60 * 60 * 24) : 14; // default 14 days
    
    return {
      actualTime: deliveryTime,
      promisedTime: promisedTime,
      onTime: deliveryTime <= promisedTime
    };
  });

  const onTimeDeliveries = deliveryTimes.filter(dt => dt.onTime).length;
  const onTimeDeliveryRate = (onTimeDeliveries / deliveredOrders.length) * 100;
  const averageDeliveryTime = deliveryTimes.reduce((sum, dt) => sum + dt.actualTime, 0) / deliveryTimes.length;

  // Calculate timeliness score
  let score = onTimeDeliveryRate * 0.7;
  
  // Bonus for fast average delivery
  if (averageDeliveryTime <= 7) {
    score += 20;
  } else if (averageDeliveryTime <= 14) {
    score += 10;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    onTimeDeliveryRate: Math.round(onTimeDeliveryRate * 100) / 100,
    averageDeliveryTime: Math.round(averageDeliveryTime * 100) / 100,
    totalDeliveredOrders: deliveredOrders.length,
    onTimeDeliveries,
    averagePromisedTime: deliveryTimes.reduce((sum, dt) => sum + dt.promisedTime, 0) / deliveryTimes.length
  };
}

/**
 * Calculate communication metrics
 * @param {Array} orders - Purchase orders
 * @returns {Object} Communication metrics
 */
function calculateCommunicationMetrics(orders) {
  const totalOrders = orders.length;
  if (totalOrders === 0) {
    return { score: 0, responseRate: 0, averageResponseTime: 0, totalOrders: 0 };
  }

  const respondedOrders = orders.filter(order => order.supplierResponseDate).length;
  const responseRate = (respondedOrders / totalOrders) * 100;

  // Calculate average response time (in hours)
  const responseTimes = orders
    .filter(order => order.createdAt && order.supplierResponseDate)
    .map(order => (order.supplierResponseDate - order.createdAt) / (1000 * 60 * 60)); // hours

  const averageResponseTime = responseTimes.length > 0 ? 
    responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;

  // Calculate communication score
  let score = responseRate * 0.6;
  
  // Bonus for fast response times
  if (averageResponseTime <= 24) {
    score += 30;
  } else if (averageResponseTime <= 48) {
    score += 20;
  } else if (averageResponseTime <= 72) {
    score += 10;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    responseRate: Math.round(responseRate * 100) / 100,
    averageResponseTime: Math.round(averageResponseTime * 100) / 100,
    totalOrders,
    respondedOrders,
    averageResponseTimeHours: averageResponseTime
  };
}

/**
 * Calculate price competitiveness metrics
 * @param {Object} supplier - Supplier object
 * @param {Array} orders - Purchase orders
 * @param {Object} db - Database connection
 * @returns {Object} Price competitiveness metrics
 */
async function calculatePriceCompetitivenessMetrics(supplier, orders, db) {
  if (orders.length === 0) {
    return { score: 0, priceCompetitiveness: 0, marketComparison: 0, totalOrders: 0 };
  }

  // Get market average prices for the same materials
  const materialNames = [...new Set(orders.map(order => order.materialName))];
  
  let totalCompetitivenessScore = 0;
  let validComparisons = 0;

  for (const materialName of materialNames) {
    const supplierOrders = orders.filter(order => order.materialName === materialName);
    const supplierAvgPrice = supplierOrders.reduce((sum, order) => sum + order.unitCost, 0) / supplierOrders.length;

    // Get market average for this material
    const marketOrders = await db.collection('purchase_orders')
      .find({
        materialName,
        status: { $in: ['order_accepted', 'delivered'] },
        deletedAt: null
      })
      .toArray();

    if (marketOrders.length > 1) {
      const marketAvgPrice = marketOrders.reduce((sum, order) => sum + order.unitCost, 0) / marketOrders.length;
      
      // Calculate competitiveness (lower is better)
      const competitiveness = ((marketAvgPrice - supplierAvgPrice) / marketAvgPrice) * 100;
      totalCompetitivenessScore += Math.max(-50, Math.min(50, competitiveness)); // Cap at ±50%
      validComparisons++;
    }
  }

  const avgCompetitiveness = validComparisons > 0 ? totalCompetitivenessScore / validComparisons : 0;
  
  // Convert to score (0-100 scale)
  let score = 50 + avgCompetitiveness; // 50 is neutral
  score = Math.max(0, Math.min(100, score));

  return {
    score: Math.round(score * 100) / 100,
    priceCompetitiveness: Math.round(avgCompetitiveness * 100) / 100,
    marketComparison: validComparisons,
    totalOrders: orders.length,
    validComparisons
  };
}

/**
 * Calculate performance trends over time
 * @param {string} supplierId - Supplier ID
 * @param {Object} db - Database connection
 * @returns {Object} Performance trends
 */
async function calculatePerformanceTrends(supplierId, db) {
  const trends = {
    monthly: [],
    quarterly: [],
    direction: 'stable'
  };

  try {
    // Get monthly performance for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const orders = await db.collection('purchase_orders')
      .find({
        supplierId: new ObjectId(supplierId),
        createdAt: { $gte: sixMonthsAgo },
        deletedAt: null
      })
      .sort({ createdAt: 1 })
      .toArray();

    // Group by month
    const monthlyGroups = {};
    orders.forEach(order => {
      const monthKey = order.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyGroups[monthKey]) {
        monthlyGroups[monthKey] = [];
      }
      monthlyGroups[monthKey].push(order);
    });

    // Calculate monthly scores
    for (const [month, monthOrders] of Object.entries(monthlyGroups)) {
      const reliability = calculateReliabilityMetrics(monthOrders);
      const timeliness = calculateTimelinessMetrics(monthOrders);
      
      const monthlyScore = (reliability.score * 0.6) + (timeliness.score * 0.4);
      
      trends.monthly.push({
        month,
        score: Math.round(monthlyScore * 100) / 100,
        orderCount: monthOrders.length
      });
    }

    // Determine trend direction
    if (trends.monthly.length >= 3) {
      const recent = trends.monthly.slice(-3);
      const firstScore = recent[0].score;
      const lastScore = recent[recent.length - 1].score;
      
      if (lastScore > firstScore + 5) {
        trends.direction = 'improving';
      } else if (lastScore < firstScore - 5) {
        trends.direction = 'declining';
      }
    }

  } catch (error) {
    console.error('Error calculating trends:', error);
  }

  return trends;
}

/**
 * Generate performance recommendations
 * @param {Object} metrics - Performance metrics
 * @returns {Array} Recommendations
 */
function generatePerformanceRecommendations(metrics) {
  const recommendations = [];

  // Reliability recommendations
  if (metrics.reliability.rejectionRate > 30) {
    recommendations.push({
      category: 'reliability',
      priority: 'high',
      message: 'High rejection rate detected. Consider reviewing order requirements and supplier capabilities.',
      action: 'Review rejection reasons and consider supplier training or replacement'
    });
  }

  if (metrics.reliability.acceptanceRate < 70) {
    recommendations.push({
      category: 'reliability',
      priority: 'medium',
      message: 'Low acceptance rate may indicate capability issues.',
      action: 'Discuss performance with supplier and set improvement targets'
    });
  }

  // Quality recommendations
  if (metrics.quality.qualityIssueRate > 10) {
    recommendations.push({
      category: 'quality',
      priority: 'high',
      message: 'High quality issue rate detected.',
      action: 'Implement quality control measures and supplier quality audits'
    });
  }

  // Timeliness recommendations
  if (metrics.timeliness.onTimeDeliveryRate < 80) {
    recommendations.push({
      category: 'timeliness',
      priority: 'medium',
      message: 'Low on-time delivery rate affecting project schedules.',
      action: 'Review delivery schedules and consider penalties for delays'
    });
  }

  if (metrics.timeliness.averageDeliveryTime > 21) {
    recommendations.push({
      category: 'timeliness',
      priority: 'medium',
      message: 'Average delivery time is longer than expected.',
      action: 'Optimize logistics and discuss delivery improvements with supplier'
    });
  }

  // Communication recommendations
  if (metrics.communication.responseRate < 90) {
    recommendations.push({
      category: 'communication',
      priority: 'medium',
      message: 'Low response rate may delay decision making.',
      action: 'Establish clear communication protocols and response time expectations'
    });
  }

  if (metrics.communication.averageResponseTime > 72) {
    recommendations.push({
      category: 'communication',
      priority: 'low',
      message: 'Slow response times affecting order processing.',
      action: 'Set up automated reminders and improve communication channels'
    });
  }

  // Price recommendations
  if (metrics.priceCompetitiveness.priceCompetitiveness < -10) {
    recommendations.push({
      category: 'price',
      priority: 'medium',
      message: 'Prices are significantly above market average.',
      action: 'Negotiate better pricing or consider alternative suppliers'
    });
  }

  // Overall performance recommendations
  if (metrics.overallScore < 60) {
    recommendations.push({
      category: 'overall',
      priority: 'high',
      message: 'Overall performance is below acceptable levels.',
      action: 'Consider supplier replacement or comprehensive performance improvement plan'
    });
  }

  return recommendations;
}

/**
 * Get performance grade based on score
 * @param {number} score - Performance score
 * @returns {string} Performance grade
 */
function getPerformanceGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 45) return 'D+';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Update supplier performance in database
 * @param {string} supplierId - Supplier ID
 * @returns {Promise<Object>} Updated performance data
 */
export async function updateSupplierPerformance(supplierId) {
  try {
    const db = await getDatabase();
    const performance = await calculateSupplierPerformance(supplierId);

    // Update supplier record with latest performance
    await db.collection('suppliers').updateOne(
      { _id: new ObjectId(supplierId) },
      {
        $set: {
          performanceMetrics: performance,
          performanceUpdatedAt: new Date()
        }
      }
    );

    // Store performance history
    await db.collection('supplier_performance_history').insertOne({
      supplierId: new ObjectId(supplierId),
      performance,
      createdAt: new Date()
    });

    return performance;
  } catch (error) {
    console.error('Error updating supplier performance:', error);
    throw error;
  }
}

/**
 * Get top performing suppliers
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Top suppliers
 */
export async function getTopPerformingSuppliers(options = {}) {
  const { limit = 10, category = null, minOrders = 5 } = options;
  
  try {
    const db = await getDatabase();
    
    // Get suppliers with sufficient order history
    const suppliers = await db.collection('suppliers')
      .find({
        status: 'active',
        'performanceMetrics.totalOrders': { $gte: minOrders }
      })
      .toArray();

    // Sort by performance score
    const sortedSuppliers = suppliers
      .filter(supplier => supplier.performanceMetrics)
      .sort((a, b) => {
        if (category && category !== 'overall') {
          return b.performanceMetrics.categories[category]?.score - a.performanceMetrics.categories[category]?.score || 0;
        }
        return b.performanceMetrics.overallScore - a.performanceMetrics.overallScore;
      })
      .slice(0, limit);

    return sortedSuppliers.map(supplier => ({
      id: supplier._id,
      name: supplier.name,
      email: supplier.email,
      performance: supplier.performanceMetrics
    }));

  } catch (error) {
    console.error('Error getting top performing suppliers:', error);
    throw error;
  }
}
