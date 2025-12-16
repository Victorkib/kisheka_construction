/**
 * Supplier Detail Page
 * View supplier details and related purchase orders
 * 
 * Route: /suppliers/[id]
 * Auth: OWNER, PM only
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';

function SupplierDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params?.id;
  const { canAccess, user } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    if (user) {
      if (!canAccess('view_suppliers')) {
        toast.showError('You do not have permission to view suppliers');
        router.push('/dashboard');
        return;
      }
      if (supplierId) {
        fetchSupplier();
      }
    }
  }, [user, canAccess, supplierId, router, toast]);

  const fetchSupplier = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/suppliers/${supplierId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch supplier');
      }

      setSupplier(data.data.supplier);
      setRecentOrders(data.data.recentOrders || []);
      setOrderCount(data.data.orderCount || 0);
    } catch (err) {
      setError(err.message);
      console.error('Fetch supplier error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete supplier "${supplier?.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/suppliers/${supplierId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete supplier');
      }

      toast.showSuccess('Supplier deleted successfully');
      router.push('/suppliers');
    } catch (err) {
      toast.showError(err.message || 'Failed to delete supplier');
      console.error('Delete supplier error:', err);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-900 font-semibold',
      inactive: 'bg-gray-100 text-gray-900 font-semibold',
      suspended: 'bg-red-100 text-red-900 font-semibold'
    };
    return badges[status] || badges.inactive;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-900 font-medium">Loading supplier...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !supplier) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border-2 border-red-300 text-red-900 px-4 py-3 rounded mb-6 font-medium">
            {error || 'Supplier not found'}
          </div>
          <Link href="/suppliers" className="text-blue-600 hover:text-blue-800 underline font-semibold">
            ← Back to Suppliers
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <Link href="/suppliers" className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block font-semibold underline">
              ← Back to Suppliers
            </Link>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              {supplier.name}
            </h1>
            <p className="text-gray-700 mt-2 font-medium">Supplier Details</p>
          </div>
          <div className="flex gap-2">
            {canAccess('edit_supplier') && (
              <Link
                href={`/suppliers/${supplierId}/edit`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold shadow-md"
              >
                Edit
              </Link>
            )}
            {canAccess('delete_supplier') && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold shadow-md"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${getStatusBadge(supplier.status)}`}>
                    {supplier.status}
                  </span>
                </div>
                {supplier.contactPerson && (
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Contact Person</p>
                    <p className="font-semibold text-gray-900">{supplier.contactPerson}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">Email</p>
                  <p className="font-semibold text-gray-900">{supplier.email}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Phone</p>
                  <p className="font-semibold text-gray-900">{supplier.phone}</p>
                </div>
                {supplier.alternateEmail && (
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Alternate Email</p>
                    <p className="font-semibold text-gray-900">{supplier.alternateEmail}</p>
                  </div>
                )}
                {supplier.alternatePhone && (
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Alternate Phone</p>
                    <p className="font-semibold text-gray-900">{supplier.alternatePhone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Business Details */}
            {(supplier.businessType || supplier.taxId || supplier.address) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Details</h2>
                <div className="space-y-4">
                  {supplier.businessType && (
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Business Type</p>
                      <p className="font-semibold text-gray-900">{supplier.businessType}</p>
                    </div>
                  )}
                  {supplier.taxId && (
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Tax ID</p>
                      <p className="font-semibold text-gray-900">{supplier.taxId}</p>
                    </div>
                  )}
                  {supplier.address && (
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Address</p>
                      <p className="font-semibold text-gray-900">{supplier.address}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Communication Preferences */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Communication Preferences</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${supplier.emailEnabled ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  <span className="text-sm font-semibold text-gray-900">Email Notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${supplier.smsEnabled ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  <span className="text-sm font-semibold text-gray-900">SMS Notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${supplier.pushNotificationsEnabled ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  <span className="text-sm font-semibold text-gray-900">Push Notifications</span>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-gray-900">Preferred Method</p>
                  <p className="font-semibold text-gray-900 capitalize">{supplier.preferredContactMethod?.replace(/_/g, ' ')}</p>
                </div>
              </div>
            </div>

            {/* Specialties */}
            {supplier.specialties && supplier.specialties.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Specialties</h2>
                <div className="flex flex-wrap gap-2">
                  {supplier.specialties.map((specialty, index) => (
                    <span
                      key={index}
                      className="inline-flex px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm font-semibold"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {supplier.notes && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
                <p className="text-gray-900 whitespace-pre-wrap font-medium">{supplier.notes}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Statistics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Total Purchase Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{orderCount}</p>
                </div>
                {supplier.rating && (
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Rating</p>
                    <p className="text-2xl font-bold text-gray-900">{supplier.rating}/5</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">Created</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Orders */}
            {recentOrders.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <Link
                      key={order._id}
                      href={`/purchase-orders/${order._id}`}
                      className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <p className="font-semibold text-gray-900 text-sm">{order.purchaseOrderNumber}</p>
                      <p className="text-xs text-gray-700 mt-1 font-medium">{order.materialName}</p>
                      <p className="text-xs text-gray-700 mt-1 font-medium">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </Link>
                  ))}
                </div>
                {orderCount > recentOrders.length && (
                  <Link
                    href={`/purchase-orders?supplierId=${supplierId}`}
                    className="block mt-4 text-center text-sm text-blue-600 hover:text-blue-800 font-semibold underline"
                  >
                    View All Orders →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function SupplierDetailPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-900 font-medium">Loading...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <SupplierDetailPageContent />
    </Suspense>
  );
}

