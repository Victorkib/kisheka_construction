/**
 * Trend Analysis Helpers
 * Functions for analyzing spending trends and patterns
 */

import { getCategorySpendingHistory } from './forecasting-helpers';

/**
 * Calculate moving average
 * @param {Array} data - Array of values
 * @param {number} window - Window size (default: 7 for weekly)
 * @returns {Array} Moving averages
 */
export function calculateMovingAverage(data, window = 7) {
  if (!data || data.length === 0) return [];
  
  const result = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const sum = slice.reduce((sum, val) => sum + (val || 0), 0);
    const avg = slice.length > 0 ? sum / slice.length : 0;
    result.push(avg);
  }
  return result;
}

/**
 * Detect spending trend (increasing, decreasing, stable)
 * @param {Array} spendingHistory - Array of { date: Date, amount: number }
 * @returns {Object} Trend analysis
 */
export function detectSpendingTrend(spendingHistory) {
  if (!spendingHistory || spendingHistory.length < 2) {
    return {
      trend: 'insufficient_data',
      direction: 'stable',
      strength: 0,
      changeRate: 0,
    };
  }

  // Sort by date
  const sorted = [...spendingHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Group by week
  const weeklyTotals = {};
  sorted.forEach(entry => {
    const date = new Date(entry.date);
    const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
    if (!weeklyTotals[weekKey]) {
      weeklyTotals[weekKey] = 0;
    }
    weeklyTotals[weekKey] += entry.amount || 0;
  });

  const weeks = Object.keys(weeklyTotals).sort();
  const values = weeks.map(week => weeklyTotals[week]);

  if (values.length < 2) {
    return {
      trend: 'insufficient_data',
      direction: 'stable',
      strength: 0,
      changeRate: 0,
    };
  }

  // Calculate linear regression
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Determine direction
  let direction = 'stable';
  if (slope > 0.1) {
    direction = 'increasing';
  } else if (slope < -0.1) {
    direction = 'decreasing';
  }

  // Calculate strength (R-squared approximation)
  const yMean = sumY / n;
  const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
  const ssResidual = values.reduce((sum, y, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(y - predicted, 2);
  }, 0);
  const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
  const strength = Math.min(100, Math.max(0, rSquared * 100));

  // Calculate change rate (percentage change from first to last)
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const changeRate = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

  return {
    trend: direction,
    direction,
    strength: Math.round(strength),
    changeRate: Math.round(changeRate * 100) / 100,
    slope: Math.round(slope * 100) / 100,
    intercept: Math.round(intercept * 100) / 100,
    dataPoints: n,
  };
}

/**
 * Get week number from date
 * @param {Date} date - Date object
 * @returns {number} Week number
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Analyze spending patterns
 * @param {Array} spendingHistory - Array of spending entries
 * @returns {Object} Pattern analysis
 */
export function analyzeSpendingPatterns(spendingHistory) {
  if (!spendingHistory || spendingHistory.length === 0) {
    return {
      averageDaily: 0,
      peakDay: null,
      peakAmount: 0,
      quietDays: [],
      busyDays: [],
      consistency: 'unknown',
    };
  }

  // Group by day
  const dailyTotals = {};
  spendingHistory.forEach(entry => {
    const date = new Date(entry.date);
    const dayKey = date.toISOString().split('T')[0];
    if (!dailyTotals[dayKey]) {
      dailyTotals[dayKey] = 0;
    }
    dailyTotals[dayKey] += entry.amount || 0;
  });

  const days = Object.keys(dailyTotals);
  const amounts = days.map(day => dailyTotals[day]);
  const totalAmount = amounts.reduce((sum, amt) => sum + amt, 0);
  const averageDaily = days.length > 0 ? totalAmount / days.length : 0;

  // Find peak day
  let peakDay = null;
  let peakAmount = 0;
  days.forEach(day => {
    if (dailyTotals[day] > peakAmount) {
      peakAmount = dailyTotals[day];
      peakDay = day;
    }
  });

  // Calculate standard deviation for consistency
  const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - averageDaily, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = averageDaily > 0 ? (stdDev / averageDaily) * 100 : 0;

  let consistency = 'unknown';
  if (coefficientOfVariation < 20) {
    consistency = 'very_consistent';
  } else if (coefficientOfVariation < 40) {
    consistency = 'consistent';
  } else if (coefficientOfVariation < 60) {
    consistency = 'variable';
  } else {
    consistency = 'highly_variable';
  }

  // Identify quiet and busy days (days below/above average)
  const quietDays = days.filter(day => dailyTotals[day] < averageDaily * 0.5);
  const busyDays = days.filter(day => dailyTotals[day] > averageDaily * 1.5);

  return {
    averageDaily: Math.round(averageDaily * 100) / 100,
    peakDay,
    peakAmount: Math.round(peakAmount * 100) / 100,
    quietDays: quietDays.length,
    busyDays: busyDays.length,
    consistency,
    coefficientOfVariation: Math.round(coefficientOfVariation * 100) / 100,
    totalDays: days.length,
  };
}

/**
 * Analyze category trends
 * @param {string} projectId - Project ID
 * @param {string} category - Cost category
 * @returns {Promise<Object>} Trend analysis
 */
export async function analyzeCategoryTrends(projectId, category) {
  const history = await getCategorySpendingHistory(projectId, category, 90);
  
  const trend = detectSpendingTrend(history);
  const patterns = analyzeSpendingPatterns(history);

  // Calculate moving averages
  const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const dailyAmounts = sorted.map(entry => entry.amount || 0);
  const movingAvg7 = calculateMovingAverage(dailyAmounts, 7);
  const movingAvg30 = calculateMovingAverage(dailyAmounts, 30);

  return {
    category,
    trend,
    patterns,
    movingAverages: {
      weekly: movingAvg7,
      monthly: movingAvg30,
    },
    dataPoints: history.length,
    dateRange: {
      start: history.length > 0 ? history[0].date : null,
      end: history.length > 0 ? history[history.length - 1].date : null,
    },
  };
}

/**
 * Compare trends across categories
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Comparative trend analysis
 */
export async function compareCategoryTrends(projectId) {
  const categories = ['dcc', 'preconstruction', 'indirect', 'contingency'];
  const analyses = {};

  for (const category of categories) {
    analyses[category] = await analyzeCategoryTrends(projectId, category);
  }

  // Find fastest growing category
  const growthRates = Object.entries(analyses).map(([cat, analysis]) => ({
    category: cat,
    changeRate: analysis.trend.changeRate,
    direction: analysis.trend.direction,
  }));

  const fastestGrowing = growthRates
    .filter(g => g.direction === 'increasing')
    .sort((a, b) => b.changeRate - a.changeRate)[0];

  const fastestDeclining = growthRates
    .filter(g => g.direction === 'decreasing')
    .sort((a, b) => a.changeRate - b.changeRate)[0];

  return {
    analyses,
    insights: {
      fastestGrowing,
      fastestDeclining,
      overallTrend: growthRates.reduce((sum, g) => sum + g.changeRate, 0) / growthRates.length,
    },
  };
}
