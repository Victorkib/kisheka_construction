/**
 * Supplier Purchase Orders List Page
 * Displays all purchase orders sent to the logged-in supplier
 * 
 * Route: /supplier/purchase-orders
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { useToast } from '@/components/toast';

function SupplierPurchaseOrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [summary, setSummary] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
  });

  // Fetch purchase orders
  useEffect(() => {
    fetchOrders();
    fetchSummary();
    fetchNotificationCount();
  }, [filters, pagination.page]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string - supplier filtering is handled by API
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/purchase-orders?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch purchase orders');
      }

      setOrders(data.data.orders || []);
      setPagination(data.data.pagination || pagination);
    } catch (err) {
      setError(err.message);
      console.error('Fetch purchase orders error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/purchase-orders?limit=0'); // Get all for summary
      const data = await response.json();
      if (data.success) {
        const allOrders = data.data.orders || [];
        const totalOrders = allOrders.length;
        const totalValue = allOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
        const pendingCount = allOrders.filter(o => o.status === 'order_sent' || o.status === 'order_modified').length;
        const acceptedCount = allOrders.filter(o => o.status === 'order_accepted').length;
        const fulfilledCount = allOrders.filter(o => o.status === 'ready_for_delivery' || o.status === 'delivered').length;
        const rejectedCount = allOrders.filter(o => o.status === 'order_rejected').length;

        setSummary({
          totalOrders,
          totalValue,
          pendingCount,
          acceptedCount,
          fulfilledCount,
          rejectedCount,
        });
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const fetchNotificationCount = async () => {
    try {
      const response = await fetch('/api/notifications?unread=true&type=purchase_order_new');
      const data = await response.json();
      if (data.success) {
        setNotificationCount(data.data.notifications?.length || 0);
      }
    } catch (err) {
      console.error('Error fetching notification count:', err);
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
    router.push(`/supplier/purchase-orders?${params.toString()}`, { scroll: false });
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">My Purchase Orders</h1>
              <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Manage your purchase orders and respond to requests</p>
            </div>
            {notificationCount > 0 && (
              <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-2 rounded-lg">
                <span className="font-semibold">{notificationCount}</span> new order{notificationCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-semibold text-gray-500">Total Orders</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{summary.totalOrders}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-semibold text-gray-500">Total Value</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.totalValue)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-semibold text-gray-500">Pending</div>
              <div className="text-2xl font-bold text-yellow-600 mt-1">{summary.pendingCount}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm font-semibold text-gray-500">Fulfilled</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{summary.fulfilledCount}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="order_sent">Order Sent</option>
                <option value="order_accepted">Order Accepted</option>
                <option value="order_rejected">Order Rejected</option>
                <option value="order_modified">Order Modified</option>
                <option value="ready_for_delivery">Ready for Delivery</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by order number, material..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ status: '', search: '' });
                  router.push('/supplier/purchase-orders', { scroll: false });
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
            <p className="text-lg text-gray-600 mb-4">No purchase orders found</p>
            <p className="text-sm text-gray-500">You will receive notifications when new orders are sent to you.</p>
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
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Total Cost
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Delivery Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Sent At
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => {
                    const canAccept = order.status === 'order_sent' || order.status === 'order_modified';
                    const canReject = order.status === 'order_sent' || order.status === 'order_modified';
                    const canModify = order.status === 'order_sent';
                    const canFulfill = order.status === 'order_accepted';

                    return (
                      <tr key={order._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/supplier/purchase-orders/${order._id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {order.purchaseOrderNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{order.materialName}</div>
                          {order.description && (
                            <div className="text-sm text-gray-600 truncate max-w-xs">{order.description}</div>
                          )}
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(order.deliveryDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(order.sentAt || order.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/supplier/purchase-orders/${order._id}`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              View
                            </Link>
                            {canAccept && (
                              <Link
                                href={`/supplier/purchase-orders/${order._id}?action=accept`}
                                className="text-green-600 hover:text-green-800"
                              >
                                Accept
                              </Link>
                            )}
                            {canReject && (
                              <Link
                                href={`/supplier/purchase-orders/${order._id}?action=reject`}
                                className="text-red-600 hover:text-red-800"
                              >
                                Reject
                              </Link>
                            )}
                            {canModify && (
                              <Link
                                href={`/supplier/purchase-orders/${order._id}?action=modify`}
                                className="text-yellow-600 hover:text-yellow-800"
                              >
                                Modify
                              </Link>
                            )}
                            {canFulfill && (
                              <Link
                                href={`/supplier/purchase-orders/${order._id}?action=fulfill`}
                                className="text-purple-600 hover:text-purple-800"
                              >
                                Fulfill
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

export default function SupplierPurchaseOrdersPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    }>
      <SupplierPurchaseOrdersPageContent />
    </Suspense>
  );
}

