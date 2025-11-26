/**
 * Items/Materials List Page
 * Displays all materials with filtering, sorting, and pagination
 * 
 * Route: /items
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';

function ItemsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [projects, setProjects] = useState([]);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [showBulkSubmitModal, setShowBulkSubmitModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitMaterialId, setSubmitMaterialId] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  
  // Filters
  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || '',
    category: searchParams.get('category') || '',
    floor: searchParams.get('floor') || '',
    status: searchParams.get('status') || '',
    supplier: searchParams.get('supplier') || '',
    entryType: searchParams.get('entryType') || '',
    search: searchParams.get('search') || '',
  });

  // Fetch projects for filter dropdown
  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch materials
  useEffect(() => {
    fetchMaterials();
  }, [filters, pagination.page]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data.projects || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.category && { category: filters.category }),
        ...(filters.floor && { floor: filters.floor }),
        ...(filters.status && { status: filters.status }),
        ...(filters.supplier && { supplier: filters.supplier }),
        ...(filters.entryType && { entryType: filters.entryType }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/materials?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch materials');
      }

      setMaterials(data.data.materials || []);
      setPagination(data.data.pagination || pagination);
    } catch (err) {
      setError(err.message);
      console.error('Fetch materials error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on filter change
    
    // Update URL params
    const params = new URLSearchParams();
    Object.entries({ ...filters, [key]: value }).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/items?${params.toString()}`, { scroll: false });
  };

  const toggleSelectMaterial = (materialId) => {
    setSelectedMaterials((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMaterials.length === materials.length) {
      setSelectedMaterials([]);
    } else {
      setSelectedMaterials(materials.map((m) => m._id));
    }
  };

  const handleBulkApproveClick = () => {
    if (selectedMaterials.length === 0) {
      toast.showError('Please select materials to approve');
      return;
    }
    setApprovalNotes('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApprove = async () => {
    setBulkActionLoading(true);
    setShowBulkApproveModal(false);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const materialId of selectedMaterials) {
        try {
          const response = await fetch(`/api/materials/${materialId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: approvalNotes }),
          });

          const data = await response.json();
          if (data.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`Error approving material ${materialId}:`, err);
        }
      }

      setSelectedMaterials([]);
      setApprovalNotes('');
      if (successCount > 0) {
        toast.showSuccess(`Approved ${successCount} material(s) successfully!`);
      }
      if (failCount > 0) {
        toast.showWarning(`${failCount} material(s) failed to approve`);
      }
      fetchMaterials(); // Refresh list
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkRejectClick = () => {
    if (selectedMaterials.length === 0) {
      toast.showError('Please select materials to reject');
      return;
    }
    setRejectReason('');
    setShowBulkRejectModal(true);
  };

  const handleBulkReject = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }
    setBulkActionLoading(true);
    setShowBulkRejectModal(false);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const materialId of selectedMaterials) {
        try {
          const response = await fetch(`/api/materials/${materialId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: rejectReason }),
          });

          const data = await response.json();
          if (data.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`Error rejecting material ${materialId}:`, err);
        }
      }

      setSelectedMaterials([]);
      setRejectReason('');
      if (successCount > 0) {
        toast.showSuccess(`Rejected ${successCount} material(s) successfully!`);
      }
      if (failCount > 0) {
        toast.showWarning(`${failCount} material(s) failed to reject`);
      }
      fetchMaterials(); // Refresh list
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkSubmitClick = () => {
    if (selectedMaterials.length === 0) {
      toast.showError('Please select materials to submit');
      return;
    }
    setShowBulkSubmitModal(true);
  };

  const handleBulkSubmit = async () => {
    setBulkActionLoading(true);
    setShowBulkSubmitModal(false);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const materialId of selectedMaterials) {
        try {
          const response = await fetch(`/api/materials/${materialId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          const data = await response.json();
          if (data.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`Error submitting material ${materialId}:`, err);
        }
      }

      setSelectedMaterials([]);
      if (successCount > 0) {
        toast.showSuccess(`Submitted ${successCount} material(s) successfully!`);
      }
      if (failCount > 0) {
        toast.showWarning(`${failCount} material(s) failed to submit`);
      }
      fetchMaterials(); // Refresh list
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSubmitClick = (materialId) => {
    setSubmitMaterialId(materialId);
    setShowSubmitModal(true);
  };

  const handleSubmit = async () => {
    if (!submitMaterialId) return;
    setBulkActionLoading(true);
    setShowSubmitModal(false);
    try {
      const response = await fetch(`/api/materials/${submitMaterialId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Material submitted successfully!');
        fetchMaterials();
      } else {
        toast.showError(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkActionLoading(false);
      setSubmitMaterialId(null);
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Materials & Items</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Track and manage construction materials</p>
          </div>
          <div className="flex gap-2">
            {selectedMaterials.length > 0 && (
              <div className="flex items-center gap-2 mr-4">
                <span className="text-sm text-gray-600">
                  {selectedMaterials.length} selected
                </span>
                {canAccess('approve_material') && (
                  <>
                    <button
                      onClick={handleBulkApproveClick}
                      disabled={bulkActionLoading}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                    >
                      {bulkActionLoading ? 'Processing...' : 'Approve Selected'}
                    </button>
                    <button
                      onClick={handleBulkRejectClick}
                      disabled={bulkActionLoading}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                    >
                      {bulkActionLoading ? 'Processing...' : 'Reject Selected'}
                    </button>
                  </>
                )}
                {canAccess('create_material') && (
                  <button
                    onClick={handleBulkSubmitClick}
                    disabled={bulkActionLoading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {bulkActionLoading ? 'Processing...' : 'Submit Selected'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedMaterials([])}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition"
                >
                  Clear
                </button>
              </div>
            )}
            {canAccess('create_material') && (
              <Link
                href="/items/new"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                + Add Material
              </Link>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Project</label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName || project.projectCode || project._id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Search</label>
              <input
                type="text"
                placeholder="Search materials..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Category</label>
              <input
                type="text"
                placeholder="Filter by category..."
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="received">Received</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Entry Type</label>
              <select
                value={filters.entryType}
                onChange={(e) => handleFilterChange('entryType', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              >
                <option value="">All Entry Types</option>
                <option value="new_procurement">New Procurement</option>
                <option value="retroactive_entry">Retroactive Entry</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Supplier</label>
              <input
                type="text"
                placeholder="Filter by supplier..."
                value={filters.supplier}
                onChange={(e) => handleFilterChange('supplier', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Floor</label>
              <input
                type="text"
                placeholder="Filter by floor..."
                value={filters.floor}
                onChange={(e) => handleFilterChange('floor', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Materials Table */}
        {loading ? (
          <LoadingTable rows={10} columns={8} showHeader={true} />
        ) : materials.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">No materials found</p>
            <Link
              href="/items/new"
              className="text-blue-600 hover:underline font-medium"
            >
              Add your first material
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      <input
                        type="checkbox"
                        checked={selectedMaterials.length === materials.length && materials.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Material Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Entry Type
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Unit Cost
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Total Cost
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Supplier
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {materials.map((material) => (
                    <tr key={material._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedMaterials.includes(material._id)}
                          onChange={() => toggleSelectMaterial(material._id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-base font-medium text-gray-900 leading-normal">
                          {material.name || material.materialName}
                        </div>
                        {material.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {material.description}
                          </div>
                        )}
                        {/* Show links to purchase order or material request */}
                        <div className="flex gap-2 mt-1">
                          {material.purchaseOrderId && (
                            <Link
                              href={`/purchase-orders/${material.purchaseOrderId}`}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              📦 PO
                            </Link>
                          )}
                          {material.materialRequestId && (
                            <Link
                              href={`/material-requests/${material.materialRequestId}`}
                              className="text-xs text-green-600 hover:text-green-800"
                            >
                              📋 Request
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
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
                          {material.entryType === 'retroactive_entry' && material.costStatus && (
                            <div className="mt-1">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                material.costStatus === 'actual'
                                  ? 'bg-green-100 text-green-800'
                                  : material.costStatus === 'estimated'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                Cost: {material.costStatus}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{material.category || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {material.quantity || material.quantityPurchased || 0} {material.unit || ''}
                        </div>
                        {material.quantityRemaining !== undefined && (
                          <div className="text-sm text-gray-600 leading-normal">
                            Remaining: {material.quantityRemaining} {material.unit || ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          KES {material.unitCost?.toLocaleString() || '0.00'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          KES {material.totalCost?.toLocaleString() || '0.00'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {material.supplierName || material.supplier || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full leading-normal ${getStatusBadgeColor(
                            material.status
                          )}`}
                        >
                          {material.status?.replace('_', ' ').toUpperCase() || 'DRAFT'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-base font-medium leading-normal">
                        <Link
                          href={`/items/${material._id}`}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          View
                        </Link>
                        {material.status === 'draft' && (
                          <>
                            <Link
                              href={`/items/${material._id}/edit`}
                              className="text-green-600 hover:text-green-900 mr-4"
                            >
                              Edit
                            </Link>
                            <span className="text-purple-600 hover:text-purple-900 cursor-pointer"
                                  onClick={() => handleSubmitClick(material._id)}
                            >
                              Submit
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-6 flex justify-between items-center">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} materials
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk Approve Modal with Notes */}
      {showBulkApproveModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={() => !bulkActionLoading && setShowBulkApproveModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-2" id="modal-title">
                    Approve Materials
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Approve {selectedMaterials.length} material(s)?
                    </p>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Approval Notes (Optional)
                    </label>
                    <textarea
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Add approval notes..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                      disabled={bulkActionLoading}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-blue-200">
                <button
                  type="button"
                  onClick={() => setShowBulkApproveModal(false)}
                  disabled={bulkActionLoading}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkApprove}
                  disabled={bulkActionLoading}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {bulkActionLoading ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reject Modal */}
      {showBulkRejectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={() => !bulkActionLoading && setShowBulkRejectModal(false)} />
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
                    Reject Materials
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Reject {selectedMaterials.length} material(s)?
                    </p>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Rejection (Required)
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter rejection reason..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      rows="4"
                      disabled={bulkActionLoading}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-yellow-200">
                <button
                  type="button"
                  onClick={() => setShowBulkRejectModal(false)}
                  disabled={bulkActionLoading}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkReject}
                  disabled={bulkActionLoading || !rejectReason.trim()}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {bulkActionLoading ? 'Rejecting...' : 'Reject Materials'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Submit Modal */}
      <ConfirmationModal
        isOpen={showBulkSubmitModal}
        onClose={() => !bulkActionLoading && setShowBulkSubmitModal(false)}
        onConfirm={handleBulkSubmit}
        title="Submit Materials"
        message={`Submit ${selectedMaterials.length} material(s) for approval?`}
        confirmText="Submit"
        cancelText="Cancel"
        variant="info"
        isLoading={bulkActionLoading}
      />

      {/* Single Submit Modal */}
      <ConfirmationModal
        isOpen={showSubmitModal}
        onClose={() => !bulkActionLoading && setShowSubmitModal(false)}
        onConfirm={handleSubmit}
        title="Submit Material"
        message="Submit this material for approval?"
        confirmText="Submit"
        cancelText="Cancel"
        variant="info"
        isLoading={bulkActionLoading}
      />
    </AppLayout>
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading materials...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <ItemsPageContent />
    </Suspense>
  );
}
