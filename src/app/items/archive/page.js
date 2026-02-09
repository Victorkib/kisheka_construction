/**
 * Archived Materials List Page
 * Displays all archived materials with restore and permanent delete options
 * 
 * Route: /items/archive
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingSpinner } from '@/components/loading';
import { ArchiveBadge } from '@/components/badges';
import { ConfirmationModal, RestoreModal } from '@/components/modals';
import { useToast } from '@/components/toast';

function ArchivedMaterialsPageContent() {
  const router = useRouter();
  const toast = useToast();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  useEffect(() => {
    fetchUser();
    fetchMaterials();
  }, []);

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
        const role = data.data.role?.toLowerCase();
        setCanManage(role === 'owner');
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/materials?archived=true', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch archived materials');
      }

      setMaterials(data.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Fetch archived materials error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = (material) => {
    setSelectedMaterial(material);
    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedMaterial) return;

    setRestoring(true);
    try {
      const response = await fetch(`/api/materials/${selectedMaterial._id}/restore`, {
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
      setSelectedMaterial(null);
      await fetchMaterials();
    } catch (err) {
      toast.showError(err.message || 'Failed to restore material');
      console.error('Restore material error:', err);
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteClick = (material) => {
    setSelectedMaterial(material);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedMaterial) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/materials/${selectedMaterial._id}?force=true`, {
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
      setSelectedMaterial(null);
      await fetchMaterials();
    } catch (err) {
      toast.showError(err.message || 'Failed to delete material');
      console.error('Delete material error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable rows={5} columns={5} />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
          <Link href="/items" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Materials
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/items"
            className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block"
          >
            ← Back to Materials
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Archived Materials</h1>
              <p className="text-gray-600 mt-1">
                {materials.length} archived material{materials.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {materials.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No archived materials</h3>
            <p className="mt-1 text-sm text-gray-500">There are no archived materials at this time.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Material
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    {canManage && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {materials.map((material) => (
                    <tr key={material._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/items/${material._id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-900"
                        >
                          {material.name || material.materialName}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <ArchiveBadge />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(material.totalCost || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {material.status}
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleRestoreClick(material)}
                              disabled={restoring}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handleDeleteClick(material)}
                              disabled={deleting}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <RestoreModal
          isOpen={showRestoreModal}
          onClose={() => !restoring && setShowRestoreModal(false)}
          onRestore={handleRestoreConfirm}
          title="Restore Material"
          message="Are you sure you want to restore this material? Project finances will be recalculated if applicable."
          itemName={selectedMaterial?.name || selectedMaterial?.materialName}
          isLoading={restoring}
        />

        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => !deleting && setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Material Permanently"
          message={
            selectedMaterial ? (
              <>
                <p className="mb-3">
                  Are you sure you want to permanently delete <strong>"{selectedMaterial.name || selectedMaterial.materialName}"</strong>?
                </p>
                <p className="text-red-600 font-medium">This action cannot be undone.</p>
              </>
            ) : (
              'Are you sure you want to proceed?'
            )
          }
          confirmText="Delete Permanently"
          cancelText="Cancel"
          variant="danger"
          isLoading={deleting}
        />
      </div>
    </AppLayout>
  );
}

export default function ArchivedMaterialsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading archived materials...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <ArchivedMaterialsPageContent />
    </Suspense>
  );
}

