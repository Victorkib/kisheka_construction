/**
 * Bulk Material Request Batch Approval Page
 * Approval interface for bulk material requests
 * 
 * Route: /material-requests/bulk/[batchId]/approve
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { BatchApprovalTable } from '@/components/bulk-request/batch-approval-table';
import { ApprovalSummary } from '@/components/bulk-request/approval-summary';
import { CapitalBalanceWarning } from '@/components/financial/capital-balance-warning';
import { normalizeUserRole, isRole } from '@/lib/role-constants';

function BatchApprovalPageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess, user } = usePermissions();
  const toast = useToast();

  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableCapital, setAvailableCapital] = useState(null);

  useEffect(() => {
    if (params.batchId) {
      fetchBatch();
    }
  }, [params.batchId]);

  useEffect(() => {
    if (batch?.projectId) {
      fetchAvailableCapital(batch.projectId);
    }
  }, [batch?.projectId]);

  const fetchBatch = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/material-requests/bulk/${params.batchId}`);
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

  const fetchAvailableCapital = async (projectId) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/financial-overview`);
      const data = await response.json();
      if (data.success && data.data) {
        setAvailableCapital(data.data.capitalBalance || 0);
      }
    } catch (err) {
      console.error('Error fetching capital:', err);
    }
  };

  const handleApprove = async (requestId, notes = '') => {
    try {
      setActionLoading(true);

      const response = await fetch(`/api/material-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes: notes }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve request');
      }

      toast.showSuccess('Material request approved');
      fetchBatch(); // Refresh batch data
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId, reason) => {
    try {
      setActionLoading(true);

      const response = await fetch(`/api/material-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject request');
      }

      toast.showSuccess('Material request rejected');
      fetchBatch(); // Refresh batch data
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAll = async (requestIds, notes = '') => {
    try {
      setActionLoading(true);

      const response = await fetch(`/api/material-requests/bulk/${params.batchId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approveAll: false,
          materialRequestIds: requestIds,
          approvalNotes: notes,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve requests');
      }

      toast.showSuccess(
        `Successfully approved ${data.data.approvedCount} of ${data.data.totalCount} request(s)${data.data.batchFullyApproved ? '. Batch is ready for supplier assignment!' : ''}`
      );
      
      // If batch is fully approved, redirect to supplier assignment after a short delay
      if (data.data.redirectToSupplierAssignment) {
        setTimeout(() => {
          router.push(`/material-requests/bulk/${params.batchId}/assign-suppliers`);
        }, 1500);
      } else {
        fetchBatch(); // Refresh batch data
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectAll = async (requestIds, reason) => {
    try {
      setActionLoading(true);

      const response = await fetch(`/api/material-requests/bulk/${params.batchId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejectAll: false,
          materialRequestIds: requestIds,
          rejectionReason: reason,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject requests');
      }

      toast.showSuccess(
        `Successfully rejected ${data.data.rejectedCount} of ${data.data.totalCount} request(s)`
      );
      fetchBatch(); // Refresh batch data
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!canAccess('bulk_approve_material_requests')) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to approve bulk material requests.</p>
            <Link href="/material-requests" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
              ← Back to Material Requests
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable rows={5} columns={6} />
        </div>
      </AppLayout>
    );
  }

  if (error || !batch) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error || 'Batch not found'}
          </div>
          <Link href="/material-requests" className="text-blue-600 hover:text-blue-800">
            ← Back to Material Requests
          </Link>
        </div>
      </AppLayout>
    );
  }

  // normalizeUserRole and isRole are already imported at the top from role-constants
  const userRole = normalizeUserRole(user?.role);
  const isOwner = isRole(userRole, 'owner');
  const isAutoApproved = batch.status === 'approved' && isOwner;

  const materialRequests = batch.materialRequests || [];
  const pendingRequests = materialRequests.filter((req) =>
    ['requested', 'pending_approval'].includes(req.status)
  );

  // Calculate total cost for pending requests
  const pendingCost = pendingRequests.reduce((sum, req) => {
    return sum + (req.estimatedCost || 0);
  }, 0);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingOverlay
          isLoading={actionLoading}
          message="Processing approvals..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/material-requests/bulk/${params.batchId}`}
            className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block"
          >
            ← Back to Batch Details
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Approve Bulk Material Request</h1>
          <p className="text-gray-600 mt-2">
            Batch: <span className="font-medium">{batch.batchNumber}</span>
            {batch.batchName && ` - ${batch.batchName}`}
          </p>
        </div>

        {/* Auto-Approved Notice (OWNER) */}
        {isAutoApproved && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 mb-2">Auto-Approved</h3>
                <p className="text-sm text-green-700 mb-4">
                  This batch was automatically approved as you are the OWNER. All material requests are approved and ready for supplier assignment.
                </p>
                <Link
                  href={`/material-requests/bulk/${params.batchId}/assign-suppliers`}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Continue to Supplier Assignment →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Capital Warning */}
        {batch.projectId && pendingCost > 0 && availableCapital !== null && (
          <div className="mb-6">
            <CapitalBalanceWarning
              projectId={batch.projectId}
              amountToApprove={pendingCost}
            />
          </div>
        )}

        {/* Approval Summary */}
        <div className="mb-6">
          <ApprovalSummary batch={batch} materialRequests={materialRequests} />
        </div>

        {/* Approval Table */}
        {!isAutoApproved && (
          <div className="bg-white rounded-lg shadow p-6">
            <BatchApprovalTable
              materialRequests={materialRequests}
              onApprove={handleApprove}
              onReject={handleReject}
              onApproveAll={handleApproveAll}
              onRejectAll={handleRejectAll}
              loading={actionLoading}
              canApprove={canAccess('bulk_approve_material_requests')}
            />
          </div>
        )}

        {/* Actions */}
        {!isAutoApproved && pendingRequests.length === 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">All Requests Processed</h3>
                <p className="text-sm text-blue-700">
                  All material requests in this batch have been approved or rejected.
                </p>
              </div>
              <Link
                href={`/material-requests/bulk/${params.batchId}/assign-suppliers`}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Assign Suppliers →
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function BatchApprovalPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={5} columns={6} />
          </div>
        </AppLayout>
      }
    >
      <BatchApprovalPageContent />
    </Suspense>
  );
}

