/**
 * Purchase Order Rejections Dashboard
 * Displays all rejected purchase orders with filtering, analytics, and reassignment options
 * 
 * Route: /purchase-orders/rejections
 * Auth: PM, OWNER
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState } from '@/components/empty-states';
import { AlertCircle, CheckCircle, Clock, DollarSign, Package, RefreshCw, TrendingDown, Filter } from 'lucide-react';

function RejectionsDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess, user } = usePermissions();
  const {
    currentProject,
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  const toast = useToast();
  
  const [rejections, setRejections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [projects, setProjects] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [reassigningOrderId, setReassigningOrderId] = useState(null);
  
  // Get projectId from context
  const projectIdFromContext = normalizeProjectId(currentProject?._id) || currentProjectId || '';
  const projectIdFromUrl = searchParams.get('projectId');
  // Prioritize context over URL, but use URL if context not available yet
  const activeProjectId = projectIdFromContext || projectIdFromUrl || '';
  
  // Initialize filters - use URL projectId if available, otherwise wait for context
  const [filters, setFilters] = useState(() => {
    // Get initial projectId - prioritize URL, then context
    const urlProjectId = searchParams.get('projectId');
    const contextProjectId = normalizeProjectId(currentProject?._id) || currentProjectId || '';
    const initialProjectId = urlProjectId || contextProjectId || '';
    
    return {
      projectId: initialProjectId,
      rejectionReason: searchParams.get('rejectionReason') || '',
      isRetryable: searchParams.get('isRetryable') || '',
      needsReassignment: searchParams.get('needsReassignment') || '',
      supplierId: searchParams.get('supplierId') || '',
      search: searchParams.get('search') || '',
    };
  });

  // Sync filters.projectId with currentProject when it changes
  useEffect(() => {
    const newProjectId = normalizeProjectId(currentProject?._id);
    // Use URL projectId as fallback if currentProject not loaded yet
    const urlProjectId = searchParams.get('projectId');
    // Prioritize context projectId over URL (context is source of truth)
    const projectIdToUse = newProjectId || urlProjectId || '';
    
    // Always update if we have a projectId and it's different from current filter
    // This handles the case where filter starts empty and project loads later
    if (projectIdToUse) {
      setFilters((prev) => {
        // If projectId hasn't changed, don't update
        if (prev.projectId === projectIdToUse) {
          return prev;
        }
        
        // Update filters with new projectId
        const updatedFilters = {
          ...prev,
          projectId: projectIdToUse
        };
        
        // Update URL params to reflect current project
        const params = new URLSearchParams();
        params.set('projectId', projectIdToUse);
        // Preserve other filters
        Object.entries(updatedFilters).forEach(([k, v]) => {
          if (k !== 'projectId' && v) {
            params.set(k, v);
          }
        });
        router.replace(`/purchase-orders/rejections?${params.toString()}`, { scroll: false });
        
        return updatedFilters;
      });
    } else if (!currentProject && !urlProjectId) {
      // If no project context and no URL param, ensure filter is cleared
      setFilters((prev) => {
        if (prev.projectId === '') {
          return prev;
        }
        return { ...prev, projectId: '' };
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject, searchParams]);

  // Check permissions
  useEffect(() => {
    if (user) {
      if (!canAccess('view_purchase_orders')) {
        toast.showError('You do not have permission to view purchase orders');
        router.push('/dashboard');
        return;
      }
    }
  }, [user, canAccess, router, toast]);

  useEffect(() => {
    setProjects(accessibleProjects || []);
  }, [accessibleProjects]);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers?status=active&limit=100');
      const data = await response.json();
      if (data.success) {
        setSuppliers(data.data.suppliers || []);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const fetchRejections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: 'order_rejected,order_partially_responded', // Include partial responses with rejections
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.rejectionReason && { rejectionReason: filters.rejectionReason }),
        ...(filters.isRetryable && { isRetryable: filters.isRetryable }),
        ...(filters.needsReassignment && { needsReassignment: filters.needsReassignment }),
        ...(filters.supplierId && { supplierId: filters.supplierId }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/purchase-orders?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch rejections');
      }

      // API should already filter by status, but do a safety check for rejected orders
      // This handles edge cases where API might return other statuses
      const rejectedOrders = (data.data.orders || []).filter(
        order => {
          // Primary check: status is rejected
          if (order.status === 'order_rejected') {
            return true;
          }
          // Secondary check: partially responded with at least one rejection
          if (order.status === 'order_partially_responded' && order.materialResponses) {
            return order.materialResponses.some(mr => mr.action === 'reject');
          }
          return false;
        }
      );

      console.log('[Rejections Dashboard] Fetch details:', {
        queryParams: queryParams.toString(),
        totalOrders: data.data.orders?.length || 0,
        rejectedOrders: rejectedOrders.length,
        orders: data.data.orders?.map(o => ({ 
          po: o.purchaseOrderNumber, 
          status: o.status, 
          projectId: o.projectId?.toString() 
        })) || []
      });

      setRejections(rejectedOrders);
      // Use API pagination if available, otherwise calculate from filtered results
      if (data.data.pagination) {
        setPagination(prev => ({
          ...prev,
          total: rejectedOrders.length, // Use filtered count
          pages: Math.ceil(rejectedOrders.length / prev.limit)
        }));
      } else {
        setPagination(prev => ({ ...prev, total: rejectedOrders.length, pages: Math.ceil(rejectedOrders.length / prev.limit) }));
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch rejections error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams({
        ...(filters.projectId && { projectId: filters.projectId }),
      });

      const response = await fetch(`/api/purchase-orders/analytics/rejections?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  }, [filters.projectId]);

  // Fetch suppliers on mount (independent of other filters)
  useEffect(() => {
    if (!isEmpty) {
      fetchSuppliers();
    }
  }, [isEmpty]); // Run when isEmpty changes

  // Fetch rejections and analytics when filters or project context changes
  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setRejections([]);
      setAnalytics(null);
      return;
    }
    
    if (!filters.projectId && projectLoading) {
      return;
    }
    // Only fetch rejections and analytics if we have a projectId
    // This ensures we don't fetch all projects' data when project context is loading
    if (filters.projectId || projectIdFromContext || projectIdFromUrl) {
      fetchRejections();
      fetchAnalytics();
    }
  }, [fetchRejections, fetchAnalytics, isEmpty, filters.projectId, projectIdFromContext, projectIdFromUrl, projectLoading]);

  const handleFilterChange = (key, value) => {
    const updatedFilters = key === 'projectId'
      ? { ...filters, projectId: value }
      : { ...filters, [key]: value };
    setFilters(updatedFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
    
    // Update URL params
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/purchase-orders/rejections?${params.toString()}`, { scroll: false });
    if (key === 'projectId' && value && value !== currentProjectId) {
      switchProject(value).catch((err) => {
        console.error('Error switching project:', err);
      });
    }
  };

  const handleAutoReassign = async (orderId, mode = 'simple') => {
    try {
      setReassigningOrderId(orderId);
      
      const response = await fetch(`/api/purchase-orders/${orderId}/auto-reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, limit: 5, autoCreate: false }) // Don't auto-create, just suggest
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to find alternatives');
      }

      if (data.data.alternatives && data.data.alternatives.length > 0) {
        toast.showSuccess(`Found ${data.data.alternatives.length} alternative supplier(s)`);
        // TODO: Show alternatives modal for user to select
        // For now, just show success
      } else {
        toast.showWarning('No alternative suppliers found');
      }

      // Refresh rejections
      fetchRejections();
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setReassigningOrderId(null);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
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

  const getRejectionReasonColor = (reason) => {
    const colors = {
      price_too_high: 'bg-orange-100 text-orange-800',
      unavailable: 'bg-red-100 text-red-800',
      timeline: 'bg-yellow-100 text-yellow-800',
      specifications: 'bg-purple-100 text-purple-800',
      quantity: 'bg-blue-100 text-blue-800',
      business_policy: 'bg-gray-100 text-gray-800',
      external_factors: 'bg-teal-100 text-teal-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[reason] || 'bg-gray-100 text-gray-800';
  };

  if (loading && rejections.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    );
  }

  if (isEmpty && !loading) {
    return (
      <AppLayout>
        <NoProjectsEmptyState />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Rejected Purchase Orders</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage and reassign rejected purchase orders
                {currentProject && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium">
                    Project: {currentProject.projectName || 'Current Project'}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Rejections</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalRejections || 0}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Retryable</p>
                  <p className="text-2xl font-bold text-green-600">{analytics.retryableCount || 0}</p>
                </div>
                <RefreshCw className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Needs Reassignment</p>
                  <p className="text-2xl font-bold text-orange-600">{analytics.needsReassignmentCount || 0}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-orange-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.totalValue || 0)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-gray-500" />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select
                value={filters.projectId || ''}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Projects</option>
                {projects && projects.length > 0 ? (
                  projects.map((project) => {
                    const projectId = project._id?.toString() || project._id || '';
                    const projectName = project.projectName || project.name || 'Unnamed Project';
                    return (
                      <option key={projectId} value={projectId}>
                        {projectName}
                      </option>
                    );
                  })
                ) : (
                  <option value="" disabled>Loading projects...</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
              <select
                value={filters.rejectionReason}
                onChange={(e) => handleFilterChange('rejectionReason', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Reasons</option>
                <option value="price_too_high">Price Too High</option>
                <option value="unavailable">Unavailable</option>
                <option value="timeline">Timeline Issues</option>
                <option value="specifications">Specifications</option>
                <option value="quantity">Quantity Issues</option>
                <option value="business_policy">Business Policy</option>
                <option value="external_factors">External Factors</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retryable</label>
              <select
                value={filters.isRetryable}
                onChange={(e) => handleFilterChange('isRetryable', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All</option>
                <option value="true">Retryable</option>
                <option value="false">Not Retryable</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reassignment</label>
              <select
                value={filters.needsReassignment}
                onChange={(e) => handleFilterChange('needsReassignment', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All</option>
                <option value="true">Needs Reassignment</option>
                <option value="false">No Reassignment Needed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select
                value={filters.supplierId}
                onChange={(e) => handleFilterChange('supplierId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier._id} value={supplier._id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="PO number, material..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => {
                setFilters({
                  projectId: activeProjectId,
                  rejectionReason: '',
                  isRetryable: '',
                  needsReassignment: '',
                  supplierId: '',
                  search: '',
                });
                router.push('/purchase-orders/rejections', { scroll: false });
              }}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Rejections Table */}
        {loading ? (
          <LoadingTable rows={5} columns={8} />
        ) : rejections.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Rejections Found</h3>
            <p className="text-gray-600">No rejected purchase orders match your filters.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PO Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Material
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rejection Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rejected Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rejections.map((order) => (
                    <tr key={order._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={`/purchase-orders/${order._id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {order.purchaseOrderNumber}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{order.materialName}</div>
                        {order.isBulkOrder && (
                          <div className="text-xs text-gray-500">
                            {order.materials?.length || 0} materials
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.supplierName}</div>
                      </td>
                      <td className="px-6 py-4">
                        {order.rejectionReason ? (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRejectionReasonColor(order.rejectionReason)}`}>
                            {order.rejectionMetadata?.formattedReason || order.rejectionReason}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">Not specified</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          {order.isRetryable ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Retryable
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              Not Retryable
                            </span>
                          )}
                          {order.needsReassignment && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                              Needs Reassignment
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(order.totalCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.supplierResponseDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAutoReassign(order._id, 'simple')}
                            disabled={reassigningOrderId === order._id}
                            className="text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Find alternative suppliers"
                          >
                            <RefreshCw className={`w-4 h-4 ${reassigningOrderId === order._id ? 'animate-spin' : ''}`} />
                          </button>
                          <a
                            href={`/purchase-orders/${order._id}`}
                            className="text-gray-600 hover:text-gray-800"
                            title="View details"
                          >
                            View
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-medium">{pagination.total}</span> rejections
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function RejectionsDashboardPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={5} columns={8} />
          </div>
        </AppLayout>
      }
    >
      <RejectionsDashboardContent />
    </Suspense>
  );
}

