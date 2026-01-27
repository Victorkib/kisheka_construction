/**
 * Bulk Material Request Batch Detail Page
 * Shows batch details, material requests, approval history, and actions
 * 
 * Route: /material-requests/bulk/[batchId]
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingButton, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ApprovalSummary } from '@/components/bulk-request/approval-summary';
import { ImportExportButtons } from '@/components/bulk-request/import-export-buttons';
import { ConfirmationModal } from '@/components/modals';
import { normalizeUserRole, isRole } from '@/lib/role-constants';

function BatchDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess, user } = usePermissions();
  const toast = useToast();

  const [batch, setBatch] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectFinances, setProjectFinances] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState(null);

  useEffect(() => {
    if (params.batchId) {
      fetchBatch();
    }
  }, [params.batchId]);

  useEffect(() => {
    if (batch?.projectId) {
      fetchProject(batch.projectId);
      fetchProjectFinances(batch.projectId);
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

  const fetchProject = async (projectId) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      if (data.success) {
        setProject(data.data);
      }
    } catch (err) {
      console.error('Error fetching project:', err);
    }
  };

  const fetchProjectFinances = async (projectId) => {
    try {
      setFinanceLoading(true);
      setFinanceError(null);
      const response = await fetch(`/api/project-finances?projectId=${projectId}`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch project finances');
      }
      setProjectFinances(data.data || null);
    } catch (err) {
      setFinanceError(err.message);
    } finally {
      setFinanceLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setActionLoading(true);

      const response = await fetch(`/api/material-requests/bulk/${params.batchId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete batch');
      }

      toast.showSuccess('Batch cancelled successfully');
      router.push('/material-requests');
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
    return new Date(date).toLocaleString('en-KE');
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      partially_ordered: 'bg-orange-100 text-orange-800',
      fully_ordered: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

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

  const materialRequests = batch.materialRequests || [];
  const canEdit = ['draft', 'pending_approval'].includes(batch.status);
  const canApprove = canAccess('bulk_approve_material_requests') && batch.status === 'pending_approval';
  
  // Check if user can assign suppliers
  // OWNER and PM should always be able to assign suppliers when batch is approved
  const userRole = normalizeUserRole(user?.role);
  const isOwner = isRole(userRole, 'owner');
  const isPM = isRole(userRole, ['pm', 'project_manager']);
  const hasPermission = canAccess('create_bulk_purchase_orders');
  const canAssignSuppliers = batch.status === 'approved' && (hasPermission || isOwner || isPM);
  
  const canDelete = ['draft', 'pending_approval'].includes(batch.status);
  const returnTo = `/material-requests/bulk/${params.batchId}`;
  const availableCapital = projectFinances?.availableCapital ?? null;
  const estimatedBatchCost = batch?.totals?.totalEstimatedCost || 0;
  const hasCapital = availableCapital === null ? true : availableCapital > 0;
  const isCapitalShort = availableCapital !== null && availableCapital < estimatedBatchCost;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingOverlay
          isLoading={actionLoading}
          message="Updating batch..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-8">
          <Link href="/material-requests" className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block">
            ← Back to Material Requests
          </Link>
          {(financeLoading || projectFinances || financeError) && (
            <div className={`mb-4 rounded-lg border px-4 py-3 ${
              financeError
                ? 'bg-red-50 border-red-200 text-red-700'
                : !hasCapital
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : isCapitalShort
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-green-50 border-green-200 text-green-800'
            }`}>
              {financeLoading ? (
                <p className="text-sm">Checking project capital availability...</p>
              ) : financeError ? (
                <p className="text-sm">Capital check failed: {financeError}</p>
              ) : (
                <div className="text-sm">
                  <p className="font-semibold">Project capital check</p>
                  <p>
                    Available: <span className="font-medium">{formatCurrency(availableCapital)}</span>
                  </p>
                  <p className="text-xs mt-1">
                    Batch estimated cost: {formatCurrency(estimatedBatchCost)}.
                  </p>
                  {!hasCapital && (
                    <p className="text-xs mt-2">
                      This project has no available capital. Allocate funds before approving or assigning suppliers.
                    </p>
                  )}
                  {hasCapital && isCapitalShort && (
                    <p className="text-xs mt-2">
                      Available capital is below the batch estimate. You may need to add funding before ordering.
                    </p>
                  )}
                  {batch?.projectId && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/financing?projectId=${batch.projectId.toString()}&returnTo=${encodeURIComponent(returnTo)}`}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                      >
                        Open Financing
                      </Link>
                      <Link
                        href={`/investors?projectId=${batch.projectId.toString()}&returnTo=${encodeURIComponent(returnTo)}`}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                      >
                        Allocate Funds (Investors)
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                  {batch.batchNumber}
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
                <p className="text-gray-600 mt-2">{batch.batchName}</p>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <ImportExportButtons
                batch={batch}
                materialRequests={materialRequests}
                onImportComplete={(materials) => {
                  // Handle import - could add materials to existing batch or create new
                  toast.showInfo(`${materials.length} materials imported. Please create a new batch or add manually.`);
                }}
              />
              {batch.status === 'pending_approval' && !canApprove && (
                <button
                  disabled
                  title="Batch must be approved before you can assign suppliers"
                  className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium"
                >
                  Assign Suppliers
                </button>
              )}
              {canApprove && (
                <Link
                  href={`/material-requests/bulk/${params.batchId}/approve`}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  Approve Batch
                </Link>
              )}
              {canAssignSuppliers && (
                <Link
                  href={`/material-requests/bulk/${params.batchId}/assign-suppliers`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Assign Suppliers
                </Link>
              )}
              {batch.status === 'approved' && !canAssignSuppliers && (
                <div className="flex flex-col items-end gap-1">
                  <button
                    disabled
                    title={`Debug: Batch status: ${batch.status}, Your role: ${userRole || 'unknown'}, Has permission: ${hasPermission}, Is Owner: ${isOwner}, Is PM: ${isPM}`}
                    className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium"
                  >
                    Assign Suppliers
                  </button>
                  <span className="text-xs text-gray-500">
                    Status: {batch.status} | Role: {userRole || 'unknown'}
                  </span>
                </div>
              )}
              {canDelete && (
                <LoadingButton
                  onClick={() => setShowDeleteModal(true)}
                  isLoading={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Cancel Batch
                </LoadingButton>
              )}
            </div>
          </div>
        </div>

        {/* Batch Information */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Batch Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Project</p>
              <p className="text-base font-medium text-gray-900 mt-1">
                {project ? `${project.projectCode} - ${project.projectName}` : 'Loading...'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created By</p>
              <p className="text-base font-medium text-gray-900 mt-1">{batch.createdByName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created At</p>
              <p className="text-base font-medium text-gray-900 mt-1">{formatDate(batch.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Materials</p>
              <p className="text-base font-medium text-gray-900 mt-1">{batch.totalMaterials || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Estimated Cost</p>
              <p className="text-base font-medium text-gray-900 mt-1">
                {formatCurrency(batch.totalEstimatedCost || 0)}
              </p>
            </div>
            {batch.approvedAt && (
              <div>
                <p className="text-sm text-gray-600">Approved At</p>
                <p className="text-base font-medium text-gray-900 mt-1">{formatDate(batch.approvedAt)}</p>
              </div>
            )}
            {batch.approvedByName && (
              <div>
                <p className="text-sm text-gray-600">Approved By</p>
                <p className="text-base font-medium text-gray-900 mt-1">{batch.approvedByName}</p>
              </div>
            )}
            {batch.approvalNotes && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600">Approval Notes</p>
                <p className="text-base text-gray-900 mt-1">{batch.approvalNotes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Workflow Guidance Card */}
        {batch && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">📋 Workflow Status & Next Steps</h3>
            {batch.status === 'draft' && (
              <div className="text-sm text-blue-800">
                <p className="mb-2"><strong>Current Status:</strong> Batch is in draft mode.</p>
                <p><strong>Next Step:</strong> Submit the batch for approval.</p>
              </div>
            )}
            {batch.status === 'pending_approval' && (
              <div className="text-sm text-blue-800">
                <p className="mb-2"><strong>Current Status:</strong> Batch is pending approval from PM/OWNER.</p>
                <p><strong>Next Step:</strong> PM/OWNER should review and approve the batch.</p>
                {canApprove && (
                  <Link
                    href={`/material-requests/bulk/${params.batchId}/approve`}
                    className="inline-block mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Review & Approve →
                  </Link>
                )}
              </div>
            )}
            {batch.status === 'approved' && (
              <div className="text-sm text-blue-800">
                <p className="mb-2"><strong>Current Status:</strong> Batch has been approved and is ready for supplier assignment.</p>
                <p className="mb-3"><strong>Next Step:</strong> Assign suppliers to materials and create purchase orders.</p>
                {canAssignSuppliers && (
                  <Link
                    href={`/material-requests/bulk/${params.batchId}/assign-suppliers`}
                    className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Assign Suppliers →
                  </Link>
                )}
              </div>
            )}
            {(batch.status === 'partially_ordered' || batch.status === 'fully_ordered') && (
              <div className="text-sm text-blue-800">
                <p className="mb-2"><strong>Current Status:</strong> Purchase orders have been created for this batch.</p>
                <p><strong>Next Step:</strong> Monitor purchase order status and supplier responses.</p>
                {batch.purchaseOrderIds && batch.purchaseOrderIds.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-blue-700 mb-2">View purchase orders:</p>
                    <div className="flex flex-wrap gap-2">
                      {batch.purchaseOrderIds.slice(0, 5).map((poId, index) => (
                        <Link
                          key={poId}
                          href={`/purchase-orders/${poId}`}
                          className="text-xs px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                        >
                          PO #{index + 1}
                        </Link>
                      ))}
                      {batch.purchaseOrderIds.length > 5 && (
                        <span className="text-xs text-blue-700 px-3 py-1">
                          +{batch.purchaseOrderIds.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {batch.status === 'cancelled' && (
              <div className="text-sm text-red-800">
                <p className="mb-2"><strong>Current Status:</strong> Batch has been cancelled.</p>
                <p><strong>Action:</strong> This batch cannot be processed further.</p>
              </div>
            )}
          </div>
        )}

        {/* Approval Summary */}
        <div className="mb-6">
          <ApprovalSummary batch={batch} materialRequests={materialRequests} />
        </div>

        {/* Material Requests List */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Material Requests</h2>
            {batch.status === 'approved' && canAssignSuppliers && (
              <Link
                href={`/material-requests/bulk/${params.batchId}/assign-suppliers`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                📋 Assign Suppliers →
              </Link>
            )}
            {batch.status === 'approved' && !canAssignSuppliers && (
              <span className="text-sm text-gray-500">Supplier assignment requires permission</span>
            )}
          </div>
          {materialRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-600">No material requests in this batch</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Request Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Material
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Estimated Cost
                    </th>
                    {batch.status === 'approved' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Supplier Assignment
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {materialRequests.map((request) => (
                    <tr key={request._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/material-requests/${request._id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          {request.requestNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{request.materialName}</div>
                        {request.description && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">{request.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {request.quantityNeeded} {request.unit}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatCurrency(request.estimatedCost)}
                      </td>
                      {batch.status === 'approved' && (
                        <td className="px-4 py-3">
                          {request.linkedPurchaseOrderId ? (
                            <span className="text-xs text-green-600 font-medium">✓ Assigned (PO Created)</span>
                          ) : (
                            <span className="text-xs text-orange-600 font-medium">⚠ Not Assigned</span>
                          )}
                          {canAssignSuppliers && !request.linkedPurchaseOrderId && (
                            <div className="mt-1">
                              <Link
                                href={`/material-requests/bulk/${params.batchId}/assign-suppliers`}
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                Assign Supplier →
                              </Link>
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                            request.status
                          )}`}
                        >
                          {request.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) ||
                            'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/material-requests/${request._id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {batch.status === 'approved' && materialRequests.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">Ready for Supplier Assignment</p>
                  <p className="text-xs text-blue-700 mb-3">
                    This batch has been approved. Assign suppliers to materials to create purchase orders. You can assign all materials to one supplier or different suppliers for each material.
                  </p>
                  {canAssignSuppliers && (
                    <Link
                      href={`/material-requests/bulk/${params.batchId}/assign-suppliers`}
                      className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                    >
                      Go to Supplier Assignment Page →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Purchase Orders (if any) */}
        {batch.purchaseOrderIds && batch.purchaseOrderIds.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Purchase Orders</h2>
            <div className="space-y-2">
              {batch.purchaseOrderIds.map((poId, index) => (
                <Link
                  key={poId}
                  href={`/purchase-orders/${poId}`}
                  className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      Purchase Order #{index + 1}
                    </span>
                    <span className="text-blue-600 hover:text-blue-800 text-sm">View →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Cancel Batch"
          message="Are you sure you want to cancel this batch? This will cancel all pending material requests in the batch. This action cannot be undone."
          confirmText="Cancel Batch"
          confirmColor="red"
          isLoading={actionLoading}
        />
      </div>
    </AppLayout>
  );
}

export default function BatchDetailPage() {
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
      <BatchDetailPageContent />
    </Suspense>
  );
}

