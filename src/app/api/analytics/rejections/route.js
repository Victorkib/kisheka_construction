import { createClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth-helpers"
import { hasPermission } from "@/lib/role-helpers"
import { getDatabase } from "@/lib/mongodb/connection"
import { successResponse, errorResponse } from "@/lib/api-response"

/**
 * GET /api/analytics/rejections
 * Get comprehensive rejection analytics dashboard data
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

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
      return errorResponse("Insufficient permissions to view rejection analytics", 403)
    }

    const userProfile = await getUserProfile(user.id)
    if (!userProfile) {
      return errorResponse("User profile not found", 404)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate") ? new Date(searchParams.get("startDate")) : null
    const endDate = searchParams.get("endDate") ? new Date(searchParams.get("endDate")) : null

    // Validate date range
    if (startDate && endDate && startDate >= endDate) {
      return errorResponse("Start date must be before end date", 400)
    }

    const db = await getDatabase()

    // Build date filter
    const dateFilter = {}
    if (startDate || endDate) {
      dateFilter.createdAt = {}
      if (startDate) dateFilter.createdAt.$gte = startDate
      if (endDate) dateFilter.createdAt.$lte = endDate
    }

    // Get comprehensive rejection analytics
    const analytics = await getRejectionAnalytics(db, dateFilter)

    return successResponse(analytics, "Rejection analytics retrieved successfully")
  } catch (error) {
    console.error("Get rejection analytics error:", error)
    return errorResponse("Failed to retrieve rejection analytics", 500)
  }
}

/**
 * Get comprehensive rejection analytics
 * @param {Object} db - Database connection
 * @param {Object} dateFilter - Date filter
 * @returns {Object} Analytics data
 */
async function getRejectionAnalytics(db, dateFilter) {
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
    const rejectedOrders = orders.filter((order) => order.status === "order_rejected")
    const retryOrders = orders.filter((order) => order.status === "retry_sent")
    const alternativeOrders = orders.filter((order) => order.isAlternativeOrder)

    // Overall rejection rate
    const rejectionRate = totalOrders > 0 ? (rejectedOrders.length / totalOrders) * 100 : 0

    // Rejection reason analysis
    const reasonAnalysis = analyzeRejectionReasons(rejectedOrders)

    // Supplier rejection analysis
    const supplierAnalysis = analyzeSupplierRejections(rejectedOrders)

    // Material category rejection analysis
    const categoryAnalysis = await analyzeCategoryRejections(rejectedOrders, db)

    // Resolution analysis (retry vs alternatives)
    const resolutionAnalysis = analyzeResolutions(rejectedOrders, retryOrders, alternativeOrders)

    // Time-based trends
    const trends = analyzeRejectionTrends(orders, dateFilter)

    // Impact analysis
    const impactAnalysis = analyzeRejectionImpact(rejectedOrders)

    return {
      overview: {
        totalOrders,
        rejectedOrders: rejectedOrders.length,
        retryOrders: retryOrders.length,
        alternativeOrders: alternativeOrders.length,
        rejectionRate: Math.round(rejectionRate * 100) / 100,
        period: dateFilter,
      },
      reasons: reasonAnalysis,
      suppliers: supplierAnalysis,
      categories: categoryAnalysis,
      resolutions: resolutionAnalysis,
      trends,
      impact: impactAnalysis,
    }
  } catch (error) {
    console.error("Error in getRejectionAnalytics:", error)
    throw error
  }
}

/**
 * Analyze rejection reasons
 * @param {Array} rejectedOrders - Rejected orders
 * @returns {Object} Reason analysis
 */
function analyzeRejectionReasons(rejectedOrders) {
  const reasonCounts = {}
  const subcategoryCounts = {}
  const retryableCounts = { retryable: 0, notRetryable: 0 }

  rejectedOrders.forEach((order) => {
    // Main reason
    const reason = order.rejectionReason || "unknown"
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1

    // Subcategory
    const subcategory = order.rejectionSubcategory || "unknown"
    subcategoryCounts[subcategory] = (subcategoryCounts[subcategory] || 0) + 1

    // Retryability
    if (order.isRetryable === true) {
      retryableCounts.retryable++
    } else if (order.isRetryable === false) {
      retryableCounts.notRetryable++
    }
  })

  // Calculate percentages
  const total = rejectedOrders.length
  const reasonPercentages = {}
  const subcategoryPercentages = {}

  Object.keys(reasonCounts).forEach((reason) => {
    reasonPercentages[reason] = Math.round((reasonCounts[reason] / total) * 10000) / 100
  })

  Object.keys(subcategoryCounts).forEach((subcategory) => {
    subcategoryPercentages[subcategory] = Math.round((subcategoryCounts[subcategory] / total) * 10000) / 100
  })

  return {
    counts: reasonCounts,
    percentages: reasonPercentages,
    subcategories: {
      counts: subcategoryCounts,
      percentages: subcategoryPercentages,
    },
    retryability: {
      ...retryableCounts,
      retryableRate: total > 0 ? Math.round((retryableCounts.retryable / total) * 10000) / 100 : 0,
    },
  }
}

/**
 * Analyze supplier rejections
 * @param {Array} rejectedOrders - Rejected orders
 * @returns {Object} Supplier analysis
 */
function analyzeSupplierRejections(rejectedOrders) {
  const supplierCounts = {}
  const supplierDetails = {}

  rejectedOrders.forEach((order) => {
    const supplierId = order.supplierId?.toString()
    if (supplierId) {
      supplierCounts[supplierId] = (supplierCounts[supplierId] || 0) + 1

      if (!supplierDetails[supplierId]) {
        supplierDetails[supplierId] = {
          name: order.supplierName || "Unknown",
          email: order.supplierEmail || "",
          reasons: {},
          totalValue: 0,
          orderCount: 0,
        }
      }

      supplierDetails[supplierId].reasons[order.rejectionReason] =
        (supplierDetails[supplierId].reasons[order.rejectionReason] || 0) + 1
      supplierDetails[supplierId].totalValue += order.totalCost || 0
      supplierDetails[supplierId].orderCount++
    }
  })

  // Sort suppliers by rejection count
  const sortedSuppliers = Object.keys(supplierCounts)
    .sort((a, b) => supplierCounts[b] - supplierCounts[a])
    .slice(0, 10) // Top 10

  return {
    topSuppliers: sortedSuppliers.map((supplierId) => ({
      id: supplierId,
      name: supplierDetails[supplierId].name,
      email: supplierDetails[supplierId].email,
      rejectionCount: supplierCounts[supplierId],
      totalValue: supplierDetails[supplierId].totalValue,
      orderCount: supplierDetails[supplierId].orderCount,
      topReasons: Object.entries(supplierDetails[supplierId].reasons)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3),
    })),
    totalSuppliers: Object.keys(supplierCounts).length,
  }
}

/**
 * Analyze category rejections
 * @param {Array} rejectedOrders - Rejected orders
 * @param {Object} db - Database connection
 * @returns {Object} Category analysis
 */
async function analyzeCategoryRejections(rejectedOrders, db) {
  const categoryCounts = {}
  const categoryDetails = {}

  // Group by category
  rejectedOrders.forEach((order) => {
    const category = order.category || "unknown"
    categoryCounts[category] = (categoryCounts[category] || 0) + 1

    if (!categoryDetails[category]) {
      categoryDetails[category] = {
        materialNames: {},
        totalValue: 0,
        orderCount: 0,
      }
    }

    categoryDetails[category].materialNames[order.materialName] =
      (categoryDetails[category].materialNames[order.materialName] || 0) + 1
    categoryDetails[category].totalValue += order.totalCost || 0
    categoryDetails[category].orderCount++
  })

  // Calculate percentages
  const total = rejectedOrders.length
  const categoryPercentages = {}

  Object.keys(categoryCounts).forEach((category) => {
    categoryPercentages[category] = Math.round((categoryCounts[category] / total) * 10000) / 100
  })

  return {
    counts: categoryCounts,
    percentages: categoryPercentages,
    details: categoryDetails,
  }
}

/**
 * Analyze resolutions (retry vs alternatives)
 * @param {Array} rejectedOrders - Rejected orders
 * @param {Array} retryOrders - Retry orders
 * @param {Array} alternativeOrders - Alternative orders
 * @returns {Object} Resolution analysis
 */
function analyzeResolutions(rejectedOrders, retryOrders, alternativeOrders) {
  const resolutions = {
    retry: 0,
    alternatives: 0,
    noAction: 0,
  }

  rejectedOrders.forEach((order) => {
    if (order.status === "retry_sent") {
      resolutions.retry++
    } else if (order.status === "alternatives_sent") {
      resolutions.alternatives++
    } else {
      resolutions.noAction++
    }
  })

  const total = rejectedOrders.length
  const resolutionRate = total > 0 ? ((resolutions.retry + resolutions.alternatives) / total) * 100 : 0

  return {
    counts: resolutions,
    percentages: {
      retry: total > 0 ? Math.round((resolutions.retry / total) * 10000) / 100 : 0,
      alternatives: total > 0 ? Math.round((resolutions.alternatives / total) * 10000) / 100 : 0,
      noAction: total > 0 ? Math.round((resolutions.noAction / total) * 10000) / 100 : 0,
      resolutionRate: Math.round(resolutionRate * 100) / 100,
    },
  }
}

/**
 * Analyze rejection trends over time
 * @param {Array} orders - All orders
 * @param {Object} dateFilter - Date filter
 * @returns {Object} Trend analysis
 */
function analyzeRejectionTrends(orders, dateFilter) {
  // Group by month
  const monthlyTrends = {}

  orders.forEach((order) => {
    const monthKey = order.createdAt.toISOString().substring(0, 7) // YYYY-MM
    if (!monthlyTrends[monthKey]) {
      monthlyTrends[monthKey] = { total: 0, rejected: 0, retry: 0, alternatives: 0 }
    }

    monthlyTrends[monthKey].total++
    if (order.status === "order_rejected") {
      monthlyTrends[monthKey].rejected++
    } else if (order.status === "retry_sent") {
      monthlyTrends[monthKey].retry++
    } else if (order.status === "alternatives_sent") {
      monthlyTrends[monthKey].alternatives++
    }
  })

  // Calculate monthly rates
  const monthlyData = Object.keys(monthlyTrends)
    .sort()
    .map((month) => ({
      month,
      totalOrders: monthlyTrends[month].total,
      rejectedOrders: monthlyTrends[month].rejected,
      retryOrders: monthlyTrends[month].retry,
      alternativeOrders: monthlyTrends[month].alternatives,
      rejectionRate:
        monthlyTrends[month].total > 0
          ? Math.round((monthlyTrends[month].rejected / monthlyTrends[month].total) * 10000) / 100
          : 0,
    }))

  // Calculate trend direction
  let trendDirection = "stable"
  if (monthlyData.length >= 3) {
    const recent = monthlyData.slice(-3)
    const firstMonth = recent[0].rejectionRate
    const lastMonth = recent[recent.length - 1].rejectionRate

    if (lastMonth > firstMonth + 5) {
      trendDirection = "increasing"
    } else if (lastMonth < firstMonth - 5) {
      trendDirection = "decreasing"
    }
  }

  return {
    monthly: monthlyData,
    trendDirection,
    averageRejectionRate:
      monthlyData.length > 0
        ? Math.round((monthlyData.reduce((sum, month) => sum + month.rejectionRate, 0) / monthlyData.length) * 100) /
          100
        : 0,
  }
}

/**
 * Analyze rejection impact
 * @param {Array} rejectedOrders - Rejected orders
 * @returns {Object} Impact analysis
 */
function analyzeRejectionImpact(rejectedOrders) {
  const totalValue = rejectedOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0)
  const averageValue = rejectedOrders.length > 0 ? totalValue / rejectedOrders.length : 0

  // Calculate potential delays
  const averageDelay =
    rejectedOrders.reduce((sum, order) => {
      if (order.createdAt && order.deliveryDate) {
        const promisedDays = (order.deliveryDate - order.createdAt) / (1000 * 60 * 60 * 24)
        return sum + promisedDays
      }
      return sum
    }, 0) / (rejectedOrders.length || 1)

  return {
    totalValue: Math.round(totalValue),
    averageValue: Math.round(averageValue),
    averageDelayInDays: Math.round(averageDelay),
    highValueRejections: rejectedOrders.filter((order) => (order.totalCost || 0) > 100000).length,
    urgentRejections: rejectedOrders.filter((order) => {
      if (order.createdAt && order.deliveryDate) {
        const daysUntilDelivery = (order.deliveryDate - order.createdAt) / (1000 * 60 * 60 * 24)
        return daysUntilDelivery <= 7 // Urgent if less than 7 days
      }
      return false
    }).length,
  }
}
