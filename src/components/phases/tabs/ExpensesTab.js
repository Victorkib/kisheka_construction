/**
 * Phase Expenses Tab Component
 * Displays expenses linked to this phase with filtering and statistics
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function ExpensesTab({ phase, formatCurrency, formatDate }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    search: ''
  });
  const [filteredExpenses, setFilteredExpenses] = useState([]);

  useEffect(() => {
    if (phase?._id) {
      fetchExpenses();
    }
  }, [phase?._id]);

  useEffect(() => {
    // Apply filters - ensure expenses is an array
    const expensesArray = Array.isArray(expenses) ? expenses : [];
    let filtered = [...expensesArray];

    if (filters.status) {
      filtered = filtered.filter(e => e.status === filters.status);
    }

    if (filters.category) {
      filtered = filtered.filter(e => 
        (e.category || '').toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(e =>
        (e.description || '').toLowerCase().includes(searchLower) ||
        (e.vendor || '').toLowerCase().includes(searchLower) ||
        (e.expenseCode || '').toLowerCase().includes(searchLower)
      );
    }

    setFilteredExpenses(filtered);
  }, [expenses, filters]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/expenses?phaseId=${phase._id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        // Ensure we always set an array
        const expensesData = data.data?.expenses || data.data;
        setExpenses(Array.isArray(expensesData) ? expensesData : []);
      } else {
        setExpenses([]);
      }
    } catch (err) {
      console.error('Fetch expenses error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics - ensure expenses is an array
  const expensesArray = Array.isArray(expenses) ? expenses : [];
  const stats = {
    total: expensesArray.length,
    totalCost: expensesArray.reduce((sum, e) => sum + (e.amount || 0), 0),
    byStatus: expensesArray.reduce((acc, e) => {
      const status = e.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}),
    byCategory: expensesArray.reduce((acc, e) => {
      const category = e.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {})
  };

  const getStatusColor = (status) => {
    const colors = {
      'APPROVED': 'bg-green-100 text-green-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'PAID': 'bg-blue-100 text-blue-800',
      'ARCHIVED': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const expenseCategories = [
    'equipment_rental',
    'transport',
    'accommodation',
    'utilities',
    'safety',
    'permits',
    'training',
    'excavation',
    'earthworks',
    'construction_services',
    'other'
  ];

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Expenses</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Amount</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {formatCurrency(stats.totalCost)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">By Status</p>
          <div className="mt-1 space-y-1">
            {Object.entries(stats.byStatus).slice(0, 2).map(([status, count]) => (
              <div key={status} className="text-sm">
                <span className="text-gray-600">{status}:</span>{' '}
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Categories</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {Object.keys(stats.byCategory).length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search expenses..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {expenseCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', category: '', search: '' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Expenses ({filteredExpenses.length})
          </h3>
          <Link
            href={`/expenses/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Expense
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Loading expenses...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">No expenses found</p>
            <Link
              href={`/expenses/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
              className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add First Expense
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExpenses.map((expense) => (
                  <tr key={expense._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/expenses/${expense._id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {expense.description || 'No description'}
                      </Link>
                      {expense.expenseCode && (
                        <p className="text-xs text-gray-500 mt-1">{expense.expenseCode}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {expense.category ? expense.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Uncategorized'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.vendor || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(expense.amount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {expense.date ? formatDate(expense.date) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(expense.status)}`}>
                        {expense.status || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/expenses/${expense._id}`}
                        className="text-blue-600 hover:text-blue-800"
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
    </div>
  );
}

export default ExpensesTab;


