/**
 * Professional Service Assignment Detail Page
 * Displays full professional service assignment details with linked activities and fees
 * 
 * Route: /professional-services/[id]
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingCard } from '@/components/loading';
import { AuditTrail } from '@/components/audit-trail';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { ImagePreview } from '@/components/uploads/image-preview';

const normalizeId = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return normalizeId(value[0]);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return value.$oid;
  if (typeof value === 'object' && value._id) return normalizeId(value._id);
  return value.toString?.() || '';
};

function ProfessionalServiceDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = normalizeId(params?.id);
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTerminating, setIsTerminating] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [activities, setActivities] = useState([]);
  const [fees, setFees] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  useEffect(() => {
    if (assignmentId) {
      fetchAssignment();
    } else {
      setError('Invalid assignment ID');
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    if (assignment?._id) {
      fetchRelatedData();
    }
  }, [assignment?._id]);

  const fetchAssignment = async () => {
    if (!assignmentId) {
      setError('Invalid assignment ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/professional-services/${assignmentId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch professional service assignment');
      }

      setAssignment(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch assignment error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedData = async () => {
    if (!assignment?._id) return;

    try {
      setLoadingRelated(true);

      // Fetch activities
      const activitiesResponse = await fetch(
        `/api/professional-activities?professionalServiceId=${assignment._id}&limit=10&sortBy=activityDate&sortOrder=desc`
      );
      const activitiesData = await activitiesResponse.json();
      if (activitiesData.success) {
        setActivities(activitiesData.data.activities || []);
      }

      // Fetch fees
      const feesResponse = await fetch(
        `/api/professional-fees?professionalServiceId=${assignment._id}&limit=10&sortBy=createdAt&sortOrder=desc`
      );
      const feesData = await feesResponse.json();
      if (feesData.success) {
        setFees(feesData.data.fees || []);
      }
    } catch (err) {
      console.error('Fetch related data error:', err);
    } finally {
      setLoadingRelated(false);
    }
  };

  const handleTerminateClick = () => {
    setShowTerminateModal(true);
  };

  const handleTerminateConfirm = async () => {
    setIsTerminating(true);
    try {
      const response = await fetch(`/api/professional-services/${assignmentId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to terminate assignment');
      }

      toast.showSuccess('Professional service assignment terminated successfully!');
      setShowTerminateModal(false);
      router.push('/professional-services');
    } catch (err) {
      toast.showError(err.message || 'Failed to terminate assignment');
      console.error('Terminate assignment error:', err);
    } finally {
      setIsTerminating(false);
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

  const getStatusBadgeColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      terminated: 'bg-red-100 text-red-800',
      on_hold: 'bg-yellow-100 text-yellow-800',
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

  if (error || !assignment) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Professional service assignment not found'}
          </div>
          <Link
            href="/professional-services"
            className="mt-4 inline-block text-blue-600 hover:text-blue-800"
          >
            ← Back to Assignments
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/professional-services"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Assignments
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                  {assignment.library?.name || 'Professional Service Assignment'}
                </h1>
                <span
                  className={`px-4 py-2 text-sm font-semibold rounded-full ${getStatusBadgeColor(
                    assignment.status
                  )}`}
                >
                  {assignment.status?.charAt(0).toUpperCase() + assignment.status?.slice(1) || 'N/A'}
                </span>
              </div>
              <p className="text-gray-600 mt-2">
                {assignment.professionalCode || 'N/A'} • {assignment.type === 'architect' ? 'Architect' : 'Engineer'}
              </p>
            </div>
            <div className="flex gap-2">
              {canAccess('edit_professional_service_assignment') && assignment.status !== 'terminated' && (
                <Link
                  href={`/professional-services/${assignmentId}/edit`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  Edit
                </Link>
              )}
              {canAccess('terminate_professional_service') && assignment.status !== 'terminated' && (
                <button
                  onClick={handleTerminateClick}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                >
                  Terminate
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Assignment Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Assignment Information</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Professional</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    {assignment.library?.name || 'N/A'}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {assignment.type === 'architect' ? 'Architect' : 'Engineer'}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Project</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {assignment.project ? (
                      <Link
                        href={`/projects/${assignment.project._id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {assignment.project.projectCode} - {assignment.project.projectName}
                      </Link>
                    ) : (
                      'N/A'
                    )}
                  </dd>
                </div>

                {assignment.phase && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Phase</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {assignment.phase.phaseName || assignment.phase.phaseCode || 'N/A'}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm font-medium text-gray-500">Contract Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {assignment.contractType?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Contract Value</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    {formatCurrency(assignment.contractValue, assignment.currency || 'KES')}
                  </dd>
                </div>

                {assignment.contractStartDate && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Contract Start Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(assignment.contractStartDate)}</dd>
                  </div>
                )}

                {assignment.contractEndDate && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Contract End Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(assignment.contractEndDate)}</dd>
                  </div>
                )}

                {assignment.paymentSchedule && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Payment Schedule</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {assignment.paymentSchedule?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                    </dd>
                  </div>
                )}

                {assignment.visitFrequency && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Visit Frequency</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {assignment.visitFrequency?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                    </dd>
                  </div>
                )}

                {assignment.notes && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Notes</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{assignment.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Contract Document */}
            {assignment.contractDocumentUrl && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Contract Document</h2>
                <ImagePreview
                  url={assignment.contractDocumentUrl}
                  title="Contract Document"
                  showDelete={false}
                />
              </div>
            )}

            {/* Statistics */}
            {assignment.statistics && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Statistics</h2>
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Total Activities</dt>
                    <dd className="mt-1 text-2xl font-bold text-gray-900">
                      {assignment.statistics.activitiesCount || 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Total Fees</dt>
                    <dd className="mt-1 text-2xl font-bold text-gray-900">
                      {formatCurrency(assignment.statistics.totalFees || 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Paid Fees</dt>
                    <dd className="mt-1 text-2xl font-bold text-green-600">
                      {formatCurrency(assignment.statistics.paidFees || 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Pending Fees</dt>
                    <dd className="mt-1 text-2xl font-bold text-yellow-600">
                      {formatCurrency(assignment.statistics.pendingFees || 0)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Recent Activities */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recent Activities</h2>
                <Link
                  href={`/professional-activities?professionalServiceId=${assignmentId}`}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  View All →
                </Link>
              </div>
              {loadingRelated ? (
                <LoadingSpinner />
              ) : activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <Link
                      key={activity._id}
                      href={`/professional-activities/${activity._id}`}
                      className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {activity.activityType?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDate(activity.activityDate)}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            activity.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : activity.status === 'pending_approval'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {activity.status?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No activities yet</p>
              )}
            </div>

            {/* Recent Fees */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Recent Fees</h2>
                <Link
                  href={`/professional-fees?professionalServiceId=${assignmentId}`}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  View All →
                </Link>
              </div>
              {loadingRelated ? (
                <LoadingSpinner />
              ) : fees.length > 0 ? (
                <div className="space-y-3">
                  {fees.map((fee) => (
                    <Link
                      key={fee._id}
                      href={`/professional-fees/${fee._id}`}
                      className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {fee.feeType?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatCurrency(fee.amount, fee.currency || 'KES')} • {formatDate(fee.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            fee.status === 'PAID'
                              ? 'bg-green-100 text-green-800'
                              : fee.status === 'APPROVED'
                              ? 'bg-blue-100 text-blue-800'
                              : fee.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {fee.status || 'N/A'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No fees yet</p>
              )}
            </div>

            {/* Activity Log */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
              <AuditTrail entityType="PROFESSIONAL_SERVICES" entityId={assignmentId} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Info</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Assigned Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(assignment.assignedDate || assignment.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Created By</dt>
                  <dd className="mt-1 text-sm text-gray-900">{assignment.createdByName || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(assignment.updatedAt)}</dd>
                </div>
              </dl>
            </div>

            {/* Professional Information */}
            {assignment.library && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Professional Information</h3>
                <dl className="space-y-3">
                  {assignment.library.companyName && (
                    <div>
                      <dt className="text-sm font-semibold text-gray-700">Company</dt>
                      <dd className="mt-1 text-sm text-gray-900">{assignment.library.companyName}</dd>
                    </div>
                  )}
                  {assignment.library.email && (
                    <div>
                      <dt className="text-sm font-semibold text-gray-700">Email</dt>
                      <dd className="mt-1 text-sm text-gray-900">{assignment.library.email}</dd>
                    </div>
                  )}
                  {assignment.library.phone && (
                    <div>
                      <dt className="text-sm font-semibold text-gray-700">Phone</dt>
                      <dd className="mt-1 text-sm text-gray-900">{assignment.library.phone}</dd>
                    </div>
                  )}
                  {assignment.library.specialization && (
                    <div>
                      <dt className="text-sm font-semibold text-gray-700">Specialization</dt>
                      <dd className="mt-1 text-sm text-gray-900">{assignment.library.specialization}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Terminate Confirmation Modal */}
      <ConfirmationModal
        isOpen={showTerminateModal}
        onClose={() => !isTerminating && setShowTerminateModal(false)}
        onConfirm={handleTerminateConfirm}
        title="Terminate Professional Service Assignment"
        message={`Are you sure you want to terminate this assignment? This action cannot be undone.`}
        confirmText="Terminate"
        cancelText="Cancel"
        variant="danger"
        isLoading={isTerminating}
      />
    </AppLayout>
  );
}

export default function ProfessionalServiceDetailPage() {
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
      <ProfessionalServiceDetailPageContent />
    </Suspense>
  );
}





