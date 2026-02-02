/**
 * Stock Tracking Page
 * Displays inventory levels, low stock alerts, and wastage tracking
 * 
 * Route: /dashboard/stock
 */

'use client';

export const revalidate = 60;

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ConfirmationModal } from '@/components/modals';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';

export default function StockPage() {
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [materialRequests, setMaterialRequests] = useState([]); // Track existing requests
  const [filters, setFilters] = useState({
    category: '',
    floor: '',
    lowStockOnly: false,
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc',
  });
  const [summary, setSummary] = useState({
    totalItems: 0,
    lowStockCount: 0,
    pendingDelivery: 0,
    pendingApproval: 0,
  });
  const [showAutoReorderModal, setShowAutoReorderModal] = useState(false);
  const [autoReorderPreview, setAutoReorderPreview] = useState(null);
  const [autoReorderLoading, setAutoReorderLoading] = useState(false);
  const { currentProject, accessibleProjects, switchProject } = useProjectContext();
  
  const selectedProjectId = normalizeProjectId(currentProject?._id) || '';

  useEffect(() => {
    if (selectedProjectId) {
      fetchStockData();
      fetchMaterialRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pagination.page, pagination.limit, selectedProjectId]);

  const handlePreviewAutoReorder = async () => {
    if (!selectedProjectId) {
      toast.showError('Please select a project');
      return;
    }

    try {
      setAutoReorderLoading(true);
      const response = await fetch('/api/material-requests/auto-reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          threshold: 20,
          preview: true,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to preview auto-reorder');
      }

      setAutoReorderPreview(data.data);
      setShowAutoReorderModal(true);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setAutoReorderLoading(false);
    }
  };

  const handleCreateAutoReorder = async () => {
    if (!selectedProjectId) {
      toast.showError('Please select a project');
      return;
    }

    try {
      setAutoReorderLoading(true);
      const response = await fetch('/api/material-requests/auto-reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          threshold: 20,
          settings: {
            urgency: 'medium',
            reason: 'Low stock - automated reorder',
          },
          preview: false,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create auto-reorder batch');
      }

      toast.showSuccess(
        `Bulk request created successfully! ${data.data.summary.totalMaterials} material(s) added.`
      );
      setShowAutoReorderModal(false);
      setAutoReorderPreview(null);

      // Redirect to batch detail page
      if (data.data.batchId) {
        router.push(`/material-requests/bulk/${data.data.batchId}`);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setAutoReorderLoading(false);
    }
  };

  const fetchStockData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Build query with pagination
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.category && { category: filters.category }),
        ...(filters.floor && { floor: filters.floor }),
        ...(filters.search && { search: filters.search }),
        ...(selectedProjectId && { projectId: selectedProjectId }),
      });

      const response = await fetch(`/api/materials?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch stock data');
      }

      let filteredMaterials = data.data.materials || [];

      // Filter by low stock if requested
      if (filters.lowStockOnly) {
        filteredMaterials = filteredMaterials.filter((m) => {
          const remaining = m.quantityRemaining || 0;
          const purchased = m.quantityPurchased || m.quantity || 0;
          const percentage = purchased > 0 ? (remaining / purchased) * 100 : 0;
          return percentage < 20 && percentage > 0;
        });
      }

      // Apply sorting
      if (sortConfig.key) {
        filteredMaterials = [...filteredMaterials].sort((a, b) => {
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
            case 'remaining':
              aValue = a.quantityRemaining || 0;
              bValue = b.quantityRemaining || 0;
              break;
            case 'stockLevel':
              const aDelivered = a.quantityDelivered || 0;
              const bDelivered = b.quantityDelivered || 0;
              const aRemaining = a.quantityRemaining || 0;
              const bRemaining = b.quantityRemaining || 0;
              aValue = aDelivered > 0 ? (aRemaining / aDelivered) * 100 : 0;
              bValue = bDelivered > 0 ? (bRemaining / bDelivered) * 100 : 0;
              break;
            case 'wastage':
              aValue = a.wastage || 0;
              bValue = b.wastage || 0;
              break;
            default:
              return 0;
          }

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }

      setMaterials(filteredMaterials);

      // Update pagination from API response
      if (data.data.pagination) {
        setPagination((prev) => ({
          ...prev,
          total: data.data.pagination.total || filteredMaterials.length,
          pages: data.data.pagination.pages || Math.ceil((data.data.pagination.total || filteredMaterials.length) / prev.limit),
        }));
      }

      // Calculate summary (from all materials, not just current page)
      // For accurate summary, we might need a separate summary endpoint
      const totalItems = data.data.pagination?.total || filteredMaterials.length;
      const lowStockCount = filteredMaterials.filter((m) => {
        const remaining = m.quantityRemaining || 0;
        const purchased = m.quantityPurchased || m.quantity || 0;
        const percentage = purchased > 0 ? (remaining / purchased) * 100 : 0;
        return percentage < 20 && percentage > 0;
      }).length;
      const pendingDelivery = filteredMaterials.filter(
        (m) => m.status === 'approved' && (m.quantityDelivered || 0) === 0
      ).length;
      const pendingApproval = filteredMaterials.filter((m) =>
        ['submitted', 'pending_approval'].includes(m.status)
      ).length;

      setSummary({
        totalItems,
        lowStockCount,
        pendingDelivery,
        pendingApproval,
      });

      // Show success toast on refresh
      if (isRefresh) {
        toast.showSuccess('Stock data refreshed successfully');
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch stock error:', err);
      if (isRefresh) {
        toast.showError('Failed to refresh stock data');
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleRefresh = async () => {
    await fetchStockData(true);
    await fetchMaterialRequests();
  };

  const fetchMaterialRequests = async () => {
    try {
      const response = await fetch('/api/material-requests?limit=1000');
      const data = await response.json();
      if (data.success) {
        setMaterialRequests(data.data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching material requests:', err);
    }
  };

  // Calculate quantity needed for low stock items
  const calculateQuantityNeeded = (material) => {
    const purchased = material.quantityPurchased || material.quantity || 0;
    const remaining = material.quantityRemaining || 0;
    const delivered = material.quantityDelivered || 0;
    
    // If material hasn't been delivered yet, suggest purchasing the full amount
    if (delivered === 0 && purchased > 0) {
      return purchased;
    }
    
    // If low stock, suggest replenishing to at least 50% of original purchased amount
    // Or if delivered, replenish to 50% of delivered amount
    const targetAmount = delivered > 0 ? delivered : purchased;
    const suggestedQuantity = Math.max(targetAmount * 0.5, targetAmount - remaining);
    
    // Round up to nearest reasonable amount
    return Math.ceil(suggestedQuantity);
  };

  // Check if material has an existing request
  const getExistingRequest = (material) => {
    // First, check if material has direct link to request
    if (material.materialRequestId) {
      const directRequest = materialRequests.find(
        req => req._id?.toString() === material.materialRequestId.toString()
      );
      if (directRequest) {
        return directRequest;
      }
    }
    
    // Fallback: name-based matching (only if no direct link)
    return materialRequests.find(
      (req) =>
        req.materialName?.toLowerCase() === (material.name || material.materialName)?.toLowerCase() &&
        req.projectId?.toString() === material.projectId?.toString() &&
        ['requested', 'pending_approval', 'approved', 'converted_to_order'].includes(req.status)
    );
  };

  // Check if material is low stock
  const isLowStock = (material) => {
    const purchased = material.quantityPurchased || material.quantity || 0;
    const remaining = material.quantityRemaining || 0;
    const delivered = material.quantityDelivered || 0;
    
    // If not delivered yet, it's not low stock (it's pending delivery)
    if (delivered === 0 && purchased > 0) {
      return false;
    }
    
    // If delivered, check percentage
    if (delivered > 0) {
      const percentage = (remaining / delivered) * 100;
      return percentage < 20 && percentage > 0;
    }
    
    return false;
  };

  const getStockStatus = (material) => {
    const purchased = material.quantityPurchased || material.quantity || 0;
    const delivered = material.quantityDelivered || 0;
    const remaining = material.quantityRemaining || 0;
    
    // If not delivered yet, show pending delivery status
    if (delivered === 0 && purchased > 0) {
      return {
        status: 'pending_delivery',
        percentage: null,
        label: 'Pending Delivery',
        color: 'bg-gray-100 text-gray-800',
      };
    }
    
    // If delivered, calculate stock percentage based on delivered quantity
    if (delivered > 0) {
      const percentage = delivered > 0 ? (remaining / delivered) * 100 : 0;
      let color = 'bg-green-100 text-green-800';
      let label = `${percentage.toFixed(1)}%`;
      
      if (percentage === 0) {
        color = 'bg-red-100 text-red-800';
        label = 'Depleted';
      } else if (percentage < 20) {
        color = 'bg-yellow-100 text-yellow-800';
      } else if (percentage < 50) {
        color = 'bg-blue-100 text-blue-800';
      }
      
      return {
        status: 'in_stock',
        percentage,
        label,
        color,
      };
    }
    
    // Default: no stock
    return {
      status: 'no_stock',
      percentage: 0,
      label: '0%',
      color: 'bg-red-100 text-red-800',
    };
  };

  const getStockStatusColor = (percentage) => {
    if (percentage === null) return 'bg-gray-100 text-gray-800';
    if (percentage === 0) return 'bg-red-100 text-red-800';
    if (percentage < 20) return 'bg-yellow-100 text-yellow-800';
    if (percentage < 50) return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  const getWastageColor = (wastage) => {
    if (wastage > 20) return 'text-red-600 font-bold';
    if (wastage > 10) return 'text-yellow-600';
    return 'text-gray-600';
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

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on filter change
  };

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
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Stock Tracking</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Monitor inventory levels and track wastage</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Refresh button - available to all users */}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Refresh stock data"
            >
              {refreshing ? (
                <>
                  <span className="animate-spin">⟳</span> Refreshing...
                </>
              ) : (
                <>
                  ⟳ Refresh
                </>
              )}
            </button>
            {canAccess('create_bulk_material_request') && summary.lowStockCount > 0 && (
              <>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" className="text-gray-900">Select Project</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id} className="text-gray-900">
                    {project.projectName}
                  </option>
                ))}
              </select>
              <LoadingButton
                onClick={handlePreviewAutoReorder}
                isLoading={autoReorderLoading}
                loadingText="Loading..."
                disabled={!selectedProjectId}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
              >
                📦 Auto-Create Bulk Request from Low Stock
              </LoadingButton>
              </>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wide">Total Items</h3>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">{summary.totalItems.toLocaleString()}</p>
              </div>
              <div className="bg-gray-100 rounded-full p-3">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-yellow-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-yellow-700 uppercase tracking-wide">Low Stock Alerts</h3>
                <p className="text-2xl sm:text-3xl font-bold text-yellow-900 mt-2">{summary.lowStockCount.toLocaleString()}</p>
                <p className="text-xs text-yellow-600 mt-1 font-medium">&lt;20% remaining</p>
              </div>
              <div className="bg-yellow-200 rounded-full p-3">
                <svg className="w-6 h-6 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-blue-700 uppercase tracking-wide">Pending Delivery</h3>
                <p className="text-2xl sm:text-3xl font-bold text-blue-900 mt-2">{summary.pendingDelivery.toLocaleString()}</p>
              </div>
              <div className="bg-blue-200 rounded-full p-3">
                <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-orange-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-orange-700 uppercase tracking-wide">Pending Approval</h3>
                <p className="text-2xl sm:text-3xl font-bold text-orange-900 mt-2">{summary.pendingApproval.toLocaleString()}</p>
              </div>
              <div className="bg-orange-200 rounded-full p-3">
                <svg className="w-6 h-6 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search Materials</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by material name, category, or supplier..."
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Floor</label>
                <input
                  type="text"
                  placeholder="Filter by floor..."
                  value={filters.floor}
                  onChange={(e) => handleFilterChange('floor', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.lowStockOnly}
                    onChange={(e) => handleFilterChange('lowStockOnly', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span className="ml-2 text-sm text-gray-700">Low stock only (&lt;20%)</span>
                </label>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilters({ category: '', floor: '', lowStockOnly: false, search: '' });
                    setPagination((prev) => ({ ...prev, page: 1 }));
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

        {/* Stock Table - Desktop View */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading stock data...</p>
          </div>
        ) : materials.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No materials found</h3>
            <p className="mt-2 text-sm text-gray-500">
              {filters.search || filters.category || filters.floor || filters.lowStockOnly
                ? 'Try adjusting your filters'
                : 'No stock data available'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center">
                          Material Name
                          <SortIcon columnKey="name" />
                        </div>
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Request
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Purchase Order
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Quantity
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('remaining')}
                      >
                        <div className="flex items-center">
                          Remaining
                          <SortIcon columnKey="remaining" />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('stockLevel')}
                      >
                        <div className="flex items-center">
                          Stock Level
                          <SortIcon columnKey="stockLevel" />
                        </div>
                      </th>
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('wastage')}
                      >
                        <div className="flex items-center">
                          Wastage
                          <SortIcon columnKey="wastage" />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Last Transaction
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Supplier
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {materials.map((material) => {
                      const stockStatus = getStockStatus(material);
                      const wastage = material.wastage || 0;
                      const purchased = material.quantityPurchased || material.quantity || 0;
                      const delivered = material.quantityDelivered || 0;
                      const pendingDelivery = purchased - delivered;

                      return (
                        <tr key={material._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <Link
                              href={`/items/${material._id}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-900"
                            >
                              {material.name || material.materialName}
                            </Link>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">{material.category || 'N/A'}</span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {material.materialRequestNumber ? (
                              <div className="flex flex-col">
                                <Link
                                  href={`/material-requests/${material.materialRequestId}`}
                                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                                >
                                  {material.materialRequestNumber}
                                </Link>
                                {material.materialRequestStatus && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${
                                    material.materialRequestStatus === 'approved'
                                      ? 'bg-green-100 text-green-800'
                                      : material.materialRequestStatus === 'converted_to_order'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {material.materialRequestStatus.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {material.purchaseOrderNumber ? (
                              <div className="flex flex-col">
                                <Link
                                  href={`/purchase-orders/${material.purchaseOrderId || material.linkedPurchaseOrderId}`}
                                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {material.purchaseOrderNumber}
                                </Link>
                                {material.isBulkOrder && (
                                  <span className="text-xs text-purple-600 mt-1">Bulk Order</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {purchased} {material.unit || ''}
                            </div>
                            {delivered > 0 && (
                              <div className="text-xs text-gray-600">
                                Delivered: {delivered} {material.unit || ''}
                              </div>
                            )}
                            {pendingDelivery > 0 && (
                              <div className="text-xs text-orange-600 font-medium">
                                Pending: {pendingDelivery} {material.unit || ''}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {material.quantityRemaining || 0} {material.unit || ''}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.color}`}
                            >
                              {stockStatus.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`text-sm ${getWastageColor(wastage)}`}>
                              {wastage > 0 ? `${wastage.toFixed(1)}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-500">
                              {material.updatedAt
                                ? new Date(material.updatedAt).toLocaleDateString()
                                : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {material.supplierName || material.supplier || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-2">
                              <Link
                                href={`/items/${material._id}`}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                View
                              </Link>
                              {isLowStock(material) && material.projectId && (() => {
                                const existingRequest = getExistingRequest(material);
                                const quantityNeeded = calculateQuantityNeeded(material);
                                
                                if (existingRequest) {
                                  return (
                                    <div className="flex flex-col gap-1">
                                      <Link
                                        href={`/material-requests/${existingRequest._id}`}
                                        className="text-xs text-green-600 hover:text-green-800 font-medium"
                                      >
                                        📋 Request: {existingRequest.requestNumber}
                                      </Link>
                                      <span className={`text-xs px-2 py-1 rounded-full inline-block ${
                                        existingRequest.status === 'approved'
                                          ? 'bg-green-100 text-green-800'
                                          : existingRequest.status === 'converted_to_order'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {existingRequest.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Pending'}
                                      </span>
                                    </div>
                                  );
                                }
                                
                                const requestParams = new URLSearchParams({
                                  materialName: material.name || material.materialName || '',
                                  quantityNeeded: quantityNeeded.toString(),
                                  projectId: material.projectId.toString(),
                                  category: material.category || '',
                                  categoryId: material.categoryId || '',
                                  urgency: 'high',
                                  unit: material.unit || 'piece',
                                });
                                
                                return (
                                  <Link
                                    href={`/material-requests/new?${requestParams.toString()}`}
                                    className="text-xs px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition"
                                  >
                                    📋 Create Request
                                  </Link>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {materials.map((material) => {
                const stockStatus = getStockStatus(material);
                const wastage = material.wastage || 0;
                const purchased = material.quantityPurchased || material.quantity || 0;
                const delivered = material.quantityDelivered || 0;
                const pendingDelivery = purchased - delivered;

                return (
                  <div key={material._id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <Link
                        href={`/items/${material._id}`}
                        className="text-base font-semibold text-blue-600 hover:text-blue-900 flex-1"
                      >
                        {material.name || material.materialName}
                      </Link>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ml-2 ${stockStatus.color}`}
                      >
                        {stockStatus.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
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
                        <span className="text-gray-500">Request:</span>
                        {material.materialRequestNumber ? (
                          <Link
                            href={`/material-requests/${material.materialRequestId}`}
                            className="ml-1 text-green-600 hover:text-green-800 font-medium text-sm"
                          >
                            {material.materialRequestNumber}
                          </Link>
                        ) : (
                          <span className="ml-1 text-gray-400 text-sm">N/A</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500">PO:</span>
                        {material.purchaseOrderNumber ? (
                          <Link
                            href={`/purchase-orders/${material.purchaseOrderId || material.linkedPurchaseOrderId}`}
                            className="ml-1 text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            {material.purchaseOrderNumber}
                            {material.isBulkOrder && <span className="text-xs text-purple-600 ml-1">(Bulk)</span>}
                          </Link>
                        ) : (
                          <span className="ml-1 text-gray-400 text-sm">N/A</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500">Quantity:</span>
                        <span className="ml-1 text-gray-900 font-medium">
                          {purchased} {material.unit || ''}
                        </span>
                        {delivered > 0 && (
                          <div className="text-xs text-gray-600 mt-0.5">
                            Delivered: {delivered} {material.unit || ''}
                          </div>
                        )}
                        {pendingDelivery > 0 && (
                          <div className="text-xs text-orange-600 font-medium mt-0.5">
                            Pending: {pendingDelivery} {material.unit || ''}
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500">Remaining:</span>
                        <span className="ml-1 text-gray-900 font-semibold">
                          {material.quantityRemaining || 0} {material.unit || ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Wastage:</span>
                        <span className={`ml-1 font-medium ${getWastageColor(wastage)}`}>
                          {wastage > 0 ? `${wastage.toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Last Update:</span>
                        <span className="ml-1 text-gray-600 text-xs">
                          {material.updatedAt
                            ? new Date(material.updatedAt).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-3 border-t border-gray-200">
                      <Link
                        href={`/items/${material._id}`}
                        className="text-sm text-blue-600 hover:text-blue-900 font-medium text-center py-2"
                      >
                        View Details →
                      </Link>
                      {isLowStock(material) && material.projectId && (() => {
                        const existingRequest = getExistingRequest(material);
                        const quantityNeeded = calculateQuantityNeeded(material);
                        
                        if (existingRequest) {
                          return (
                            <div className="space-y-1">
                              <Link
                                href={`/material-requests/${existingRequest._id}`}
                                className="block text-xs text-green-600 hover:text-green-800 font-medium text-center"
                              >
                                📋 Request: {existingRequest.requestNumber}
                              </Link>
                              <span className={`block text-xs px-2 py-1 rounded-full text-center ${
                                existingRequest.status === 'approved'
                                  ? 'bg-green-100 text-green-800'
                                  : existingRequest.status === 'converted_to_order'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {existingRequest.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Pending'}
                              </span>
                            </div>
                          );
                        }
                        
                        const requestParams = new URLSearchParams({
                          materialName: material.name || material.materialName || '',
                          quantityNeeded: quantityNeeded.toString(),
                          projectId: material.projectId.toString(),
                          category: material.category || '',
                          categoryId: material.categoryId || '',
                          urgency: 'high',
                          unit: material.unit || 'piece',
                        });
                        
                        return (
                          <Link
                            href={`/material-requests/new?${requestParams.toString()}`}
                            className="text-xs px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition text-center"
                          >
                            📋 Create Request
                          </Link>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
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

        {/* Auto-Reorder Preview Modal */}
        <ConfirmationModal
          isOpen={showAutoReorderModal}
          onClose={() => {
            setShowAutoReorderModal(false);
            setAutoReorderPreview(null);
          }}
          onConfirm={handleCreateAutoReorder}
          title="Auto-Create Bulk Request from Low Stock"
          message={
            autoReorderPreview ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  The following {autoReorderPreview.materials?.length || 0} material(s) will be added to a bulk request:
                </p>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Material</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Unit</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {autoReorderPreview.materials?.map((material, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 text-gray-900">{material.name}</td>
                          <td className="px-3 py-2 text-gray-600">{material.quantityNeeded}</td>
                          <td className="px-3 py-2 text-gray-600">{material.unit}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {material.estimatedCost
                              ? new Intl.NumberFormat('en-KE', {
                                  style: 'currency',
                                  currency: 'KES',
                                }).format(material.estimatedCost)
                              : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {autoReorderPreview.summary && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-900">
                      Total Estimated Cost:{' '}
                      {new Intl.NumberFormat('en-KE', {
                        style: 'currency',
                        currency: 'KES',
                      }).format(autoReorderPreview.summary.estimatedTotalCost || 0)}
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-600">
                  Click "Confirm" to create the bulk request, or "Cancel" to go back.
                </p>
              </div>
            ) : (
              'Loading preview...'
            )
          }
          confirmText="Create Bulk Request"
          confirmColor="green"
          isLoading={autoReorderLoading}
        />
      </div>
    </AppLayout>
  );
}

