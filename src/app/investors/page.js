/**
 * Investors List Page
 * Displays all investors (OWNER only)
 * 
 * Route: /investors
 */

'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingSpinner } from '@/components/loading';

function InvestorsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const returnProjectId = searchParams.get('projectId');
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({
    totalInvested: 0,
    totalLoans: 0,
    totalEquity: 0,
    count: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    investmentType: searchParams.get('investmentType') || '',
    status: searchParams.get('status') || 'ACTIVE',
    search: searchParams.get('search') || '',
  });
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters((prev) => ({ ...prev, search: searchInput }));
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch investors when filters change (excluding search which is handled by debounce)
  useEffect(() => {
    fetchInvestors();
  }, [filters.investmentType, filters.status, filters.search]);

  const fetchInvestors = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams({
        ...(filters.investmentType && { investmentType: filters.investmentType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/investors?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch investors');
      }

      // API returns nested structure: { success: true, data: { data: [...], summary: {...}, total: 1 } }
      setInvestors(data.data?.data || []);
      setSummary(data.data?.summary || summary);
    } catch (err) {
      setError(err.message);
      console.error('Fetch investors error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const getInvestmentTypeBadge = (type) => {
    const colors = {
      EQUITY: 'bg-blue-100 text-blue-800',
      LOAN: 'bg-purple-100 text-purple-800',
      MIXED: 'bg-indigo-100 text-indigo-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadge = (status) => {
    const colors = {
      ACTIVE: 'bg-green-100 text-green-800',
      INACTIVE: 'bg-yellow-100 text-yellow-800',
      ARCHIVED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {returnTo && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-semibold">Return to bulk material request</p>
                <p className="text-xs">Allocate funds, then jump back to continue supplier assignment.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {returnProjectId && (
                  <Link
                    href={`/financing?projectId=${returnProjectId}&returnTo=${encodeURIComponent(returnTo)}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
                  >
                    View Financing
                  </Link>
                )}
                <Link
                  href={returnTo}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
                >
                  Back to Bulk Request
                </Link>
              </div>
            </div>
          </div>
        )}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Investors</h1>
              <p className="mt-2 text-sm text-gray-700">
                Manage investors and track contributions
              </p>
            </div>
            <Link
              href="/investors/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + Add Investor
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-base font-semibold text-gray-700 leading-normal">Total Investors</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary.count}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-base font-semibold text-gray-700 leading-normal">Total Invested</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(summary.totalInvested)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-base font-semibold text-gray-700 leading-normal">Total Loans</div>
            <div className="text-2xl font-bold text-purple-600 mt-1">
              {formatCurrency(summary.totalLoans)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-base font-semibold text-gray-700 leading-normal">Total Equity</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {formatCurrency(summary.totalEquity)}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Investment Type
              </label>
              <select
                value={filters.investmentType}
                onChange={(e) => handleFilterChange('investmentType', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                <option value="EQUITY">Equity</option>
                <option value="LOAN">Loan</option>
                <option value="MIXED">Mixed</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name, email, or phone..."
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                />
                {loading && searchInput && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <LoadingSpinner size="sm" color="blue-600" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Investors Table */}
        {loading ? (
          <LoadingTable rows={10} columns={6} showHeader={true} />
        ) : investors.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-600">No investors found</div>
            <Link
              href="/investors/new"
              className="mt-4 inline-block text-blue-600 hover:text-blue-800"
            >
              Add your first investor
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Total Invested
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
                {investors && investors.length > 0 && investors?.map((investor) => (
                  <tr key={investor._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/investors/${investor._id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}${returnProjectId ? `&projectId=${returnProjectId}` : ''}` : ''}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-900"
                      >
                        {investor.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{investor.email || 'N/A'}</div>
                      {investor.phone && (
                        <div className="text-sm text-gray-600">{investor.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getInvestmentTypeBadge(
                          investor.investmentType
                        )}`}
                      >
                        {investor.investmentType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(investor.totalInvested || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          investor.status
                        )}`}
                      >
                        {investor.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={`/investors/${investor._id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}${returnProjectId ? `&projectId=${returnProjectId}` : ''}` : ''}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function InvestorsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable rows={10} columns={6} showHeader={true} />
        </div>
      </AppLayout>
    }>
      <InvestorsPageContent />
    </Suspense>
  );
}

