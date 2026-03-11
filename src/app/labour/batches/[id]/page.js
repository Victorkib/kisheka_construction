/**
 * Labour Batch Detail Page
 * Displays batch details, entries, phase summaries, and actions
 * 
 * Route: /labour/batches/[id]
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { ConfirmationModal } from '@/components/modals';
import { 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  ArrowLeft, 
  Clock, 
  DollarSign, 
  Users, 
  Calendar,
  Building2,
  FileText,
  TrendingUp
} from 'lucide-react';

function LabourBatchDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const batchId = params?.id;
  const { canAccess, user } = usePermissions();
  const toast = useToast();

  const [batch, setBatch] = useState(null);
  const [project, setProject] = useState(null);
  const [workItem, setWorkItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (batchId) {
      fetchBatch();
    } else {
      setError('Invalid batch ID');
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (batch?.projectId) {
      fetchProject(batch.projectId);
    }
    if (batch?.workItemId) {
      fetchWorkItem(batch.workItemId);
    } else {
      setWorkItem(null);
    }
  }, [batch?.projectId, batch?.workItemId]);

  const fetchBatch = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/labour/batches/${batchId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch batch');
      }

      setBatch(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch batch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProject = async (projectId) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProject(data.data);
      }
    } catch (err) {
      console.error('Error fetching project:', err);
    }
  };

  const fetchWorkItem = async (workItemId) => {
    try {
      const response = await fetch(`/api/work-items/${workItemId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setWorkItem(data.data);
      }
    } catch (err) {
      console.error('Error fetching work item:', err);
      setWorkItem(null);
    }
  };

  const handleDelete = async () => {
    try {
      setActionLoading(true);

      const response = await fetch(`/api/labour/batches/${batchId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete batch');
      }

      toast.showSuccess('Batch deleted successfully');
      router.push('/labour/batches');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
      setShowDeleteModal(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'KES 0';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      draft: 'ds-bg-surface-muted ds-text-primary',
      submitted: 'bg-blue-100 text-blue-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading batch..." />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !batch) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-400/60 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error || 'Batch not found'}
          </div>
          <Link href="/labour/batches" className="text-blue-600 hover:text-blue-800">
            ← Back to Labour Batches
          </Link>
        </div>
      </AppLayout>
    );
  }

  const canEdit = batch.status === 'draft' && canAccess('edit_labour_batch');
  const canDelete = batch.status === 'draft' && canAccess('delete_labour_batch');
  const entries = batch.entries || [];
  const summaryByPhase = batch.summaryByPhase || [];

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <LoadingOverlay
          isLoading={actionLoading}
          message="Updating labour batch..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/labour/batches" 
            className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Labour Batches
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold ds-text-primary">
                  {batch.batchNumber || 'Batch Details'}
                </h1>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeColor(
                    batch.status
                  )}`}
                >
                  {batch.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'}
                </span>
              </div>
              {batch.batchName && (
                <p className="ds-text-secondary text-lg">{batch.batchName}</p>
              )}
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <button
                  onClick={() => {
                    // TODO: Navigate to edit page when implemented
                    toast.showInfo('Edit functionality coming soon');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              )}
              {canDelete && (
                <LoadingButton
                  onClick={() => setShowDeleteModal(true)}
                  isLoading={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </LoadingButton>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium ds-text-secondary">Total Entries</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">{batch.totalEntries || entries.length}</div>
          </div>

          <div className="bg-green-50 border border-green-400/60 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium ds-text-secondary">Total Hours</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {(batch.totalHours || 0).toFixed(1)}
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-400/60 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium ds-text-secondary">Total Cost</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(batch.totalCost || 0)}
            </div>
          </div>

          <div className="ds-bg-surface-muted border ds-border-subtle rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 ds-text-secondary" />
              <span className="text-sm font-medium ds-text-secondary">Created</span>
            </div>
            <div className="text-sm font-semibold ds-text-secondary">
              {formatDate(batch.createdAt)}
            </div>
          </div>
        </div>

        {/* Batch Information */}
        <div className="ds-bg-surface rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold ds-text-primary mb-4">Batch Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm ds-text-secondary">Project</p>
              <p className="text-base font-medium ds-text-primary mt-1">
                {project ? `${project.projectCode} - ${project.projectName}` : 'Loading...'}
              </p>
            </div>
            <div>
              <p className="text-sm ds-text-secondary">Created By</p>
              <p className="text-base font-medium ds-text-primary mt-1">{batch.createdByName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm ds-text-secondary">Entry Type</p>
              <p className="text-base font-medium ds-text-primary mt-1">
                {batch.entryType?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm ds-text-secondary">Default Date</p>
              <p className="text-base font-medium ds-text-primary mt-1">
                {batch.defaultDate ? new Date(batch.defaultDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            {batch.approvedAt && (
              <div>
                <p className="text-sm ds-text-secondary">Approved At</p>
                <p className="text-base font-medium ds-text-primary mt-1">{formatDate(batch.approvedAt)}</p>
              </div>
            )}
            {batch.approvedByName && (
              <div>
                <p className="text-sm ds-text-secondary">Approved By</p>
                <p className="text-base font-medium ds-text-primary mt-1">{batch.approvedByName}</p>
              </div>
            )}
            {batch.approvalNotes && (
              <div className="md:col-span-2">
                <p className="text-sm ds-text-secondary">Approval Notes</p>
                <p className="text-base ds-text-primary mt-1">{batch.approvalNotes}</p>
              </div>
            )}
            {batch.workItemId && workItem && (
              <div className="md:col-span-2">
                <p className="text-sm ds-text-secondary">Work Item</p>
                <div className="mt-1">
                  <Link
                    href={`/work-items/${workItem._id}`}
                    className="text-base font-medium text-blue-600 hover:text-blue-800"
                  >
                    {workItem.name} →
                  </Link>
                  <div className="mt-1 text-sm ds-text-secondary">
                    <span className="capitalize">{workItem.category || 'Other'}</span>
                    {' • '}
                    <span className="capitalize">{workItem.status?.replace('_', ' ') || 'Not Started'}</span>
                    {workItem.estimatedHours > 0 && (
                      <>
                        {' • '}
                        <span>
                          {workItem.actualHours || 0}/{workItem.estimatedHours} hrs
                          {' '}
                          ({Math.min(100, Math.round(((workItem.actualHours || 0) / workItem.estimatedHours) * 100))}%)
                        </span>
                      </>
                    )}
                  </div>
                  <Link
                    href={`/labour/entries?workItemId=${workItem._id}`}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1 inline-block"
                  >
                    View all entries for this work item →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Phase Summaries */}
        {summaryByPhase.length > 0 && (
          <div className="ds-bg-surface rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold ds-text-primary mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Summary by Phase
            </h2>
            <div className="space-y-4">
              {summaryByPhase.map((phaseSummary) => (
                <div
                  key={phaseSummary.phaseId}
                  className="border ds-border-subtle rounded-lg p-4 hover:ds-bg-surface-muted"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold ds-text-primary">
                        {phaseSummary.phase?.phaseName || 'Unknown Phase'}
                      </h3>
                      <p className="text-sm ds-text-secondary">
                        {phaseSummary.phase?.phaseCode || ''}
                      </p>
                    </div>
                    <Link
                      href={`/phases/${phaseSummary.phaseId}`}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View Phase →
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <div>
                      <p className="text-xs ds-text-muted">Entries</p>
                      <p className="text-lg font-semibold ds-text-primary">{phaseSummary.entryCount}</p>
                    </div>
                    <div>
                      <p className="text-xs ds-text-muted">Hours</p>
                      <p className="text-lg font-semibold ds-text-primary">
                        {phaseSummary.totalHours.toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs ds-text-muted">Cost</p>
                      <p className="text-lg font-semibold ds-text-primary">
                        {formatCurrency(phaseSummary.totalCost)}
                      </p>
                    </div>
                  </div>
                  {phaseSummary.phase?.budgetAllocation?.labour && (
                    <div className="mt-3 pt-3 border-t ds-border-subtle">
                      <div className="flex justify-between items-center text-sm">
                        <span className="ds-text-secondary">Budget Allocation:</span>
                        <span className="font-medium ds-text-primary">
                          {formatCurrency(phaseSummary.phase.budgetAllocation.labour)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm mt-1">
                        <span className="ds-text-secondary">Current Spending:</span>
                        <span className="font-medium ds-text-primary">
                          {formatCurrency(phaseSummary.phase.actualSpending?.labour || 0)}
                        </span>
                      </div>
                      {phaseSummary.phase.budgetAllocation.labour > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs ds-text-secondary mb-1">
                            <span>Utilization</span>
                            <span>
                              {(
                                ((phaseSummary.phase.actualSpending?.labour || 0) /
                                  phaseSummary.phase.budgetAllocation.labour) *
                                100
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                          <div className="w-full ds-bg-surface-muted rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((phaseSummary.phase.actualSpending?.labour || 0) /
                                    phaseSummary.phase.budgetAllocation.labour) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entries Table */}
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold ds-text-primary flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Labour Entries ({entries.length})
            </h2>
            <Link
              href={`/labour/entries?batchId=${batchId}`}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View All Entries →
            </Link>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-8 ds-text-muted">
              <p>No entries found in this batch.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-ds-border-subtle">
                <thead className="ds-bg-surface-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Worker
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Skill
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                  {entries.map((entry) => (
                    <tr key={entry._id} className="hover:ds-bg-surface-muted">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(entry.workerProfileId || entry.workerId) ? (
                          <Link
                            href={`/labour/workers/${entry.workerProfileId || entry.workerId}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {entry.workerName} →
                          </Link>
                        ) : (
                          <div className="text-sm font-medium ds-text-primary">{entry.workerName}</div>
                        )}
                        <div className="text-xs ds-text-muted">{entry.workerRole}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm ds-text-primary">
                          {entry.skillType?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm ds-text-primary">
                        {new Date(entry.entryDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm ds-text-primary">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 ds-text-muted" />
                          {entry.totalHours?.toFixed(1) || 0} hrs
                        </div>
                        {entry.overtimeHours > 0 && (
                          <div className="text-xs text-orange-600">
                            +{entry.overtimeHours.toFixed(1)} OT
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm ds-text-primary">
                        {formatCurrency(entry.hourlyRate || 0)}/hr
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold ds-text-primary">
                          {formatCurrency(entry.totalCost || 0)}
                        </div>
                        <div className="text-xs ds-text-muted">
                          {formatCurrency(entry.regularCost || 0)} reg
                          {entry.overtimeCost > 0 && ` + ${formatCurrency(entry.overtimeCost)} OT`}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                            entry.status
                          )}`}
                        >
                          {entry.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <Link
                          href={`/labour/entries/${entry._id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="ds-bg-surface-muted">
                  <tr>
                    <td colSpan="3" className="px-4 py-3 text-sm font-semibold ds-text-primary">
                      Totals
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold ds-text-primary">
                      {(batch.totalHours || 0).toFixed(1)} hrs
                    </td>
                    <td colSpan="2" className="px-4 py-3 text-sm font-semibold ds-text-primary">
                      {formatCurrency(batch.totalCost || 0)}
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Batch"
          message="Are you sure you want to delete this batch? This action cannot be undone and will reverse all budget impacts."
          confirmText="Delete"
          cancelText="Cancel"
          confirmButtonClassName="bg-red-600 hover:bg-red-700"
          loading={actionLoading}
        />
      </div>
    </AppLayout>
  );
}

export default function LabourBatchDetailPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <LoadingSpinner size="lg" text="Loading..." />
            </div>
          </div>
        </AppLayout>
      }
    >
      <LabourBatchDetailPageContent />
    </Suspense>
  );
}
