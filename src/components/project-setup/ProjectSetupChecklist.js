/**
 * Project Setup Checklist Component
 * Displays project setup prerequisites and completion status
 * Shows what's done, what's missing, and provides quick actions
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function ProjectSetupChecklist({ projectId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchPrerequisites();
    }
  }, [projectId]);

  const fetchPrerequisites = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/projects/${projectId}/prerequisites`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load prerequisites');
      }
    } catch (err) {
      console.error('Error fetching prerequisites:', err);
      setError('Failed to load project setup status');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600">Loading setup status...</p>
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

  if (!data) {
    return null;
  }

  const { prerequisites, readiness, summary } = data;

  const getStatusIcon = (status, completed) => {
    if (completed) {
      return (
        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (status === 'low' || status === 'depleted') {
      return (
        <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  };

  const getStatusColor = (status, completed) => {
    if (completed) return 'bg-green-50 border-green-200';
    if (status === 'low' || status === 'depleted') return 'bg-yellow-50 border-yellow-200';
    return 'bg-gray-50 border-gray-200';
  };

  const getStatusTextColor = (status, completed) => {
    if (completed) return 'text-green-800';
    if (status === 'low' || status === 'depleted') return 'text-yellow-800';
    return 'text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Project Setup Checklist</h2>
          <p className="text-sm text-gray-600 mt-1">
            {readiness.completionPercentage}% complete • {summary.completedItems} of {summary.totalItems} items
          </p>
        </div>
        <button
          onClick={fetchPrerequisites}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          title="Refresh status"
        >
          Refresh
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Setup Progress</span>
          <span className="text-sm font-semibold text-gray-900">{readiness.completionPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${readiness.completionPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Readiness Status */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-4 rounded-lg border-2 ${
          readiness.readyForMaterials 
            ? 'bg-green-50 border-green-300' 
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {readiness.readyForMaterials ? (
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span className={`font-semibold ${
              readiness.readyForMaterials ? 'text-green-900' : 'text-yellow-900'
            }`}>
              Ready for Material Requests
            </span>
          </div>
          <p className="text-sm text-gray-700">
            {readiness.readyForMaterials 
              ? 'All required items are set up. You can create material requests.'
              : 'Complete required items to enable material requests.'}
          </p>
        </div>

        <div className={`p-4 rounded-lg border-2 ${
          readiness.readyForPurchaseOrders 
            ? 'bg-green-50 border-green-300' 
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {readiness.readyForPurchaseOrders ? (
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span className={`font-semibold ${
              readiness.readyForPurchaseOrders ? 'text-green-900' : 'text-yellow-900'
            }`}>
              Ready for Purchase Orders
            </span>
          </div>
          <p className="text-sm text-gray-700">
            {readiness.readyForPurchaseOrders 
              ? 'All items are set up. You can create purchase orders.'
              : 'Complete all items including suppliers to enable purchase orders.'}
          </p>
        </div>
      </div>

      {/* Prerequisites List */}
      <div className="space-y-3">
        {Object.entries(prerequisites).map(([key, item]) => (
          <div
            key={key}
            className={`p-4 rounded-lg border ${getStatusColor(item.status, item.completed)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-0.5">
                  {getStatusIcon(item.status, item.completed)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold ${getStatusTextColor(item.status, item.completed)}`}>
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </h3>
                    {item.required && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded-full font-medium">
                        Required
                      </span>
                    )}
                    {!item.required && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className={`text-sm ${getStatusTextColor(item.status, item.completed)} mb-2`}>
                    {item.message}
                  </p>
                  {item.warning && (
                    <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
                      ⚠️ {item.warning}
                    </div>
                  )}
                  {item.details && Object.keys(item.details).length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      {key === 'budget' && (
                        <div className="grid grid-cols-2 gap-2">
                          <span>Total: {item.details.total.toLocaleString()} KES</span>
                          <span>Materials: {item.details.materials.toLocaleString()} KES</span>
                        </div>
                      )}
                      {key === 'capital' && (
                        <div className="space-y-1">
                          <span>Invested: {item.details.totalInvested.toLocaleString()} KES</span>
                          <span>Available: {item.details.availableCapital.toLocaleString()} KES</span>
                          {item.details.capitalStatus === 'low' && (
                            <span className="text-yellow-700 font-medium">⚠️ Low capital</span>
                          )}
                          {item.details.capitalStatus === 'depleted' && (
                            <span className="text-red-700 font-medium">⚠️ Capital depleted</span>
                          )}
                        </div>
                      )}
                      {(key === 'floors' || key === 'suppliers' || key === 'categories') && (
                        <span>{item.details.count} {key} available</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {!item.completed && (
                <Link
                  href={item.actionUrl}
                  className="ml-4 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition whitespace-nowrap"
                >
                  {item.actionLabel}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      {!readiness.readyForMaterials && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-semibold text-blue-900 mb-2">Quick Actions</p>
          <div className="flex flex-wrap gap-2">
            {!prerequisites.budget.completed && (
              <Link
                href={prerequisites.budget.actionUrl}
                className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Set Budget
              </Link>
            )}
            {!prerequisites.capital.completed && (
              <Link
                href={prerequisites.capital.actionUrl}
                className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Allocate Capital
              </Link>
            )}
            {!prerequisites.floors.completed && (
              <Link
                href={prerequisites.floors.actionUrl}
                className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Create Floors
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

