/**
 * Professional Activity Detail Page
 * Displays full professional activity details with documents and approval actions
 * 
 * Route: /professional-activities/[id]
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingCard, LoadingButton } from '@/components/loading';
import { AuditTrail } from '@/components/audit-trail';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { ImagePreview } from '@/components/uploads/image-preview';

function ProfessionalActivityDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const activityId = params?.id;
  const { canAccess, user } = usePermissions();
  const toast = useToast();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (activityId) {
      fetchActivity();
    } else {
      setError('Invalid activity ID');
      setLoading(false);
    }
  }, [activityId]);

  const fetchActivity = async () => {
    if (!activityId) {
      setError('Invalid activity ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/professional-activities/${activityId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch professional activity');
      }

      setActivity(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch activity error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = () => {
    setApprovalNotes('');
    setShowApproveModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/professional-activities/${activityId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes: approvalNotes || 'Approved via UI' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve activity');
      }

      await fetchActivity();
      setApprovalNotes('');
      setShowApproveModal(false);
      toast.showSuccess('Professional activity approved successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to approve activity');
      console.error('Approve activity error:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectClick = () => {
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectionReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }

    setIsRejecting(true);
    try {
      const response = await fetch(`/api/professional-activities/${activityId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject activity');
      }

      await fetchActivity();
      setShowRejectModal(false);
      setRejectionReason('');
      toast.showSuccess('Professional activity rejected successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to reject activity');
      console.error('Reject activity error:', err);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/professional-activities/${activityId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete activity');
      }

      toast.showSuccess('Professional activity deleted successfully!');
      setShowDeleteModal(false);
      router.push('/professional-activities');
    } catch (err) {
      toast.showError(err.message || 'Failed to delete activity');
      console.error('Delete activity error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (amount, currency = 'KES') => {
    if (!amount && amount !== 0) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingCard count={2} showHeader={true} lines={6} />
        </div>
      </AppLayout>
    );
  }

  if (error || !activity) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Professional activity not found'}
          </div>
          <Link
            href="/professional-activities"
            className="mt-4 inline-block text-blue-600 hover:text-blue-800"
          >
            ← Back to Professional Activities
          </Link>
        </div>
      </AppLayout>
    );
  }

  const canApprove = canAccess('approve_professional_activity') && activity.status === 'pending_approval';
  const canReject = canAccess('approve_professional_activity') && activity.status === 'pending_approval';
  const canEdit = canAccess('edit_professional_activity') && (activity.status !== 'approved' || user?.role?.toLowerCase() === 'owner');
  const canDelete = canAccess('delete_professional_activity') && user?.role?.toLowerCase() === 'owner';

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/professional-activities"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Professional Activities
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                  {activity.activityCode || 'Professional Activity'}
                </h1>
                <span
                  className={`px-4 py-2 text-sm font-semibold rounded-full ${getStatusBadgeColor(
                    activity.status
                  )}`}
                >
                  {activity.status?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                </span>
              </div>
              <p className="text-gray-600 mt-2">
                {activity.activityType?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'} • {formatDate(activity.activityDate)}
              </p>
            </div>
            <div className="flex gap-2">
              {canApprove && (
                <button
                  onClick={handleApproveClick}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                >
                  Approve
                </button>
              )}
              {canReject && (
                <button
                  onClick={handleRejectClick}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                >
                  Reject
                </button>
              )}
              {canEdit && (
                <Link
                  href={`/professional-activities/${activityId}/edit`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  Edit
                </Link>
              )}
              {canDelete && (
                <button
                  onClick={handleDeleteClick}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Activity Information</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Activity Type</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    {activity.activityType?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Activity Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(activity.activityDate)}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Professional Service</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {activity.professionalService ? (
                      <Link
                        href={`/professional-services/${activity.professionalService._id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {activity.professionalService.professionalCode || 'N/A'}
                      </Link>
                    ) : (
                      'N/A'
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Project</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {activity.project ? (
                      <Link
                        href={`/projects/${activity.project._id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {activity.project.projectCode} - {activity.project.projectName}
                      </Link>
                    ) : (
                      'N/A'
                    )}
                  </dd>
                </div>

                {activity.phase && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Phase</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {activity.phase.phaseName || activity.phase.phaseCode || 'N/A'}
                    </dd>
                  </div>
                )}

                {activity.visitPurpose && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Visit Purpose</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {activity.visitPurpose?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                    </dd>
                  </div>
                )}

                {activity.visitDuration && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Visit Duration</dt>
                    <dd className="mt-1 text-sm text-gray-900">{activity.visitDuration} hours</dd>
                  </div>
                )}

                {activity.inspectionType && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Inspection Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {activity.inspectionType?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                    </dd>
                  </div>
                )}

                {activity.complianceStatus && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Compliance Status</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {activity.complianceStatus?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                    </dd>
                  </div>
                )}

                {activity.feesCharged !== undefined && activity.feesCharged !== null && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Fees Charged</dt>
                    <dd className="mt-1 text-lg font-semibold text-gray-900">
                      {formatCurrency(activity.feesCharged)}
                    </dd>
                  </div>
                )}

                {activity.expensesIncurred !== undefined && activity.expensesIncurred !== null && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Expenses Incurred</dt>
                    <dd className="mt-1 text-lg font-semibold text-gray-900">
                      {formatCurrency(activity.expensesIncurred)}
                    </dd>
                  </div>
                )}

                {activity.notes && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Notes</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{activity.notes}</dd>
                  </div>
                )}

                {activity.observations && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Observations</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{activity.observations}</dd>
                  </div>
                )}

                {activity.recommendations && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Recommendations</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{activity.recommendations}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Attendees */}
            {activity.attendees && activity.attendees.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Attendees</h2>
                <ul className="list-disc list-inside space-y-1">
                  {activity.attendees.map((attendee, index) => (
                    <li key={index} className="text-sm text-gray-900">{attendee}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues Found */}
            {activity.issuesFound && activity.issuesFound.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Issues Found</h2>
                <div className="space-y-3">
                  {activity.issuesFound.map((issue, index) => (
                    <div key={index} className="border-l-4 border-red-500 pl-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{issue.description}</p>
                          {issue.location && (
                            <p className="text-sm text-gray-600 mt-1">Location: {issue.location}</p>
                          )}
                          {issue.resolutionNotes && (
                            <p className="text-sm text-gray-700 mt-2">{issue.resolutionNotes}</p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            issue.severity === 'critical'
                              ? 'bg-red-100 text-red-800'
                              : issue.severity === 'major'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {issue.severity?.toUpperCase() || 'N/A'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Material Tests */}
            {activity.materialTests && activity.materialTests.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Material Tests</h2>
                <div className="space-y-3">
                  {activity.materialTests.map((test, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{test.materialName}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Type: {test.testType?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                          </p>
                          {test.testReportUrl && (
                            <a
                              href={test.testReportUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm mt-1 inline-block"
                            >
                              View Report →
                            </a>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            test.testResult === 'pass'
                              ? 'bg-green-100 text-green-800'
                              : test.testResult === 'fail'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {test.testResult?.toUpperCase() || 'N/A'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            {activity.documents && activity.documents.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Documents</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activity.documents.map((doc, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <p className="font-medium text-gray-900">{doc.documentName || 'Untitled Document'}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {doc.documentType?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                      </p>
                      {doc.description && (
                        <p className="text-sm text-gray-700 mt-2">{doc.description}</p>
                      )}
                      {doc.documentUrl && (
                        <div className="mt-3">
                          <ImagePreview
                            url={doc.documentUrl}
                            title={doc.documentName || 'Document'}
                            showDelete={false}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approval Information */}
            {activity.approvedBy && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Approval Information</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Approved By</dt>
                    <dd className="mt-1 text-sm text-gray-900">{activity.approvedByName || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Approval Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDateTime(activity.approvedAt)}</dd>
                  </div>
                  {activity.approvalNotes && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Approval Notes</dt>
                      <dd className="mt-1 text-sm text-gray-900">{activity.approvalNotes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Linked Fee */}
            {activity.fee && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Linked Fee</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{activity.fee.feeCode || 'N/A'}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatCurrency(activity.fee.amount)} • {activity.fee.status}
                    </p>
                  </div>
                  <Link
                    href={`/professional-fees/${activity.fee._id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View Fee →
                  </Link>
                </div>
              </div>
            )}

            {/* Activity Log */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
              <AuditTrail entityType="PROFESSIONAL_ACTIVITY" entityId={activityId} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Approval Actions */}
            {activity.status === 'pending_approval' && (canApprove || canReject) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Actions</h3>
                <div className="space-y-4">
                  {canApprove && (
                    <div>
                      <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                        Approval Notes (Optional)
                      </label>
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        rows={3}
                        placeholder="Add notes for approval..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}
                  {canReject && (
                    <div>
                      <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                        Rejection Reason *
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                        placeholder="Explain why this activity is being rejected..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    {canApprove && (
                      <LoadingButton
                        onClick={handleApproveClick}
                        isLoading={isApproving}
                        loadingText="Processing..."
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        Approve
                      </LoadingButton>
                    )}
                    {canReject && (
                      <LoadingButton
                        onClick={handleRejectClick}
                        isLoading={isRejecting}
                        loadingText="Processing..."
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        Reject
                      </LoadingButton>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Info</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Created By</dt>
                  <dd className="mt-1 text-sm text-gray-900">{activity.createdByName || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Created At</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDateTime(activity.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDateTime(activity.updatedAt)}</dd>
                </div>
                {activity.followUpRequired && (
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Follow-up Required</dt>
                    <dd className="mt-1 text-sm text-gray-900">Yes</dd>
                  </div>
                )}
                {activity.followUpDate && (
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Follow-up Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(activity.followUpDate)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Confirmation Modal */}
      <ConfirmationModal
        isOpen={showApproveModal}
        onClose={() => !isApproving && setShowApproveModal(false)}
        onConfirm={handleApproveConfirm}
        title="Approve Professional Activity"
        message="Are you sure you want to approve this professional activity?"
        confirmText="Approve"
        cancelText="Cancel"
        variant="info"
        isLoading={isApproving}
      >
        <div className="mt-4">
          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Approval Notes (Optional)</label>
          <textarea
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            rows={3}
            disabled={isApproving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Add any notes about this approval..."
          />
        </div>
      </ConfirmationModal>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={() => !isRejecting && setShowRejectModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-2" id="modal-title">
                    Reject Professional Activity
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Please provide a reason for rejecting this activity:
                    </p>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter rejection reason..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      rows="4"
                      disabled={isRejecting}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-yellow-200">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  disabled={isRejecting}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectConfirm}
                  disabled={isRejecting || !rejectionReason.trim()}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRejecting ? 'Rejecting...' : 'Reject Activity'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Professional Activity"
        message="Are you sure you want to delete this professional activity? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </AppLayout>
  );
}

export default function ProfessionalActivityDetailPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingCard count={2} showHeader={true} lines={6} />
          </div>
        </AppLayout>
      }
    >
      <ProfessionalActivityDetailPageContent />
    </Suspense>
  );
}





