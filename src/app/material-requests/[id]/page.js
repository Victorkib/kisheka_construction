/**
 * Material Request Detail Page
 * Displays full material request details with approval actions and timeline
 * 
 * Route: /material-requests/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingCard, LoadingButton, LoadingOverlay } from '@/components/loading';
import { AuditTrail } from '@/components/audit-trail';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { useTrackPageView } from '@/hooks/use-track-page-view';

export default function MaterialRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params?.id;
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [linkedPurchaseOrder, setLinkedPurchaseOrder] = useState(null);
  const [linkedMaterial, setLinkedMaterial] = useState(null);
  const [availableCapital, setAvailableCapital] = useState(null);
  const [projectFinances, setProjectFinances] = useState(null);

  // Track page view
  useTrackPageView('material-request', async (id) => {
    try {
      const response = await fetch(`/api/material-requests/${id}`);
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
    } catch (err) {
      console.error('Error fetching material request for tracking:', err);
    }
    return {};
  });

  useEffect(() => {
    if (requestId) {
      fetchRequest();
    } else {
      setError('Invalid request ID');
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (request?.linkedPurchaseOrderId) {
      fetchPurchaseOrder(request.linkedPurchaseOrderId);
    }
    if (request?.linkedPurchaseOrderId) {
      fetchLinkedMaterial(request.linkedPurchaseOrderId);
    }
  }, [request?.linkedPurchaseOrderId]);

  const fetchRequest = async () => {
    if (!requestId) {
      setError('Invalid request ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/material-requests/${requestId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch material request');
      }

      setRequest(data.data);
      
      // Fetch available capital if user has permission
      if (data.data.projectId && canAccess('view_financing')) {
        fetchAvailableCapital(data.data.projectId);
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch material request error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCapital = async (projectId) => {
    try {
      const response = await fetch(`/api/project-finances?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setProjectFinances(data.data);
        setAvailableCapital(data.data.availableCapital || data.data.capitalBalance || 0);
      }
    } catch (err) {
      console.error('Error fetching available capital:', err);
    }
  };

  const fetchPurchaseOrder = async (poId) => {
    try {
      const response = await fetch(`/api/purchase-orders/${poId}`);
      const data = await response.json();
      if (data.success) {
        setLinkedPurchaseOrder(data.data);
      }
    } catch (err) {
      console.error('Error fetching purchase order:', err);
    }
  };

  const fetchLinkedMaterial = async (poId) => {
    try {
      // Find material linked to this purchase order
      const response = await fetch(`/api/materials?purchaseOrderId=${poId}`);
      const data = await response.json();
      if (data.success && data.data.materials?.length > 0) {
        setLinkedMaterial(data.data.materials[0]);
      }
    } catch (err) {
      console.error('Error fetching linked material:', err);
    }
  };

  const handleApproveClick = () => {
    setApprovalNotes('');
    setShowApproveModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/material-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes: approvalNotes || 'Approved via UI' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve material request');
      }

      await fetchRequest();
      setApprovalNotes('');
      setShowApproveModal(false);
      toast.showSuccess('Material request approved successfully!');
      if (data.data?.financialWarning) {
        toast.showWarning(data.data.financialWarning.message);
      }
    } catch (err) {
      toast.showError(err.message || 'Failed to approve material request');
      console.error('Approve material request error:', err);
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
      const response = await fetch(`/api/material-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject material request');
      }

      await fetchRequest();
      setShowRejectModal(false);
      setRejectionReason('');
      toast.showSuccess('Material request rejected successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to reject material request');
      console.error('Reject material request error:', err);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleConvertClick = () => {
    setShowConvertModal(true);
  };

  const handleConvertConfirm = async () => {
    setIsConverting(true);
    try {
      // First mark as converted
      const convertResponse = await fetch(`/api/material-requests/${requestId}/convert-to-order`, {
        method: 'POST',
      });

      const convertData = await convertResponse.json();

      if (!convertData.success) {
        throw new Error(convertData.error || 'Failed to convert material request');
      }

      // Redirect to create purchase order page with request ID
      router.push(`/purchase-orders/new?requestId=${requestId}`);
    } catch (err) {
      toast.showError(err.message || 'Failed to convert material request');
      console.error('Convert material request error:', err);
      setIsConverting(false);
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      requested: 'bg-gray-100 text-gray-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      converted_to_order: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-gray-100 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getUrgencyBadgeColor = (urgency) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[urgency] || 'bg-gray-100 text-gray-800';
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

  const formatCurrency = (amount) => {
    // For financial amounts, show 0 instead of N/A for clarity
    const value = amount || 0;
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingCard />
        </div>
      </AppLayout>
    );
  }

  if (error || !request) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error || 'Material request not found'}
          </div>
          <Link href="/material-requests" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Material Requests
          </Link>
        </div>
      </AppLayout>
    );
  }

  const canApprove = canAccess('approve_material_request') && ['requested', 'pending_approval'].includes(request.status);
  const canReject = canAccess('reject_material_request') && ['requested', 'pending_approval'].includes(request.status);
  // Can convert if: has permission AND (approved OR converted_to_order) AND no linked PO
  const canConvert = canAccess('create_purchase_order') && 
    (request.status === 'approved' || request.status === 'converted_to_order') && 
    !request.linkedPurchaseOrderId;
  const canEdit = canAccess('edit_material_request') && ['requested', 'pending_approval'].includes(request.status);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Loading Overlay for Actions */}
        <LoadingOverlay 
          isLoading={isApproving || isRejecting || isConverting} 
          message={
            isApproving ? "Approving material request..." :
            isRejecting ? "Rejecting material request..." :
            isConverting ? "Converting to purchase order..." :
            "Processing..."
          } 
          fullScreen={false} 
        />
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/material-requests"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Material Requests
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                  {request.requestNumber}
                </h1>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeColor(request.status)}`}>
                  {request.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'}
                </span>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getUrgencyBadgeColor(request.urgency)}`}>
                  {request.urgency?.toUpperCase() || 'N/A'}
                </span>
              </div>
              <p className="text-gray-600 mt-2">{request.materialName}</p>
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
              {canConvert && (
                <>
                  {request.status === 'converted_to_order' && !request.linkedPurchaseOrderId && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> This request has been marked as converted but no purchase order has been created yet. Click below to create the purchase order.
                      </p>
                    </div>
                  )}
                  <button
                    onClick={handleConvertClick}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
                  >
                    {request.status === 'converted_to_order' ? 'Continue to Create Purchase Order' : 'Create Purchase Order'}
                  </button>
                </>
              )}
              {canEdit && (
                <Link
                  href={`/material-requests/${requestId}/edit`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  Edit
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Workflow Guidance Card */}
        {request && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">📋 Workflow Status & Next Steps</h3>
            {request.status === 'requested' && (
              <div className="text-sm text-blue-800">
                <p className="mb-2"><strong>Current Status:</strong> Request has been submitted and is awaiting approval.</p>
                <p><strong>Next Step:</strong> PM/OWNER needs to review and approve or reject this request.</p>
              </div>
            )}
            {request.status === 'pending_approval' && (
              <div className="text-sm text-blue-800">
                <p className="mb-2"><strong>Current Status:</strong> Request is pending approval from PM/OWNER.</p>
                <p><strong>Next Step:</strong> PM/OWNER should review the request details and approve or reject it.</p>
              </div>
            )}
            {request.status === 'approved' && !request.linkedPurchaseOrderId && (
              <div className="text-sm text-blue-800">
                <p className="mb-2"><strong>Current Status:</strong> Request has been approved and is ready for purchase order creation.</p>
                <p><strong>Next Step:</strong> PM/OWNER should create a purchase order by clicking "Create Purchase Order" above.</p>
              </div>
            )}
            {request.status === 'converted_to_order' && !request.linkedPurchaseOrderId && (
              <div className="text-sm text-amber-800 bg-amber-50 border-amber-200 rounded p-3">
                <p className="mb-2"><strong>Current Status:</strong> Request has been marked as converted but no purchase order has been created yet.</p>
                <p><strong>Next Step:</strong> Click "Continue to Create Purchase Order" above to complete the purchase order creation.</p>
              </div>
            )}
            {request.status === 'converted_to_order' && request.linkedPurchaseOrderId && (
              <div className="text-sm text-green-800 bg-green-50 border-green-200 rounded p-3">
                <p className="mb-2"><strong>Current Status:</strong> Purchase order has been created and sent to supplier.</p>
                <p><strong>Next Step:</strong> Supplier will review and respond to the purchase order. You can track the order status in the Purchase Orders section.</p>
                {linkedPurchaseOrder && (
                  <Link href={`/purchase-orders/${request.linkedPurchaseOrderId}`} className="text-green-700 hover:text-green-900 underline mt-1 inline-block">
                    View Purchase Order →
                  </Link>
                )}
              </div>
            )}
            {request.status === 'rejected' && (
              <div className="text-sm text-red-800 bg-red-50 border-red-200 rounded p-3">
                <p className="mb-2"><strong>Current Status:</strong> Request has been rejected.</p>
                {request.rejectionReason && (
                  <p className="mb-2"><strong>Reason:</strong> {request.rejectionReason}</p>
                )}
                <p><strong>Next Step:</strong> Review the rejection reason and edit the request if needed, or create a new request.</p>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Request Details</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Material Name</dt>
                  <dd className="mt-1 text-base text-gray-900">{request.materialName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Quantity Needed</dt>
                  <dd className="mt-1 text-base text-gray-900">
                    {request.quantityNeeded} {request.unit}
                  </dd>
                </div>
                {request.description && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-semibold text-gray-500">Description</dt>
                    <dd className="mt-1 text-base text-gray-900">{request.description}</dd>
                  </div>
                )}
                {request.reason && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-semibold text-gray-500">Reason</dt>
                    <dd className="mt-1 text-base text-gray-900">{request.reason}</dd>
                  </div>
                )}
                {request.notes && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-semibold text-gray-500">Notes</dt>
                    <dd className="mt-1 text-base text-gray-900">{request.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Financial Information */}
            {(request.estimatedCost || request.estimatedUnitCost || availableCapital !== null) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Financial Information</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {request.estimatedUnitCost && (
                    <div>
                      <dt className="text-sm font-semibold text-gray-500">Estimated Unit Cost</dt>
                      <dd className="mt-1 text-base text-gray-900">
                        {formatCurrency(request.estimatedUnitCost)}
                      </dd>
                    </div>
                  )}
                  {request.estimatedCost && (
                    <div>
                      <dt className="text-sm font-semibold text-gray-500">Estimated Total Cost</dt>
                      <dd className="mt-1 text-base font-semibold text-gray-900">
                        {formatCurrency(request.estimatedCost)}
                      </dd>
                    </div>
                  )}
                  {availableCapital !== null && canAccess('view_financing') && (
                    <div>
                      <dt className="text-sm font-semibold text-gray-500">Available Capital</dt>
                      <dd className="mt-1 text-base text-gray-900">
                        {formatCurrency(availableCapital)}
                      </dd>
                    </div>
                  )}
                  {request.estimatedCost && availableCapital !== null && (
                    <div>
                      <dt className="text-sm font-semibold text-gray-500">Remaining After This Request</dt>
                      <dd className={`mt-1 text-base font-semibold ${
                        (availableCapital - request.estimatedCost) < 0 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {formatCurrency(availableCapital - request.estimatedCost)}
                      </dd>
                    </div>
                  )}
                </dl>
                {request.estimatedCost && availableCapital !== null && request.estimatedCost > availableCapital && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-800">
                      ⚠️ Warning: Estimated cost ({formatCurrency(request.estimatedCost)}) exceeds available capital ({formatCurrency(availableCapital)}) by {formatCurrency(request.estimatedCost - availableCapital)}
                    </p>
                  </div>
                )}
                {projectFinances && projectFinances.materialsBreakdown && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Materials Budget Context</h3>
                    <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <dt className="text-gray-500">Budget</dt>
                        <dd className="font-semibold text-gray-900">{formatCurrency(projectFinances.materialsBreakdown.budget || 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-orange-600">Estimated</dt>
                        <dd className="font-semibold text-orange-700">{formatCurrency(projectFinances.materialsBreakdown.estimated || 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-amber-600">Committed</dt>
                        <dd className="font-semibold text-amber-700">{formatCurrency(projectFinances.materialsBreakdown.committed || 0)}</dd>
                      </div>
                      <div>
                        <dt className="text-green-600">Actual</dt>
                        <dd className="font-semibold text-green-700">{formatCurrency(projectFinances.materialsBreakdown.actual || 0)}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            )}

            {/* Approval Information */}
            {request.approvedBy && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Approval Information</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-semibold text-gray-500">Approved By</dt>
                    <dd className="mt-1 text-base text-gray-900">{request.approvedByName || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-500">Approval Date</dt>
                    <dd className="mt-1 text-base text-gray-900">{formatDate(request.approvalDate)}</dd>
                  </div>
                  {request.approvalNotes && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-semibold text-gray-500">Approval Notes</dt>
                      <dd className="mt-1 text-base text-gray-900">{request.approvalNotes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Rejection Information */}
            {request.status === 'rejected' && request.rejectionReason && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
                <h2 className="text-xl font-bold text-red-900 mb-4">Rejection Information</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-semibold text-gray-500">Rejected By</dt>
                    <dd className="mt-1 text-base text-gray-900">{request.approvedByName || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-500">Rejection Date</dt>
                    <dd className="mt-1 text-base text-gray-900">{formatDate(request.approvalDate)}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="text-sm font-semibold text-gray-500">Rejection Reason</dt>
                    <dd className="mt-1 text-base text-red-900">{request.rejectionReason}</dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Linked Purchase Order */}
            {linkedPurchaseOrder && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Linked Purchase Order</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{linkedPurchaseOrder.purchaseOrderNumber}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Status: <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(linkedPurchaseOrder.status)}`}>
                        {linkedPurchaseOrder.status?.replace(/_/g, ' ')}
                      </span>
                    </p>
                  </div>
                  <Link
                    href={`/purchase-orders/${linkedPurchaseOrder._id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View Order →
                  </Link>
                </div>
              </div>
            )}

            {/* Status Message for Converted but No PO */}
            {request.status === 'converted_to_order' && !request.linkedPurchaseOrderId && !linkedPurchaseOrder && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Purchase Order Status</h2>
                <p className="text-sm text-amber-800 mb-3">
                  This request has been marked as converted to order, but the purchase order has not been created yet. 
                  Use the "Create Purchase Order" button above to proceed.
                </p>
              </div>
            )}

            {/* Linked Material */}
            {linkedMaterial && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Linked Material Entry</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{linkedMaterial.name || linkedMaterial.materialName}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Status: <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(linkedMaterial.status)}`}>
                        {linkedMaterial.status?.replace(/_/g, ' ')}
                      </span>
                    </p>
                  </div>
                  <Link
                    href={`/items/${linkedMaterial._id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View Material →
                  </Link>
                </div>
              </div>
            )}

            {/* Audit Trail */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Activity Log</h2>
              <AuditTrail
                entityType="MATERIAL_REQUEST"
                entityId={requestId}
                projectId={request.projectId?.toString()}
              />
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div className="space-y-6">
            {/* Request Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Request Information</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Request Number</dt>
                  <dd className="mt-1 text-base text-gray-900">{request.requestNumber}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Requested By</dt>
                  <dd className="mt-1 text-base text-gray-900">{request.requestedByName || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Submitted At</dt>
                  <dd className="mt-1 text-base text-gray-900">{formatDate(request.submittedAt || request.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Created At</dt>
                  <dd className="mt-1 text-base text-gray-900">{formatDate(request.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-base text-gray-900">{formatDate(request.updatedAt)}</dd>
                </div>
              </dl>
            </div>

            {/* Project Information */}
            {request.projectId && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Project</h2>
                <Link
                  href={`/projects/${request.projectId}`}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  View Project →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <ConfirmationModal
          isOpen={showApproveModal}
          onClose={() => {
            if (!isApproving) {
              setShowApproveModal(false);
              setApprovalNotes('');
            }
          }}
          onConfirm={handleApproveConfirm}
          title="Approve Material Request"
          message="Are you sure you want to approve this material request?"
          confirmText="Approve"
          cancelText="Cancel"
          confirmColor="green"
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

        <ConfirmationModal
          isOpen={showRejectModal}
          onClose={() => {
            if (!isRejecting) {
              setShowRejectModal(false);
              setRejectionReason('');
            }
          }}
          onConfirm={handleRejectConfirm}
          title="Reject Material Request"
          message="Please provide a reason for rejecting this material request."
          confirmText="Reject"
          cancelText="Cancel"
          confirmColor="red"
          isLoading={isRejecting}
        >
          <div className="mt-4">
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Rejection Reason *</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              required
              disabled={isRejecting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Explain why this request is being rejected..."
            />
          </div>
        </ConfirmationModal>

        <ConfirmationModal
          isOpen={showConvertModal}
          onClose={() => {
            if (!isConverting) {
              setShowConvertModal(false);
            }
          }}
          onConfirm={handleConvertConfirm}
          title="Convert to Purchase Order"
          message="This will mark the request as converted and redirect you to create a purchase order. Continue?"
          confirmText="Continue"
          cancelText="Cancel"
          confirmColor="purple"
          isLoading={isConverting}
        />
      </div>
    </AppLayout>
  );
}

