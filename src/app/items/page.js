/**
 * Items/Materials List Page
 * Displays all materials with filtering, sorting, and pagination
 * 
 * Route: /items
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState, NoDataEmptyState } from '@/components/empty-states';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';

function ItemsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const {
    currentProject,
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  const toast = useToast();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc',
  });
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
    projectId: searchParams.get('projectId') || currentProjectId || '',
    category: searchParams.get('category') || '',
    floor: searchParams.get('floor') || '',
    phaseId: searchParams.get('phaseId') || '',
    status: searchParams.get('status') || '',
    supplier: searchParams.get('supplier') || '',
    entryType: searchParams.get('entryType') || '',
    search: searchParams.get('search') || '',
  });
  const [phases, setPhases] = useState([]);
  const [loadingPhases, setLoadingPhases] = useState(false);

  useEffect(() => {
    if (currentProjectId) {
      fetchPhases(currentProjectId);
    }
  }, [currentProjectId]);

  const fetchPhases = async (projectId) => {
    if (!projectId) {
      setPhases([]);
      return;
    }
    setLoadingPhases(true);
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    } finally {
      setLoadingPhases(false);
    }
  };

  const fetchMaterials = useCallback(async () => {
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
        ...(filters.phaseId && { phaseId: filters.phaseId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.supplier && { supplier: filters.supplier }),
        ...(filters.entryType && { entryType: filters.entryType }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/materials?${queryParams}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch materials');
      }

      let materialsData = data.data.materials || [];

      // Apply sorting
      if (sortConfig.key) {
        materialsData = [...materialsData].sort((a, b) => {
          let aValue, bValue;
          
          switch (sortConfig.key) {
            case 'name':
              aValue = (a.name || a.materialName || '').toLowerCase();
              bValue = (b.name || b.materialName || '').toLowerCase();
              break;
            case 'category':
              aValue = (a.category || '').toLowerCase();
              bValue = (b.category || '').toLowerCase();
              break;
            case 'quantity':
              aValue = a.quantity || a.quantityPurchased || 0;
              bValue = b.quantity || b.quantityPurchased || 0;
              break;
            case 'unitCost':
              aValue = a.unitCost || 0;
              bValue = b.unitCost || 0;
              break;
            case 'totalCost':
              aValue = a.totalCost || 0;
              bValue = b.totalCost || 0;
              break;
            case 'status':
              aValue = (a.status || '').toLowerCase();
              bValue = (b.status || '').toLowerCase();
              break;
            default:
              return 0;
          }

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }

      setMaterials(materialsData);
      setPagination(prev => {
        const newPagination = data.data.pagination || prev;
        // Only update if values actually changed
        if (prev.page === newPagination.page && 
            prev.limit === newPagination.limit && 
            prev.total === newPagination.total && 
            prev.pages === newPagination.pages) {
          return prev; // Return same reference to prevent re-render
        }
        return newPagination;
      });
    } catch (err) {
      setError(err.message);
      console.error('Fetch materials error:', err);
    } finally {
      setLoading(false);
    }
  }, [
    filters.projectId,
    filters.category,
    filters.floor,
    filters.phaseId,
    filters.status,
    filters.supplier,
    filters.entryType,
    filters.search,
    pagination.page,
    pagination.limit,
    sortConfig.key,
    sortConfig.direction,
  ]);

  // Update filters when project changes
  useEffect(() => {
    const newProjectId = normalizeProjectId(currentProject?._id) || currentProjectId || '';
    if (newProjectId && filters.projectId !== newProjectId) {
      setFilters((prev) => ({ ...prev, projectId: newProjectId, phaseId: '' }));
      fetchPhases(newProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?._id, currentProjectId]);

  // Fetch materials
  useEffect(() => {
    // Don't fetch if empty state
    if (isEmpty) {
      setLoading(false);
      setMaterials([]);
      return;
    }

    if (!filters.projectId) {
      if (projectLoading) return;
      setLoading(false);
      setMaterials([]);
      return;
    }

    fetchMaterials();
  }, [fetchMaterials, isEmpty, projectLoading, filters.projectId]);

  const handleFilterChange = (key, value) => {
    let updatedFilters = { ...filters, [key]: value };
    if (key === 'projectId') {
      updatedFilters = { ...filters, projectId: value, phaseId: '' };
      setFilters(updatedFilters);
      setPhases([]);
      if (value) {
        fetchPhases(value);
        if (value !== currentProjectId) {
          switchProject(value).catch((err) => {
            console.error('Error switching project:', err);
          });
        }
      }
    } else {
      setFilters(updatedFilters);
    }
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on filter change

    // Update URL params
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([k, v]) => {
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
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
              },
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
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
              },
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
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
              },
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
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
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

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLimitChange = (newLimit) => {
    setPagination((prev) => ({ ...prev, limit: parseInt(newLimit), page: 1 }));
  };

  // Check empty state - no projects
  if (isEmpty && !loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Materials & Items</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Track and manage construction materials</p>
          </div>
          <NoProjectsEmptyState
            canCreate={canAccess('create_project')}
            role={canAccess('create_project') ? 'owner' : 'site_clerk'}
          />
        </div>
      </AppLayout>
    );
  }

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <span className="ml-1 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </span>
      );
    }
    return (
      <span className="ml-1 text-blue-600">
        {sortConfig.direction === 'asc' ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingOverlay
          isLoading={bulkActionLoading}
          message="Processing materials..."
          fullScreen
        />
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

        <PrerequisiteGuide
          title="Set up items before requesting materials"
          description="Materials and items fuel purchasing and inventory tracking."
          prerequisites={[
            'Project is created',
            'Material library or items are defined',
          ]}
          actions={[
            { href: '/projects/new', label: 'Create Project' },
            { href: '/material-library', label: 'Material Library' },
            { href: '/items/new', label: 'Add Item' },
          ]}
          tip="Use categories and suppliers to improve reporting."
        />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search Materials</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by material name, category, supplier, or description..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Project</label>
                <select
                  value={filters.projectId}
                  onChange={(e) => handleFilterChange('projectId', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" className="text-gray-900">All Projects</option>
                  {accessibleProjects.map((project) => (
                    <option key={project._id} value={project._id} className="text-gray-900">
                      {project.projectName || project.projectCode || project._id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <input
                  type="text"
                  placeholder="Filter by category..."
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" className="text-gray-900">All Status</option>
                  <option value="draft" className="text-gray-900">Draft</option>
                  <option value="submitted" className="text-gray-900">Submitted</option>
                  <option value="pending_approval" className="text-gray-900">Pending Approval</option>
                  <option value="approved" className="text-gray-900">Approved</option>
                  <option value="rejected" className="text-gray-900">Rejected</option>
                  <option value="received" className="text-gray-900">Received</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Entry Type</label>
                <select
                  value={filters.entryType}
                  onChange={(e) => handleFilterChange('entryType', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" className="text-gray-900">All Entry Types</option>
                  <option value="new_procurement" className="text-gray-900">New Procurement</option>
                  <option value="retroactive_entry" className="text-gray-900">Retroactive Entry</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Supplier</label>
                <input
                  type="text"
                  placeholder="Filter by supplier..."
                  value={filters.supplier}
                  onChange={(e) => handleFilterChange('supplier', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Floor</label>
                <input
                  type="text"
                  placeholder="Filter by floor..."
                  value={filters.floor}
                  onChange={(e) => handleFilterChange('floor', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phase</label>
                <select
                  value={filters.phaseId}
                  onChange={(e) => handleFilterChange('phaseId', e.target.value)}
                  disabled={loadingPhases}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="" className="text-gray-900">All Phases</option>
                  {loadingPhases ? (
                    <option>Loading phases...</option>
                  ) : (
                    phases.map((phase) => (
                      <option key={phase._id} value={phase._id} className="text-gray-900">
                        {phase.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    const resetFilters = {
                      projectId: currentProjectId || '',
                      category: '',
                      floor: '',
                      phaseId: '',
                      status: '',
                      supplier: '',
                      entryType: '',
                      search: '',
                    };
                    setFilters(resetFilters);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                    if (resetFilters.projectId) {
                      fetchPhases(resetFilters.projectId);
                    } else {
                      setPhases([]);
                    }
                    const params = new URLSearchParams();
                    Object.entries(resetFilters).forEach(([k, v]) => {
                      if (v) params.set(k, v);
                    });
                    router.push(`/items?${params.toString()}`, { scroll: false });
                  }}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Materials Table - Desktop View */}
        {loading ? (
          <LoadingTable rows={10} columns={8} showHeader={true} />
        ) : materials.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No materials found</h3>
            <p className="mt-2 text-sm text-gray-500">
              {filters.search || filters.category || filters.status || filters.projectId
                ? 'Try adjusting your filters'
                : 'Get started by adding your first material'}
            </p>
            {canAccess('create_material') && (
              <Link
                href="/items/new"
                className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
              >
                + Add Material
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedMaterials.length === materials.length && materials.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center">
                          Material Name
                          <SortIcon columnKey="name" />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Entry Type
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('category')}
                      >
                        <div className="flex items-center">
                          Category
                          <SortIcon columnKey="category" />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('quantity')}
                      >
                        <div className="flex items-center">
                          Quantity
                          <SortIcon columnKey="quantity" />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('unitCost')}
                      >
                        <div className="flex items-center">
                          Unit Cost
                          <SortIcon columnKey="unitCost" />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('totalCost')}
                      >
                        <div className="flex items-center">
                          Total Cost
                          <SortIcon columnKey="totalCost" />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Supplier
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center">
                          Status
                          <SortIcon columnKey="status" />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {materials.map((material) => (
                      <tr key={material._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedMaterials.includes(material._id)}
                            onChange={() => toggleSelectMaterial(material._id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {material.name || material.materialName}
                          </div>
                          {material.description && (
                            <div className="text-xs text-gray-500 truncate max-w-xs mt-1">
                              {material.description}
                            </div>
                          )}
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
                        <td className="px-4 py-4 whitespace-nowrap">
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
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">{material.category || 'N/A'}</span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {material.quantity || material.quantityPurchased || 0} {material.unit || ''}
                          </div>
                          {material.quantityRemaining !== undefined && (
                            <div className="text-xs text-gray-600">
                              Remaining: {material.quantityRemaining} {material.unit || ''}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            KES {material.unitCost?.toLocaleString() || '0.00'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            KES {material.totalCost?.toLocaleString() || '0.00'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {material.supplierName || material.supplier || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                              material.status
                            )}`}
                          >
                            {material.status?.replace('_', ' ').toUpperCase() || 'DRAFT'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-col gap-1">
                            <Link
                              href={`/items/${material._id}`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View
                            </Link>
                            {material.status === 'draft' && (
                              <>
                                <Link
                                  href={`/items/${material._id}/edit`}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Edit
                                </Link>
                                <button
                                  onClick={() => handleSubmitClick(material._id)}
                                  className="text-left text-purple-600 hover:text-purple-900"
                                >
                                  Submit
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {materials.map((material) => (
                <div key={material._id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={selectedMaterials.includes(material._id)}
                          onChange={() => toggleSelectMaterial(material._id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Link
                          href={`/items/${material._id}`}
                          className="text-base font-semibold text-blue-600 hover:text-blue-900 flex-1"
                        >
                          {material.name || material.materialName}
                        </Link>
                      </div>
                      {material.description && (
                        <p className="text-sm text-gray-600 mb-2">{material.description}</p>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                            material.status
                          )}`}
                        >
                          {material.status?.replace('_', ' ').toUpperCase() || 'DRAFT'}
                        </span>
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
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3 pt-3 border-t border-gray-200">
                    <div>
                      <span className="text-gray-500">Category:</span>
                      <span className="ml-1 text-gray-900 font-medium">{material.category || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Supplier:</span>
                      <span className="ml-1 text-gray-900 font-medium">
                        {material.supplierName || material.supplier || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Quantity:</span>
                      <span className="ml-1 text-gray-900 font-medium">
                        {material.quantity || material.quantityPurchased || 0} {material.unit || ''}
                      </span>
                      {material.quantityRemaining !== undefined && (
                        <div className="text-xs text-gray-600 mt-0.5">
                          Remaining: {material.quantityRemaining} {material.unit || ''}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">Unit Cost:</span>
                      <span className="ml-1 text-gray-900 font-medium">
                        KES {material.unitCost?.toLocaleString() || '0.00'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Total Cost:</span>
                      <span className="ml-1 text-gray-900 font-semibold">
                        KES {material.totalCost?.toLocaleString() || '0.00'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-3 border-t border-gray-200">
                    <div className="flex gap-2">
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
                    <div className="flex gap-2">
                      <Link
                        href={`/items/${material._id}`}
                        className="flex-1 text-sm text-blue-600 hover:text-blue-900 font-medium text-center py-2"
                      >
                        View Details →
                      </Link>
                      {material.status === 'draft' && (
                        <>
                          <Link
                            href={`/items/${material._id}/edit`}
                            className="flex-1 text-sm text-green-600 hover:text-green-900 font-medium text-center py-2"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleSubmitClick(material._id)}
                            className="flex-1 text-sm text-purple-600 hover:text-purple-900 font-medium text-center py-2"
                          >
                            Submit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-6 bg-white rounded-lg shadow p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Items per page:</span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => handleLimitChange(e.target.value)}
                      className="px-3 py-1 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="10" className="text-gray-900">10</option>
                      <option value="20" className="text-gray-900">20</option>
                      <option value="50" className="text-gray-900">50</option>
                      <option value="100" className="text-gray-900">100</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">
                      Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Previous
                    </button>
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                        let pageNum;
                        if (pagination.pages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.pages - 2) {
                          pageNum = pagination.pages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium ${
                              pagination.page === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.pages}
                      className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Next
                    </button>
                  </div>
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
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
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
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 placeholder:text-gray-400"
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
