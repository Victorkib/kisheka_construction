/**
 * Floor Dashboard Page
 * Comprehensive cross-floor management view with summary cards, alerts, and bulk operations
 *
 * Route: /floors/dashboard
 */

'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { BaseModal, ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';

function FloorDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { currentProjectId, accessibleProjects, switchProject } = useProjectContext();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [capitalIntelligence, setCapitalIntelligence] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(
    searchParams.get('projectId') || currentProjectId || ''
  );
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);

  // Capital rebalancing states
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [rebalanceData, setRebalanceData] = useState({
    fromFloorId: '',
    toFloorId: '',
    amount: '',
    reason: ''
  });
  const [processingRebalance, setProcessingRebalance] = useState(false);

  // Bulk operation states
  const [selectedFloors, setSelectedFloors] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkOperation, setBulkOperation] = useState(null); // 'status', 'progress', 'capital'
  const [bulkUpdates, setBulkUpdates] = useState({
    status: '',
    completionPercentage: 50,
    milestoneNotes: '',
    capitalAllocation: 0
  });
  const [processingBulk, setProcessingBulk] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (currentProjectId && currentProjectId !== selectedProjectId) {
      setSelectedProjectId(currentProjectId);
    }
  }, [currentProjectId, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchDashboard();
    }
  }, [selectedProjectId]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        setCanEdit(['owner', 'pm', 'project_manager', 'accountant'].includes(role));
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [dashboardRes, intelligenceRes] = await Promise.all([
        fetch(`/api/floors/dashboard?projectId=${selectedProjectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/floors/capital-intelligence?projectId=${selectedProjectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        })
      ]);

      const dashboardData = await dashboardRes.json();
      const intelligenceData = await intelligenceRes.json();

      if (!dashboardData.success) {
        throw new Error(dashboardData.error || 'Failed to fetch dashboard data');
      }

      if (!intelligenceData.success) {
        throw new Error(intelligenceData.error || 'Failed to fetch capital intelligence');
      }

      setDashboardData(dashboardData.data);
      setCapitalIntelligence(intelligenceData.data);
    } catch (err) {
      toast.showError(err.message || 'Failed to load dashboard');
      console.error('Fetch dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = (e) => {
    const projectId = e.target.value;
    setSelectedProjectId(projectId);
    if (projectId) {
      router.push(`/floors/dashboard?projectId=${projectId}`);
      if (projectId !== currentProjectId) {
        switchProject(projectId).catch((err) => {
          console.error('Error switching project:', err);
        });
      }
    } else {
      router.push('/floors/dashboard');
    }
  };

  const toggleFloorSelection = (floorId) => {
    setSelectedFloors(prev =>
      prev.includes(floorId)
        ? prev.filter(id => id !== floorId)
        : [...prev, floorId]
    );
  };

  const selectAllFloors = () => {
    if (dashboardData?.floors) {
      setSelectedFloors(dashboardData.floors.map(f => f._id));
    }
  };

  const deselectAllFloors = () => {
    setSelectedFloors([]);
  };

  const openBulkModal = (operation) => {
    if (selectedFloors.length === 0) {
      toast.showError('Please select at least one floor');
      return;
    }
    setBulkOperation(operation);
    setShowBulkModal(true);
  };

  const handleBulkUpdate = async () => {
    if (!bulkOperation || selectedFloors.length === 0) return;

    setProcessingBulk(true);
    try {
      const updates = {};

      if (bulkOperation === 'status' && bulkUpdates.status) {
        updates.status = bulkUpdates.status;
      } else if (bulkOperation === 'progress') {
        updates.completionPercentage = bulkUpdates.completionPercentage;
        if (bulkUpdates.milestoneNotes) {
          updates.milestoneNotes = bulkUpdates.milestoneNotes;
        }
      } else if (bulkOperation === 'capital' && bulkUpdates.capitalAllocation > 0) {
        updates.capitalAllocation = {
          total: bulkUpdates.capitalAllocation,
          strategy: 'proportional'
        };
      }

      if (Object.keys(updates).length === 0) {
        toast.showError('Please provide valid update values');
        setProcessingBulk(false);
        return;
      }

      const response = await fetch('/api/floors/bulk/update', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          floorIds: selectedFloors,
          projectId: selectedProjectId,
          updates
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to perform bulk update');
      }

      toast.showSuccess(`Successfully updated ${data.data.updatedFloors} floor(s)`);
      setShowBulkModal(false);
      setSelectedFloors([]);
      fetchDashboard();
    } catch (err) {
      toast.showError(err.message || 'Bulk update failed');
      console.error('Bulk update error:', err);
    } finally {
      setProcessingBulk(false);
    }
  };

  const openRebalanceModal = (fromFloorId = '', toFloorId = '') => {
    setRebalanceData({
      fromFloorId,
      toFloorId,
      amount: '',
      reason: ''
    });
    setShowRebalanceModal(true);
  };

  const handleRebalance = async () => {
    if (!rebalanceData.fromFloorId || !rebalanceData.toFloorId || !rebalanceData.amount) {
      toast.showError('Please fill in all required fields');
      return;
    }

    if (rebalanceData.fromFloorId === rebalanceData.toFloorId) {
      toast.showError('Source and destination floors must be different');
      return;
    }

    setProcessingRebalance(true);
    try {
      const response = await fetch('/api/floors/rebalance', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          fromFloorId: rebalanceData.fromFloorId,
          toFloorId: rebalanceData.toFloorId,
          amount: parseFloat(rebalanceData.amount),
          projectId: selectedProjectId,
          reason: rebalanceData.reason,
          priority: 'normal'
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to process capital rebalancing');
      }

      toast.showSuccess(data.data.message);
      setShowRebalanceModal(false);
      fetchDashboard();
    } catch (err) {
      toast.showError(err.message || 'Capital rebalancing failed');
      console.error('Rebalance error:', err);
    } finally {
      setProcessingRebalance(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getFloorDisplayName = (floorNumber, name) => {
    if (name) return name;
    if (floorNumber < 0) return `Basement ${Math.abs(floorNumber)}`;
    if (floorNumber === 0) return 'Ground Floor';
    return `Floor ${floorNumber}`;
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      NOT_STARTED: 'ds-bg-surface-muted ds-text-primary',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      ON_HOLD: 'bg-yellow-100 text-yellow-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
  };

  const getAlertIcon = (severity) => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <LoadingSpinner size="lg" />
            <p className="mt-4 ds-text-secondary">Loading dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!selectedProjectId) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-400/60 rounded-lg p-6 text-center">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">No Project Selected</h2>
            <p className="text-yellow-600 mb-4">Please select a project to view the floor dashboard</p>
            <Link
              href="/projects"
              className="inline-block px-4 py-2 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700"
            >
              Go to Projects
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const summary = dashboardData?.summary || {};
  const alerts = dashboardData?.alerts || [];
  const floors = dashboardData?.floors || [];
  const progressViz = dashboardData?.progressVisualization || [];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs
            items={[
              { label: 'Projects', href: '/projects' },
              { label: 'Floors', href: `/floors?projectId=${selectedProjectId}` },
              { label: 'Dashboard', href: null, current: true },
            ]}
          />
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold ds-text-primary">Floor Dashboard</h1>
            <p className="ds-text-secondary mt-1">Cross-floor management and analytics</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedProjectId}
              onChange={handleProjectChange}
              className="px-4 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Project</option>
              {accessibleProjects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectName}
                </option>
              ))}
            </select>
            <Link
              href={`/floors/new?projectId=${selectedProjectId}`}
              className="px-4 py-2 ds-bg-accent-primary text-white font-medium rounded-lg hover:ds-bg-accent-hover"
            >
              + New Floor
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="ds-bg-surface rounded-lg shadow p-4">
            <p className="text-xs ds-text-secondary">Total Floors</p>
            <p className="text-2xl font-bold ds-text-primary">{summary.totalFloors || 0}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-4">
            <p className="text-xs ds-text-secondary">Not Started</p>
            <p className="text-2xl font-bold ds-text-muted">{summary.floorsNotStarted || 0}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-4">
            <p className="text-xs ds-text-secondary">In Progress</p>
            <p className="text-2xl font-bold ds-text-accent-primary">{summary.floorsInProgress || 0}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-4">
            <p className="text-xs ds-text-secondary">Completed</p>
            <p className="text-2xl font-bold text-green-600">{summary.floorsCompleted || 0}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-4">
            <p className="text-xs ds-text-secondary">Avg Progress</p>
            <p className="text-2xl font-bold ds-text-primary">{summary.avgProgress || 0}%</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-4">
            <p className="text-xs ds-text-secondary">Over Budget</p>
            <p className="text-2xl font-bold text-red-600">{summary.floorsOverBudget || 0}</p>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="ds-bg-surface rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-xs ds-text-secondary">Total Budget</p>
            <p className="text-xl font-bold ds-text-primary">{formatCurrency(summary.totalBudget || 0)}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-4 border-l-4 border-purple-500">
            <p className="text-xs ds-text-secondary">Total Capital</p>
            <p className="text-xl font-bold text-purple-700">{formatCurrency(summary.totalCapital || 0)}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-xs ds-text-secondary">Actual Cost</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(summary.totalActualCost || 0)}</p>
          </div>
        </div>

        {/* Capital Intelligence Section */}
        {capitalIntelligence && (
          <>
            {/* Capital Heat Map */}
            <div className="ds-bg-surface rounded-lg shadow p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold ds-text-primary">🔥 Capital Distribution Heat Map</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs ds-text-secondary">Coverage:</span>
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">≥80% Good</span>
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">50-79% Fair</span>
                  <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">&lt;50% Critical</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium ds-text-secondary uppercase">Floor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium ds-text-secondary uppercase">Capital</th>
                      <th className="px-4 py-3 text-left text-xs font-medium ds-text-secondary uppercase">Budget</th>
                      <th className="px-4 py-3 text-left text-xs font-medium ds-text-secondary uppercase">Coverage</th>
                      <th className="px-4 py-3 text-left text-xs font-medium ds-text-secondary uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium ds-text-secondary uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ds-border-subtle">
                    {capitalIntelligence.heatMap.map((floor) => (
                      <tr key={floor._id} className="hover:ds-bg-surface-muted">
                        <td className="px-4 py-3">
                          <Link
                            href={`/floors/${floor._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            {floor.name}
                          </Link>
                          {floor.alerts.length > 0 && (
                            <div className="text-xs text-red-600 mt-0.5">
                              ⚠️ {floor.alerts.length} alert{floor.alerts.length > 1 ? 's' : ''}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-purple-700">{formatCurrency(floor.capital.total)}</p>
                            <p className="text-xs ds-text-muted">Rem: {formatCurrency(floor.capital.remaining)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium ds-text-primary">{formatCurrency(floor.budget.total)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-24 ds-bg-surface-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  floor.coverage >= 80
                                    ? 'ds-bg-success'
                                    : floor.coverage >= 50
                                    ? 'ds-bg-warning'
                                    : 'ds-bg-danger'
                                }`}
                                style={{ width: `${Math.min(floor.coverage, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium ds-text-secondary">{floor.coverage}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            floor.coverageStatus === 'full' ? 'bg-green-100 text-green-800' :
                            floor.coverageStatus === 'good' ? 'bg-blue-100 text-blue-800' :
                            floor.coverageStatus === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                            floor.coverageStatus === 'low' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {floor.coverageStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openRebalanceModal('', floor._id)}
                              className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                              title="Add Capital"
                            >
                              + Add
                            </button>
                            {floor.coverage > 100 && (
                              <button
                                onClick={() => openRebalanceModal(floor._id, '')}
                                className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                                title="Reduce Excess"
                              >
                                Reduce
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Smart Capital Suggestions */}
            {capitalIntelligence.suggestions.length > 0 && (
              <div className="ds-bg-accent-subtle border-2 ds-border-accent-subtle rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold ds-text-primary">💡 Smart Capital Suggestions</h3>
                  <p className="text-xs ds-text-secondary">
                    Available: <span className="font-semibold text-purple-700">{formatCurrency(capitalIntelligence.availableProjectCapital)}</span>
                  </p>
                </div>
                <div className="space-y-3">
                  {capitalIntelligence.suggestions.slice(0, 5).map((suggestion, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        suggestion.priority === 'critical'
                          ? 'bg-red-50 border-red-400/60'
                          : suggestion.priority === 'high'
                          ? 'bg-yellow-50 border-yellow-400/60'
                          : 'bg-blue-50 border-blue-400/60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold ds-text-primary">{suggestion.floorName}</p>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                              suggestion.priority === 'critical' ? 'bg-red-200 text-red-800' :
                              suggestion.priority === 'high' ? 'bg-yellow-200 text-yellow-800' :
                              'bg-blue-200 text-blue-800'
                            }`}>
                              {suggestion.priority}
                            </span>
                          </div>
                          <p className="text-xs ds-text-secondary mb-2">{suggestion.reason}</p>
                          <div className="flex items-center gap-4 text-xs">
                            <span>Current: {formatCurrency(suggestion.currentCapital)}</span>
                            <span>→</span>
                            <span className="font-semibold">Suggested: {formatCurrency(suggestion.suggestedCapital)}</span>
                            {suggestion.allocateAmount && (
                              <span className="text-green-700">(+{formatCurrency(suggestion.allocateAmount)})</span>
                            )}
                            {suggestion.reduceAmount && (
                              <span className="text-orange-700">(-{formatCurrency(suggestion.reduceAmount)})</span>
                            )}
                          </div>
                          {suggestion.impact && (
                            <div className="mt-2 text-xs ds-text-muted">
                              Impact: {suggestion.impact.newCoverage}% coverage
                              {suggestion.impact.daysOfRunway && `• ${suggestion.impact.daysOfRunway} days runway`}
                              {suggestion.impact.freedCapital && ` • Frees ${formatCurrency(suggestion.impact.freedCapital)}`}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (suggestion.allocateAmount) {
                              openRebalanceModal('', suggestion.floorId);
                              setRebalanceData(prev => ({ ...prev, amount: suggestion.allocateAmount.toString() }));
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-medium ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="ds-bg-surface rounded-lg shadow p-4 mb-6">
            <h3 className="text-lg font-semibold ds-text-primary mb-3">⚠️ Floor Alerts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    alert.severity === 'critical'
                      ? 'bg-red-50 border-red-400/60'
                      : alert.severity === 'warning'
                      ? 'bg-yellow-50 border-yellow-400/60'
                      : 'bg-blue-50 border-blue-400/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold ds-text-primary">{alert.floorName}</p>
                      <p className="text-xs ds-text-secondary mt-1">{alert.message}</p>
                    </div>
                    <span className="text-lg">{getAlertIcon(alert.severity)}</span>
                  </div>
                  <Link
                    href={`/floors/${alert.floorId}`}
                    className="text-xs font-medium ds-text-accent-primary hover:ds-text-accent-hover mt-2 inline-block"
                  >
                    View Floor →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bulk Actions Toolbar */}
        {canEdit && floors.length > 0 && (
          <div className="ds-bg-surface rounded-lg shadow p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={selectAllFloors}
                  className="text-sm ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllFloors}
                  className="text-sm ds-text-muted hover:ds-text-secondary font-medium"
                >
                  Deselect All
                </button>
                <span className="text-sm ds-text-secondary">
                  {selectedFloors.length} of {floors.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => openBulkModal('status')}
                  disabled={selectedFloors.length === 0}
                  className="px-3 py-1.5 text-sm font-medium ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update Status
                </button>
                <button
                  onClick={() => openBulkModal('progress')}
                  disabled={selectedFloors.length === 0}
                  className="px-3 py-1.5 text-sm font-medium ds-bg-surface-muted ds-text-primary border ds-border-subtle rounded-lg hover:ds-bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update Progress
                </button>
                <button
                  onClick={() => openBulkModal('capital')}
                  disabled={selectedFloors.length === 0}
                  className="px-3 py-1.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Allocate Capital
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floor Status Table */}
        <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ds-border-subtle">
              <thead className="ds-bg-surface-muted">
                <tr>
                  {canEdit && (
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedFloors.length === floors.length && floors.length > 0}
                        onChange={(e) => e.target.checked ? selectAllFloors() : deselectAllFloors()}
                        className="rounded ds-border-subtle"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-sm font-semibold ds-text-secondary">Floor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold ds-text-secondary">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold ds-text-secondary">Progress</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold ds-text-secondary">Budget</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold ds-text-secondary">Capital</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold ds-text-secondary">Coverage</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold ds-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border-subtle">
                {floors.map((floor) => (
                  <tr key={floor._id} className="hover:ds-bg-surface-muted">
                    {canEdit && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedFloors.includes(floor._id)}
                          onChange={() => toggleFloorSelection(floor._id)}
                          className="rounded ds-border-subtle"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link
                        href={`/floors/${floor._id}`}
                        className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                      >
                        {getFloorDisplayName(floor.floorNumber, floor.name)}
                      </Link>
                      {floor.alert && (
                        <div className="text-xs text-red-600 mt-0.5">
                          {getAlertIcon(floor.alert.severity)} {floor.alert.type.replace('_', ' ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(floor.status)}`}>
                        {floor.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 ds-bg-surface-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              floor.progress >= 100
                                ? 'ds-bg-success'
                                : floor.progress >= 50
                                ? 'ds-bg-accent-primary'
                                : floor.progress > 0
                                ? 'ds-bg-warning'
                                : 'ds-bg-surface-muted'
                            }`}
                            style={{ width: `${floor.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium ds-text-secondary">{floor.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium ds-text-primary">{formatCurrency(floor.budget.total)}</p>
                        <p className="text-xs ds-text-muted">{floor.budget.utilization}% used</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-purple-700">{formatCurrency(floor.capital.total)}</p>
                        <p className="text-xs ds-text-muted">Rem: {formatCurrency(floor.capital.remaining)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 ds-bg-surface-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              floor.capital.coverage >= 100
                                ? 'ds-bg-success'
                                : floor.capital.coverage >= 80
                                ? 'ds-bg-warning'
                                : 'ds-bg-danger'
                            }`}
                            style={{ width: `${Math.min(floor.capital.coverage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium ds-text-secondary">{floor.capital.coverage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/floors/${floor._id}`}
                        className="text-sm ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Progress Visualization */}
        <div className="mt-6 ds-bg-surface rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold ds-text-primary mb-4">Progress Visualization</h3>
          <div className="space-y-3">
            {progressViz.map((floor) => (
              <div key={floor.floorId} className="flex items-center gap-3">
                <div className="w-32 text-sm font-medium ds-text-primary truncate">
                  {getFloorDisplayName(floor.floorNumber, floor.name)}
                </div>
                <div className="flex-1 ds-bg-surface-muted rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      floor.progress >= 100
                        ? 'ds-bg-success'
                        : floor.progress >= 50
                        ? 'ds-bg-accent-primary'
                        : floor.progress > 0
                        ? 'ds-bg-warning'
                        : 'ds-bg-surface-muted'
                    }`}
                    style={{ width: `${floor.progress}%` }}
                  />
                </div>
                <div className="w-20 text-xs ds-text-secondary text-right">{floor.progress}%</div>
                {floor.alert && (
                  <span className="text-lg">{getAlertIcon(floor.alert.severity)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Update Modal */}
      <BaseModal
        isOpen={showBulkModal}
        onClose={() => !processingBulk && setShowBulkModal(false)}
        title={`Bulk ${bulkOperation === 'status' ? 'Status' : bulkOperation === 'progress' ? 'Progress' : 'Capital'} Update`}
        maxWidth="max-w-lg"
        isLoading={processingBulk}
        loadingMessage="Processing..."
      >
        <div className="p-4 space-y-4">
          <p className="text-sm ds-text-secondary">
            Updating {selectedFloors.length} floor(s)
          </p>

          {bulkOperation === 'status' && (
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-2">New Status</label>
              <select
                value={bulkUpdates.status}
                onChange={(e) => setBulkUpdates(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Status</option>
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          )}

          {bulkOperation === 'progress' && (
            <>
              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-2">
                  Completion Percentage: {bulkUpdates.completionPercentage}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bulkUpdates.completionPercentage}
                  onChange={(e) => setBulkUpdates(prev => ({ ...prev, completionPercentage: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-2">Milestone Notes (Optional)</label>
                <textarea
                  value={bulkUpdates.milestoneNotes}
                  onChange={(e) => setBulkUpdates(prev => ({ ...prev, milestoneNotes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add notes about this progress update..."
                />
              </div>
            </>
          )}

          {bulkOperation === 'capital' && (
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-2">
                Capital Amount per Floor (KES)
              </label>
              <input
                type="number"
                min="0"
                value={bulkUpdates.capitalAllocation}
                onChange={(e) => setBulkUpdates(prev => ({ ...prev, capitalAllocation: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter capital amount"
              />
              <p className="text-xs ds-text-muted mt-2">
                Total: {formatCurrency(bulkUpdates.capitalAllocation * selectedFloors.length)} for {selectedFloors.length} floors
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t ds-border-subtle flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowBulkModal(false)}
            disabled={processingBulk}
            className="px-4 py-2 text-sm font-medium ds-text-secondary ds-bg-surface rounded-lg hover:ds-bg-surface-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleBulkUpdate}
            disabled={processingBulk || (bulkOperation === 'status' && !bulkUpdates.status)}
            className="px-4 py-2 text-sm font-medium text-white ds-bg-accent-primary rounded-lg hover:ds-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingBulk ? 'Processing...' : 'Apply Changes'}
          </button>
        </div>
      </BaseModal>

      {/* Capital Rebalancing Modal */}
      <BaseModal
        isOpen={showRebalanceModal}
        onClose={() => !processingRebalance && setShowRebalanceModal(false)}
        title="🔄 Capital Rebalancing"
        maxWidth="max-w-lg"
        isLoading={processingRebalance}
        loadingMessage="Processing rebalancing..."
      >
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium ds-text-secondary mb-2">
              From Floor (Source)
            </label>
            <select
              value={rebalanceData.fromFloorId}
              onChange={(e) => setRebalanceData(prev => ({ ...prev, fromFloorId: e.target.value }))}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select source floor</option>
              {capitalIntelligence?.heatMap
                .filter(f => f.capital.total > 0 && f.capital.remaining > 0)
                .map(floor => (
                  <option key={floor._id} value={floor._id}>
                    {floor.name} - {formatCurrency(floor.capital.remaining)} available
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium ds-text-secondary mb-2">
              To Floor (Destination)
            </label>
            <select
              value={rebalanceData.toFloorId}
              onChange={(e) => setRebalanceData(prev => ({ ...prev, toFloorId: e.target.value }))}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select destination floor</option>
              {capitalIntelligence?.heatMap
                .filter(f => f._id !== rebalanceData.fromFloorId)
                .map(floor => (
                  <option key={floor._id} value={floor._id}>
                    {floor.name} - {formatCurrency(floor.capital.total)} current
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium ds-text-secondary mb-2">
              Transfer Amount (KES) *
            </label>
            <input
              type="number"
              min="0"
              value={rebalanceData.amount}
              onChange={(e) => setRebalanceData(prev => ({ ...prev, amount: e.target.value }))}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter amount to transfer"
            />
            {rebalanceData.fromFloorId && (
              <p className="text-xs ds-text-muted mt-1">
                Max: {formatCurrency(capitalIntelligence?.heatMap.find(f => f._id === rebalanceData.fromFloorId)?.capital.remaining || 0)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium ds-text-secondary mb-2">
              Reason (Optional)
            </label>
            <textarea
              value={rebalanceData.reason}
              onChange={(e) => setRebalanceData(prev => ({ ...prev, reason: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Explain why this capital transfer is needed..."
            />
          </div>

          {rebalanceData.fromFloorId && rebalanceData.toFloorId && rebalanceData.amount && (
            <div className="p-3 bg-blue-50 border ds-border-accent-subtle rounded-lg">
              <p className="text-sm font-medium ds-text-primary mb-2">Transfer Preview:</p>
              <div className="text-xs ds-text-secondary space-y-1">
                <p>• Source will have: {formatCurrency(
                  (capitalIntelligence?.heatMap.find(f => f._id === rebalanceData.fromFloorId)?.capital.remaining || 0) - parseFloat(rebalanceData.amount || 0)
                )} remaining</p>
                <p>• Destination will have: {formatCurrency(
                  (capitalIntelligence?.heatMap.find(f => f._id === rebalanceData.toFloorId)?.capital.remaining || 0) + parseFloat(rebalanceData.amount || 0)
                )} remaining</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t ds-border-subtle flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowRebalanceModal(false)}
            disabled={processingRebalance}
            className="px-4 py-2 text-sm font-medium ds-text-secondary ds-bg-surface rounded-lg hover:ds-bg-surface-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRebalance}
            disabled={processingRebalance || !rebalanceData.fromFloorId || !rebalanceData.toFloorId || !rebalanceData.amount}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingRebalance ? 'Processing...' : 'Transfer Capital'}
          </button>
        </div>
      </BaseModal>
    </AppLayout>
  );
}

export default function FloorDashboardPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <LoadingSpinner size="lg" />
              <p className="mt-4 ds-text-secondary">Loading dashboard...</p>
            </div>
          </div>
        </AppLayout>
      }
    >
      <FloorDashboardContent />
    </Suspense>
  );
}
