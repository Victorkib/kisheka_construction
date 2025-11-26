/**
 * Discrepancy Detection Helper Functions
 * Detects variance, loss, and wastage in materials and creates alerts
 * 
 * This module provides functions to:
 * - Check materials for discrepancies
 * - Calculate variance, loss, and wastage
 * - Create alerts when thresholds are exceeded
 * - Track supplier performance
 */

import { getDatabase } from './mongodb/connection';
import { ObjectId } from 'mongodb';
import {
  calculateVariance,
  calculateVariancePercentage,
  calculateLoss,
  calculateLossPercentage,
  calculateWastage,
  isVarianceExcessive,
  isLossExcessive,
  isWastageExcessive,
  calculateVarianceCost,
  calculateLossCost,
  calculateTotalDiscrepancyCost,
} from './calculations';
import { createNotification, createNotifications } from './notifications';
import { createAuditLog } from './audit-log';
import { sendDiscrepancyEmail } from './email-templates';

/**
 * Default thresholds for discrepancy detection
 */
export const DEFAULT_THRESHOLDS = {
  variancePercentage: 5, // Alert if variance > 5%
  varianceAmount: 100, // Alert if variance > 100 units
  lossPercentage: 10, // Alert if loss > 10%
  lossAmount: 50, // Alert if loss > 50 units
  wastagePercentage: 15, // Alert if wastage > 15%
};

/**
 * Checks a single material for discrepancies
 * @param {Object} material - Material document from MongoDB
 * @param {Object} [thresholds] - Custom thresholds (optional)
 * @returns {Object} Discrepancy analysis result
 */
export function checkMaterialDiscrepancies(material, thresholds = {}) {
  const thresh = { ...DEFAULT_THRESHOLDS, ...thresholds };
  
  const quantityPurchased = parseFloat(material.quantityPurchased || material.quantity || 0);
  const quantityDelivered = parseFloat(material.quantityDelivered || 0);
  const quantityUsed = parseFloat(material.quantityUsed || 0);
  const unitCost = parseFloat(material.unitCost || 0);
  
  // Calculate metrics
  const variance = calculateVariance(quantityPurchased, quantityDelivered);
  const variancePercentage = calculateVariancePercentage(quantityPurchased, quantityDelivered);
  const varianceCost = calculateVarianceCost(quantityPurchased, quantityDelivered, unitCost);
  
  const loss = calculateLoss(quantityDelivered, quantityUsed);
  const lossPercentage = calculateLossPercentage(quantityDelivered, quantityUsed);
  const lossCost = calculateLossCost(quantityDelivered, quantityUsed, unitCost);
  
  const wastage = calculateWastage(quantityPurchased, quantityDelivered, quantityUsed);
  const totalDiscrepancyCost = calculateTotalDiscrepancyCost(
    quantityPurchased,
    quantityDelivered,
    quantityUsed,
    unitCost
  );
  
  // Check if discrepancies exceed thresholds
  const hasVarianceIssue = isVarianceExcessive(
    quantityPurchased,
    quantityDelivered,
    thresh.variancePercentage,
    thresh.varianceAmount
  );
  
  const hasLossIssue = isLossExcessive(
    quantityDelivered,
    quantityUsed,
    thresh.lossPercentage,
    thresh.lossAmount
  );
  
  const hasWastageIssue = isWastageExcessive(
    quantityPurchased,
    quantityDelivered,
    quantityUsed,
    thresh.wastagePercentage
  );
  
  return {
    materialId: material._id.toString(),
    materialName: material.name || material.materialName,
    projectId: material.projectId?.toString(),
    supplierName: material.supplierName || material.supplier,
    metrics: {
      variance,
      variancePercentage,
      varianceCost,
      loss,
      lossPercentage,
      lossCost,
      wastage,
      totalDiscrepancyCost,
    },
    alerts: {
      variance: hasVarianceIssue,
      loss: hasLossIssue,
      wastage: hasWastageIssue,
      hasAnyAlert: hasVarianceIssue || hasLossIssue || hasWastageIssue,
    },
    severity: getSeverityLevel(hasVarianceIssue, hasLossIssue, hasWastageIssue, totalDiscrepancyCost),
  };
}

/**
 * Determines severity level of discrepancies
 * @param {boolean} hasVariance - Whether variance exceeds threshold
 * @param {boolean} hasLoss - Whether loss exceeds threshold
 * @param {boolean} hasWastage - Whether wastage exceeds threshold
 * @param {number} totalCost - Total discrepancy cost
 * @returns {string} Severity level (LOW, MEDIUM, HIGH, CRITICAL)
 */
function getSeverityLevel(hasVariance, hasLoss, hasWastage, totalCost) {
  if (!hasVariance && !hasLoss && !hasWastage) {
    return 'NONE';
  }
  
  // Critical: Multiple issues or high cost (>10,000)
  if ((hasVariance && hasLoss) || totalCost > 10000) {
    return 'CRITICAL';
  }
  
  // High: Single issue with high cost (>5,000) or variance (theft indicator)
  if (hasVariance || totalCost > 5000) {
    return 'HIGH';
  }
  
  // Medium: Loss or wastage with moderate cost (>1,000)
  if ((hasLoss || hasWastage) && totalCost > 1000) {
    return 'MEDIUM';
  }
  
  // Low: Any issue with low cost
  return 'LOW';
}

/**
 * Checks all materials in a project for discrepancies
 * @param {string} projectId - Project ID
 * @param {Object} [options] - Options object
 * @param {Object} [options.thresholds] - Custom thresholds (optional)
 * @param {Date} [options.startDate] - Start date filter
 * @param {Date} [options.endDate] - End date filter
 * @param {string} [options.category] - Category filter
 * @returns {Promise<Array>} Array of discrepancy results
 */
export async function checkProjectDiscrepancies(projectId, options = {}) {
  try {
    const db = await getDatabase();
    
    // Get project-specific thresholds if not provided
    let thresholds = options.thresholds;
    if (!thresholds || Object.keys(thresholds).length === 0) {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(projectId),
      });
      thresholds = project?.wastageThresholds || DEFAULT_THRESHOLDS;
    } else {
      // Merge with defaults for any missing values
      thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    }
    
    const query = {
      projectId: new ObjectId(projectId),
      deletedAt: null,
      quantityDelivered: { $gt: 0 }, // Only check materials that have been delivered
    };

    // Add category filter if provided
    if (options.category) {
      query.category = options.category;
    }

    // Add date filters if provided
    if (options.startDate || options.endDate) {
      const dateFilter = {};
      if (options.startDate) {
        dateFilter.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        const endDate = new Date(options.endDate);
        endDate.setHours(23, 59, 59, 999); // End of day
        dateFilter.$lte = endDate;
      }
      
      if (Object.keys(dateFilter).length > 0) {
        query.$or = [
          { dateDelivered: dateFilter },
          { dateUsed: dateFilter },
          { createdAt: dateFilter },
          { updatedAt: dateFilter },
        ];
      }
    }
    
    // Get all materials for the project that have been delivered
    const materials = await db
      .collection('materials')
      .find(query)
      .toArray();
    
    const discrepancies = materials.map((material) =>
      checkMaterialDiscrepancies(material, thresholds)
    );
    
    // Filter to only materials with alerts
    return discrepancies.filter((d) => d.alerts.hasAnyAlert);
  } catch (error) {
    console.error('Error checking project discrepancies:', error);
    return [];
  }
}

/**
 * Creates alerts for materials with discrepancies
 * @param {Array} discrepancies - Array of discrepancy results from checkMaterialDiscrepancies
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Number of notifications created
 */
export async function createDiscrepancyAlerts(discrepancies, projectId) {
  try {
    const db = await getDatabase();
    
    // Get project managers and owners who should receive alerts
    const alertRecipients = await db
      .collection('users')
      .find({
        role: { $in: ['owner', 'pm', 'project_manager', 'admin'] },
        status: 'active',
      })
      .toArray();
    
    if (alertRecipients.length === 0) {
      console.warn('No alert recipients found for discrepancy alerts');
      return 0;
    }
    
    const notifications = [];
    
    // Get project name for email
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });
    const projectName = project?.projectName || project?.projectCode || 'Unknown Project';

    for (const discrepancy of discrepancies) {
      if (!discrepancy.alerts.hasAnyAlert) continue;

      // Create or update discrepancy record in database
      const existingDiscrepancy = await db.collection('discrepancies').findOne({
        materialId: new ObjectId(discrepancy.materialId),
        isActive: true,
      });

      const discrepancyData = {
        materialId: new ObjectId(discrepancy.materialId),
        projectId: new ObjectId(projectId),
        materialName: discrepancy.materialName,
        supplierName: discrepancy.supplierName,
        severity: discrepancy.severity,
        metrics: discrepancy.metrics,
        alerts: discrepancy.alerts,
        status: 'open',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        resolutionHistory: [],
      };

      if (existingDiscrepancy) {
        // Update existing discrepancy if metrics have changed
        await db.collection('discrepancies').findOneAndUpdate(
          { _id: existingDiscrepancy._id },
          {
            $set: {
              severity: discrepancy.severity,
              metrics: discrepancy.metrics,
              alerts: discrepancy.alerts,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              ...discrepancyData,
            },
          },
          { upsert: true }
        );
      } else {
        // Create new discrepancy record
        await db.collection('discrepancies').insertOne(discrepancyData);
      }

      // Send email for CRITICAL severity discrepancies
      if (discrepancy.severity === 'CRITICAL') {
        for (const recipient of alertRecipients) {
          // Check user email preferences
          const userPrefs = recipient.notificationPreferences || {};
          const emailEnabled = userPrefs.emailNotifications !== false; // Default to true if not set
          const discrepancyAlertsEnabled = userPrefs.discrepancyAlerts !== false; // Default to true if not set

          if (emailEnabled && discrepancyAlertsEnabled && recipient.email) {
            try {
              await sendDiscrepancyEmail({
                discrepancy,
                recipient,
                projectName,
              });
              console.log(`Critical discrepancy email sent to ${recipient.email}`);
            } catch (emailError) {
              console.error(`Failed to send email to ${recipient.email}:`, emailError);
              // Continue with other recipients even if one fails
            }
          }
        }
      }
      
      // Build alert message
      const alertParts = [];
      if (discrepancy.alerts.variance) {
        alertParts.push(
          `Variance: ${discrepancy.metrics.variance.toFixed(2)} units (${discrepancy.metrics.variancePercentage.toFixed(2)}%)`
        );
      }
      if (discrepancy.alerts.loss) {
        alertParts.push(
          `Loss: ${discrepancy.metrics.loss.toFixed(2)} units (${discrepancy.metrics.lossPercentage.toFixed(2)}%)`
        );
      }
      if (discrepancy.alerts.wastage) {
        alertParts.push(`Wastage: ${discrepancy.metrics.wastage.toFixed(2)}%`);
      }
      
      const message = `${discrepancy.materialName} - ${alertParts.join(', ')}. Total cost impact: ${discrepancy.metrics.totalDiscrepancyCost.toFixed(2)}`;
      
      // Create notification for each recipient
      for (const recipient of alertRecipients) {
        notifications.push({
          userId: recipient._id.toString(),
          type: 'discrepancy_alert',
          title: `Material Discrepancy Alert - ${discrepancy.severity} Severity`,
          message,
          projectId,
          relatedModel: 'MATERIAL',
          relatedId: discrepancy.materialId,
        });
      }
    }
    
    if (notifications.length > 0) {
      await createNotifications(notifications);
      
      // Create audit log
      await createAuditLog({
        userId: alertRecipients[0]._id.toString(), // Use first recipient as system user
        action: 'DISCREPANCY_ALERTS_CREATED',
        entityType: 'PROJECT',
        entityId: projectId,
        changes: {
          discrepancyCount: discrepancies.filter((d) => d.alerts.hasAnyAlert).length,
          notificationCount: notifications.length,
        },
        projectId,
      });
    }
    
    return notifications.length;
  } catch (error) {
    console.error('Error creating discrepancy alerts:', error);
    return 0;
  }
}

/**
 * Gets supplier performance metrics
 * @param {string} projectId - Project ID (optional, if not provided checks all projects)
 * @param {Object} [options] - Optional filters
 * @param {Date} [options.startDate] - Start date filter
 * @param {Date} [options.endDate] - End date filter
 * @param {string} [options.category] - Category filter
 * @returns {Promise<Array>} Array of supplier performance data
 */
export async function getSupplierPerformance(projectId = null, options = {}) {
  try {
    const db = await getDatabase();
    
    const matchQuery = {
      deletedAt: null,
      quantityDelivered: { $gt: 0 },
    };
    
    if (projectId) {
      matchQuery.projectId = new ObjectId(projectId);
    }

    // Add category filter if provided
    if (options.category) {
      matchQuery.category = options.category;
    }

    // Add date filters if provided
    if (options.startDate || options.endDate) {
      const dateFilter = {};
      if (options.startDate) {
        dateFilter.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        const endDate = new Date(options.endDate);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }
      
      if (Object.keys(dateFilter).length > 0) {
        matchQuery.$or = [
          { dateDelivered: dateFilter },
          { dateUsed: dateFilter },
          { createdAt: dateFilter },
          { updatedAt: dateFilter },
        ];
      }
    }
    
    const supplierStats = await db
      .collection('materials')
      .aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$supplierName',
            totalMaterials: { $sum: 1 },
            totalPurchased: { $sum: '$quantityPurchased' },
            totalDelivered: { $sum: '$quantityDelivered' },
            totalVariance: {
              $sum: {
                $subtract: ['$quantityPurchased', '$quantityDelivered'],
              },
            },
            totalVarianceCost: {
              $sum: {
                $multiply: [
                  { $subtract: ['$quantityPurchased', '$quantityDelivered'] },
                  '$unitCost',
                ],
              },
            },
            averageVariancePercentage: {
              $avg: {
                $cond: [
                  { $gt: ['$quantityPurchased', 0] },
                  {
                    $multiply: [
                      {
                        $divide: [
                          { $subtract: ['$quantityPurchased', '$quantityDelivered'] },
                          '$quantityPurchased',
                        ],
                      },
                      100,
                    ],
                  },
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            supplierName: '$_id',
            totalMaterials: 1,
            totalPurchased: 1,
            totalDelivered: 1,
            totalVariance: 1,
            totalVarianceCost: { $round: ['$totalVarianceCost', 2] },
            averageVariancePercentage: { $round: ['$averageVariancePercentage', 2] },
            deliveryAccuracy: {
              $round: [
                {
                  $multiply: [
                    {
                      $divide: [
                        '$totalDelivered',
                        { $cond: [{ $gt: ['$totalPurchased', 0] }, '$totalPurchased', 1] },
                      ],
                    },
                    100,
                  ],
                },
                2,
              ],
            },
          },
        },
        { $sort: { totalVarianceCost: -1 } },
      ])
      .toArray();
    
    return supplierStats;
  } catch (error) {
    console.error('Error getting supplier performance:', error);
    return [];
  }
}

/**
 * Gets discrepancy summary for a project
 * @param {string} projectId - Project ID
 * @param {Object} [options] - Optional filters
 * @param {Date} [options.startDate] - Start date filter
 * @param {Date} [options.endDate] - End date filter
 * @param {string} [options.category] - Category filter
 * @returns {Promise<Object>} Summary of all discrepancies
 */
export async function getProjectDiscrepancySummary(projectId, options = {}) {
  try {
    const db = await getDatabase();
    
    const query = {
      projectId: new ObjectId(projectId),
      deletedAt: null,
      quantityDelivered: { $gt: 0 },
    };

    // Add category filter if provided
    if (options.category) {
      query.category = options.category;
    }

    // Add date filters if provided
    if (options.startDate || options.endDate) {
      const dateFilter = {};
      if (options.startDate) {
        dateFilter.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        const endDate = new Date(options.endDate);
        endDate.setHours(23, 59, 59, 999); // End of day
        dateFilter.$lte = endDate;
      }
      
      // Check any of these date fields (materials matching any date field)
      if (Object.keys(dateFilter).length > 0) {
        query.$or = [
          { dateDelivered: dateFilter },
          { dateUsed: dateFilter },
          { createdAt: dateFilter },
          { updatedAt: dateFilter },
        ];
      }
    }
    
    const materials = await db
      .collection('materials')
      .find(query)
      .toArray();
    
    let totalVariance = 0;
    let totalLoss = 0;
    let totalWastage = 0;
    let totalVarianceCost = 0;
    let totalLossCost = 0;
    let totalDiscrepancyCost = 0;
    let materialsWithIssues = 0;
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    
    for (const material of materials) {
      const discrepancy = checkMaterialDiscrepancies(material);
      
      if (discrepancy.alerts.hasAnyAlert) {
        materialsWithIssues++;
        totalVariance += discrepancy.metrics.variance;
        totalLoss += discrepancy.metrics.loss;
        totalWastage += discrepancy.metrics.wastage;
        totalVarianceCost += discrepancy.metrics.varianceCost;
        totalLossCost += discrepancy.metrics.lossCost;
        totalDiscrepancyCost += discrepancy.metrics.totalDiscrepancyCost;
        
        switch (discrepancy.severity) {
          case 'CRITICAL':
            criticalCount++;
            break;
          case 'HIGH':
            highCount++;
            break;
          case 'MEDIUM':
            mediumCount++;
            break;
          case 'LOW':
            lowCount++;
            break;
        }
      }
    }
    
    return {
      projectId,
      totalMaterials: materials.length,
      materialsWithIssues,
      metrics: {
        totalVariance: parseFloat(totalVariance.toFixed(2)),
        totalLoss: parseFloat(totalLoss.toFixed(2)),
        totalWastage: parseFloat((totalWastage / materials.length).toFixed(2)),
        totalVarianceCost: parseFloat(totalVarianceCost.toFixed(2)),
        totalLossCost: parseFloat(totalLossCost.toFixed(2)),
        totalDiscrepancyCost: parseFloat(totalDiscrepancyCost.toFixed(2)),
      },
      severityBreakdown: {
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
      },
    };
  } catch (error) {
    console.error('Error getting project discrepancy summary:', error);
    return null;
  }
}

/**
 * Gets historical trend data for wastage analytics
 * @param {string} projectId - Project ID
 * @param {Object} [options] - Optional filters
 * @param {Date} [options.startDate] - Start date filter
 * @param {Date} [options.endDate] - End date filter
 * @returns {Promise<Array>} Array of monthly trend data
 */
export async function getHistoricalTrends(projectId, options = {}) {
  try {
    const db = await getDatabase();
    
    const query = {
      projectId: new ObjectId(projectId),
      deletedAt: null,
      quantityDelivered: { $gt: 0 },
    };

    // Add date filters if provided
    if (options.startDate || options.endDate) {
      const dateFilter = {};
      if (options.startDate) {
        dateFilter.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        const endDate = new Date(options.endDate);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }
      
      if (Object.keys(dateFilter).length > 0) {
        query.$or = [
          { dateDelivered: dateFilter },
          { dateUsed: dateFilter },
          { createdAt: dateFilter },
          { updatedAt: dateFilter },
        ];
      }
    }

    const materials = await db
      .collection('materials')
      .find(query)
      .sort({ createdAt: 1 })
      .toArray();

    // Group by month
    const monthlyData = new Map();

    materials.forEach((material) => {
      // Use dateDelivered if available, otherwise use createdAt
      const date = material.dateDelivered || material.dateUsed || material.createdAt;
      if (!date) return;

      const monthKey = new Date(date).toISOString().substring(0, 7); // YYYY-MM format
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          month: monthKey,
          variance: 0,
          loss: 0,
          wastage: 0,
          varianceCost: 0,
          lossCost: 0,
          totalDiscrepancyCost: 0,
          materialCount: 0,
          materialsWithIssues: 0,
        });
      }

      const discrepancy = checkMaterialDiscrepancies(material);
      const monthData = monthlyData.get(monthKey);
      
      monthData.materialCount++;
      
      if (discrepancy.alerts.hasAnyAlert) {
        monthData.materialsWithIssues++;
        monthData.variance += discrepancy.metrics.variance;
        monthData.loss += discrepancy.metrics.loss;
        monthData.wastage += discrepancy.metrics.wastage;
        monthData.varianceCost += discrepancy.metrics.varianceCost;
        monthData.lossCost += discrepancy.metrics.lossCost;
        monthData.totalDiscrepancyCost += discrepancy.metrics.totalDiscrepancyCost;
      }
    });

    // Convert to array and format
    const trends = Array.from(monthlyData.values())
      .map((data) => ({
        month: data.month,
        monthLabel: new Date(data.month + '-01').toLocaleDateString('en-KE', { year: 'numeric', month: 'short' }),
        variance: parseFloat(data.variance.toFixed(2)),
        loss: parseFloat(data.loss.toFixed(2)),
        wastage: parseFloat((data.wastage / data.materialCount).toFixed(2)),
        varianceCost: parseFloat(data.varianceCost.toFixed(2)),
        lossCost: parseFloat(data.lossCost.toFixed(2)),
        totalDiscrepancyCost: parseFloat(data.totalDiscrepancyCost.toFixed(2)),
        materialCount: data.materialCount,
        materialsWithIssues: data.materialsWithIssues,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return trends;
  } catch (error) {
    console.error('Error getting historical trends:', error);
    return [];
  }
}

/**
 * Gets category-based discrepancy analysis
 * @param {string} projectId - Project ID
 * @param {Object} [options] - Optional filters
 * @param {Date} [options.startDate] - Start date filter
 * @param {Date} [options.endDate] - End date filter
 * @returns {Promise<Array>} Array of category performance data
 */
export async function getCategoryAnalysis(projectId, options = {}) {
  try {
    const db = await getDatabase();
    
    const query = {
      projectId: new ObjectId(projectId),
      deletedAt: null,
      quantityDelivered: { $gt: 0 },
    };

    // Add date filters if provided
    if (options.startDate || options.endDate) {
      const dateFilter = {};
      if (options.startDate) {
        dateFilter.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        const endDate = new Date(options.endDate);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }
      
      if (Object.keys(dateFilter).length > 0) {
        query.$or = [
          { dateDelivered: dateFilter },
          { dateUsed: dateFilter },
          { createdAt: dateFilter },
          { updatedAt: dateFilter },
        ];
      }
    }

    const materials = await db
      .collection('materials')
      .find(query)
      .toArray();

    // Group by category
    const categoryData = new Map();

    materials.forEach((material) => {
      const category = material.category || 'other';
      
      if (!categoryData.has(category)) {
        categoryData.set(category, {
          category,
          totalMaterials: 0,
          materialsWithIssues: 0,
          totalVariance: 0,
          totalLoss: 0,
          totalWastage: 0,
          totalVarianceCost: 0,
          totalLossCost: 0,
          totalDiscrepancyCost: 0,
        });
      }

      const discrepancy = checkMaterialDiscrepancies(material);
      const catData = categoryData.get(category);
      
      catData.totalMaterials++;
      
      if (discrepancy.alerts.hasAnyAlert) {
        catData.materialsWithIssues++;
        catData.totalVariance += discrepancy.metrics.variance;
        catData.totalLoss += discrepancy.metrics.loss;
        catData.totalWastage += discrepancy.metrics.wastage;
        catData.totalVarianceCost += discrepancy.metrics.varianceCost;
        catData.totalLossCost += discrepancy.metrics.lossCost;
        catData.totalDiscrepancyCost += discrepancy.metrics.totalDiscrepancyCost;
      }
    });

    // Convert to array and format
    const analysis = Array.from(categoryData.values())
      .map((data) => ({
        category: data.category,
        totalMaterials: data.totalMaterials,
        materialsWithIssues: data.materialsWithIssues,
        variance: parseFloat(data.totalVariance.toFixed(2)),
        loss: parseFloat(data.totalLoss.toFixed(2)),
        wastage: parseFloat((data.totalWastage / data.totalMaterials).toFixed(2)),
        varianceCost: parseFloat(data.totalVarianceCost.toFixed(2)),
        lossCost: parseFloat(data.totalLossCost.toFixed(2)),
        totalDiscrepancyCost: parseFloat(data.totalDiscrepancyCost.toFixed(2)),
        issueRate: data.totalMaterials > 0 
          ? parseFloat(((data.materialsWithIssues / data.totalMaterials) * 100).toFixed(2))
          : 0,
      }))
      .sort((a, b) => b.totalDiscrepancyCost - a.totalDiscrepancyCost);

    return analysis;
  } catch (error) {
    console.error('Error getting category analysis:', error);
    return [];
  }
}

