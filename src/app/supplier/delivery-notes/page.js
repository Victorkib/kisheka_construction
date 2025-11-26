/**
 * Supplier Delivery Notes Page
 * Allows suppliers to view materials they supplied and upload delivery notes
 * 
 * Route: /supplier/delivery-notes
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { ImagePreview } from '@/components/uploads/image-preview';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';

function SupplierDeliveryNotesContent() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [supplierName, setSupplierName] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [needsDeliveryNote, setNeedsDeliveryNote] = useState(searchParams.get('needsDeliveryNote') === 'true');
  const [uploadingMaterialId, setUploadingMaterialId] = useState(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceMaterialId, setReplaceMaterialId] = useState(null);

  useEffect(() => {
    fetchMaterials();
  }, [filterStatus, needsDeliveryNote, pagination.page]);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (needsDeliveryNote) params.append('needsDeliveryNote', 'true');
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);

      const response = await fetch(`/api/supplier/delivery-notes?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch materials');
      }

      setMaterials(data.data.materials || []);
      setSupplierName(data.data.supplierName || '');
      setPagination(data.data.pagination || pagination);
    } catch (err) {
      setError(err.message);
      console.error('Fetch materials error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDeliveryNote = async (materialId, fileUrl) => {
    try {
      setUploadingMaterialId(materialId);

      const response = await fetch('/api/supplier/delivery-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId,
          deliveryNoteFileUrl: fileUrl,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to upload delivery note');
      }

      // Refresh materials list
      await fetchMaterials();
      toast.showSuccess('Delivery note uploaded successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Upload delivery note error:', err);
    } finally {
      setUploadingMaterialId(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
      case 'received':
        return 'bg-green-100 text-green-800';
      case 'pending_approval':
      case 'submitted':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && materials.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading materials...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && materials.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-medium">Error: {error}</p>
            <p className="text-sm mt-1">Please ensure your user profile has a supplier name or company set.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Delivery Notes</h1>
            <p className="text-gray-600 mt-2">
              Materials supplied by: <span className="font-semibold">{supplierName}</span>
            </p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPagination({ ...pagination, page: 1 });
                  }}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="received">Received</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsDeliveryNote}
                    onChange={(e) => {
                      setNeedsDeliveryNote(e.target.checked);
                      setPagination({ ...pagination, page: 1 });
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-base font-semibold text-gray-700 leading-normal">Only show materials needing delivery notes</span>
                </label>
              </div>
            </div>
          </div>

          {/* Materials List */}
          {materials.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500 text-lg">No materials found</p>
              <p className="text-gray-400 text-sm mt-2">
                {needsDeliveryNote
                  ? 'All materials have delivery notes uploaded'
                  : 'No materials match your supplier account'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {materials.map((material) => (
                <div key={material._id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    {/* Material Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{material.name || material.materialName}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {material.description || 'No description'}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(material.status)}`}>
                          {material.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                        <div>
                          <p className="text-gray-600">Quantity</p>
                          <p className="font-medium text-gray-900">
                            {material.quantity} {material.unit}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Total Cost</p>
                          <p className="font-medium text-gray-900">{formatCurrency(material.totalCost || 0)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Date Purchased</p>
                          <p className="font-medium text-gray-900">{formatDate(material.datePurchased)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Date Delivered</p>
                          <p className="font-medium text-gray-900">{formatDate(material.dateDelivered)}</p>
                        </div>
                      </div>

                      {/* Current Delivery Note */}
                      {material.deliveryNoteFileUrl && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                          <p className="text-sm font-medium text-green-800 mb-2">Delivery Note Uploaded</p>
                          <ImagePreview
                            url={material.deliveryNoteFileUrl}
                            fileName="Delivery Note"
                          />
                        </div>
                      )}
                    </div>

                    {/* Upload Section */}
                    <div className="md:w-80">
                      {material.deliveryNoteFileUrl ? (
                        <div className="text-center p-4 bg-green-50 border border-green-200 rounded">
                          <p className="text-sm font-medium text-green-800 mb-2">✓ Delivery Note Uploaded</p>
                          <button
                            onClick={() => {
                              setReplaceMaterialId(material._id);
                              setShowReplaceModal(true);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Replace
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-base font-semibold text-gray-700 mb-2 leading-normal">Upload Delivery Note</p>
                          {uploadingMaterialId === material._id ? (
                            <div className="space-y-2">
                              <CloudinaryUploadWidget
                                uploadPreset="Construction_Accountability_System"
                                folder="Kisheka_construction/delivery-notes"
                                label="Upload Delivery Note"
                                onChange={(url) => {
                                  handleUploadDeliveryNote(material._id, url);
                                }}
                              />
                              <button
                                onClick={() => setUploadingMaterialId(null)}
                                className="w-full px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setUploadingMaterialId(material._id)}
                              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                            >
                              Upload Delivery Note
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="mt-6 flex justify-center items-center gap-4">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.pages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
      </div>

      {/* Replace Delivery Note Confirmation Modal */}
      <ConfirmationModal
        isOpen={showReplaceModal}
        onClose={() => setShowReplaceModal(false)}
        onConfirm={() => {
          if (replaceMaterialId) {
            setUploadingMaterialId(replaceMaterialId);
            setShowReplaceModal(false);
            setReplaceMaterialId(null);
          }
        }}
        title="Replace Delivery Note"
        message="Upload a new delivery note to replace the existing one?"
        confirmText="Replace"
        cancelText="Cancel"
        variant="warning"
      />
    </AppLayout>
  );
}

export default function SupplierDeliveryNotesPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading delivery notes...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <SupplierDeliveryNotesContent />
    </Suspense>
  );
}

