/**
 * Purchase Orders List Page
 * Displays all purchase orders with filtering, sorting, and pagination
 * 
 * Route: /purchase-orders
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState } from '@/components/empty-states';
import { PhaseFilter } from '@/components/filters/PhaseFilter';

function PurchaseOrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess, user } = usePermissions();
  const { currentProject, isEmpty } = useProjectContext();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [projects, setProjects] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  // Get projectId from context (prioritize current project over URL param)
  const projectIdFromContext = normalizeProjectId(currentProject?._id);
  const projectIdFromUrl = searchParams.get('projectId');
  const activeProjectId = projectIdFromContext || projectIdFromUrl || '';
  
  // Filters
  const [filters, setFilters] = useState({
    projectId: activeProjectId,
    status: searchParams.get('status') || '',
    supplierId: searchParams.get('supplierId') || '',
    phaseId: searchParams.get('phaseId') || '',
    search: searchParams.get('search') || '',
  });

  // Check if user has access to purchase orders
  useEffect(() => {
    if (user) {
      const userRole = user.role?.toLowerCase();
      if (userRole === 'clerk' || userRole === 'site_clerk') {
        toast.showError('You do not have permission to view purchase orders');
        router.push('/dashboard/clerk');
        return;
      }
      if (!canAccess('view_purchase_orders')) {
        toast.showError('You do not have permission to view purchase orders');
        router.push('/dashboard');
        return;
      }
    }
  }, [user, canAccess, router, toast]);

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

  const fetchSuppliers = async () => {
    try {
      // Updated to use suppliers collection instead of users
      const response = await fetch('/api/suppliers?status=active&limit=100');
      const data = await response.json();
      if (data.success) {
        setSuppliers(data.data.suppliers || []);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.supplierId && { supplierId: filters.supplierId }),
        ...(filters.phaseId && { phaseId: filters.phaseId }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/purchase-orders?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch purchase orders');
      }

      setOrders(data.data.orders || []);
      setPagination(prev => data.data.pagination || prev);
    } catch (err) {
      setError(err.message);
      console.error('Fetch purchase orders error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  // Fetch purchase orders
  useEffect(() => {
    // Don't fetch if empty state
    if (isEmpty) {
      setLoading(false);
      setOrders([]);
      return;
    }
    
    fetchOrders();
  }, [fetchOrders, isEmpty]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on filter change
    
    // Update URL params
    const params = new URLSearchParams();
    Object.entries({ ...filters, [key]: value }).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/purchase-orders?${params.toString()}`, { scroll: false });
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      order_sent: 'bg-blue-100 text-blue-800',
      order_accepted: 'bg-green-100 text-green-800',
      order_rejected: 'bg-red-100 text-red-800',
      order_modified: 'bg-yellow-100 text-yellow-800',
      ready_for_delivery: 'bg-purple-100 text-purple-800',
      delivered: 'bg-indigo-100 text-indigo-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getFinancialStatusBadgeColor = (financialStatus) => {
    const colors = {
      not_committed: 'bg-gray-100 text-gray-800',
      committed: 'bg-orange-100 text-orange-800',
      fulfilled: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[financialStatus] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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

  if (loading && orders.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    );
  }

  // Check empty state - no projects
  if (isEmpty && !loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Purchase Orders</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Manage purchase orders and supplier interactions</p>
          </div>
          <NoProjectsEmptyState
            canCreate={canAccess('create_project')}
            role={canAccess('create_project') ? 'owner' : 'pm'}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Purchase Orders</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Manage purchase orders and supplier interactions</p>
          </div>
          {canAccess('create_purchase_order') && (
            <Link
              href="/purchase-orders/new"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
            >
              + New Order
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Project</label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map((project, index) => (
                  <option key={project._id?.toString() || project.id?.toString() || `project-${index}`} value={project._id?.toString() || project.id?.toString() || ''}>
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="order_sent">Order Sent</option>
                <option value="order_accepted">Order Accepted</option>
                <option value="order_rejected">Order Rejected</option>
                <option value="order_modified">Order Modified</option>
                <option value="ready_for_delivery">Ready for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {canAccess('view_purchase_orders') && (
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Supplier</label>
                <select
                  value={filters.supplierId}
                  onChange={(e) => handleFilterChange('supplierId', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map((supplier, index) => {
                    const supplierId = supplier._id?.toString() || supplier.id?.toString() || '';
                    const displayName = supplier.name || supplier.contactPerson || supplier.email || 'Unknown Supplier';
                    return (
                      <option key={supplierId || `supplier-${index}`} value={supplierId}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            <PhaseFilter
              projectId={filters.projectId}
              value={filters.phaseId}
              onChange={(phaseId) => handleFilterChange('phaseId', phaseId)}
            />
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by order number, material..."
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ projectId: '', status: '', supplierId: '', phaseId: '', search: '' });
                  router.push('/purchase-orders', { scroll: false });
                }}
                className="w-full px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Orders Table */}
        {orders.length === 0 && !loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-lg text-gray-700 mb-4">No purchase orders found</p>
            {canAccess('create_purchase_order') && (
              <Link
                href="/purchase-orders/new"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                Create Your First Order
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Order Number
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Material
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Phase
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Total Cost
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Financial Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Delivery Date
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order, index) => {
                    const canView = canAccess('view_purchase_orders');
                    const canAccept = canAccess('accept_purchase_order') && order.status === 'order_sent' && order.supplierId;
                    const canReject = canAccess('reject_purchase_order') && order.status === 'order_sent' && order.supplierId;
                    const canModify = canAccess('modify_purchase_order') && order.status === 'order_sent' && order.supplierId;
                    const canFulfill = canAccess('fulfill_purchase_order') && order.status === 'order_accepted' && order.supplierId;
                    const canCreateMaterial = canAccess('create_material_from_order') && order.status === 'ready_for_delivery';

                    return (
                      <tr key={order._id?.toString() || order.id?.toString() || `order-${index}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/purchase-orders/${order._id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {order.purchaseOrderNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{order.materialName}</div>
                          {order.description && (
                            <div className="text-sm text-gray-700 truncate max-w-xs">{order.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.phaseName ? (
                            <Link
                              href={`/phases/${order.phaseId}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {order.phaseName}
                            </Link>
                          ) : order.phaseId ? (
                            <span className="text-gray-500 italic">Phase ID: {order.phaseId.toString().substring(0, 8)}...</span>
                          ) : (
                            <span className="text-red-500 italic">No Phase</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.supplierName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.quantityOrdered} {order.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {formatCurrency(order.totalCost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full leading-normal ${getStatusBadgeColor(order.status)}`}>
                            {order.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full leading-normal ${getFinancialStatusBadgeColor(order.financialStatus)}`}>
                            {order.financialStatus?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {formatDate(order.deliveryDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            {canView && (
                              <Link
                                href={`/purchase-orders/${order._id}`}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                View
                              </Link>
                            )}
                            {canAccept && (
                              <Link
                                href={`/purchase-orders/${order._id}?action=accept`}
                                className="text-green-600 hover:text-green-800"
                              >
                                Accept
                              </Link>
                            )}
                            {canReject && (
                              <Link
                                href={`/purchase-orders/${order._id}?action=reject`}
                                className="text-red-600 hover:text-red-800"
                              >
                                Reject
                              </Link>
                            )}
                            {canModify && (
                              <Link
                                href={`/purchase-orders/${order._id}?action=modify`}
                                className="text-yellow-600 hover:text-yellow-800"
                              >
                                Modify
                              </Link>
                            )}
                            {canFulfill && (
                              <Link
                                href={`/purchase-orders/${order._id}?action=fulfill`}
                                className="text-purple-600 hover:text-purple-800"
                              >
                                Fulfill
                              </Link>
                            )}
                            {canCreateMaterial && (
                              <Link
                                href={`/purchase-orders/${order._id}?action=create-material`}
                                className="text-indigo-600 hover:text-indigo-800"
                              >
                                Create Material
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} orders
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    }>
      <PurchaseOrdersPageContent />
    </Suspense>
  );
}

