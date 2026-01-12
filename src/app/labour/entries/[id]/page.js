/**
 * Labour Entry Detail Page
 * Displays full labour entry details
 * 
 * Route: /labour/entries/[id]
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { ConfirmationModal } from '@/components/modals';
import { Edit, Trash2, CheckCircle, XCircle, ArrowLeft, Clock, DollarSign, User, Calendar, MapPin, Briefcase } from 'lucide-react';

function LabourEntryDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const entryId = params?.id;
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [project, setProject] = useState(null);
  const [phase, setPhase] = useState(null);
  const [workItem, setWorkItem] = useState(null);

  useEffect(() => {
    if (entryId) {
      fetchEntry();
    } else {
      setError('Invalid entry ID');
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    if (entry?.projectId) {
      fetchProject();
    }
    if (entry?.phaseId) {
      fetchPhase();
    }
    if (entry?.workItemId) {
      fetchWorkItem();
    } else {
      setWorkItem(null);
    }
  }, [entry?.projectId, entry?.phaseId, entry?.workItemId]);

  const fetchEntry = async () => {
    if (!entryId) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/labour/entries/${entryId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch labour entry');
      }

      setEntry(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch entry error:', err);
      toast.showError(err.message || 'Failed to load labour entry');
    } finally {
      setLoading(false);
    }
  };

  const fetchProject = async () => {
    if (!entry?.projectId) return;
    try {
      const response = await fetch(`/api/projects/${entry.projectId}`);
      const data = await response.json();
      if (data.success) {
        setProject(data.data);
      }
    } catch (err) {
      console.error('Error fetching project:', err);
    }
  };

  const fetchPhase = async () => {
    if (!entry?.phaseId) return;
    try {
      const response = await fetch(`/api/phases/${entry.phaseId}`);
      const data = await response.json();
      if (data.success) {
        setPhase(data.data);
      }
    } catch (err) {
      console.error('Error fetching phase:', err);
    }
  };

  const fetchWorkItem = async () => {
    if (!entry?.workItemId) return;
    try {
      const response = await fetch(`/api/work-items/${entry.workItemId}`);
      const data = await response.json();
      if (data.success) {
        setWorkItem(data.data);
      }
    } catch (err) {
      console.error('Error fetching work item:', err);
      setWorkItem(null);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/labour/entries/${entryId}/approve`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve entry');
      }

      toast.showSuccess('Labour entry approved successfully');
      fetchEntry();
    } catch (err) {
      console.error('Error approving entry:', err);
      toast.showError(err.message || 'Failed to approve entry');
    } finally {
      setIsApproving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/labour/entries/${entryId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete entry');
      }

      toast.showSuccess('Labour entry deleted successfully');
      router.push('/labour/entries');
    } catch (err) {
      console.error('Error deleting entry:', err);
      toast.showError(err.message || 'Failed to delete entry');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-600',
    };

    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${badges[status] || badges.draft}`}>
        {status?.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  const canEdit = canAccess('edit_labour_entry');
  const canDelete = canAccess('delete_labour_entry');
  const canApprove = canAccess('approve_labour_entry');

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading labour entry..." />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !entry) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 mb-4">{error || 'Labour entry not found'}</p>
            <Link
              href="/labour/entries"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Entries
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Use schema calculation logic for display
  const totalHours = entry.totalHours || 0;
  const calculatedOvertimeHours = Math.max(0, totalHours - 8);
  const finalOvertimeHours = (entry.overtimeHours || 0) > 0 
    ? entry.overtimeHours 
    : calculatedOvertimeHours;
  const finalRegularHours = totalHours - finalOvertimeHours;
  const regularCost = finalRegularHours * (entry.hourlyRate || 0);
  const overtimeCost = finalOvertimeHours * (entry.hourlyRate || 0) * 1.5;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/labour/entries"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Entries
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Labour Entry Details</h1>
              <p className="text-gray-600 mt-1">Entry Number: {entry.entryNumber || entry._id}</p>
              {entry.batchId && (
                <Link
                  href={`/labour/batches/${entry.batchId}`}
                  className="text-blue-600 hover:text-blue-800 text-sm mt-1 inline-flex items-center gap-1"
                >
                  Part of Batch: {entry.batchNumber || entry.batchId} →
                </Link>
              )}
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(entry.status)}
              {canApprove && entry.status === 'pending_approval' && (
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {isApproving ? 'Approving...' : 'Approve'}
                </button>
              )}
              {canEdit && entry.status === 'draft' && (
                <Link
                  href={`/labour/entries/${entryId}/edit`}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </Link>
              )}
              {canDelete && (entry.status === 'draft' || entry.status === 'rejected') && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Total Hours</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {entry.totalHours?.toFixed(1)} hrs
            </div>
            {finalOvertimeHours > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Regular: {finalRegularHours.toFixed(1)} hrs | Overtime: {finalOvertimeHours.toFixed(1)} hrs
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Total Cost</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {entry.totalCost?.toLocaleString()} KES
            </div>
            {finalOvertimeHours > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Regular: {regularCost.toLocaleString()} KES | Overtime: {overtimeCost.toLocaleString()} KES
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">Hourly Rate</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {entry.hourlyRate?.toLocaleString()} KES/hr
            </div>
          </div>
        </div>

        {/* Main Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Worker Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Worker Information</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500">Worker Name</label>
                {(entry.workerProfileId || entry.workerId) ? (
                  <div>
                    <Link
                      href={`/labour/workers/${entry.workerProfileId || entry.workerId}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {entry.workerName} →
                    </Link>
                    <Link
                      href={`/labour/entries?workerId=${entry.workerId || entry.workerProfileId}`}
                      className="text-blue-600 hover:text-blue-800 text-sm mt-1 block"
                    >
                      View all entries for this worker →
                    </Link>
                  </div>
                ) : (
                  <p className="text-gray-900 font-medium">{entry.workerName}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Worker Type</label>
                  <p className="text-gray-900 capitalize">{entry.workerType || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Worker Role</label>
                  <p className="text-gray-900 capitalize">{entry.workerRole || 'N/A'}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Skill Type</label>
                <p className="text-gray-900">{entry.skillType?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</p>
              </div>
            </div>
          </div>

          {/* Project Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Information</h2>
            <div className="space-y-3">
              {project && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Project</label>
                  <p className="text-gray-900 font-medium">{project.projectName}</p>
                </div>
              )}
              {phase && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Phase</label>
                  <p className="text-gray-900">{phase.phaseName}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Entry Date</label>
                <p className="text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(entry.entryDate).toLocaleDateString()}
                </p>
              </div>
              {entry.clockInTime && entry.clockOutTime && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Time Range</label>
                  <p className="text-gray-900">
                    {new Date(entry.clockInTime).toLocaleTimeString()} - {new Date(entry.clockOutTime).toLocaleTimeString()}
                  </p>
                </div>
              )}
              {entry.workItemId && workItem && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Work Item</label>
                  <div className="mt-1">
                    <Link
                      href={`/work-items/${workItem._id}`}
                      className="text-gray-900 font-medium hover:text-blue-600 flex items-center gap-1"
                    >
                      <Briefcase className="w-4 h-4" />
                      {workItem.name} →
                    </Link>
                    <div className="mt-1 text-sm text-gray-600">
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
        </div>

        {/* Additional Details */}
        {entry.taskDescription && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Task Description</h2>
            <p className="text-gray-700">{entry.taskDescription}</p>
          </div>
        )}

        {/* Professional Service Details */}
        {entry.workerType === 'professional' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Professional Service Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entry.serviceType && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Service Type</label>
                  <p className="text-gray-900 capitalize">{entry.serviceType}</p>
                </div>
              )}
              {entry.visitPurpose && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Visit Purpose</label>
                  <p className="text-gray-900">{entry.visitPurpose}</p>
                </div>
              )}
              {entry.deliverables && entry.deliverables.length > 0 && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Deliverables</label>
                  <ul className="list-disc list-inside text-gray-900 mt-1">
                    {entry.deliverables.map((deliverable, index) => (
                      <li key={index}>{deliverable}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cost Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cost Breakdown</h2>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600 text-gray-900">Regular Hours ({finalRegularHours.toFixed(1)} hrs)</span>
              <span className="font-medium text-gray-900 font-bold">{regularCost.toLocaleString()} KES</span>
            </div>
            {finalOvertimeHours > 0 && (
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600 text-gray-900">Overtime Hours ({finalOvertimeHours.toFixed(1)} hrs @ 1.5x)</span>
                <span className="font-medium text-gray-900 font-bold">{overtimeCost.toLocaleString()} KES</span>
              </div>
            )}
            <div className="flex justify-between py-2 font-bold text-lg">
              <span>Total Cost</span>
              <span className="text-gray-900 font-bold">{entry.totalCost?.toLocaleString()} KES</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Labour Entry"
        message={`Are you sure you want to delete the labour entry for ${entry?.workerName}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      />
    </AppLayout>
  );
}

export default function LabourEntryDetailPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        </div>
      </AppLayout>
    }>
      <LabourEntryDetailPageContent />
    </Suspense>
  );
}

