/**
 * Supplier Purchase Order Detail Page
 * Displays purchase order details with supplier-specific actions
 * 
 * Route: /supplier/purchase-orders/[id]
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingCard, LoadingButton } from '@/components/loading';
import { AuditTrail } from '@/components/audit-trail';
import { ConfirmationModal } from '@/components/modals';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { ImagePreview } from '@/components/uploads/image-preview';
import { useToast } from '@/components/toast';

function SupplierPurchaseOrderDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params?.id;
  const action = searchParams.get('action');
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linkedRequest, setLinkedRequest] = useState(null);
  
  // Action states
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState(false);
  
  // Modals
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  
  // Form data
  const [acceptData, setAcceptData] = useState({ supplierNotes: '', unitCost: '' });
  const [rejectData, setRejectData] = useState({ supplierNotes: '' });
  const [modifyData, setModifyData] = useState({
    quantityOrdered: '',
    unitCost: '',
    deliveryDate: '',
    notes: '',
  });
  const [fulfillData, setFulfillData] = useState({
    deliveryNoteFileUrl: '',
    actualQuantityDelivered: '',
    supplierNotes: '',
  });

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    } else {
      setError('Invalid order ID');
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (action && order) {
      handleActionFromUrl(action);
    }
  }, [action, order]);

  useEffect(() => {
    if (order?.materialRequestId) {
      fetchMaterialRequest(order.materialRequestId);
    }
  }, [order?.materialRequestId]);

  const fetchOrder = async () => {
    if (!orderId) {
      setError('Invalid order ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/purchase-orders/${orderId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch purchase order');
      }

      // Verify this order belongs to the logged-in supplier
      const userResponse = await fetch('/api/auth/me');
      const userData = await userResponse.json();
      if (userData.success && data.data.supplierId) {
        const currentUserId = userData.data._id;
        if (data.data.supplierId.toString() !== currentUserId) {
          throw new Error('You are not authorized to view this purchase order');
        }
      }

      setOrder(data.data);
      
      // Pre-fill form data
      setAcceptData((prev) => ({ ...prev, unitCost: data.data.unitCost?.toString() || '' }));
      setModifyData({
        quantityOrdered: data.data.quantityOrdered?.toString() || '',
        unitCost: data.data.unitCost?.toString() || '',
        deliveryDate: data.data.deliveryDate ? new Date(data.data.deliveryDate).toISOString().split('T')[0] : '',
        notes: '',
      });
      setFulfillData((prev) => ({
        ...prev,
        actualQuantityDelivered: data.data.quantityOrdered?.toString() || '',
      }));
    } catch (err) {
      setError(err.message);
      console.error('Fetch purchase order error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterialRequest = async (requestId) => {
    try {
      const response = await fetch(`/api/material-requests/${requestId}`);
      const data = await response.json();
      if (data.success) {
        setLinkedRequest(data.data);
      }
    } catch (err) {
      console.error('Error fetching material request:', err);
    }
  };

  const handleActionFromUrl = (actionType) => {
    if (!order) return;
    
    switch (actionType) {
      case 'accept':
        if (order.status === 'order_sent' || order.status === 'order_modified') {
          setShowAcceptModal(true);
        }
        break;
      case 'reject':
        if (order.status === 'order_sent' || order.status === 'order_modified') {
          setShowRejectModal(true);
        }
        break;
      case 'modify':
        if (order.status === 'order_sent') {
          setShowModifyModal(true);
        }
        break;
      case 'fulfill':
        if (order.status === 'order_accepted') {
          setShowFulfillModal(true);
        }
        break;
    }
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const payload = {
        supplierNotes: acceptData.supplierNotes,
        ...(acceptData.unitCost && { unitCost: parseFloat(acceptData.unitCost) }),
      };

      const response = await fetch(`/api/purchase-orders/${orderId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to accept purchase order');
      }

      await fetchOrder();
      setShowAcceptModal(false);
      setAcceptData({ supplierNotes: '', unitCost: '' });
      toast.showSuccess('Purchase order accepted successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to accept purchase order');
      console.error('Accept purchase order error:', err);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectData.supplierNotes.trim()) {
      toast.showError('Rejection reason is required');
      return;
    }

    setIsRejecting(true);
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierNotes: rejectData.supplierNotes.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject purchase order');
      }

      await fetchOrder();
      setShowRejectModal(false);
      setRejectData({ supplierNotes: '' });
      toast.showSuccess('Purchase order rejected successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to reject purchase order');
      console.error('Reject purchase order error:', err);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleModify = async () => {
    setIsModifying(true);
    try {
      const supplierModifications = {};
      if (modifyData.quantityOrdered) supplierModifications.quantityOrdered = parseFloat(modifyData.quantityOrdered);
      if (modifyData.unitCost) supplierModifications.unitCost = parseFloat(modifyData.unitCost);
      if (modifyData.deliveryDate) supplierModifications.deliveryDate = modifyData.deliveryDate;

      const response = await fetch(`/api/purchase-orders/${orderId}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierModifications,
          supplierNotes: modifyData.notes,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to modify purchase order');
      }

      await fetchOrder();
      setShowModifyModal(false);
      setModifyData({ quantityOrdered: '', unitCost: '', deliveryDate: '', notes: '' });
      toast.showSuccess('Purchase order modification submitted successfully! PM/OWNER will review your changes.');
    } catch (err) {
      toast.showError(err.message || 'Failed to modify purchase order');
      console.error('Modify purchase order error:', err);
    } finally {
      setIsModifying(false);
    }
  };

  const handleFulfill = async () => {
    if (!fulfillData.deliveryNoteFileUrl.trim()) {
      toast.showError('Delivery note is required to fulfill an order');
      return;
    }

    setIsFulfilling(true);
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryNoteFileUrl: fulfillData.deliveryNoteFileUrl.trim(),
          actualQuantityDelivered: fulfillData.actualQuantityDelivered ? parseFloat(fulfillData.actualQuantityDelivered) : undefined,
          supplierNotes: fulfillData.supplierNotes,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fulfill purchase order');
      }

      await fetchOrder();
      setShowFulfillModal(false);
      setFulfillData({ deliveryNoteFileUrl: '', actualQuantityDelivered: '', supplierNotes: '' });
      toast.showSuccess('Purchase order fulfilled successfully! PM/OWNER will be notified to create the material entry.');
    } catch (err) {
      toast.showError(err.message || 'Failed to fulfill purchase order');
      console.error('Fulfill purchase order error:', err);
    } finally {
      setIsFulfilling(false);
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      order_sent: 'bg-blue-100 text-blue-800',
      order_accepted: 'bg-green-100 text-green-800',
      order_rejected: 'bg-red-100 text-red-800',
      order_modified: 'bg-yellow-100 text-yellow-800',
      ready_for_delivery: 'bg-purple-100 text-purple-800',
      delivered: 'bg-indigo-100 text-indigo-800',
      cancelled: 'bg-gray-100 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
    if (!amount || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
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

  if (error || !order) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error || 'Purchase order not found'}
          </div>
          <Link href="/supplier/purchase-orders" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to My Purchase Orders
          </Link>
        </div>
      </AppLayout>
    );
  }

  const canAccept = order.status === 'order_sent' || order.status === 'order_modified';
  const canReject = order.status === 'order_sent' || order.status === 'order_modified';
  const canModify = order.status === 'order_sent';
  const canFulfill = order.status === 'order_accepted';

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/supplier/purchase-orders"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to My Purchase Orders
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                  {order.purchaseOrderNumber}
                </h1>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeColor(order.status)}`}>
                  {order.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'}
                </span>
              </div>
              <p className="text-gray-600 mt-2">{order.materialName}</p>
            </div>
            <div className="flex gap-2">
              {canAccept && (
                <button
                  onClick={() => setShowAcceptModal(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                >
                  Accept Order
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                >
                  Reject Order
                </button>
              )}
              {canModify && (
                <button
                  onClick={() => setShowModifyModal(true)}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg transition"
                >
                  Propose Changes
                </button>
              )}
              {canFulfill && (
                <button
                  onClick={() => setShowFulfillModal(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
                >
                  Fulfill Order
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Details</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Material Name</dt>
                  <dd className="mt-1 text-base text-gray-900">{order.materialName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Quantity Ordered</dt>
                  <dd className="mt-1 text-base text-gray-900">
                    {order.quantityOrdered} {order.unit}
                  </dd>
                </div>
                {order.description && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-semibold text-gray-500">Description</dt>
                    <dd className="mt-1 text-base text-gray-900">{order.description}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Unit Cost</dt>
                  <dd className="mt-1 text-base text-gray-900">{formatCurrency(order.unitCost)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Total Cost</dt>
                  <dd className="mt-1 text-base font-semibold text-gray-900">{formatCurrency(order.totalCost)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Delivery Date</dt>
                  <dd className="mt-1 text-base text-gray-900">{formatDate(order.deliveryDate)}</dd>
                </div>
                {order.terms && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-semibold text-gray-500">Payment Terms</dt>
                    <dd className="mt-1 text-base text-gray-900">{order.terms}</dd>
                  </div>
                )}
                {order.notes && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-semibold text-gray-500">Notes</dt>
                    <dd className="mt-1 text-base text-gray-900">{order.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Supplier Modifications (if proposed) */}
            {order.supplierModifications && order.status === 'order_modified' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-yellow-900 mb-4">Your Proposed Modifications</h2>
                <p className="text-sm text-yellow-800 mb-4">PM/OWNER is reviewing your proposed changes. You will be notified once they respond.</p>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {order.supplierModifications.quantityOrdered !== undefined && (
                    <div>
                      <dt className="text-sm font-semibold text-gray-700">Proposed Quantity</dt>
                      <dd className="mt-1 text-base text-gray-900">
                        {order.supplierModifications.quantityOrdered} {order.unit}
                      </dd>
                    </div>
                  )}
                  {order.supplierModifications.unitCost !== undefined && (
                    <div>
                      <dt className="text-sm font-semibold text-gray-700">Proposed Unit Cost</dt>
                      <dd className="mt-1 text-base text-gray-900">
                        {formatCurrency(order.supplierModifications.unitCost)}
                      </dd>
                    </div>
                  )}
                  {order.supplierModifications.deliveryDate && (
                    <div>
                      <dt className="text-sm font-semibold text-gray-700">Proposed Delivery Date</dt>
                      <dd className="mt-1 text-base text-gray-900">
                        {formatDate(order.supplierModifications.deliveryDate)}
                      </dd>
                    </div>
                  )}
                  {order.supplierModifications.notes && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-semibold text-gray-700">Modification Notes</dt>
                      <dd className="mt-1 text-base text-gray-900">{order.supplierModifications.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Supplier Response */}
            {order.supplierResponse && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Your Response</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-semibold text-gray-500">Response</dt>
                    <dd className="mt-1 text-base text-gray-900 capitalize">{order.supplierResponse}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-500">Response Date</dt>
                    <dd className="mt-1 text-base text-gray-900">{formatDate(order.supplierResponseDate)}</dd>
                  </div>
                  {order.supplierNotes && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-semibold text-gray-500">Your Notes</dt>
                      <dd className="mt-1 text-base text-gray-900">{order.supplierNotes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Delivery Note */}
            {order.deliveryNoteFileUrl && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Delivery Note</h2>
                <ImagePreview imageUrl={order.deliveryNoteFileUrl} alt="Delivery Note" />
              </div>
            )}

            {/* Linked Material Request */}
            {linkedRequest && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Original Material Request</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{linkedRequest.requestNumber}</p>
                    <p className="text-sm text-gray-600 mt-1">{linkedRequest.materialName}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Audit Trail */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order History</h2>
              <AuditTrail
                entityType="PURCHASE_ORDER"
                entityId={orderId}
                projectId={order.projectId?.toString()}
              />
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div className="space-y-6">
            {/* Order Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Information</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Order Number</dt>
                  <dd className="mt-1 text-base text-gray-900">{order.purchaseOrderNumber}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Created By</dt>
                  <dd className="mt-1 text-base text-gray-900">{order.createdByName || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Sent At</dt>
                  <dd className="mt-1 text-base text-gray-900">{formatDate(order.sentAt || order.createdAt)}</dd>
                </div>
                {order.committedAt && (
                  <div>
                    <dt className="text-sm font-semibold text-gray-500">Accepted At</dt>
                    <dd className="mt-1 text-base text-gray-900">{formatDate(order.committedAt)}</dd>
                  </div>
                )}
                {order.fulfilledAt && (
                  <div>
                    <dt className="text-sm font-semibold text-gray-500">Fulfilled At</dt>
                    <dd className="mt-1 text-base text-gray-900">{formatDate(order.fulfilledAt)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-semibold text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-base text-gray-900">{formatDate(order.updatedAt)}</dd>
                </div>
              </dl>
            </div>

            {/* Action Guide */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-md font-semibold text-blue-900 mb-2">📋 What to Do</h3>
              <ul className="text-sm text-blue-800 space-y-2">
                {order.status === 'order_sent' && (
                  <>
                    <li>• <strong>Accept:</strong> Confirm you can fulfill this order</li>
                    <li>• <strong>Reject:</strong> Decline if you cannot fulfill</li>
                    <li>• <strong>Modify:</strong> Propose changes to quantity, price, or delivery date</li>
                  </>
                )}
                {order.status === 'order_modified' && (
                  <>
                    <li>• <strong>Accept:</strong> Confirm the modified order</li>
                    <li>• <strong>Reject:</strong> Decline the modified order</li>
                  </>
                )}
                {order.status === 'order_accepted' && (
                  <>
                    <li>• <strong>Fulfill:</strong> Upload delivery note when ready to deliver</li>
                    <li>• Once fulfilled, PM/OWNER will create the material entry</li>
                  </>
                )}
                {order.status === 'ready_for_delivery' && (
                  <>
                    <li>• Order fulfilled! Waiting for PM/OWNER to create material entry</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Modals */}
        {/* Accept Modal */}
        <ConfirmationModal
          isOpen={showAcceptModal}
          onClose={() => {
            setShowAcceptModal(false);
            setAcceptData({ supplierNotes: '', unitCost: order.unitCost?.toString() || '' });
          }}
          onConfirm={handleAccept}
          title="Accept Purchase Order"
          message="Confirm that you accept this purchase order. You can adjust the final unit cost if needed."
          confirmText="Accept Order"
          cancelText="Cancel"
          confirmColor="green"
        >
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Final Unit Cost (Optional)</label>
              <input
                type="number"
                value={acceptData.unitCost}
                onChange={(e) => setAcceptData((prev) => ({ ...prev, unitCost: e.target.value }))}
                min="0"
                step="0.01"
                placeholder={order.unitCost?.toString() || '0.00'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <p className="text-sm text-gray-600 mt-1">Leave empty to use original unit cost</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Your Notes (Optional)</label>
              <textarea
                value={acceptData.supplierNotes}
                onChange={(e) => setAcceptData((prev) => ({ ...prev, supplierNotes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Add any notes about this acceptance..."
              />
            </div>
          </div>
        </ConfirmationModal>

        {/* Reject Modal */}
        <ConfirmationModal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setRejectData({ supplierNotes: '' });
          }}
          onConfirm={handleReject}
          title="Reject Purchase Order"
          message="Please provide a reason for rejecting this purchase order."
          confirmText="Reject Order"
          cancelText="Cancel"
          confirmColor="red"
        >
          <div className="mt-4">
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Rejection Reason *</label>
            <textarea
              value={rejectData.supplierNotes}
              onChange={(e) => setRejectData((prev) => ({ ...prev, supplierNotes: e.target.value }))}
              rows={3}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Explain why you are rejecting this order..."
            />
          </div>
        </ConfirmationModal>

        {/* Modify Modal */}
        <ConfirmationModal
          isOpen={showModifyModal}
          onClose={() => {
            setShowModifyModal(false);
            setModifyData({
              quantityOrdered: order.quantityOrdered?.toString() || '',
              unitCost: order.unitCost?.toString() || '',
              deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : '',
              notes: '',
            });
          }}
          onConfirm={handleModify}
          title="Propose Modifications"
          message="Propose changes to this purchase order. PM/OWNER will review and approve or reject your modifications."
          confirmText="Submit Modifications"
          cancelText="Cancel"
          confirmColor="yellow"
        >
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Proposed Quantity</label>
                <input
                  type="number"
                  value={modifyData.quantityOrdered}
                  onChange={(e) => setModifyData((prev) => ({ ...prev, quantityOrdered: e.target.value }))}
                  min="0.01"
                  step="0.01"
                  placeholder={order.quantityOrdered?.toString() || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Proposed Unit Cost</label>
                <input
                  type="number"
                  value={modifyData.unitCost}
                  onChange={(e) => setModifyData((prev) => ({ ...prev, unitCost: e.target.value }))}
                  min="0"
                  step="0.01"
                  placeholder={order.unitCost?.toString() || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Proposed Delivery Date</label>
              <input
                type="date"
                value={modifyData.deliveryDate}
                onChange={(e) => setModifyData((prev) => ({ ...prev, deliveryDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Modification Notes</label>
              <textarea
                value={modifyData.notes}
                onChange={(e) => setModifyData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                placeholder="Explain the proposed changes..."
              />
            </div>
          </div>
        </ConfirmationModal>

        {/* Fulfill Modal */}
        <ConfirmationModal
          isOpen={showFulfillModal}
          onClose={() => {
            setShowFulfillModal(false);
            setFulfillData({ deliveryNoteFileUrl: '', actualQuantityDelivered: order.quantityOrdered?.toString() || '', supplierNotes: '' });
          }}
          onConfirm={handleFulfill}
          title="Fulfill Purchase Order"
          message="Upload delivery note and confirm fulfillment. This will mark the order as ready for material entry."
          confirmText="Fulfill Order"
          cancelText="Cancel"
          confirmColor="purple"
        >
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Delivery Note *</label>
              <CloudinaryUploadWidget
                onUploadComplete={(url) => setFulfillData((prev) => ({ ...prev, deliveryNoteFileUrl: url }))}
                folder="purchase-orders/delivery-notes"
              />
              {fulfillData.deliveryNoteFileUrl && (
                <div className="mt-2">
                  <ImagePreview imageUrl={fulfillData.deliveryNoteFileUrl} alt="Delivery Note" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Actual Quantity Delivered (Optional)</label>
              <input
                type="number"
                value={fulfillData.actualQuantityDelivered}
                onChange={(e) => setFulfillData((prev) => ({ ...prev, actualQuantityDelivered: e.target.value }))}
                min="0.01"
                step="0.01"
                placeholder={order.quantityOrdered?.toString() || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-sm text-gray-600 mt-1">Leave empty to use ordered quantity</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Your Notes (Optional)</label>
              <textarea
                value={fulfillData.supplierNotes}
                onChange={(e) => setFulfillData((prev) => ({ ...prev, supplierNotes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Add any notes about the delivery..."
              />
            </div>
          </div>
        </ConfirmationModal>
      </div>
    </AppLayout>
  );
}

export default function SupplierPurchaseOrderDetailPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingCard />
        </div>
      </AppLayout>
    }>
      <SupplierPurchaseOrderDetailPageContent />
    </Suspense>
  );
}

