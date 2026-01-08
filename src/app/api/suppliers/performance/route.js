/**
 * Supplier Performance Dashboard API Routes
 * GET /api/suppliers/performance/top - Get top performing suppliers
 * GET /api/suppliers/performance/dashboard - Performance dashboard data
 * GET /api/suppliers/performance/summary - Performance summary statistics
 * 
 * Auth: PM, OWNER, ADMIN
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { getTopPerformingSuppliers } from '@/lib/supplier-performance';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/suppliers/performance/top
 * Get top performing suppliers by category
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_suppliers');
    if (!canView) {
      return errorResponse('Insufficient permissions to view supplier performance', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 10;
    const category = searchParams.get('category') || 'overall';
    const minOrders = parseInt(searchParams.get('minOrders')) || 5;

    // Validate parameters
    if (limit < 1 || limit > 50) {
      return errorResponse('Limit must be between 1 and 50', 400);
    }

    if (minOrders < 1) {
      return errorResponse('Minimum orders must be at least 1', 400);
    }

    const validCategories = ['overall', 'reliability', 'quality', 'timeliness', 'communication', 'priceCompetitiveness'];
    if (!validCategories.includes(category)) {
      return errorResponse(`Invalid category. Must be one of: ${validCategories.join(', ')}`, 400);
    }

    // Get top performing suppliers
    const topSuppliers = await getTopPerformingSuppliers({
      limit,
      category,
      minOrders
    });

    return successResponse({
      suppliers: topSuppliers,
      category,
      limit,
      minOrders,
      totalResults: topSuppliers.length
    }, `Top ${topSuppliers.length} suppliers by ${category}`);

  } catch (error) {
    console.error('Get top performing suppliers error:', error);
    return errorResponse('Failed to retrieve top performing suppliers', 500);
  }
}

/**
 * GET /api/suppliers/performance/dashboard
 * Get comprehensive performance dashboard data
 */
export async function DASHBOARD(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_suppliers');
    if (!canView) {
      return errorResponse('Insufficient permissions to view supplier performance', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 10;

    const db = await getDatabase();

    // Get overall statistics
    const totalSuppliers = await db.collection('suppliers').countDocuments({
      status: 'active'
    });

    const suppliersWithPerformance = await db.collection('suppliers').countDocuments({
      status: 'active',
      'performanceMetrics.totalOrders': { $gte: 1 }
    });

    // Get performance distribution
    const performanceDistribution = await getPerformanceDistribution(db);

    // Get top performers in each category
    const topPerformers = {};
    const categories = ['reliability', 'quality', 'timeliness', 'communication', 'priceCompetitiveness'];
    
    for (const category of categories) {
      const suppliers = await getTopPerformingSuppliers({
        limit: 5,
        category,
        minOrders: 3
      });
      topPerformers[category] = suppliers;
    }

    // Get recent performance updates
    const recentUpdates = await db.collection('supplier_performance_history')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    // Get performance trends
    const trends = await getPerformanceTrends(db);

    return successResponse({
      overview: {
        totalSuppliers,
        suppliersWithPerformance,
        performanceCoverage: totalSuppliers > 0 ? Math.round((suppliersWithPerformance / totalSuppliers) * 100) : 0
      },
      distribution: performanceDistribution,
      topPerformers,
      recentUpdates: recentUpdates.map(update => ({
        supplierId: update.supplierId,
        score: update.performance.overallScore,
        grade: update.performance.grade,
        updatedAt: update.createdAt
      })),
      trends
    }, 'Performance dashboard data retrieved successfully');

  } catch (error) {
    console.error('Get performance dashboard error:', error);
    return errorResponse('Failed to retrieve performance dashboard data', 500);
  }
}

/**
 * Get performance distribution statistics
 * @param {Object} db - Database connection
 * @returns {Object} Performance distribution
 */
async function getPerformanceDistribution(db) {
  try {
    const suppliers = await db.collection('suppliers')
      .find({
        status: 'active',
        'performanceMetrics.totalOrders': { $gte: 1 }
      })
      .toArray();

    const distribution = {
      excellent: 0,    // 90+
      good: 0,         // 80-89
      average: 0,      // 70-79
      belowAverage: 0, // 60-69
      poor: 0          // <60
    };

    const categoryDistribution = {};

    suppliers.forEach(supplier => {
      if (supplier.performanceMetrics && supplier.performanceMetrics.overallScore) {
        const score = supplier.performanceMetrics.overallScore;
        
        if (score >= 90) distribution.excellent++;
        else if (score >= 80) distribution.good++;
        else if (score >= 70) distribution.average++;
        else if (score >= 60) distribution.belowAverage++;
        else distribution.poor++;

        // Category distribution
        if (supplier.performanceMetrics.categories) {
          Object.keys(supplier.performanceMetrics.categories).forEach(category => {
            if (!categoryDistribution[category]) {
              categoryDistribution[category] = { excellent: 0, good: 0, average: 0, belowAverage: 0, poor: 0 };
            }
            
            const categoryScore = supplier.performanceMetrics.categories[category].score;
            if (categoryScore >= 90) categoryDistribution[category].excellent++;
            else if (categoryScore >= 80) categoryDistribution[category].good++;
            else if (categoryScore >= 70) categoryDistribution[category].average++;
            else if (categoryScore >= 60) categoryDistribution[category].belowAverage++;
            else categoryDistribution[category].poor++;
          });
        }
      }
    });

    return {
      overall: distribution,
      categories: categoryDistribution,
      total: suppliers.length
    };

  } catch (error) {
    console.error('Error getting performance distribution:', error);
    return { overall: {}, categories: {}, total: 0 };
  }
}

/**
 * Get performance trends over time
 * @param {Object} db - Database connection
 * @returns {Object} Performance trends
 */
async function getPerformanceTrends(db) {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const history = await db.collection('supplier_performance_history')
      .find({
        createdAt: { $gte: threeMonthsAgo }
      })
      .sort({ createdAt: 1 })
      .toArray();

    // Group by week
    const weeklyTrends = {};
    const supplierTrends = {};

    history.forEach(record => {
      const weekKey = getWeekKey(record.createdAt);
      
      if (!weeklyTrends[weekKey]) {
        weeklyTrends[weekKey] = { scores: [], count: 0 };
      }
      
      weeklyTrends[weekKey].scores.push(record.performance.overallScore);
      weeklyTrends[weekKey].count++;

      // Track individual supplier trends
      const supplierIdStr = record.supplierId.toString();
      if (!supplierTrends[supplierIdStr]) {
        supplierTrends[supplierIdStr] = [];
      }
      supplierTrends[supplierIdStr].push({
        date: record.createdAt,
        score: record.performance.overallScore
      });
    });

    // Calculate weekly averages
    const weeklyAverages = Object.keys(weeklyTrends).map(week => ({
      week,
      averageScore: weeklyTrends[week].scores.reduce((sum, score) => sum + score, 0) / weeklyTrends[week].scores.length,
      supplierCount: weeklyTrends[week].count
    }));

    // Calculate trend direction
    let trendDirection = 'stable';
    if (weeklyAverages.length >= 4) {
      const recent = weeklyAverages.slice(-4);
      const firstWeek = recent[0].averageScore;
      const lastWeek = recent[recent.length - 1].averageScore;
      
      if (lastWeek > firstWeek + 2) {
        trendDirection = 'improving';
      } else if (lastWeek < firstWeek - 2) {
        trendDirection = 'declining';
      }
    }

    return {
      weeklyAverages,
      trendDirection,
      supplierCount: Object.keys(supplierTrends).length
    };

  } catch (error) {
    console.error('Error getting performance trends:', error);
    return { weeklyAverages: [], trendDirection: 'stable', supplierCount: 0 };
  }
}

/**
 * Get week key for grouping
 * @param {Date} date - Date
 * @returns {string} Week key (YYYY-WW)
 */
function getWeekKey(date) {
  const year = date.getFullYear();
  const week = Math.ceil((date - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-W${week.toString().padStart(2, '0')}`;
}
