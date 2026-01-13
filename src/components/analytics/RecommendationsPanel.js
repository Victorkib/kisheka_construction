/**
 * Recommendations Panel Component
 * Displays actionable recommendations for the project
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BudgetTransferForm } from '@/components/budget/BudgetTransferForm';
import { BudgetAdjustmentForm } from '@/components/budget/BudgetAdjustmentForm';

export function RecommendationsPanel({ projectId }) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchRecommendations();
    }
  }, [projectId]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/recommendations`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch recommendations');
      }

      setRecommendations(result.data);
    } catch (err) {
      console.error('Fetch recommendations error:', err);
      setError(err.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (recommendation) => {
    setSelectedRecommendation(recommendation);

    if (recommendation.actionType === 'budget_transfer') {
      setShowTransferForm(true);
    } else if (recommendation.actionType === 'budget_adjustment') {
      setShowAdjustmentForm(true);
    } else if (recommendation.actionType === 'contingency_draw') {
      router.push(`/projects/${projectId}/contingency`);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'border-red-300 bg-red-50';
      case 'medium':
        return 'border-yellow-300 bg-yellow-50';
      case 'low':
        return 'border-blue-300 bg-blue-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'warning':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'suggestion':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!recommendations || !recommendations.recommendations || recommendations.recommendations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
        <div className="text-center py-8 text-gray-500">
          <p>No recommendations at this time.</p>
          <p className="text-sm mt-2">Your project finances are in good shape!</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Recommendations
          </h3>
          <button
            onClick={fetchRecommendations}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Refresh
          </button>
        </div>

        {/* Summary */}
        {recommendations.summary && (
          <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total</p>
              <p className="text-sm font-semibold text-gray-900">
                {recommendations.summary.total}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Warnings</p>
              <p className="text-sm font-semibold text-red-600">
                {recommendations.summary.byType.warning}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Info</p>
              <p className="text-sm font-semibold text-blue-600">
                {recommendations.summary.byType.info}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Actionable</p>
              <p className="text-sm font-semibold text-green-600">
                {recommendations.summary.actionable}
              </p>
            </div>
          </div>
        )}

        {/* Recommendations List */}
        <div className="space-y-4">
          {recommendations.recommendations.map((rec, index) => (
            <div
              key={index}
              className={`border-2 rounded-lg p-4 ${getPriorityColor(rec.priority)}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getTypeIcon(rec.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-white">
                      {rec.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{rec.message}</p>
                  <p className="text-sm text-gray-600 mb-3">{rec.action}</p>
                  {rec.actionable && (
                    <button
                      onClick={() => handleAction(rec)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                    >
                      {rec.actionType === 'budget_transfer' && 'Request Transfer'}
                      {rec.actionType === 'budget_adjustment' && 'Request Adjustment'}
                      {rec.actionType === 'contingency_draw' && 'Request Draw'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transfer Form Modal */}
      {showTransferForm && selectedRecommendation && (
        <BudgetTransferForm
          projectId={projectId}
          onClose={() => {
            setShowTransferForm(false);
            setSelectedRecommendation(null);
            fetchRecommendations();
          }}
          onSuccess={() => {
            setShowTransferForm(false);
            setSelectedRecommendation(null);
            fetchRecommendations();
          }}
          initialData={selectedRecommendation.fromCategory && selectedRecommendation.toCategory ? {
            fromCategory: selectedRecommendation.fromCategory,
            toCategory: selectedRecommendation.toCategory,
            amount: selectedRecommendation.suggestedAmount || '',
          } : null}
        />
      )}

      {/* Adjustment Form Modal */}
      {showAdjustmentForm && selectedRecommendation && (
        <BudgetAdjustmentForm
          projectId={projectId}
          onClose={() => {
            setShowAdjustmentForm(false);
            setSelectedRecommendation(null);
            fetchRecommendations();
          }}
          onSuccess={() => {
            setShowAdjustmentForm(false);
            setSelectedRecommendation(null);
            fetchRecommendations();
          }}
          initialData={selectedRecommendation.category ? {
            category: selectedRecommendation.category,
            adjustmentType: 'increase',
            adjustmentAmount: selectedRecommendation.suggestedAmount || '',
          } : null}
        />
      )}
    </>
  );
}
