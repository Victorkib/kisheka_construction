/**
 * Supplier Response Analytics API
 * GET /api/analytics/supplier-responses - Comprehensive supplier response analytics
 * 
 * Auth: PM, OWNER, ADMIN
 */

import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth-helpers"
import { hasPermission } from "@/lib/role-helpers"
import { getDatabase } from "@/lib/mongodb/connection"
import { successResponse, errorResponse } from "@/lib/api-response"

/**
 * GET /api/analytics/supplier-responses
 * Get comprehensive supplier response analytics
 */
export async function GET(request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return errorResponse("Unauthorized", 401)
    }

    // Check permission
    const canView = await hasPermission(user.id, "view_purchase_orders")
    if (!canView) {
      return errorResponse("Insufficient permissions to view analytics", 403)
    }

    const userProfile = await getUserProfile(user.id)
    if (!userProfile) {
      return errorResponse("User profile not found", 404)
    }

    const { searchParams } = new URL(request.url)
    const timeFilter = searchParams.get("timeFilter") || "30d"
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")) : null
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")) : null

    // Build date filter based on timeFilter
    const dateFilter = {}
    const now = new Date()
    
    if (timeFilter === "7d") {
      dateFilter.createdAt = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
    } else if (timeFilter === "30d") {
      dateFilter.createdAt = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
    } else if (timeFilter === "90d") {
      dateFilter.createdAt = { $gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) }
    }
    
    // Override with custom date range if provided
    if (startDate || endDate) {
      dateFilter.createdAt = {}
      if (startDate) dateFilter.createdAt.$gte = startDate
      if (endDate) dateFilter.createdAt.$lte = endDate
    }

    const db = await getDatabase()

    // Get comprehensive response analytics
    const analytics = await getSupplierResponseAnalytics(db, dateFilter)

    return successResponse(analytics, "Supplier response analytics retrieved successfully")
  } catch (error) {
    console.error("Get supplier response analytics error:", error)
    return errorResponse("Failed to retrieve supplier response analytics", 500)
  }
}

/**
 * Get comprehensive supplier response analytics
 * @param {Object} db - Database connection
 * @param {Object} dateFilter - Date filter
 * @returns {Object} Analytics data
 */
async function getSupplierResponseAnalytics(db, dateFilter) {
  try {
    // Get all orders in date range
    const orders = await db
      .collection("purchase_orders")
      .find({
        ...dateFilter,
        deletedAt: null,
      })
      .toArray()

    const totalOrders = orders.length
    const respondedOrders = orders.filter(order => order.supplierResponse)
    const acceptedOrders = orders.filter(order => order.supplierResponse === 'accept')
    const rejectedOrders = orders.filter(order => order.supplierResponse === 'reject')
    const modifiedOrders = orders.filter(order => order.supplierResponse === 'modify')
    const pendingOrders = orders.filter(order => !order.supplierResponse && (order.status === 'order_sent' || order.status === 'order_modified'))

    // Overall metrics
    const responseRate = totalOrders > 0 ? (respondedOrders.length / totalOrders) * 100 : 0
    const acceptanceRate = respondedOrders.length > 0 ? (acceptedOrders.length / respondedOrders.length) * 100 : 0
    const rejectionRate = respondedOrders.length > 0 ? (rejectedOrders.length / respondedOrders.length) * 100 : 0
    const modificationRate = respondedOrders.length > 0 ? (modifiedOrders.length / respondedOrders.length) * 100 : 0

    // Calculate average response time
    const responseTimes = respondedOrders
      .filter(order => order.supplierResponseDate && order.sentAt)
      .map(order => (new Date(order.supplierResponseDate) - new Date(order.sentAt)) / (1000 * 60 * 60)) // in hours
    
    const averageResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0

    // Supplier performance analysis
    const supplierAnalysis = analyzeSupplierResponses(respondedOrders)

    // Response trends over time
    const trends = analyzeResponseTrends(orders, dateFilter)

    // Recent activity
    const recentActivity = getRecentActivity(respondedOrders)

    // Response reason analysis (for rejections)
    const rejectionReasons = analyzeRejectionReasons(rejectedOrders)

    // Modification analysis
    const modificationAnalysis = analyzeModifications(modifiedOrders)

    return {
      overview: {
        totalOrders,
        totalResponses: respondedOrders.length,
        pendingResponses: pendingOrders.length,
        responseRate: Math.round(responseRate * 100) / 100,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        rejectionRate: Math.round(rejectionRate * 100) / 100,
        modificationRate: Math.round(modificationRate * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      },
      suppliers: supplierAnalysis,
      trends,
      recentActivity,
      rejectionReasons,
      modifications: modificationAnalysis,
      period: dateFilter,
    }
  } catch (error) {
    console.error("Error in getSupplierResponseAnalytics:", error)
    throw error
  }
}

/**
 * Analyze supplier response performance
 * @param {Array} respondedOrders - Orders with supplier responses
 * @returns {Object} Supplier analysis
 */
function analyzeSupplierResponses(respondedOrders) {
  const supplierStats = {}

  respondedOrders.forEach(order => {
    const supplierId = order.supplierId?.toString()
    const supplierName = order.supplierName || 'Unknown'
    
    if (!supplierStats[supplierId]) {
      supplierStats[supplierId] = {
        name: supplierName,
        email: order.supplierEmail || '',
        totalResponses: 0,
        acceptedOrders: 0,
        rejectedOrders: 0,
        modifiedOrders: 0,
        responseTimes: [],
        totalValue: 0,
      }
    }

    const stats = supplierStats[supplierId]
    stats.totalResponses++
    stats.totalValue += order.totalCost || 0

    if (order.supplierResponse === 'accept') stats.acceptedOrders++
    else if (order.supplierResponse === 'reject') stats.rejectedOrders++
    else if (order.supplierResponse === 'modify') stats.modifiedOrders++

    // Calculate response time
    if (order.supplierResponseDate && order.sentAt) {
      const responseTime = (new Date(order.supplierResponseDate) - new Date(order.sentAt)) / (1000 * 60 * 60)
      stats.responseTimes.push(responseTime)
    }
  })

  // Calculate metrics for each supplier
  const suppliers = Object.keys(supplierStats).map(supplierId => {
    const stats = supplierStats[supplierId]
    const averageResponseTime = stats.responseTimes.length > 0 ?
      stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length : 0
    
    return {
      id: supplierId,
      name: stats.name,
      email: stats.email,
      totalResponses: stats.totalResponses,
      acceptanceRate: stats.totalResponses > 0 ? (stats.acceptedOrders / stats.totalResponses) * 100 : 0,
      rejectionRate: stats.totalResponses > 0 ? (stats.rejectedOrders / stats.totalResponses) * 100 : 0,
      modificationRate: stats.totalResponses > 0 ? (stats.modifiedOrders / stats.totalResponses) * 100 : 0,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      totalValue: stats.totalValue,
    }
  })

  // Sort by acceptance rate and response time
  return {
    topSuppliers: suppliers
      .sort((a, b) => {
        // Primary sort: acceptance rate
        if (b.acceptanceRate !== a.acceptanceRate) {
          return b.acceptanceRate - a.acceptanceRate
        }
        // Secondary sort: response time (lower is better)
        return a.averageResponseTime - b.averageResponseTime
      })
      .slice(0, 10),
    totalSuppliers: suppliers.length,
  }
}

/**
 * Analyze response trends over time
 * @param {Array} orders - All orders
 * @param {Object} dateFilter - Date filter
 * @returns {Array} Trend data
 */
function analyzeResponseTrends(orders, dateFilter) {
  // Group by week
  const weeklyTrends = {}
  
  orders.forEach(order => {
    const weekKey = getWeekKey(new Date(order.createdAt))
    
    if (!weeklyTrends[weekKey]) {
      weeklyTrends[weekKey] = {
        total: 0,
        responded: 0,
        accepted: 0,
        rejected: 0,
        modified: 0,
        responseTimes: [],
      }
    }
    
    weeklyTrends[weekKey].total++
    
    if (order.supplierResponse) {
      weeklyTrends[weekKey].responded++
      
      if (order.supplierResponse === 'accept') weeklyTrends[weekKey].accepted++
      else if (order.supplierResponse === 'reject') weeklyTrends[weekKey].rejected++
      else if (order.supplierResponse === 'modify') weeklyTrends[weekKey].modified++
      
      // Calculate response time
      if (order.supplierResponseDate && order.sentAt) {
        const responseTime = (new Date(order.supplierResponseDate) - new Date(order.sentAt)) / (1000 * 60 * 60)
        weeklyTrends[weekKey].responseTimes.push(responseTime)
      }
    }
  })

  // Convert to array and calculate metrics
  return Object.keys(weeklyTrends)
    .sort()
    .map(weekKey => {
      const week = weeklyTrends[weekKey]
      const responseRate = week.total > 0 ? (week.responded / week.total) * 100 : 0
      const acceptanceRate = week.responded > 0 ? (week.accepted / week.responded) * 100 : 0
      const averageResponseTime = week.responseTimes.length > 0 ?
        week.responseTimes.reduce((sum, time) => sum + time, 0) / week.responseTimes.length : 0
      
      return {
        period: weekKey,
        totalOrders: week.total,
        totalResponses: week.responded,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        responseTime: Math.round(averageResponseTime * 100) / 100,
        responseRate: Math.round(responseRate * 100) / 100,
      }
    })
    .slice(-12) // Last 12 weeks
}

/**
 * Get recent activity
 * @param {Array} respondedOrders - Orders with responses
 * @returns {Array} Recent activity
 */
function getRecentActivity(respondedOrders) {
  return respondedOrders
    .filter(order => order.supplierResponseDate)
    .sort((a, b) => new Date(b.supplierResponseDate) - new Date(a.supplierResponseDate))
    .slice(0, 20)
    .map(order => ({
      type: order.supplierResponse,
      title: `Order ${order.supplierResponse === 'accept' ? 'Accepted' : 
                    order.supplierResponse === 'reject' ? 'Rejected' : 'Modified'}`,
      description: `PO #${order.purchaseOrderNumber} - ${order.supplierName}`,
      timestamp: order.supplierResponseDate,
      orderId: order._id.toString(),
      purchaseOrderNumber: order.purchaseOrderNumber,
      supplierName: order.supplierName,
    }))
}

/**
 * Analyze rejection reasons
 * @param {Array} rejectedOrders - Rejected orders
 * @returns {Object} Rejection analysis
 */
function analyzeRejectionReasons(rejectedOrders) {
  const reasonCounts = {}
  const subcategoryCounts = {}

  rejectedOrders.forEach(order => {
    const reason = order.rejectionReason || 'unknown'
    const subcategory = order.rejectionSubcategory || 'unknown'
    
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
    subcategoryCounts[subcategory] = (subcategoryCounts[subcategory] || 0) + 1
  })

  const total = rejectedOrders.length
  const reasonPercentages = {}
  const subcategoryPercentages = {}

  Object.keys(reasonCounts).forEach(reason => {
    reasonPercentages[reason] = Math.round((reasonCounts[reason] / total) * 10000) / 100
  })

  Object.keys(subcategoryCounts).forEach(subcategory => {
    subcategoryPercentages[subcategory] = Math.round((subcategoryCounts[subcategory] / total) * 10000) / 100
  })

  return {
    counts: reasonCounts,
    percentages: reasonPercentages,
    subcategories: {
      counts: subcategoryCounts,
      percentages: subcategoryPercentages,
    },
    totalRejections: total,
  }
}

/**
 * Analyze modification requests
 * @param {Array} modifiedOrders - Modified orders
 * @returns {Object} Modification analysis
 */
function analyzeModifications(modifiedOrders) {
  const modificationTypes = {
    unitCost: 0,
    quantity: 0,
    deliveryDate: 0,
    other: 0,
  }

  modifiedOrders.forEach(order => {
    if (order.supplierModifications) {
      if (order.supplierModifications.unitCost !== undefined) modificationTypes.unitCost++
      if (order.supplierModifications.quantityOrdered !== undefined) modificationTypes.quantity++
      if (order.supplierModifications.deliveryDate) modificationTypes.deliveryDate++
      if (order.supplierModifications.notes) modificationTypes.other++
    }
  })

  const total = modifiedOrders.length
  const percentages = {}

  Object.keys(modificationTypes).forEach(type => {
    percentages[type] = total > 0 ? Math.round((modificationTypes[type] / total) * 10000) / 100 : 0
  })

  return {
    counts: modificationTypes,
    percentages,
    totalModifications: total,
  }
}

/**
 * Get week key for grouping
 * @param {Date} date - Date to get week key for
 * @returns {string} Week key in format "YYYY-WWW"
 */
function getWeekKey(date) {
  const year = date.getFullYear()
  const week = Math.ceil((date - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000))
  return `${year}-W${week.toString().padStart(2, '0')}`
}
