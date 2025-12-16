/**
 * Project Health Dashboard Component
 * Shows project health metrics, setup status, and recommendations
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Project Health Dashboard Component
 * @param {Object} props
 * @param {string} props.projectId - Project ID
 */
export function ProjectHealthDashboard({ projectId }) {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchHealthData();
    }
  }, [projectId]);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch prerequisites
      const prereqResponse = await fetch(`/api/projects/${projectId}/prerequisites`);
      const prereqData = await prereqResponse.json();
      
      // Fetch project finances
      const financeResponse = await fetch(`/api/project-finances?projectId=${projectId}`);
      const financeData = await financeResponse.json();
      
      // Fetch project details
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      const projectData = await projectResponse.json();
      
      if (prereqData.success && financeData.success && projectData.success) {
        const project = projectData.data;
        const finances = financeData.data;
        const prerequisites = prereqData.data;
        
        // Calculate health metrics
        const budget = project.budget || {};
        const totalInvested = finances.totalInvested || 0;
        const totalUsed = finances.totalUsed || 0;
        const availableCapital = finances.availableCapital || 0;
        const committedCost = finances.committedCost || 0;
        const estimatedCost = finances.estimatedCost || 0;
        
        // Budget utilization
        const budgetUtilization = budget.total > 0 
          ? (totalUsed / budget.total) * 100 
          : 0;
        
        // Capital utilization
        const capitalUtilization = totalInvested > 0
          ? ((totalUsed + committedCost) / totalInvested) * 100
          : 0;
        
        // Health score (0-100)
        const healthScore = calculateHealthScore({
          prerequisites,
          budgetUtilization,
          capitalUtilization,
          availableCapital,
          totalInvested,
        });
        
        // Health status
        const healthStatus = healthScore >= 80 
          ? 'excellent' 
          : healthScore >= 60 
            ? 'good' 
            : healthScore >= 40 
              ? 'fair' 
              : 'poor';
        
        // Recommendations
        const recommendations = generateRecommendations({
          prerequisites,
          budgetUtilization,
          capitalUtilization,
          availableCapital,
          totalInvested,
          healthStatus,
        });
        
        setHealthData({
          healthScore,
          healthStatus,
          metrics: {
            budgetUtilization,
            capitalUtilization,
            availableCapital,
            totalInvested,
            totalUsed,
            committedCost,
            estimatedCost,
          },
          prerequisites,
          recommendations,
        });
      } else {
        setError('Failed to load health data');
      }
    } catch (err) {
      console.error('Error fetching health data:', err);
      setError('Failed to load health data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600">Loading health data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  if (!healthData) {
    return null;
  }

  const { healthScore, healthStatus, metrics, recommendations } = healthData;

  const getHealthColor = (status) => {
    const colors = {
      excellent: 'bg-green-100 text-green-800 border-green-300',
      good: 'bg-blue-100 text-blue-800 border-blue-300',
      fair: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      poor: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] || colors.fair;
  };

  const getHealthIcon = (status) => {
    if (status === 'excellent') return '✅';
    if (status === 'good') return '👍';
    if (status === 'fair') return '⚠️';
    return '❌';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Project Health</h2>
        <button
          onClick={fetchHealthData}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          title="Refresh health data"
        >
          Refresh
        </button>
      </div>

      {/* Health Score */}
      <div className={`p-6 rounded-lg border-2 mb-6 ${getHealthColor(healthStatus)}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getHealthIcon(healthStatus)}</span>
            <div>
              <h3 className="text-xl font-bold capitalize">{healthStatus} Health</h3>
              <p className="text-sm opacity-90">Overall project health score</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{healthScore}</div>
            <div className="text-sm opacity-90">/ 100</div>
          </div>
        </div>
        
        {/* Health Score Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                healthStatus === 'excellent' ? 'bg-green-600' :
                healthStatus === 'good' ? 'bg-blue-600' :
                healthStatus === 'fair' ? 'bg-yellow-600' :
                'bg-red-600'
              }`}
              style={{ width: `${healthScore}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Budget Utilization</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.budgetUtilization.toFixed(1)}%</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                metrics.budgetUtilization > 90 ? 'bg-red-600' :
                metrics.budgetUtilization > 75 ? 'bg-yellow-600' :
                'bg-green-600'
              }`}
              style={{ width: `${Math.min(100, metrics.budgetUtilization)}%` }}
            ></div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Capital Utilization</p>
          <p className="text-2xl font-bold text-gray-900">{metrics.capitalUtilization.toFixed(1)}%</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                metrics.capitalUtilization > 90 ? 'bg-red-600' :
                metrics.capitalUtilization > 75 ? 'bg-yellow-600' :
                'bg-green-600'
              }`}
              style={{ width: `${Math.min(100, metrics.capitalUtilization)}%` }}
            ></div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Available Capital</p>
          <p className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('en-KE', {
              style: 'currency',
              currency: 'KES',
              minimumFractionDigits: 0,
            }).format(metrics.availableCapital)}
          </p>
          {metrics.availableCapital < 0 && (
            <p className="text-xs text-red-600 mt-1">⚠️ Negative balance</p>
          )}
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Committed Costs</p>
          <p className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('en-KE', {
              style: 'currency',
              currency: 'KES',
              minimumFractionDigits: 0,
            }).format(metrics.committedCost)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Pending purchase orders</p>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Recommendations</h3>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  rec.priority === 'high' 
                    ? 'bg-red-50 border-red-200' 
                    : rec.priority === 'medium'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg">{rec.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{rec.title}</h4>
                    <p className="text-sm text-gray-700 mb-2">{rec.message}</p>
                    {rec.actionUrl && (
                      <Link
                        href={rec.actionUrl}
                        className="inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {rec.actionLabel} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Calculate health score (0-100)
 */
function calculateHealthScore({ prerequisites, budgetUtilization, capitalUtilization, availableCapital, totalInvested }) {
  let score = 0;
  
  // Prerequisites (40 points)
  if (prerequisites) {
    const completion = prerequisites.readiness.completionPercentage || 0;
    score += (completion / 100) * 40;
  }
  
  // Budget utilization (20 points) - lower is better
  if (budgetUtilization <= 75) {
    score += 20;
  } else if (budgetUtilization <= 90) {
    score += 10;
  } else {
    score += 5;
  }
  
  // Capital utilization (20 points) - lower is better
  if (capitalUtilization <= 75) {
    score += 20;
  } else if (capitalUtilization <= 90) {
    score += 10;
  } else {
    score += 5;
  }
  
  // Capital availability (20 points)
  if (totalInvested === 0) {
    score += 0;
  } else if (availableCapital > 0 && availableCapital >= totalInvested * 0.1) {
    score += 20;
  } else if (availableCapital > 0) {
    score += 10;
  } else {
    score += 0;
  }
  
  return Math.round(score);
}

/**
 * Generate recommendations
 */
function generateRecommendations({ prerequisites, budgetUtilization, capitalUtilization, availableCapital, totalInvested, healthStatus }) {
  const recommendations = [];
  
  // Prerequisites recommendations
  if (prerequisites && !prerequisites.readiness.readyForMaterials) {
    const missing = Object.entries(prerequisites.prerequisites)
      .filter(([_, item]) => item.required && !item.completed);
    
    if (missing.length > 0) {
      missing.forEach(([key, item]) => {
        recommendations.push({
          priority: 'high',
          icon: '⚠️',
          title: `Complete ${key.charAt(0).toUpperCase() + key.slice(1)} Setup`,
          message: item.message,
          actionUrl: item.actionUrl,
          actionLabel: item.actionLabel,
        });
      });
    }
  }
  
  // Budget recommendations
  if (budgetUtilization > 90) {
    recommendations.push({
      priority: 'high',
      icon: '💰',
      title: 'Budget Overutilization',
      message: `Budget utilization is at ${budgetUtilization.toFixed(1)}%. Consider reviewing expenses or increasing budget.`,
      actionUrl: `/projects/${prerequisites?.projectId}/finances`,
      actionLabel: 'View Finances',
    });
  } else if (budgetUtilization > 75) {
    recommendations.push({
      priority: 'medium',
      icon: '💰',
      title: 'Budget Warning',
      message: `Budget utilization is at ${budgetUtilization.toFixed(1)}%. Monitor spending closely.`,
      actionUrl: `/projects/${prerequisites?.projectId}/finances`,
      actionLabel: 'View Finances',
    });
  }
  
  // Capital recommendations
  if (totalInvested === 0) {
    recommendations.push({
      priority: 'high',
      icon: '💵',
      title: 'No Capital Allocated',
      message: 'Project has no capital allocated. Allocate capital to enable material procurement.',
      actionUrl: '/financing',
      actionLabel: 'Allocate Capital',
    });
  } else if (availableCapital <= 0) {
    recommendations.push({
      priority: 'high',
      icon: '💵',
      title: 'Capital Depleted',
      message: 'Available capital is depleted or negative. Allocate more capital to continue operations.',
      actionUrl: '/financing',
      actionLabel: 'Allocate Capital',
    });
  } else if (availableCapital < totalInvested * 0.1) {
    recommendations.push({
      priority: 'medium',
      icon: '💵',
      title: 'Low Capital Warning',
      message: `Available capital is low (${(availableCapital / totalInvested * 100).toFixed(1)}% of total). Consider allocating more capital.`,
      actionUrl: '/financing',
      actionLabel: 'Allocate Capital',
    });
  }
  
  // Capital utilization recommendations
  if (capitalUtilization > 90) {
    recommendations.push({
      priority: 'high',
      icon: '📊',
      title: 'High Capital Utilization',
      message: `Capital utilization is at ${capitalUtilization.toFixed(1)}%. Consider allocating more capital or reviewing committed costs.`,
      actionUrl: `/projects/${prerequisites?.projectId}/finances`,
      actionLabel: 'View Finances',
    });
  }
  
  return recommendations;
}

