/**
 * Material/Item Detail Page
 * Displays full material details with approval history and activity log
 * 
 * Route: /items/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { ImagePreview } from '@/components/uploads/image-preview';
import { LoadingButton, LoadingCard, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { AuditTrail } from '@/components/audit-trail';
import { checkMaterialDiscrepanciesClient } from '@/lib/discrepancy-calculations-client';
import { ConfirmationModal, RestoreModal } from '@/components/modals';
import { ArchiveBadge } from '@/components/badges';
import { useToast } from '@/components/toast';

export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const materialId = params?.id;
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isVerifyingReceipt, setIsVerifyingReceipt] = useState(false);
  const [validatingCapital, setValidatingCapital] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showVerifyReceiptModal, setShowVerifyReceiptModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [verifyReceiptData, setVerifyReceiptData] = useState({
    actualQuantityReceived: '',
    notes: '',
  });
  const [quantityUpdateForm, setQuantityUpdateForm] = useState({
    quantityDelivered: '',
    quantityUsed: '',
    dateDelivered: '',
    dateUsed: '',
  });
  const [updatingQuantity, setUpdatingQuantity] = useState(false);
  const [discrepancyRecord, setDiscrepancyRecord] = useState(null);
  const [loadingDiscrepancy, setLoadingDiscrepancy] = useState(false);
  const [projectThresholds, setProjectThresholds] = useState(null);

  useEffect(() => {
    if (materialId) {
      fetchMaterial();
      fetchUser();
    } else {
      setError('Invalid material ID');
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    if (material && material._id) {
      fetchDiscrepancyRecord();
      if (material.projectId) {
        fetchProjectThresholds();
      }
    }
  }, [material?._id, material?.projectId]);

  const fetchMaterial = async () => {
    if (!materialId) {
      setError('Invalid material ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/materials/${materialId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch material');
      }

      setMaterial(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch material error:', err);
    } finally {
      setLoading(false);
    }
  };

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
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  const fetchDiscrepancyRecord = async () => {
    if (!material?._id) return;
    setLoadingDiscrepancy(true);
    try {
      const response = await fetch(`/api/discrepancies/${material._id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success && data.data.discrepancy) {
        setDiscrepancyRecord(data.data.discrepancy);
      } else {
        setDiscrepancyRecord(null);
      }
    } catch (err) {
      console.error('Error fetching discrepancy record:', err);
      setDiscrepancyRecord(null);
    } finally {
      setLoadingDiscrepancy(false);
    }
  };

  const fetchProjectThresholds = async () => {
    if (!material?.projectId) return;
    try {
      const response = await fetch(`/api/projects/${material.projectId}/thresholds`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProjectThresholds(data.data);
      }
    } catch (err) {
      console.error('Error fetching project thresholds:', err);
    }
  };

  const handleApproveClick = () => {
    setShowApproveModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsApproving(true);
    setValidatingCapital(true);
    
    try {
      const response = await fetch(`/api/materials/${materialId}/approve`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        body: JSON.stringify({ approvalNotes: approvalNotes || 'Approved via UI' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve material');
      }

      // Capital validation complete
      setValidatingCapital(false);

      // Refresh material data
      fetchMaterial();
      setShowApproveModal(false);
      toast.showSuccess('Material approved successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Approve error:', err);
    } finally {
      setIsApproving(false);
      setValidatingCapital(false);
    }
  };

  const handleRejectClick = () => {
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }

    setIsRejecting(true);

    try {
      const response = await fetch(`/api/materials/${materialId}/reject`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        body: JSON.stringify({ reason: rejectReason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject material');
      }

      // Refresh material data
      fetchMaterial();
      setShowRejectModal(false);
      setRejectReason('');
      toast.showSuccess('Material rejected successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Reject error:', err);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleVerifyReceiptClick = () => {
    // Pre-fill with current delivered quantity if available
    setVerifyReceiptData({
      actualQuantityReceived: material.quantityDelivered?.toString() || material.quantityPurchased?.toString() || '',
      notes: '',
    });
    setShowVerifyReceiptModal(true);
  };

  const handleVerifyReceiptConfirm = async () => {
    setIsVerifyingReceipt(true);
    try {
      const response = await fetch(`/api/materials/${materialId}/verify-receipt`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          actualQuantityReceived: verifyReceiptData.actualQuantityReceived ? parseFloat(verifyReceiptData.actualQuantityReceived) : undefined,
          notes: verifyReceiptData.notes?.trim() || '',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to verify receipt');
      }

      // Refresh material data
      fetchMaterial();
      setShowVerifyReceiptModal(false);
      setVerifyReceiptData({ actualQuantityReceived: '', notes: '' });
      toast.showSuccess('Material receipt verified successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Verify receipt error:', err);
    } finally {
      setIsVerifyingReceipt(false);
    }
  };

  const handleSubmitClick = () => {
    setShowSubmitModal(true);
  };

  const handleSubmitConfirm = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/materials/${materialId}/submit`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to submit material');
      }

      // Refresh material data
      fetchMaterial();
      setShowSubmitModal(false);
      toast.showSuccess('Material submitted for approval successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleArchiveConfirm = async () => {
    if (!materialId) {
      toast.showError('Invalid material ID');
      return;
    }

    setIsArchiving(true);
    try {
      const response = await fetch(`/api/materials/${materialId}/archive`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to archive material');
      }

      toast.showSuccess(data.message || 'Material archived successfully!');
      setShowDeleteModal(false);
      // Refresh material data
      fetchMaterial();
    } catch (err) {
      toast.showError(err.message || 'Failed to archive material');
      console.error('Archive material error:', err);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestoreClick = () => {
    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = async () => {
    if (!materialId) {
      toast.showError('Invalid material ID');
      return;
    }

    setIsRestoring(true);
    try {
      const response = await fetch(`/api/materials/${materialId}/restore`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to restore material');
      }

      toast.showSuccess(data.message || 'Material restored successfully!');
      setShowRestoreModal(false);
      // Refresh material data
      fetchMaterial();
    } catch (err) {
      toast.showError(err.message || 'Failed to restore material');
      console.error('Restore material error:', err);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/materials/${materialId}?force=true`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete material');
      }

      toast.showSuccess(data.message || 'Material permanently deleted successfully!');
      setShowDeleteModal(false);
      // Redirect to materials list
      setTimeout(() => {
        router.push('/items');
      }, 500);
    } catch (err) {
      toast.showError(err.message || 'Failed to delete material');
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleQuantityUpdate = async (type) => {
    setUpdatingQuantity(true);
    try {
      const updateData = {};
      
      if (type === 'delivery') {
        if (!quantityUpdateForm.quantityDelivered || parseFloat(quantityUpdateForm.quantityDelivered) <= 0) {
          toast.showError('Please enter a valid delivered quantity');
          setUpdatingQuantity(false);
          return;
        }
        updateData.quantityDelivered = parseFloat(quantityUpdateForm.quantityDelivered);
        if (quantityUpdateForm.dateDelivered) {
          updateData.dateDelivered = quantityUpdateForm.dateDelivered;
        }
      } else if (type === 'usage') {
        if (!quantityUpdateForm.quantityUsed || parseFloat(quantityUpdateForm.quantityUsed) < 0) {
          toast.showError('Please enter a valid used quantity');
          setUpdatingQuantity(false);
          return;
        }
        updateData.quantityUsed = parseFloat(quantityUpdateForm.quantityUsed);
        if (quantityUpdateForm.dateUsed) {
          updateData.dateUsed = quantityUpdateForm.dateUsed;
        }
      }

      // Validate quantities
      const purchased = material.quantityPurchased || material.quantity || 0;
      const delivered = type === 'delivery' 
        ? updateData.quantityDelivered 
        : (material.quantityDelivered || 0);
      const used = type === 'usage' 
        ? updateData.quantityUsed 
        : (material.quantityUsed || 0);

      if (delivered > purchased) {
        toast.showError(`Delivered quantity (${delivered}) cannot exceed purchased quantity (${purchased})`);
        setUpdatingQuantity(false);
        return;
      }

      if (used > delivered) {
        toast.showError(`Used quantity (${used}) cannot exceed delivered quantity (${delivered})`);
        setUpdatingQuantity(false);
        return;
      }

      const response = await fetch(`/api/materials/${materialId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update quantity');
      }

      // Refresh material data
      fetchMaterial();
      // Reset form
      setQuantityUpdateForm({
        quantityDelivered: '',
        quantityUsed: '',
        dateDelivered: '',
        dateUsed: '',
      });
      toast.showSuccess(`${type === 'delivery' ? 'Delivery' : 'Usage'} updated successfully!`);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Update quantity error:', err);
    } finally {
      setUpdatingQuantity(false);
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      received: 'bg-purple-100 text-purple-800',
      archived: 'bg-gray-100 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const canApprove = user && canAccess('approve_material');
  const canEdit = material && material.status === 'draft' && canAccess('edit_material');
  const canSubmit = material && (material.status === 'draft' || material.status === 'rejected') && canAccess('create_material');
  const canDelete = user && canAccess('delete_material');
  // CLERK/SUPERVISOR can verify receipt for approved or pending_receipt materials
  const userRole = user?.role?.toLowerCase();
  const canVerifyReceipt = user && (userRole === 'clerk' || userRole === 'site_clerk' || userRole === 'supervisor') && 
    material && (material.status === 'approved' || material.status === 'pending_receipt') && material.status !== 'received';

  // Calculate discrepancy data
  const discrepancy = material ? checkMaterialDiscrepanciesClient(material) : null;
  const hasDiscrepancyIssues = discrepancy && discrepancy.alerts.hasAnyAlert;
  
  const getSeverityColor = (severity) => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800 border-red-300',
      HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      LOW: 'bg-blue-100 text-blue-800 border-blue-300',
      NONE: 'bg-gray-100 text-gray-600 border-gray-300',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <LoadingOverlay 
          isLoading={isDeleting || isArchiving || isRestoring || updatingQuantity} 
          message={
            isDeleting ? "Deleting material..." :
            isArchiving ? "Archiving material..." :
            isRestoring ? "Restoring material..." :
            updatingQuantity ? "Updating quantities..." :
            "Processing..."
          } 
          fullScreen={false} 
        />
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-48"></div>
            </div>
            <LoadingCard count={2} showHeader={true} lines={6} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !material) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/items" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Materials
          </Link>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || 'Material not found'}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Loading Overlay for Actions */}
        <LoadingOverlay 
          isLoading={isDeleting || isArchiving || isRestoring || updatingQuantity || isVerifyingReceipt || isSubmitting || isApproving} 
          message={
            isDeleting ? "Deleting material..." :
            isArchiving ? "Archiving material..." :
            isRestoring ? "Restoring material..." :
            updatingQuantity ? "Updating quantities..." :
            isVerifyingReceipt ? "Verifying receipt and updating finances..." :
            isSubmitting ? "Submitting material for approval..." :
            isApproving ? (validatingCapital ? "Validating capital availability..." : "Approving material and updating finances...") :
            "Processing..."
          } 
          fullScreen={false} 
        />
        {/* Header */}
        <div className="mb-6">
          <Link href="/items" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Materials
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                  {material.name || material.materialName}
                </h1>
                {material.deletedAt && <ArchiveBadge />}
              </div>
              <div className="mt-2 flex items-center gap-4 flex-wrap">
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeColor(
                    material.status
                  )}`}
                >
                  {material.status?.replace('_', ' ').toUpperCase() || 'DRAFT'}
                </span>
                {material.entryType && (
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    material.entryType === 'new_procurement'
                      ? 'bg-blue-100 text-blue-800'
                      : material.entryType === 'retroactive_entry'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {material.entryType === 'new_procurement'
                      ? 'New Procurement'
                      : material.entryType === 'retroactive_entry'
                      ? 'Retroactive Entry'
                      : 'Legacy'}
                  </span>
                )}
                {material.category && (
                  <span className="text-sm text-gray-600">Category: {material.category}</span>
                )}
                {/* Show links to purchase order or material request */}
                <div className="flex gap-2">
                  {material.purchaseOrderId && (
                    <Link
                      href={`/purchase-orders/${material.purchaseOrderId}`}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      📦 View Purchase Order
                    </Link>
                  )}
                  {material.materialRequestId && (
                    <Link
                      href={`/material-requests/${material.materialRequestId}`}
                      className="text-sm text-green-600 hover:text-green-800 font-medium"
                    >
                      📋 View Material Request
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <Link
                  href={`/items/${materialId}/edit`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Edit
                </Link>
              )}
              {canSubmit && (
                <LoadingButton
                  onClick={handleSubmitClick}
                  isLoading={isApproving}
                  loadingText="Submitting..."
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Submit for Approval
                </LoadingButton>
              )}
              {canApprove && material.status === 'pending_approval' && (
                <>
                  <LoadingButton
                    onClick={handleApproveClick}
                    isLoading={isApproving}
                    loadingText="Processing..."
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </LoadingButton>
                  <LoadingButton
                    onClick={handleRejectClick}
                    isLoading={isApproving}
                    loadingText="Processing..."
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </LoadingButton>
                </>
              )}
              {canVerifyReceipt && (
                <LoadingButton
                  onClick={handleVerifyReceiptClick}
                  isLoading={isVerifyingReceipt}
                  loadingText="Verifying..."
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Verify Receipt
                </LoadingButton>
              )}
              {canDelete && !material.deletedAt && (
                <>
                  <button
                    onClick={handleArchiveClick}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    Archive
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    Delete
                  </button>
                </>
              )}
              {canDelete && material.deletedAt && (
                <>
                  <button
                    onClick={handleRestoreClick}
                    disabled={isRestoring}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {isRestoring ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Material Lifecycle Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl md:text-2xl font-semibold mb-4 leading-tight">Material Lifecycle</h2>
          <div className="flex items-center justify-between overflow-x-auto pb-4">
            {[
              { status: 'draft', label: 'Draft', color: 'bg-gray-200', textColor: 'text-gray-700' },
              { status: 'submitted', label: 'Submitted', color: 'bg-blue-200', textColor: 'text-blue-700' },
              { status: 'pending_approval', label: 'Pending Approval', color: 'bg-yellow-200', textColor: 'text-yellow-700' },
              { status: 'approved', label: 'Approved', color: 'bg-green-200', textColor: 'text-green-700' },
              { status: 'received', label: 'Received', color: 'bg-purple-200', textColor: 'text-purple-700' },
            ].map((stage, index, array) => {
              const currentStatus = material.status || 'draft';
              const isActive = stage.status === currentStatus;
              const statusOrder = ['draft', 'submitted', 'pending_approval', 'approved', 'received'];
              const currentIndex = statusOrder.indexOf(currentStatus);
              const stageIndex = statusOrder.indexOf(stage.status);
              const isCompleted = currentIndex > stageIndex;
              const isRejected = currentStatus === 'rejected';
              
              return (
                <div key={stage.status} className="flex items-center flex-1 min-w-[120px]">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                        isActive
                          ? `${stage.color} ${stage.textColor} ring-4 ring-blue-300 scale-110`
                          : isCompleted
                          ? `${stage.color} ${stage.textColor}`
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <span className={`text-sm mt-2 text-center leading-normal ${isActive ? 'font-semibold text-gray-700' : 'text-gray-600'}`}>
                      {stage.label}
                    </span>
                  </div>
                  {index < array.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 transition-all ${
                        isCompleted ? 'bg-green-400' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {material.status === 'rejected' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">
                <strong>Status:</strong> REJECTED
              </p>
              {material.approvalNotes && (
                <p className="text-xs text-red-600 mt-1">
                  Reason: {material.approvalNotes}
                </p>
              )}
              <p className="text-xs text-red-600 mt-1">
                Next step: Review rejection reason and resubmit if needed
              </p>
            </div>
          )}
          {material.status !== 'rejected' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Current Status:</strong> {material.status?.replace('_', ' ').toUpperCase() || 'DRAFT'}
              </p>
              {material.status === 'draft' && (
                <p className="text-sm text-blue-600 mt-1 leading-normal">
                  Next step: Submit for approval
                </p>
              )}
              {material.status === 'pending_approval' && (
                <p className="text-sm text-blue-600 mt-1 leading-normal">
                  Next step: Awaiting PM/OWNER approval
                </p>
              )}
              {material.status === 'approved' && (
                <p className="text-sm text-blue-600 mt-1 leading-normal">
                  Next step: Mark as delivered when materials arrive
                </p>
              )}
              {material.status === 'received' && (
                <p className="text-sm text-blue-600 mt-1 leading-normal">
                  Next step: Track usage as materials are used
                </p>
              )}
            </div>
          )}
        </div>

        {/* Discrepancy Summary Card - Hidden for Clerk */}
        {material && material.quantityDelivered > 0 && discrepancy && 
          userRole !== 'clerk' && userRole !== 'site_clerk' && (
          <div className={`bg-white rounded-lg shadow mb-6 border-2 ${hasDiscrepancyIssues ? getSeverityColor(discrepancy.severity) : 'border-gray-200'}`}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Discrepancy Analysis</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Material variance, loss, and wastage tracking
                  </p>
                </div>
                {hasDiscrepancyIssues && (
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getSeverityColor(discrepancy.severity)}`}>
                    {discrepancy.severity} SEVERITY
                  </span>
                )}
                {material.projectId && (
                  <Link
                    href={`/dashboard/analytics/wastage?projectId=${material.projectId}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    View Full Analytics →
                  </Link>
                )}
              </div>

              {hasDiscrepancyIssues ? (
                <div className="space-y-4">
                  {/* Alert Indicators */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {discrepancy.alerts.variance && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">⚠️</span>
                          <span className="font-semibold text-yellow-900">Variance Alert</span>
                        </div>
                        <p className="text-sm text-yellow-800">
                          {discrepancy.metrics.variance.toFixed(2)} units ({discrepancy.metrics.variancePercentage.toFixed(2)}%)
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Cost Impact: {formatCurrency(discrepancy.metrics.varianceCost)}
                        </p>
                      </div>
                    )}
                    {discrepancy.alerts.loss && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">⚠️</span>
                          <span className="font-semibold text-orange-900">Loss Alert</span>
                        </div>
                        <p className="text-sm text-orange-800">
                          {discrepancy.metrics.loss.toFixed(2)} units ({discrepancy.metrics.lossPercentage.toFixed(2)}%)
                        </p>
                        <p className="text-xs text-orange-700 mt-1">
                          Cost Impact: {formatCurrency(discrepancy.metrics.lossCost)}
                        </p>
                      </div>
                    )}
                    {discrepancy.alerts.wastage && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">⚠️</span>
                          <span className="font-semibold text-red-900">Wastage Alert</span>
                        </div>
                        <p className="text-sm text-red-800">
                          {discrepancy.metrics.wastage.toFixed(2)}% wastage
                        </p>
                        <p className="text-xs text-red-700 mt-1">
                          Exceeds acceptable threshold
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Total Impact */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Total Discrepancy Cost:</span>
                      <span className="text-2xl font-bold text-red-600">
                        {formatCurrency(discrepancy.metrics.totalDiscrepancyCost)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Combined financial impact of variance and loss
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✅</span>
                    <div>
                      <p className="font-semibold text-green-900">No Discrepancies Detected</p>
                      <p className="text-sm text-green-700 mt-1">
                        Material quantities are within acceptable thresholds
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Detailed Metrics */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-base font-semibold text-gray-700 mb-3 leading-normal">Detailed Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <dt className="text-sm font-semibold text-gray-700 leading-normal">Variance</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">
                      {discrepancy.metrics.variance.toFixed(2)} units
                    </dd>
                    <dd className="text-sm text-gray-600 leading-normal">
                      {discrepancy.metrics.variancePercentage.toFixed(2)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-700 leading-normal">Loss</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">
                      {discrepancy.metrics.loss.toFixed(2)} units
                    </dd>
                    <dd className="text-sm text-gray-600 leading-normal">
                      {discrepancy.metrics.lossPercentage.toFixed(2)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-700 leading-normal">Wastage</dt>
                    <dd className="mt-1 text-sm font-semibold text-gray-900">
                      {discrepancy.metrics.wastage.toFixed(2)}%
                    </dd>
                    <dd className="text-sm text-gray-600 leading-normal">of purchased</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-700 leading-normal">Total Cost</dt>
                    <dd className="mt-1 text-sm font-semibold text-red-600">
                      {formatCurrency(discrepancy.metrics.totalDiscrepancyCost)}
                    </dd>
                    <dd className="text-sm text-gray-600 leading-normal">impact</dd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {['overview', 'discrepancy', 'approval', 'activity']
              .filter(tab => {
                // Hide discrepancy tab for clerk
                if (tab === 'discrepancy' && (userRole === 'clerk' || userRole === 'site_clerk')) {
                  return false;
                }
                return true;
              })
              .map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Quantity Tracking Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg md:text-xl font-semibold mb-4 text-blue-900 leading-tight">Quantity Tracking</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-blue-700">Purchased</dt>
                      <dd className="mt-1 text-lg font-bold text-blue-900">
                        {material.quantityPurchased || material.quantity || 0} {material.unit || ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-blue-700">Delivered</dt>
                      <dd className="mt-1 text-lg font-bold text-blue-900">
                        {material.quantityDelivered || 0} {material.unit || ''}
                      </dd>
                      {material.dateDelivered && (
                        <dd className="text-xs text-blue-600 mt-1">
                          {new Date(material.dateDelivered).toLocaleDateString()}
                        </dd>
                      )}
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-blue-700">Used</dt>
                      <dd className="mt-1 text-lg font-bold text-blue-900">
                        {material.quantityUsed || 0} {material.unit || ''}
                      </dd>
                      {material.dateUsed && (
                        <dd className="text-xs text-blue-600 mt-1">
                          {new Date(material.dateUsed).toLocaleDateString()}
                        </dd>
                      )}
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-blue-700">Remaining</dt>
                      <dd className="mt-1 text-lg font-bold text-blue-900">
                        {material.quantityRemaining || 0} {material.unit || ''}
                      </dd>
                      {material.wastage > 0 && (
                        <dd className="text-xs text-red-600 mt-1">
                          Wastage: {material.wastage?.toFixed(1)}%
                        </dd>
                      )}
                    </div>
                  </div>
                  
                  {/* Wastage Metrics Breakdown */}
                  {(material.quantityDelivered > 0 || material.quantityUsed > 0) && (
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <h4 className="text-sm font-semibold text-blue-900 mb-3">Wastage Analysis</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        {(() => {
                          const purchased = material.quantityPurchased || material.quantity || 0;
                          const delivered = material.quantityDelivered || 0;
                          const used = material.quantityUsed || 0;
                          const variance = Math.max(0, purchased - delivered);
                          const loss = Math.max(0, delivered - used);
                          const variancePercentage = purchased > 0 ? ((variance / purchased) * 100).toFixed(1) : 0;
                          const lossPercentage = delivered > 0 ? ((loss / delivered) * 100).toFixed(1) : 0;
                          
                          return (
                            <>
                              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-yellow-800">Variance</span>
                                  <span 
                                    className="text-xs text-yellow-600 cursor-help" 
                                    title="Difference between purchased and delivered quantities. Indicates potential supplier issues or theft."
                                  >
                                    ℹ️
                                  </span>
                                </div>
                                <div className="text-lg font-bold text-yellow-900">
                                  {variance} {material.unit || ''}
                                </div>
                                <div className="text-xs text-yellow-700">
                                  {variancePercentage}% of purchased
                                </div>
                              </div>
                              <div className="bg-orange-50 border border-orange-200 rounded p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-orange-800">Loss</span>
                                  <span 
                                    className="text-xs text-orange-600 cursor-help" 
                                    title="Difference between delivered and used quantities. Indicates wastage, damage, or theft at site."
                                  >
                                    ℹ️
                                  </span>
                                </div>
                                <div className="text-lg font-bold text-orange-900">
                                  {loss} {material.unit || ''}
                                </div>
                                <div className="text-xs text-orange-700">
                                  {lossPercentage}% of delivered
                                </div>
                              </div>
                              <div className="bg-red-50 border border-red-200 rounded p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-red-800">Total Wastage</span>
                                  <span 
                                    className="text-xs text-red-600 cursor-help" 
                                    title="Total unaccounted materials (variance + loss). Represents total materials that are unaccounted for."
                                  >
                                    ℹ️
                                  </span>
                                </div>
                                <div className="text-lg font-bold text-red-900">
                                  {variance + loss} {material.unit || ''}
                                </div>
                                <div className="text-xs text-red-700">
                                  {material.wastage?.toFixed(1) || 0}% of purchased
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg md:text-xl font-semibold leading-tight">Material Details</h3>
                      {/* Workflow Information Section */}
                      {(material.entryType === 'retroactive_entry' || material.purchaseOrderId || material.materialRequestId || material.retroactiveNotes || material.costStatus || material.documentationStatus) && (
                        <div className="text-sm text-gray-600">
                          {material.entryType === 'retroactive_entry' && '📝 Retroactive Entry'}
                        </div>
                      )}
                    </div>

                    {/* Workflow Information Card */}
                    {(material.entryType === 'retroactive_entry' || material.purchaseOrderId || material.materialRequestId) && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <h4 className="text-base font-semibold text-blue-900 mb-3">Workflow Information</h4>
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {material.entryType && (
                            <div>
                              <dt className="text-sm font-semibold text-gray-700">Entry Type</dt>
                              <dd className="mt-1">
                                <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                                  material.entryType === 'new_procurement'
                                    ? 'bg-blue-100 text-blue-800'
                                    : material.entryType === 'retroactive_entry'
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {material.entryType === 'new_procurement'
                                    ? 'New Procurement'
                                    : material.entryType === 'retroactive_entry'
                                    ? 'Retroactive Entry'
                                    : 'Legacy'}
                                </span>
                              </dd>
                            </div>
                          )}
                          {material.purchaseOrderId && (
                            <div>
                              <dt className="text-sm font-semibold text-gray-700">Purchase Order</dt>
                              <dd className="mt-1">
                                <Link
                                  href={`/purchase-orders/${material.purchaseOrderId}`}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  View Purchase Order →
                                </Link>
                              </dd>
                            </div>
                          )}
                          {material.materialRequestId && (
                            <div>
                              <dt className="text-sm font-semibold text-gray-700">Material Request</dt>
                              <dd className="mt-1">
                                <Link
                                  href={`/material-requests/${material.materialRequestId}`}
                                  className="text-green-600 hover:text-green-800 font-medium"
                                >
                                  View Material Request →
                                </Link>
                              </dd>
                            </div>
                          )}
                          {material.entryType === 'retroactive_entry' && material.costStatus && (
                            <div>
                              <dt className="text-sm font-semibold text-gray-700">Cost Status</dt>
                              <dd className="mt-1">
                                <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                                  material.costStatus === 'actual'
                                    ? 'bg-green-100 text-green-800'
                                    : material.costStatus === 'estimated'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {material.costStatus.charAt(0).toUpperCase() + material.costStatus.slice(1)}
                                </span>
                              </dd>
                            </div>
                          )}
                          {material.entryType === 'retroactive_entry' && material.documentationStatus && (
                            <div>
                              <dt className="text-sm font-semibold text-gray-700">Documentation Status</dt>
                              <dd className="mt-1">
                                <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                                  material.documentationStatus === 'complete'
                                    ? 'bg-green-100 text-green-800'
                                    : material.documentationStatus === 'partial'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {material.documentationStatus.charAt(0).toUpperCase() + material.documentationStatus.slice(1)}
                                </span>
                              </dd>
                            </div>
                          )}
                          {material.entryType === 'retroactive_entry' && material.originalPurchaseDate && (
                            <div>
                              <dt className="text-sm font-semibold text-gray-700">Original Purchase Date</dt>
                              <dd className="mt-1 text-sm text-gray-900">
                                {new Date(material.originalPurchaseDate).toLocaleDateString('en-KE', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </dd>
                            </div>
                          )}
                        </dl>
                        {material.entryType === 'retroactive_entry' && material.retroactiveNotes && (
                          <div className="mt-4 pt-4 border-t border-blue-200">
                            <dt className="text-sm font-semibold text-gray-700 mb-2">Retroactive Notes</dt>
                            <dd className="text-sm text-gray-900 bg-white p-3 rounded border border-blue-100">
                              {material.retroactiveNotes}
                            </dd>
                          </div>
                        )}
                      </div>
                    )}

                    <h3 className="text-lg md:text-xl font-semibold mb-4 leading-tight">Material Details</h3>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Description</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {material.description || 'No description'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Quantity Purchased</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {material.quantityPurchased || material.quantity || 0} {material.unit || ''}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Category</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {material.categoryDetails?.name || material.category || 'N/A'}
                          {material.categoryDetails && (
                            <span className="text-sm text-gray-600 ml-2 leading-normal">
                              ({material.categoryDetails.description || 'No description'})
                            </span>
                          )}
                        </dd>
                      </div>
                      {material.projectDetails && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Project</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            <Link
                              href={`/projects/${material.projectId}`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {material.projectDetails.projectName || material.projectDetails.projectCode || 'View Project'}
                            </Link>
                          </dd>
                        </div>
                      )}
                      {material.floorDetails && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Floor</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            <Link
                              href={`/floors/${material.floor}`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {(() => {
                                const floor = material.floorDetails;
                                if (!floor) return 'N/A';
                                if (floor.name) return floor.name;
                                const floorNumber = floor.floorNumber;
                                if (floorNumber === undefined || floorNumber === null) return 'N/A';
                                if (floorNumber < 0) return `Basement ${Math.abs(floorNumber)}`;
                                if (floorNumber === 0) return 'Ground Floor';
                                return `Floor ${floorNumber}`;
                              })()}
                            </Link>
                          </dd>
                        </div>
                      )}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Unit Cost</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        KES {material.unitCost?.toLocaleString() || '0.00'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Total Cost</dt>
                      <dd className="mt-1 text-lg font-bold text-gray-900">
                        KES {material.totalCost?.toLocaleString() || '0.00'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Supplier</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {material.supplierName || material.supplier || 'N/A'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {material.paymentMethod || 'N/A'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Quantity Update Forms */}
                {canAccess('edit_material') && material.status === 'approved' && (
                  <div className="col-span-2 space-y-4">
                    {/* Delivery Update Form */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="text-md font-semibold mb-3 text-green-900">Update Delivery</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-green-700 mb-1">
                            Delivered Quantity ({material.unit || 'units'})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={material.quantityPurchased || material.quantity || 0}
                            value={quantityUpdateForm.quantityDelivered}
                            onChange={(e) => setQuantityUpdateForm(prev => ({ ...prev, quantityDelivered: e.target.value }))}
                            placeholder={material.quantityDelivered?.toString() || '0'}
                            className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <p className="text-xs text-green-600 mt-1">
                            Max: {material.quantityPurchased || material.quantity || 0} {material.unit || ''}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-green-700 mb-1">
                            Delivery Date
                          </label>
                          <input
                            type="date"
                            value={quantityUpdateForm.dateDelivered}
                            onChange={(e) => setQuantityUpdateForm(prev => ({ ...prev, dateDelivered: e.target.value }))}
                            className="w-full px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleQuantityUpdate('delivery')}
                        disabled={updatingQuantity || !quantityUpdateForm.quantityDelivered}
                        className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updatingQuantity ? 'Updating...' : 'Update Delivery'}
                      </button>
                    </div>

                    {/* Usage Update Form */}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="text-md font-semibold mb-3 text-orange-900">Update Usage</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-orange-700 mb-1">
                            Used Quantity ({material.unit || 'units'})
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={material.quantityDelivered || 0}
                            value={quantityUpdateForm.quantityUsed}
                            onChange={(e) => setQuantityUpdateForm(prev => ({ ...prev, quantityUsed: e.target.value }))}
                            placeholder={material.quantityUsed?.toString() || '0'}
                            className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                          <p className="text-xs text-orange-600 mt-1">
                            Max: {material.quantityDelivered || 0} {material.unit || ''} (delivered)
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-orange-700 mb-1">
                            Usage Date
                          </label>
                          <input
                            type="date"
                            value={quantityUpdateForm.dateUsed}
                            onChange={(e) => setQuantityUpdateForm(prev => ({ ...prev, dateUsed: e.target.value }))}
                            className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleQuantityUpdate('usage')}
                        disabled={updatingQuantity || !quantityUpdateForm.quantityUsed}
                        className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updatingQuantity ? 'Updating...' : 'Update Usage'}
                      </button>
                    </div>
                  </div>
                )}
                </div>

                {/* Finishing Details Section */}
                {material.finishingDetails && Object.keys(material.finishingDetails).length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg md:text-xl font-semibold mb-4 leading-tight">Finishing Details</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <dl className="space-y-3">
                        {material.finishingDetails.brand && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 leading-normal">Brand</dt>
                            <dd className="mt-1 text-sm text-gray-900">{material.finishingDetails.brand}</dd>
                          </div>
                        )}
                        {material.finishingDetails.colour && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 leading-normal">Colour</dt>
                            <dd className="mt-1 text-sm text-gray-900">{material.finishingDetails.colour}</dd>
                          </div>
                        )}
                        {material.finishingDetails.technicianName && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 leading-normal">Technician Name</dt>
                            <dd className="mt-1 text-sm text-gray-900">{material.finishingDetails.technicianName}</dd>
                          </div>
                        )}
                        {material.finishingDetails.installationTeam && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 leading-normal">Installation Team</dt>
                            <dd className="mt-1 text-sm text-gray-900">{material.finishingDetails.installationTeam}</dd>
                          </div>
                        )}
                        {material.finishingDetails.materialType && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 leading-normal">Material Type</dt>
                            <dd className="mt-1 text-sm text-gray-900">{material.finishingDetails.materialType}</dd>
                          </div>
                        )}
                        {material.finishingDetails.teamLeader && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 leading-normal">Team Leader</dt>
                            <dd className="mt-1 text-sm text-gray-900">{material.finishingDetails.teamLeader}</dd>
                          </div>
                        )}
                        {material.finishingDetails.tileType && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 leading-normal">Tile Type</dt>
                            <dd className="mt-1 text-sm text-gray-900">{material.finishingDetails.tileType}</dd>
                          </div>
                        )}
                        {material.finishingDetails.squareMeters && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 leading-normal">Square Meters Covered</dt>
                            <dd className="mt-1 text-sm text-gray-900">{material.finishingDetails.squareMeters} m²</dd>
                          </div>
                        )}
                        {material.finishingDetails.contractNumber && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 leading-normal">Contract Number</dt>
                            <dd className="mt-1 text-sm text-gray-900">{material.finishingDetails.contractNumber}</dd>
                          </div>
                        )}
                        {material.finishingDetails.paymentSchedule && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 leading-normal">Payment Schedule</dt>
                            <dd className="mt-1 text-sm text-gray-900 whitespace-pre-line">{material.finishingDetails.paymentSchedule}</dd>
                          </div>
                        )}
                        {material.finishingDetails.installationDate && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 leading-normal">Installation Date</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {new Date(material.finishingDetails.installationDate).toLocaleDateString()}
                            </dd>
                          </div>
                        )}
                        {material.finishingDetails.warrantyDocuments && 
                         Array.isArray(material.finishingDetails.warrantyDocuments) && 
                         material.finishingDetails.warrantyDocuments.length > 0 && (
                          <div>
                            <dt className="text-base font-semibold text-gray-700 mb-2 leading-normal">Warranty Documents</dt>
                            <dd className="mt-1 space-y-2">
                              {material.finishingDetails.warrantyDocuments.map((url, index) => (
                                <ImagePreview
                                  key={index}
                                  url={url}
                                  title={`Warranty Document ${index + 1}`}
                                  showDelete={false}
                                />
                              ))}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold mb-4">Documents</h3>
                  <div className="space-y-4">
                    {material.receiptUrl || material.receiptFileUrl ? (
                      <ImagePreview
                        url={material.receiptUrl || material.receiptFileUrl}
                        title="Receipt"
                        showDelete={false}
                      />
                    ) : (
                      <p className="text-sm text-gray-500">No receipt uploaded</p>
                    )}
                    {material.invoiceFileUrl && (
                      <ImagePreview
                        url={material.invoiceFileUrl}
                        title="Invoice"
                        showDelete={false}
                      />
                    )}
                    {material.deliveryNoteFileUrl && (
                      <ImagePreview
                        url={material.deliveryNoteFileUrl}
                        title="Delivery Note"
                        showDelete={false}
                      />
                    )}
                    {!material.receiptUrl && !material.receiptFileUrl && !material.invoiceFileUrl && !material.deliveryNoteFileUrl && (
                      <p className="text-sm text-gray-500 italic">No documents uploaded for this material</p>
                    )}
                  </div>

                  {material.notes && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Notes</h4>
                      <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                        {material.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Approval History Tab */}
            {activeTab === 'approval' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Approval History</h3>
                {material.approvalHistory && material.approvalHistory.length > 0 ? (
                  <div className="space-y-4">
                    {material.approvalHistory.map((approval, index) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">
                              {approval.action === 'APPROVED' ? '✅ Approved' : '❌ Rejected'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {approval.reason || approval.approvalNotes || 'No notes'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">
                              {new Date(approval.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No approval history yet</p>
                )}
              </div>
            )}

            {/* Discrepancy Tab */}
            {activeTab === 'discrepancy' && (
              <div className="space-y-6">
                {loadingDiscrepancy ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading discrepancy data...</p>
                  </div>
                ) : discrepancyRecord ? (
                  <>
                    {/* Current Discrepancy Status */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">Current Discrepancy Status</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Status</label>
                          <div className="mt-1">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              discrepancyRecord.status === 'open' ? 'bg-red-100 text-red-800' :
                              discrepancyRecord.status === 'investigating' ? 'bg-yellow-100 text-yellow-800' :
                              discrepancyRecord.status === 'resolved' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {discrepancyRecord.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Severity</label>
                          <div className="mt-1">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getSeverityColor(discrepancyRecord.severity)}`}>
                              {discrepancyRecord.severity}
                            </span>
                          </div>
                        </div>
                        {discrepancyRecord.resolutionNotes && (
                          <div className="md:col-span-2">
                            <label className="text-sm font-medium text-gray-500">Resolution Notes</label>
                            <p className="mt-1 text-sm text-gray-900">{discrepancyRecord.resolutionNotes}</p>
                          </div>
                        )}
                        {discrepancyRecord.resolvedAt && (
                          <div>
                            <label className="text-sm font-medium text-gray-500">Resolved At</label>
                            <p className="mt-1 text-sm text-gray-900">
                              {new Date(discrepancyRecord.resolvedAt).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Threshold Comparison */}
                    {projectThresholds && discrepancy && (
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold mb-4">Threshold Comparison</h3>
                        <div className="space-y-3">
                          {discrepancy.alerts.variance && (
                            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                              <div>
                                <p className="font-medium text-gray-900">Variance Threshold</p>
                                <p className="text-sm text-gray-600">
                                  Current: {discrepancy.metrics.variancePercentage.toFixed(2)}% | 
                                  Threshold: {projectThresholds.variancePercentage}%
                                </p>
                              </div>
                              <span className="text-red-600 font-semibold">⚠️ Exceeded</span>
                            </div>
                          )}
                          {discrepancy.alerts.loss && (
                            <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                              <div>
                                <p className="font-medium text-gray-900">Loss Threshold</p>
                                <p className="text-sm text-gray-600">
                                  Current: {discrepancy.metrics.lossPercentage.toFixed(2)}% | 
                                  Threshold: {projectThresholds.lossPercentage}%
                                </p>
                              </div>
                              <span className="text-red-600 font-semibold">⚠️ Exceeded</span>
                            </div>
                          )}
                          {discrepancy.alerts.wastage && (
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                              <div>
                                <p className="font-medium text-gray-900">Wastage Threshold</p>
                                <p className="text-sm text-gray-600">
                                  Current: {discrepancy.metrics.wastage.toFixed(2)}% | 
                                  Threshold: {projectThresholds.wastagePercentage}%
                                </p>
                              </div>
                              <span className="text-red-600 font-semibold">⚠️ Exceeded</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Resolution History */}
                    {discrepancyRecord.resolutionHistory && discrepancyRecord.resolutionHistory.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold mb-4">Resolution History</h3>
                        <div className="space-y-4">
                          {discrepancyRecord.resolutionHistory.map((entry, index) => (
                            <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    Status: <span className="text-blue-600">{entry.status.replace('_', ' ').toUpperCase()}</span>
                                  </p>
                                  {entry.resolutionNotes && (
                                    <p className="text-sm text-gray-600 mt-1">{entry.resolutionNotes}</p>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 leading-normal">
                                  {new Date(entry.updatedAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <p className="text-green-800 font-medium">No Active Discrepancy</p>
                    <p className="text-sm text-green-600 mt-1">
                      This material has no active discrepancy records. All quantities are within acceptable thresholds.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Activity Log Tab */}
            {activeTab === 'activity' && (
              <AuditTrail entityType="MATERIAL" entityId={materialId} />
            )}
          </div>
        </div>
      </div>

      {/* Approval Confirmation Modal */}
      <ConfirmationModal
        isOpen={showApproveModal}
        onClose={() => {
          if (!isApproving) {
            setShowApproveModal(false);
            setApprovalNotes('');
          }
        }}
        onConfirm={handleApproveConfirm}
        title="Approve Material"
        message="Approving this material will update project finances. Make sure sufficient capital is available."
        confirmText="Approve"
        cancelText="Cancel"
        variant="info"
        isLoading={isApproving}
      >
        <div className="mt-4 space-y-4">
          {/* Capital Validation Indicator */}
          {validatingCapital && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" color="blue-600" />
                <span>Validating capital availability...</span>
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Approval Notes (Optional)
            </label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add approval notes..."
              rows={3}
              disabled={isApproving}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </ConfirmationModal>

      {/* Rejection Modal with Reason Input */}
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
                    Reject Material
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Please provide a reason for rejecting this material:
                    </p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
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
                  disabled={isRejecting || !rejectReason.trim()}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRejecting ? 'Rejecting...' : 'Reject Material'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      <ConfirmationModal
        isOpen={showSubmitModal}
        onClose={() => !isSubmitting && setShowSubmitModal(false)}
        onConfirm={handleSubmitConfirm}
        title="Submit for Approval"
        message="Are you sure you want to submit this material for approval?"
        confirmText="Submit"
        cancelText="Cancel"
        variant="info"
        isLoading={isSubmitting}
      />

      {/* Archive/Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && !isArchiving && setShowDeleteModal(false)}
        onArchive={handleArchiveConfirm}
        onDelete={handleDeleteConfirm}
        title={material?.deletedAt ? 'Delete Material Permanently' : 'Archive or Delete Material'}
        message={
          material ? (
            <>
              <p className="mb-3">
                {material.deletedAt ? (
                  <>
                    Are you sure you want to permanently delete <strong>"{material.name || material.materialName}"</strong>?
                    <br />
                    <span className="text-red-600 font-medium">This action cannot be undone.</span>
                  </>
                ) : (
                  <>
                    What would you like to do with <strong>"{material.name || material.materialName}"</strong>?
                  </>
                )}
              </p>
              {!material.deletedAt && (
                <>
                  <p className="mb-2 font-medium">Permanent deletion will:</p>
                  <ul className="list-disc list-inside mb-3 space-y-1 text-gray-600">
                    <li>Permanently remove the material from the system</li>
                    {material.status && ['approved', 'received'].includes(material.status) && material.totalCost > 0 && (
                      <li>Recalculate project finances</li>
                    )}
                  </ul>
                  {material.status && ['approved', 'received'].includes(material.status) && material.totalCost > 0 && (
                    <p className="text-yellow-600 font-medium mb-2">
                      ⚠️ This material has a cost of KES {material.totalCost?.toLocaleString() || 0}.
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            'Are you sure you want to proceed?'
          )
        }
        archiveLabel="Archive"
        deleteLabel="Delete Permanently"
        cancelText="Cancel"
        variant={material?.deletedAt ? 'danger' : 'both'}
        isArchiving={isArchiving}
        isDeleting={isDeleting}
        showRecommendation={!material?.deletedAt && material?.status && ['approved', 'received'].includes(material.status) && material.totalCost > 0}
      />

      {/* Restore Modal */}
      <RestoreModal
        isOpen={showRestoreModal}
        onClose={() => !isRestoring && setShowRestoreModal(false)}
        onRestore={handleRestoreConfirm}
        title="Restore Material"
        message="Are you sure you want to restore this material? Project finances will be recalculated if applicable."
        itemName={material?.name || material?.materialName}
        isLoading={isRestoring}
      />

      {/* Verify Receipt Modal */}
      <ConfirmationModal
        isOpen={showVerifyReceiptModal}
        onClose={() => !isVerifyingReceipt && setShowVerifyReceiptModal(false)}
        onConfirm={handleVerifyReceiptConfirm}
        title="Verify Material Receipt"
        message={
          <div className="space-y-4">
            <p>Confirm that you have received and verified the materials on site.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actual Quantity Received (Optional)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={verifyReceiptData.actualQuantityReceived}
                onChange={(e) => setVerifyReceiptData(prev => ({ ...prev, actualQuantityReceived: e.target.value }))}
                placeholder={material?.quantityDelivered?.toString() || material?.quantityPurchased?.toString() || 'Enter quantity'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to use delivered quantity ({material?.quantityDelivered || material?.quantityPurchased || 0} {material?.unit || ''})
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={verifyReceiptData.notes}
                onChange={(e) => setVerifyReceiptData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any notes about the receipt verification..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
        }
        confirmText="Verify Receipt"
        cancelText="Cancel"
        variant="info"
        isLoading={isVerifyingReceipt}
      />
    </AppLayout>
  );
}

