/**
 * Expense Dashboard Page
 * Displays expense analytics with charts and summaries
 * 
 * Route: /dashboard/expenses
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';

export default function ExpensesPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [recentExpenses, setRecentExpenses] = useState([]);

  useEffect(() => {
    fetchSummary();
    fetchRecentExpenses();
  }, [dateRange]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      });

      const response = await fetch(`/api/reports/summary?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch expense summary');
      }

      setSummary(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch summary error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentExpenses = async () => {
    try {
      const queryParams = new URLSearchParams({
        limit: '10',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      });

      const response = await fetch(`/api/expenses?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        setRecentExpenses(data.data.expenses || []);
      }
    } catch (err) {
      console.error('Fetch recent expenses error:', err);
    }
  };

  const fetchSupplierSummary = async () => {
    try {
      const queryParams = new URLSearchParams({
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      });

      const response = await fetch(`/api/reports/supplier-summary?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        return data.data.suppliers || [];
      }
      return [];
    } catch (err) {
      console.error('Fetch supplier summary error:', err);
      return [];
    }
  };

  if (loading && !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading expense data...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Expense Dashboard</h1>
          <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Track and analyze project expenses</p>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
            <button
              onClick={() => {
                const today = new Date();
                const lastMonth = new Date(today.setMonth(today.getMonth() - 1));
                setDateRange({
                  startDate: lastMonth.toISOString().split('T')[0],
                  endDate: new Date().toISOString().split('T')[0],
                });
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Last Month
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Spent</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  KES {summary.totalExpenses?.toLocaleString() || '0.00'}
                </p>
                <p className="text-sm text-gray-600 mt-1 leading-normal">
                  {summary.totalItems || 0} items
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Daily Average</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  KES {summary.dailyBurnRate?.toLocaleString() || '0.00'}
                </p>
                <p className="text-sm text-gray-600 mt-1 leading-normal">Per day</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Categories</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {summary.categoryBreakdown?.length || 0}
                </p>
                <p className="text-sm text-gray-600 mt-1 leading-normal">Active categories</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Floors</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {summary.floorBreakdown?.length || 0}
                </p>
                <p className="text-sm text-gray-600 mt-1 leading-normal">With expenses</p>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost by Category</h2>
                {summary.categoryBreakdown && summary.categoryBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {summary.categoryBreakdown.slice(0, 10).map((item, index) => (
                      <div key={index}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-base font-semibold text-gray-700 leading-normal">{item.category}</span>
                          <span className="text-sm font-bold text-gray-900">
                            KES {item.total.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, parseFloat(item.percentage))}%`,
                            }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600 mt-1 leading-normal">
                          <span>{item.count} items</span>
                          <span>{item.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No category data available</p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost by Floor</h2>
                {summary.floorBreakdown && summary.floorBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {summary.floorBreakdown.map((item, index) => (
                      <div key={index}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-base font-semibold text-gray-700 leading-normal">
                            {item.floorName || `Floor ${item.floorNumber}`}
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            KES {item.total.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min(
                                100,
                                summary.totalExpenses > 0
                                  ? (item.total / summary.totalExpenses) * 100
                                  : 0
                              )}%`,
                            }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600 mt-1 leading-normal">
                          <span>{item.count} items</span>
                          {item.percentage && <span>Budget: {item.percentage}%</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No floor data available</p>
                )}
              </div>
            </div>

            {/* Recent Expenses & Supplier Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Expenses</h2>
                {recentExpenses.length > 0 ? (
                  <div className="space-y-3">
                    {recentExpenses.slice(0, 10).map((expense) => (
                      <div
                        key={expense._id}
                        className="flex justify-between items-center border-b border-gray-200 pb-3"
                      >
                        <div>
                          <Link
                            href={`/expenses/${expense._id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-900"
                          >
                            {expense.description || expense.expenseCode || 'Expense'}
                          </Link>
                          <p className="text-sm text-gray-600 leading-normal">
                            {expense.vendor || 'N/A'} • {expense.category?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">
                            {expense.currency || 'KES'} {expense.amount?.toLocaleString() || '0.00'}
                          </p>
                          <p className="text-sm text-gray-600 leading-normal">
                            {expense.date
                              ? new Date(expense.date).toLocaleDateString()
                              : expense.createdAt
                              ? new Date(expense.createdAt).toLocaleDateString()
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No recent expenses</p>
                )}
                <div className="mt-4">
                  <Link
                    href="/expenses"
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                  >
                    View all expenses →
                  </Link>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Suppliers</h2>
                <SupplierSummaryTable dateRange={dateRange} />
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

// Supplier Summary Component
function SupplierSummaryTable({ dateRange }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuppliers();
  }, [dateRange]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      });

      const response = await fetch(`/api/reports/supplier-summary?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        setSuppliers(data.data.suppliers || []);
      }
    } catch (err) {
      console.error('Fetch suppliers error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="text-gray-500">Loading suppliers...</p>;
  }

  if (suppliers.length === 0) {
    return <p className="text-gray-500">No supplier data available</p>;
  }

  return (
    <div className="space-y-3">
      {suppliers.slice(0, 10).map((supplier, index) => (
        <div
          key={index}
          className="flex justify-between items-center border-b border-gray-200 pb-3"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">{supplier.name}</p>
            <p className="text-sm text-gray-600 leading-normal">{supplier.itemCount} items</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">
              KES {supplier.totalSpent.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600 leading-normal">
              Avg: KES {supplier.avgPrice.toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

