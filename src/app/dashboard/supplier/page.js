/**
 * Supplier Dashboard
 * Overview of supplier activities, delivery notes, and materials
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingCard } from '@/components/loading';

export default function SupplierDashboard() {
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const [userResponse, ordersResponse] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/purchase-orders?limit=10'),
        ]);

        const userData = await userResponse.json();
        const ordersData = await ordersResponse.json();

        if (!userData.success) {
          router.push('/auth/login');
          return;
        }

        setUser(userData.data);
        
        if (ordersData.success) {
          const orders = ordersData.data.orders || [];
          const totalOrders = ordersData.data.pagination?.total || 0;
          const pendingCount = orders.filter(o => o.status === 'order_sent' || o.status === 'order_modified').length;
          const acceptedCount = orders.filter(o => o.status === 'order_accepted').length;
          const fulfilledCount = orders.filter(o => o.status === 'ready_for_delivery' || o.status === 'delivered').length;
          const rejectedCount = orders.filter(o => o.status === 'order_rejected').length;
          const totalValue = orders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
          
          setSummary({
            totalOrders,
            totalValue,
            pendingCount,
            acceptedCount,
            fulfilledCount,
            rejectedCount,
            recentOrders: orders.slice(0, 5),
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-96"></div>
            </div>
            <LoadingCard count={4} showHeader={true} lines={3} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Supplier Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {user.firstName || user.email}!</p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Total Orders</h2>
              <p className="text-3xl font-bold text-blue-600">{summary.totalOrders || 0}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Total Value</h2>
              <p className="text-3xl font-bold text-indigo-600">
                {new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                  minimumFractionDigits: 0,
                }).format(summary.totalValue || 0)}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Pending Response</h2>
              <p className="text-3xl font-bold text-yellow-600">{summary.pendingCount || 0}</p>
              {summary.pendingCount > 0 && (
                <p className="text-sm text-gray-600 mt-1 leading-normal">Orders awaiting your response</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Fulfilled</h2>
              <p className="text-3xl font-bold text-green-600">{summary.fulfilledCount || 0}</p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/supplier/purchase-orders"
              className="p-6 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
            >
              <div className="text-4xl mb-3">📦</div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">My Purchase Orders</h3>
              <p className="text-sm text-gray-600">View and manage all purchase orders</p>
            </Link>

            <Link
              href="/supplier/purchase-orders?status=order_sent"
              className="p-6 border-2 border-yellow-200 rounded-lg hover:border-yellow-500 hover:bg-yellow-50 transition text-center"
            >
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">Pending Orders</h3>
              <p className="text-sm text-gray-600">
                {summary?.pendingCount || 0} orders need your response
              </p>
            </Link>

            <Link
              href="/supplier/delivery-notes"
              className="p-6 border-2 border-green-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition text-center"
            >
              <div className="text-4xl mb-3">📋</div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">Delivery Notes</h3>
              <p className="text-sm text-gray-600">View delivery notes (legacy)</p>
            </Link>
          </div>
        </div>

        {/* Recent Purchase Orders */}
        {summary && summary.recentOrders && summary.recentOrders.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Purchase Orders</h2>
              <Link
                href="/supplier/purchase-orders"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {summary.recentOrders.map((order) => {
                const getStatusBadgeColor = (status) => {
                  const colors = {
                    order_sent: 'bg-blue-100 text-blue-800',
                    order_accepted: 'bg-green-100 text-green-800',
                    order_rejected: 'bg-red-100 text-red-800',
                    order_modified: 'bg-yellow-100 text-yellow-800',
                    ready_for_delivery: 'bg-purple-100 text-purple-800',
                    delivered: 'bg-indigo-100 text-indigo-800',
                  };
                  return colors[status] || 'bg-gray-100 text-gray-800';
                };

                return (
                  <Link
                    key={order._id}
                    href={`/supplier/purchase-orders/${order._id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{order.purchaseOrderNumber}</h3>
                      <p className="text-sm text-gray-500">
                        {order.materialName} • {order.quantityOrdered} {order.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(order.status)}`}>
                        {order.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Information Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-md font-semibold text-blue-900 mb-2">ℹ️ Supplier Information</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Respond to purchase orders by accepting, rejecting, or proposing modifications</li>
            <li>• When you accept an order, it becomes committed and you should prepare for delivery</li>
            <li>• Fulfill orders by uploading delivery notes when materials are ready</li>
            <li>• You can view all your purchase orders in the Purchase Orders section</li>
            <li>• Contact the Project Manager if you need assistance</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}

