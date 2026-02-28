/**
 * Floor Phase Breakdown Tab Component
 * Displays comprehensive phase breakdown for a floor with materials, labour, equipment, etc.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/loading';
import { useToast } from '@/components/toast';

export function FloorPhaseBreakdownTab({ floor, project, formatCurrency, formatDate, canEdit = false }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [phaseData, setPhaseData] = useState(null);
  const [expandedPhases, setExpandedPhases] = useState(new Set());
  const [updatingProgress, setUpdatingProgress] = useState(new Set());
  const [phaseProgress, setPhaseProgress] = useState({});

  useEffect(() => {
    if (floor?._id) {
      fetchPhaseBreakdown();
      fetchPhaseProgress();
    }
  }, [floor?._id]);

  const fetchPhaseProgress = async () => {
    if (!floor?._id) return;
    
    try {
      const response = await fetch(`/api/floors/${floor._id}/phases/progress`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      
      if (data.success) {
        const progressMap = {};
        data.data.phases.forEach(phase => {
          progressMap[phase.phaseId] = phase;
        });
        setPhaseProgress(progressMap);
      }
    } catch (err) {
      console.error('Error fetching phase progress:', err);
    }
  };

  const updatePhaseProgress = async (phaseId, status, progress, notes) => {
    if (!floor?._id || !canEdit) return;
    
    setUpdatingProgress(prev => new Set(prev).add(phaseId));
    try {
      const response = await fetch(`/api/floors/${floor._id}/phases/progress`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          phaseId,
          status,
          progress,
          notes
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update phase progress');
      }
      
      // Update local state
      setPhaseProgress(prev => ({
        ...prev,
        [phaseId]: data.data.progress
      }));
      
      toast.showSuccess('Phase progress updated successfully');
      
      // Refresh phase breakdown to get updated data
      fetchPhaseBreakdown();
    } catch (err) {
      console.error('Error updating phase progress:', err);
      toast.showError(err.message || 'Failed to update phase progress');
    } finally {
      setUpdatingProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(phaseId);
        return newSet;
      });
    }
  };

  const fetchPhaseBreakdown = async () => {
    if (!floor?._id) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/floors/${floor._id}/phases`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load phase breakdown');
      }
      
      setPhaseData(data.data);
    } catch (err) {
      console.error('Error fetching phase breakdown:', err);
      setError(err.message || 'Failed to load phase breakdown');
      toast.showError(err.message || 'Failed to load phase breakdown');
    } finally {
      setLoading(false);
    }
  };

  const togglePhase = (phaseId) => {
    setExpandedPhases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phaseId)) {
        newSet.delete(phaseId);
      } else {
        newSet.add(phaseId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'NOT_STARTED': 'ds-bg-surface-muted ds-text-primary',
      'IN_PROGRESS': 'bg-blue-100 text-blue-800',
      'COMPLETED': 'bg-green-100 text-green-800',
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
  };

  const getProgressColor = (utilization) => {
    if (utilization >= 100) return 'bg-red-500';
    if (utilization >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
        <span className="ml-2 ds-text-secondary">Loading phase breakdown...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg">
        <p className="font-semibold">Error loading phase breakdown</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchPhaseBreakdown}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!phaseData || !phaseData.phases || phaseData.phases.length === 0) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6">
        <div className="text-center py-8">
          <p className="ds-text-secondary mb-4">No phase data available for this floor.</p>
          <p className="text-sm ds-text-muted">
            Phases will appear here once materials, labour, or equipment are assigned to this floor.
          </p>
        </div>
      </div>
    );
  }

  const { phases, summary } = phaseData;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="ds-bg-surface rounded-lg shadow p-4">
          <p className="text-xs ds-text-secondary">Total Phases</p>
          <p className="text-2xl font-bold ds-text-primary mt-1">{summary.totalPhases}</p>
          <p className="text-xs ds-text-muted mt-1">
            {summary.phasesWithBudget} with budget
          </p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-4">
          <p className="text-xs ds-text-secondary">In Progress</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{summary.phasesInProgress}</p>
          <p className="text-xs ds-text-muted mt-1">
            {summary.phasesCompleted} completed
          </p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-4">
          <p className="text-xs ds-text-secondary">Total Budget</p>
          <p className="text-2xl font-bold ds-text-primary mt-1">
            {formatCurrency(summary.totalBudget)}
          </p>
          <p className="text-xs ds-text-muted mt-1">
            {formatCurrency(summary.totalActual)} spent
          </p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-4">
          <p className="text-xs ds-text-secondary">Remaining</p>
          <p className={`text-2xl font-bold mt-1 ${
            summary.totalRemaining < 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {formatCurrency(summary.totalRemaining)}
          </p>
          <p className="text-xs ds-text-muted mt-1">
            {formatCurrency(summary.totalCommitted)} committed
          </p>
        </div>
      </div>

      {/* Phase Sections */}
      <div className="space-y-4">
        {phases.map((phase) => {
          const isExpanded = expandedPhases.has(phase.phaseId);
          const hasItems = phase.counts.materials > 0 || 
                          phase.counts.materialRequests > 0 || 
                          phase.counts.labour > 0 || 
                          phase.counts.equipment > 0 || 
                          phase.counts.workItems > 0;

          return (
            <div
              key={phase.phaseId}
              className="ds-bg-surface rounded-lg shadow border ds-border-subtle overflow-hidden"
            >
              {/* Phase Header */}
              <div
                className="p-4 cursor-pointer hover:ds-bg-surface-muted transition-colors"
                onClick={() => togglePhase(phase.phaseId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-2xl">
                      {phase.phaseCode === 'PHASE-01' ? '🏗️' :
                       phase.phaseCode === 'PHASE-02' ? '🏢' :
                       phase.phaseCode === 'PHASE-03' ? '🎨' :
                       phase.phaseCode === 'PHASE-04' ? '⚙️' : '📋'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold ds-text-primary">
                          {phase.phaseName}
                        </h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          phaseProgress[phase.phaseId]?.status || phase.status
                        )}`}>
                          {(phaseProgress[phase.phaseId]?.status || phase.status).replace('_', ' ')}
                        </span>
                        {(() => {
                          const progressData = phaseProgress[phase.phaseId] || {};
                          const currentProgress = progressData.progress !== undefined ? progressData.progress : phase.progress;
                          return currentProgress > 0 && (
                            <span className="text-xs ds-text-muted">
                              {currentProgress}% complete
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-sm ds-text-muted mt-1">{phase.phaseCode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Budget Summary */}
                    <div className="text-right">
                      <p className="text-sm font-semibold ds-text-primary">
                        {formatCurrency(phase.budget.total)}
                      </p>
                      <p className="text-xs ds-text-muted">Budget</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${
                        phase.actual.total > phase.budget.total ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {formatCurrency(phase.actual.total)}
                      </p>
                      <p className="text-xs ds-text-muted">Actual</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${
                        phase.remaining < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(phase.remaining)}
                      </p>
                      <p className="text-xs ds-text-muted">Remaining</p>
                    </div>
                    {/* Expand/Collapse Icon */}
                    <div className="ds-text-muted">
                      {isExpanded ? '▼' : '▶'}
                    </div>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="mt-3 space-y-2">
                  {/* Budget Utilization */}
                  {phase.budget.total > 0 && (
                    <div>
                      <div className="flex justify-between text-xs ds-text-secondary mb-1">
                        <span>Budget Utilization</span>
                        <span>{phase.utilization.toFixed(1)}%</span>
                      </div>
                      <div className="w-full ds-bg-surface-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getProgressColor(phase.utilization)}`}
                          style={{ width: `${Math.min(100, phase.utilization)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Completion Progress */}
                  {(() => {
                    const progressData = phaseProgress[phase.phaseId] || {};
                    const currentProgress = progressData.progress !== undefined ? progressData.progress : phase.progress;
                    if (currentProgress > 0) {
                      return (
                        <div>
                          <div className="flex justify-between text-xs ds-text-secondary mb-1">
                            <span>Completion Progress</span>
                            <span>{currentProgress}%</span>
                          </div>
                          <div className="w-full ds-bg-surface-muted rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all bg-blue-500"
                              style={{ width: `${Math.min(100, currentProgress)}%` }}
                            />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Quick Stats */}
                <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
                  <div className="text-center">
                    <p className="font-semibold ds-text-primary">{phase.counts.materials}</p>
                    <p className="ds-text-muted">Materials</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold ds-text-primary">{phase.counts.materialRequests}</p>
                    <p className="ds-text-muted">Requests</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold ds-text-primary">{phase.counts.labour}</p>
                    <p className="ds-text-muted">Labour</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold ds-text-primary">{phase.counts.equipment}</p>
                    <p className="ds-text-muted">Equipment</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold ds-text-primary">{phase.counts.workItems}</p>
                    <p className="ds-text-muted">Work Items</p>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t ds-border-subtle p-4 ds-bg-surface-muted">
                  {/* Budget Breakdown */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold ds-text-primary mb-2">Budget Breakdown</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                      <div>
                        <p className="ds-text-muted">Materials</p>
                        <p className="font-semibold ds-text-primary">{formatCurrency(phase.budget.materials)}</p>
                        <p className="text-blue-600">{formatCurrency(phase.actual.materials)}</p>
                      </div>
                      <div>
                        <p className="ds-text-muted">Labour</p>
                        <p className="font-semibold ds-text-primary">{formatCurrency(phase.budget.labour)}</p>
                        <p className="text-blue-600">{formatCurrency(phase.actual.labour)}</p>
                      </div>
                      <div>
                        <p className="ds-text-muted">Equipment</p>
                        <p className="font-semibold ds-text-primary">{formatCurrency(phase.budget.equipment)}</p>
                        <p className="text-blue-600">{formatCurrency(phase.actual.equipment)}</p>
                      </div>
                      <div>
                        <p className="ds-text-muted">Subcontractors</p>
                        <p className="font-semibold ds-text-primary">{formatCurrency(phase.budget.subcontractors)}</p>
                        <p className="text-blue-600">{formatCurrency(phase.actual.subcontractors)}</p>
                      </div>
                      <div>
                        <p className="ds-text-muted">Committed</p>
                        <p className="font-semibold text-yellow-600">{formatCurrency(phase.committed.total)}</p>
                        <p className="ds-text-muted text-xs">
                          {phase.committed.materialRequests} requests, {phase.committed.purchaseOrders} orders
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Items Lists */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Materials */}
                    {phase.items.materials.length > 0 && (
                      <div className="ds-bg-surface rounded-lg p-3 border ds-border-subtle">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-semibold ds-text-primary">Materials ({phase.counts.materials})</h5>
                          <Link
                            href={`/items?floorId=${floor._id}&phaseId=${phase.phaseId}`}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            View All →
                          </Link>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {phase.items.materials.slice(0, 5).map((item) => (
                            <div key={item._id} className="text-xs flex justify-between py-1 border-b ds-border-subtle">
                              <span className="ds-text-secondary truncate">{item.name}</span>
                              <span className="ds-text-primary font-medium ml-2">{formatCurrency(item.totalCost)}</span>
                            </div>
                          ))}
                          {phase.items.materials.length > 5 && (
                            <p className="text-xs ds-text-muted text-center pt-1">
                              +{phase.items.materials.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Material Requests */}
                    {phase.items.materialRequests.length > 0 && (
                      <div className="ds-bg-surface rounded-lg p-3 border ds-border-subtle">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-semibold ds-text-primary">Material Requests ({phase.counts.materialRequests})</h5>
                          <Link
                            href={`/material-requests?floorId=${floor._id}&phaseId=${phase.phaseId}`}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            View All →
                          </Link>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {phase.items.materialRequests.slice(0, 5).map((item) => (
                            <div key={item._id} className="text-xs flex justify-between py-1 border-b ds-border-subtle">
                              <span className="ds-text-secondary truncate">{item.materialName}</span>
                              <span className="ds-text-primary font-medium ml-2">{formatCurrency(item.estimatedCost)}</span>
                            </div>
                          ))}
                          {phase.items.materialRequests.length > 5 && (
                            <p className="text-xs ds-text-muted text-center pt-1">
                              +{phase.items.materialRequests.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Labour */}
                    {phase.items.labour.length > 0 && (
                      <div className="ds-bg-surface rounded-lg p-3 border ds-border-subtle">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-semibold ds-text-primary">Labour ({phase.counts.labour})</h5>
                          <Link
                            href={`/labour/entries?floorId=${floor._id}&phaseId=${phase.phaseId}`}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            View All →
                          </Link>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {phase.items.labour.slice(0, 5).map((item) => (
                            <div key={item._id} className="text-xs flex justify-between py-1 border-b ds-border-subtle">
                              <span className="ds-text-secondary truncate">
                                {item.workerName} ({item.skillType})
                              </span>
                              <span className="ds-text-primary font-medium ml-2">{formatCurrency(item.totalCost)}</span>
                            </div>
                          ))}
                          {phase.items.labour.length > 5 && (
                            <p className="text-xs ds-text-muted text-center pt-1">
                              +{phase.items.labour.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Equipment */}
                    {phase.items.equipment.length > 0 && (
                      <div className="ds-bg-surface rounded-lg p-3 border ds-border-subtle">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-semibold ds-text-primary">Equipment ({phase.counts.equipment})</h5>
                          <Link
                            href={`/equipment?projectId=${project?._id}&phaseId=${phase.phaseId}`}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            View All →
                          </Link>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {phase.items.equipment.slice(0, 5).map((item) => (
                            <div key={item._id} className="text-xs flex justify-between py-1 border-b ds-border-subtle">
                              <span className="ds-text-secondary truncate">{item.equipmentName}</span>
                              <span className="ds-text-primary font-medium ml-2">{formatCurrency(item.totalCost)}</span>
                            </div>
                          ))}
                          {phase.items.equipment.length > 5 && (
                            <p className="text-xs ds-text-muted text-center pt-1">
                              +{phase.items.equipment.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Work Items */}
                    {phase.items.workItems.length > 0 && (
                      <div className="ds-bg-surface rounded-lg p-3 border ds-border-subtle">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-semibold ds-text-primary">Work Items ({phase.counts.workItems})</h5>
                          <Link
                            href={`/work-items?floorId=${floor._id}&phaseId=${phase.phaseId}`}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            View All →
                          </Link>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {phase.items.workItems.slice(0, 5).map((item) => (
                            <div key={item._id} className="text-xs flex justify-between py-1 border-b ds-border-subtle">
                              <span className="ds-text-secondary truncate">{item.name}</span>
                              <span className="ds-text-primary font-medium ml-2">
                                {formatCurrency(item.actualCost || item.estimatedCost)}
                              </span>
                            </div>
                          ))}
                          {phase.items.workItems.length > 5 && (
                            <p className="text-xs ds-text-muted text-center pt-1">
                              +{phase.items.workItems.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Empty State */}
                  {!hasItems && (
                    <div className="text-center py-4 ds-text-muted text-sm">
                      No materials, labour, equipment, or work items assigned to this phase on this floor yet.
                    </div>
                  )}

                  {/* Phase Progress Tracking */}
                  {(() => {
                    const progressData = phaseProgress[phase.phaseId] || {};
                    const currentStatus = progressData.status || phase.status;
                    const currentProgress = progressData.progress !== undefined ? progressData.progress : phase.progress;
                    const isUpdating = updatingProgress.has(phase.phaseId);
                    
                    return (
                      <div className="mt-4 pt-4 border-t ds-border-subtle">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold ds-text-primary">Phase Progress Tracking</h4>
                          {progressData.completedDate && (
                            <span className="text-xs ds-text-muted">
                              Completed: {formatDate(progressData.completedDate)}
                            </span>
                          )}
                        </div>
                        
                        {/* Progress Display */}
                        <div className="mb-3">
                          <div className="flex justify-between text-xs ds-text-secondary mb-1">
                            <span>Completion Progress</span>
                            <span>{currentProgress}%</span>
                          </div>
                          <div className="w-full ds-bg-surface-muted rounded-full h-3">
                            <div
                              className="h-3 rounded-full transition-all bg-blue-500"
                              style={{ width: `${Math.min(100, currentProgress)}%` }}
                            />
                          </div>
                        </div>

                        {/* Progress Update Controls (if canEdit) */}
                        {canEdit && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                onClick={() => updatePhaseProgress(phase.phaseId, 'NOT_STARTED', 0, null)}
                                disabled={isUpdating || currentStatus === 'NOT_STARTED'}
                                className={`px-3 py-2 text-xs font-medium rounded-lg transition ${
                                  currentStatus === 'NOT_STARTED'
                                    ? 'bg-slate-600 text-white'
                                    : 'ds-bg-surface-muted ds-text-secondary hover:ds-bg-surface-muted'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                Not Started
                              </button>
                              <button
                                onClick={() => updatePhaseProgress(phase.phaseId, 'IN_PROGRESS', currentProgress || 25, null)}
                                disabled={isUpdating || currentStatus === 'IN_PROGRESS'}
                                className={`px-3 py-2 text-xs font-medium rounded-lg transition ${
                                  currentStatus === 'IN_PROGRESS'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                In Progress
                              </button>
                              <button
                                onClick={() => updatePhaseProgress(phase.phaseId, 'COMPLETED', 100, null)}
                                disabled={isUpdating || currentStatus === 'COMPLETED'}
                                className={`px-3 py-2 text-xs font-medium rounded-lg transition ${
                                  currentStatus === 'COMPLETED'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                Completed
                              </button>
                            </div>
                            
                            {isUpdating && (
                              <p className="text-xs ds-text-muted text-center">Updating progress...</p>
                            )}
                            
                            {progressData.startedDate && (
                              <p className="text-xs ds-text-muted">
                                Started: {formatDate(progressData.startedDate)}
                              </p>
                            )}
                            
                            {progressData.notes && (
                              <div className="ds-bg-surface rounded p-2 border ds-border-subtle">
                                <p className="text-xs font-medium ds-text-secondary mb-1">Notes:</p>
                                <p className="text-xs ds-text-secondary">{progressData.notes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Phase Actions */}
                  <div className="mt-4 pt-4 border-t ds-border-subtle flex gap-2">
                    <Link
                      href={`/phases/${phase.phaseId}`}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"
                    >
                      View Phase Details →
                    </Link>
                    <Link
                      href={`/phases/${phase.phaseId}/budget`}
                      className="px-3 py-1.5 ds-bg-surface-muted ds-text-secondary text-xs font-medium rounded-lg hover:ds-bg-surface-muted transition"
                    >
                      Manage Phase Budget →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
