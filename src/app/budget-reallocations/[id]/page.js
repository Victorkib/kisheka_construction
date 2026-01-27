/**
 * Budget Reallocation Detail Page
 * View and manage a specific budget reallocation request
 * 
 * Route: /budget-reallocations/[id]
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';

function BudgetReallocationDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [reallocation, setReallocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (params?.id) {
      fetchReallocation();
    }
  }, [params?.id]);

  const fetchReallocation = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/budget-reallocations?limit=1`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch budget reallocation');
      }

      // Find the specific reallocation
      const found = data.data.reallocations.find(r => r._id === params.id);
      if (found) {
        setReallocation(found);
      } else {
        setError('Budget reallocation not found');
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch reallocation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvalNotes.trim() && !confirm('Approve without notes?')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/budget-reallocations/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes: approvalNotes.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve reallocation');
      }

      toast.showSuccess('Budget reallocation approved and executed successfully');
      fetchReallocation();
      setApprovalNotes('');
    } catch (err) {
      toast.showError(err.message || 'Failed to approve reallocation');
      console.error('Approve error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.showError('Rejection reason is required');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/budget-reallocations/${params.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject reallocation');
      }

      toast.showSuccess('Budget reallocation rejected successfully');
      fetchReallocation();
      setRejectionReason('');
    } catch (err) {
      toast.showError(err.message || 'Failed to reject reallocation');
      console.error('Reject error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      executed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getReallocationTypeLabel = (type) => {
    const labels = {
      phase_to_phase: 'Phase to Phase',
      project_to_phase: 'Project to Phase',
      phase_to_project: 'Phase to Project',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  if (error || !reallocation) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error || 'Budget reallocation not found'}
          </div>
          <Link href="/budget-reallocations" className="text-blue-600 hover:text-blue-800">
            ← Back to Budget Reallocations
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingOverlay
          isLoading={actionLoading}
          message="Updating reallocation request..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-8">
          <Link href="/budget-reallocations" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Budget Reallocations
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">Budget Reallocation Request</h1>
              <p className="text-gray-600 mt-2">View and manage budget reallocation details</p>
            </div>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeColor(reallocation.status)}`}>
              {reallocation.status.charAt(0).toUpperCase() + reallocation.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Reallocation Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
              <p className="text-base text-gray-900">{getReallocationTypeLabel(reallocation.reallocationType)}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Amount</label>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(reallocation.amount)}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">From</label>
              <p className="text-base text-gray-900">
                {reallocation.fromPhaseId ? `Phase: ${reallocation.fromPhaseId}` : 'Project Budget'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">To</label>
              <p className="text-base text-gray-900">
                {reallocation.toPhaseId ? `Phase: ${reallocation.toPhaseId}` : 'Project Budget'}
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Reason</label>
              <p className="text-base text-gray-900 bg-gray-50 p-3 rounded-lg">{reallocation.reason}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Requested By</label>
              <p className="text-base text-gray-900">{reallocation.requestedByName || 'Unknown'}</p>
              <p className="text-sm text-gray-600">{formatDate(reallocation.requestedAt)}</p>
            </div>
            {reallocation.approvedBy && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Approved By</label>
                <p className="text-base text-gray-900">{reallocation.approvedByName || 'Unknown'}</p>
                <p className="text-sm text-gray-600">{formatDate(reallocation.approvedAt)}</p>
              </div>
            )}
            {reallocation.rejectedBy && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Rejected By</label>
                <p className="text-base text-gray-900">{reallocation.rejectedByName || 'Unknown'}</p>
                <p className="text-sm text-gray-600">{formatDate(reallocation.rejectedAt)}</p>
              </div>
            )}
            {reallocation.approvalNotes && (
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Approval Notes</label>
                <p className="text-base text-gray-900 bg-green-50 p-3 rounded-lg">{reallocation.approvalNotes}</p>
              </div>
            )}
            {reallocation.rejectionReason && (
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Rejection Reason</label>
                <p className="text-base text-gray-900 bg-red-50 p-3 rounded-lg">{reallocation.rejectionReason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {reallocation.status === 'pending' && (canAccess('approve_budget_reallocation') || canAccess('reject_budget_reallocation')) && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-4">
              {canAccess('approve_budget_reallocation') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Approval Notes (Optional)</label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    rows={3}
                    placeholder="Add notes about this approval..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
                  />
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Processing...' : 'Approve & Execute'}
                  </button>
                </div>
              )}
              {canAccess('reject_budget_reallocation') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Rejection Reason (Required)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    placeholder="Explain why this reallocation is being rejected..."
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 mb-3"
                  />
                  <button
                    onClick={handleReject}
                    disabled={actionLoading || !rejectionReason.trim()}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Processing...' : 'Reject Request'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function BudgetReallocationDetailPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <BudgetReallocationDetailPageContent />
    </Suspense>
  );
}



