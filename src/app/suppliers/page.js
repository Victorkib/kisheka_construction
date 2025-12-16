/**
 * Suppliers List Page
 * Displays all suppliers with view for OWNER/PM, create for OWNER/PM
 * 
 * Route: /suppliers
 */

'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';

function SuppliersPageContent() {
  const router = useRouter();
  const { canAccess, user } = usePermissions();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [canCreate, setCanCreate] = useState(false);
  
  // Use ref to track if fetch is in progress to prevent duplicate calls
  const fetchingRef = useRef(false);
  const searchDebounceRef = useRef(null);

  // Memoize fetchSuppliers function to prevent recreation on every render
  const fetchSuppliers = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) {
      return;
    }

    if (!user || !canAccess('view_suppliers')) {
      return;
    }

    try {
      fetchingRef.current = true;
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`/api/suppliers?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch suppliers');
      }

      setSuppliers(data.data.suppliers || []);
      setTotalPages(data.data.pagination?.pages || 1);
    } catch (err) {
      setError(err.message);
      console.error('Fetch suppliers error:', err);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user, canAccess, page, statusFilter, searchTerm]);

  // Check permissions and redirect if needed (only when user changes)
  useEffect(() => {
    if (user) {
      const canView = canAccess('view_suppliers');
      const canCreateSupplier = canAccess('create_supplier');
      
      setCanCreate(canCreateSupplier);
      
      if (!canView) {
        toast.showError('You do not have permission to view suppliers');
        router.push('/dashboard');
        return;
      }
    }
  }, [user, canAccess, router, toast]);

  // Fetch suppliers when filters change or when user is available
  useEffect(() => {
    // Prevent execution if user is not loaded or doesn't have permission
    if (!user || !canAccess('view_suppliers')) {
      return;
    }

    // Clear any existing debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    // For search, wait 500ms after user stops typing
    if (searchTerm.trim()) {
      searchDebounceRef.current = setTimeout(() => {
        fetchSuppliers();
      }, 500);
    } else {
      // For other filters (page, status), fetch immediately
      fetchSuppliers();
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [user, canAccess, fetchSuppliers, page, statusFilter, searchTerm]);


  const handleDelete = useCallback(async (supplierId, supplierName) => {
    if (!confirm(`Are you sure you want to delete supplier "${supplierName}"? This action cannot be undone.`)) {
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
      fetchSuppliers();
    } catch (err) {
      toast.showError(err.message || 'Failed to delete supplier');
      console.error('Delete supplier error:', err);
    }
  }, [toast, fetchSuppliers]);

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-900 font-semibold',
      inactive: 'bg-gray-100 text-gray-900 font-semibold',
      suspended: 'bg-red-100 text-red-900 font-semibold'
    };
    return badges[status] || badges.inactive;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Suppliers</h1>
            <p className="text-gray-700 mt-2 font-medium">Manage supplier contacts and information</p>
          </div>
          {canCreate && (
            <Link
              href="/suppliers/new"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition shadow-md"
            >
              + Add Supplier
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, email, or contact person..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-300 text-red-900 px-4 py-3 rounded mb-6 font-medium">
            {error}
          </div>
        )}

        {/* Suppliers Table */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-900 font-medium">Loading suppliers...</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No suppliers found</h3>
            <p className="text-gray-700 mb-6 font-medium">
              {canCreate
                ? 'Get started by adding your first supplier.'
                : 'No suppliers match your search criteria.'}
            </p>
            {canCreate && (
              <Link
                href="/suppliers/new"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition inline-block shadow-md"
              >
                + Add Supplier
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                        Communication
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {suppliers.map((supplier) => (
                      <tr key={supplier._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{supplier.name}</div>
                              {supplier.contactPerson && (
                                <div className="text-sm text-gray-700 font-medium">{supplier.contactPerson}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-medium">{supplier.contactPerson || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-medium">{supplier.phone}</div>
                          {supplier.alternatePhone && (
                            <div className="text-sm text-gray-700 font-medium">{supplier.alternatePhone}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-medium">{supplier.email}</div>
                          {supplier.alternateEmail && (
                            <div className="text-sm text-gray-700 font-medium">{supplier.alternateEmail}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(supplier.status)}`}>
                            {supplier.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {supplier.emailEnabled && (
                              <span className="text-xs text-green-700 font-medium">✓ Email</span>
                            )}
                            {supplier.smsEnabled && (
                              <span className="text-xs text-green-700 font-medium">✓ SMS</span>
                            )}
                            {supplier.pushNotificationsEnabled && (
                              <span className="text-xs text-green-700 font-medium">✓ Push</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/suppliers/${supplier._id}`}
                            className="text-blue-600 hover:text-blue-800 font-semibold mr-4 underline"
                          >
                            View
                          </Link>
                          {canAccess('edit_supplier') && (
                            <Link
                              href={`/suppliers/${supplier._id}/edit`}
                              className="text-indigo-600 hover:text-indigo-800 font-semibold mr-4 underline"
                            >
                              Edit
                            </Link>
                          )}
                          {canAccess('delete_supplier') && (
                            <button
                              onClick={() => handleDelete(supplier._id, supplier.name)}
                              className="text-red-600 hover:text-red-800 font-semibold underline"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-900 font-medium bg-white"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-gray-900 font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-900 font-medium bg-white"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default function SuppliersPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <SuppliersPageContent />
    </Suspense>
  );
}

