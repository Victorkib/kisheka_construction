/**
 * Users Management Page
 * Displays all users with filtering, search, and role management
 * 
 * Route: /dashboard/users
 * Auth: OWNER only
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingSpinner } from '@/components/loading';

function UsersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [roleDistribution, setRoleDistribution] = useState({});

  // Filters
  const [filters, setFilters] = useState({
    role: searchParams.get('role') || '',
    status: searchParams.get('status') || 'active',
    search: searchParams.get('search') || '',
  });

  // Fetch user and check permissions
  useEffect(() => {
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
          setUser(data.data);
          const role = data.data.role?.toLowerCase();
          // Only owner can access this page
          if (role !== 'owner') {
            router.push('/dashboard');
          }
        } else {
          router.push('/auth/login');
        }
      } catch (err) {
        console.error('Fetch user error:', err);
        router.push('/auth/login');
      }
    };

    fetchUser();
  }, [router]);

  // Fetch users
  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user, filters, pagination.page]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.role && { role: filters.role }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/users?${queryParams}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data.data?.users || []);
      setPagination(data.data?.pagination || pagination);
      setRoleDistribution(data.data?.roleDistribution || {});
    } catch (err) {
      setError(err.message);
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page on filter change
  };

  const getRoleBadge = (role) => {
    const colors = {
      owner: 'bg-purple-100 text-purple-800',
      investor: 'bg-blue-100 text-blue-800',
      pm: 'bg-green-100 text-green-800',
      project_manager: 'bg-green-100 text-green-800',
      supervisor: 'bg-yellow-100 text-yellow-800',
      site_clerk: 'ds-bg-surface-muted ds-text-primary',
      clerk: 'ds-bg-surface-muted ds-text-primary',
      accountant: 'bg-indigo-100 text-indigo-800',
      supplier: 'bg-orange-100 text-orange-800',
    };

    const normalizedRole = role?.toLowerCase() || 'unknown';
    const colorClass = colors[normalizedRole] || 'ds-bg-surface-muted ds-text-primary';
    const displayRole = normalizedRole === 'pm' || normalizedRole === 'project_manager' 
      ? 'Project Manager' 
      : normalizedRole === 'site_clerk' 
      ? 'Clerk' 
      : normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
        {displayRole}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-red-100 text-red-800',
      suspended: 'bg-yellow-100 text-yellow-800',
    };

    const colorClass = colors[status] || 'ds-bg-surface-muted ds-text-primary';
    const displayStatus = status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown';

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
        {displayStatus}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">User Management</h1>
              <p className="text-base md:text-lg ds-text-secondary mt-2 leading-relaxed">Manage users, roles, and access permissions</p>
            </div>
            <Link
              href="/dashboard/users/invite"
              className="px-4 py-2 ds-bg-accent-primary text-white rounded-lg hover:bg-blue-700 transition"
            >
              Invite User
            </Link>
          </div>
        </div>

        {/* Role Distribution Summary */}
        {Object.keys(roleDistribution).length > 0 && (
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {Object.entries(roleDistribution).map(([role, count]) => (
              <div key={role} className="ds-bg-surface rounded-lg shadow p-4">
                <p className="text-sm ds-text-secondary">{role === 'pm' ? 'Project Manager' : role.charAt(0).toUpperCase() + role.slice(1)}</p>
                <p className="text-2xl font-bold ds-text-primary">{count}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-2 leading-normal">Search</label>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-2 leading-normal">Role</label>
              <select
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Roles</option>
                <option value="owner">Owner</option>
                <option value="investor">Investor</option>
                <option value="pm">Project Manager</option>
                <option value="supervisor">Supervisor</option>
                <option value="site_clerk">Clerk</option>
                <option value="accountant">Accountant</option>
                <option value="supplier">Supplier</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-2 leading-normal">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Users Table */}
        {loading ? (
          <LoadingTable rows={5} cols={6} />
        ) : users.length === 0 ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <p className="ds-text-muted text-lg">No users found</p>
            <p className="ds-text-muted text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-ds-border-subtle">
                <thead className="ds-bg-surface-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                  {users.map((userItem) => (
                    <tr key={userItem.id} className="hover:ds-bg-surface-muted">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium ds-text-primary">
                            {userItem.firstName || userItem.lastName
                              ? `${userItem.firstName || ''} ${userItem.lastName || ''}`.trim()
                              : 'No Name'}
                          </div>
                          <div className="text-sm ds-text-muted">{userItem.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRoleBadge(userItem.role)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(userItem.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                        {formatDate(userItem.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                        {formatDate(userItem.lastLogin)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/dashboard/users/${userItem.id}`}
                          className="ds-text-accent-primary hover:ds-text-accent-hover mr-4"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm ds-text-secondary">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} users
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-4 py-2 border ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted"
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

export default function UsersPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <UsersPageContent />
    </Suspense>
  );
}



