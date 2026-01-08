/**
 * Phase Materials Tab Component
 * Displays materials linked to this phase with filtering and statistics
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function MaterialsTab({ phase, formatCurrency, formatDate }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    search: ''
  });
  const [filteredMaterials, setFilteredMaterials] = useState([]);

  useEffect(() => {
    if (phase?._id) {
      fetchMaterials();
    }
  }, [phase?._id]);

  useEffect(() => {
    // Apply filters
    let filtered = [...materials];

    if (filters.status) {
      filtered = filtered.filter(m => m.status === filters.status);
    }

    if (filters.category) {
      filtered = filtered.filter(m => 
        (m.category || '').toLowerCase().includes(filters.category.toLowerCase())
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(m =>
        (m.itemName || m.name || '').toLowerCase().includes(searchLower) ||
        (m.description || '').toLowerCase().includes(searchLower)
      );
    }

    setFilteredMaterials(filtered);
  }, [materials, filters]);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/materials?phaseId=${phase._id}`);
      const data = await response.json();
      if (data.success) {
        setMaterials(data.data?.materials || data.data || []);
      }
    } catch (err) {
      console.error('Fetch materials error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = {
    total: materials.length,
    totalCost: materials.reduce((sum, m) => sum + (m.totalCost || 0), 0),
    byStatus: materials.reduce((acc, m) => {
      const status = m.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}),
    byCategory: materials.reduce((acc, m) => {
      const category = m.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {})
  };

  const getStatusColor = (status) => {
    const colors = {
      'APPROVED': 'bg-green-100 text-green-800',
      'RECEIVED': 'bg-green-100 text-green-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'DRAFT': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Materials</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Cost</p>
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
              placeholder="Search materials..."
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
              <option value="RECEIVED">Received</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              placeholder="Filter by category..."
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

      {/* Materials List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Materials ({filteredMaterials.length})
          </h3>
          <Link
            href={`/items/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Material
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Loading materials...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">No materials found</p>
            <Link
              href={`/items/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
              className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add First Material
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMaterials.map((material) => (
                  <tr key={material._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/items/${material._id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {material.itemName || material.name || 'Unnamed'}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {material.category || 'Uncategorized'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {material.quantity || 0} {material.unit || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(material.unitCost || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(material.totalCost || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(material.status)}`}>
                        {material.status || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {material.datePurchased ? formatDate(material.datePurchased) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/items/${material._id}`}
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

      {/* Material Requests Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Material Requests</h3>
          <Link
            href={`/material-requests/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            + New Request
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          Create material requests for this phase. Approved requests can be converted to purchase orders.
        </p>
        <Link
          href={`/material-requests?phaseId=${phase._id}`}
          className="mt-3 inline-block text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View all material requests for this phase →
        </Link>
      </div>

      {/* Purchase Orders Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Purchase Orders</h3>
          <Link
            href={`/purchase-orders?phaseId=${phase._id}`}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            View All POs
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          View purchase orders linked to this phase. Purchase orders are created from approved material requests.
        </p>
        <Link
          href={`/purchase-orders?phaseId=${phase._id}`}
          className="mt-3 inline-block text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View all purchase orders for this phase →
        </Link>
      </div>
    </div>
  );
}

export default MaterialsTab;


