/**
 * Project Setup Checklist Component
 * Displays project setup prerequisites and completion status
 * Shows what's done, what's missing, and provides quick actions
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BaseModal } from '@/components/modals';
import { useToast } from '@/components/toast';

export function ProjectSetupChecklist({ projectId }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showFloorInitModal, setShowFloorInitModal] = useState(false);
  const [floorInitError, setFloorInitError] = useState('');
  const [initializingFloors, setInitializingFloors] = useState(false);
  const [floorInitForm, setFloorInitForm] = useState({
    floorCount: 10,
    includeBasements: false,
    basementCount: 0,
  });

  useEffect(() => {
    if (projectId) {
      fetchPrerequisites();
    }
  }, [projectId]);

  const fetchPrerequisites = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/projects/${projectId}/prerequisites`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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

  const openFloorInitModal = () => {
    setFloorInitError('');
    setFloorInitForm((prev) => ({
      floorCount: typeof prev.floorCount === 'number' ? prev.floorCount : 10,
      includeBasements: !!prev.includeBasements,
      basementCount: typeof prev.basementCount === 'number' ? prev.basementCount : 0,
    }));
    setShowFloorInitModal(true);
  };

  const handleFloorInitChange = (field, value) => {
    setFloorInitError('');
    setFloorInitForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitFloorInit = async () => {
    if (!projectId) {
      toast.showError('Invalid project ID');
      return;
    }

    const floorCount = parseInt(floorInitForm.floorCount, 10);
    const basementCount = parseInt(floorInitForm.basementCount, 10);
    const includeBasements = !!floorInitForm.includeBasements;

    if (isNaN(floorCount) || floorCount < 0 || floorCount > 50) {
      setFloorInitError('Floor count must be a number between 0 and 50.');
      return;
    }

    if (includeBasements && (isNaN(basementCount) || basementCount < 0 || basementCount > 10)) {
      setFloorInitError('Basement count must be a number between 0 and 10.');
      return;
    }

    if (floorCount === 0 && (!includeBasements || basementCount === 0)) {
      setFloorInitError('Please add at least one floor or basement.');
      return;
    }

    try {
      setInitializingFloors(true);
      const response = await fetch(`/api/projects/${projectId}/floors/initialize`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          floorCount: floorInitForm.floorCount,
          includeBasements: floorInitForm.includeBasements,
          basementCount: floorInitForm.basementCount,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to initialize floors');
      }

      toast.showSuccess(`Successfully initialized ${result.data.count} floors`);
      setShowFloorInitModal(false);
      fetchPrerequisites();
    } catch (err) {
      const message = err.message || 'Failed to initialize floors';
      setFloorInitError(message);
      toast.showError(message);
      console.error('Initialize floors error:', err);
    } finally {
      setInitializingFloors(false);
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
                item.actionKey === 'floors' || key === 'floors' ? (
                  <button
                    type="button"
                    onClick={openFloorInitModal}
                    className="ml-4 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition whitespace-nowrap"
                  >
                    {item.actionLabel || 'Create Floors'}
                  </button>
                ) : (
                  <Link
                    href={item.actionUrl}
                    className="ml-4 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition whitespace-nowrap"
                  >
                    {item.actionLabel}
                  </Link>
                )
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
              <button
                type="button"
                onClick={openFloorInitModal}
                className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Create Floors
              </button>
            )}
          </div>
        </div>
      )}

      {/* Auto-create Floors Modal */}
      <BaseModal
        isOpen={showFloorInitModal}
        onClose={() => !initializingFloors && setShowFloorInitModal(false)}
        maxWidth="max-w-2xl"
        variant="indigo"
        showCloseButton={true}
        isLoading={initializingFloors}
        loadingMessage="Creating floors..."
        preventCloseDuringLoading={true}
      >
        <div className="px-8 py-6 border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/90 text-white rounded-xl p-3 shadow-lg shadow-indigo-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Auto-create Floors</h3>
              <p className="text-sm text-gray-600">Generate a default floor stack for this project.</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {floorInitError && (
            <div className="bg-red-50/80 border border-red-200/70 text-red-700 px-4 py-3 rounded-xl">
              {floorInitError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Number of Floors
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={floorInitForm.floorCount}
                onChange={(e) => handleFloorInitChange('floorCount', e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-black"
              />
              <p className="text-xs text-gray-500 mt-2">Includes ground floor. Range: 0-50.</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/70 border border-indigo-200/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Include Basements</p>
                  <p className="text-xs text-gray-600">Optional underground floors</p>
                </div>
                <input
                  type="checkbox"
                  checked={floorInitForm.includeBasements}
                  onChange={(e) => handleFloorInitChange('includeBasements', e.target.checked)}
                  className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
              </div>
              {floorInitForm.includeBasements && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Basement Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={floorInitForm.basementCount}
                    onChange={(e) => handleFloorInitChange('basementCount', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/90 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-black"
                  />
                  <p className="text-xs text-gray-500 mt-2">Range: 0-10.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-200/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-gradient-to-br from-gray-50/60 to-transparent">
          <button
            type="button"
            onClick={() => setShowFloorInitModal(false)}
            disabled={initializingFloors}
            className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-gray-700 bg-white/70 backdrop-blur-sm border border-gray-300/50 rounded-xl hover:bg-white/90 hover:border-gray-400/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitFloorInit}
            disabled={initializingFloors}
            className="relative w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl hover:from-indigo-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40"
          >
            {initializingFloors ? 'Creating Floors...' : 'Create Floors'}
          </button>
        </div>
      </BaseModal>
    </div>
  );
}

