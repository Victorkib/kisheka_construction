/**
 * Stock Tracking Page
 * Displays inventory levels, low stock alerts, and wastage tracking
 * 
 * Route: /dashboard/stock
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';

export default function StockPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [materialRequests, setMaterialRequests] = useState([]); // Track existing requests
  const [filters, setFilters] = useState({
    category: '',
    floor: '',
    lowStockOnly: false,
  });
  const [summary, setSummary] = useState({
    totalItems: 0,
    lowStockCount: 0,
    pendingDelivery: 0,
    pendingApproval: 0,
  });

  useEffect(() => {
    fetchStockData();
    fetchMaterialRequests();
  }, [filters]);

  const fetchStockData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query
      const queryParams = new URLSearchParams({
        limit: '1000', // Get all for stock tracking
        ...(filters.category && { category: filters.category }),
        ...(filters.floor && { floor: filters.floor }),
      });

      const response = await fetch(`/api/materials?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch stock data');
      }

      let filteredMaterials = data.data.materials || [];

      // Filter by low stock if requested
      if (filters.lowStockOnly) {
        filteredMaterials = filteredMaterials.filter((m) => {
          const remaining = m.quantityRemaining || 0;
          const purchased = m.quantityPurchased || m.quantity || 0;
          const percentage = purchased > 0 ? (remaining / purchased) * 100 : 0;
          return percentage < 20 && percentage > 0;
        });
      }

      setMaterials(filteredMaterials);

      // Calculate summary
      const totalItems = filteredMaterials.length;
      const lowStockCount = filteredMaterials.filter((m) => {
        const remaining = m.quantityRemaining || 0;
        const purchased = m.quantityPurchased || m.quantity || 0;
        const percentage = purchased > 0 ? (remaining / purchased) * 100 : 0;
        return percentage < 20 && percentage > 0;
      }).length;
      const pendingDelivery = filteredMaterials.filter(
        (m) => m.status === 'approved' && (m.quantityDelivered || 0) === 0
      ).length;
      const pendingApproval = filteredMaterials.filter((m) =>
        ['submitted', 'pending_approval'].includes(m.status)
      ).length;

      setSummary({
        totalItems,
        lowStockCount,
        pendingDelivery,
        pendingApproval,
      });
    } catch (err) {
      setError(err.message);
      console.error('Fetch stock error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterialRequests = async () => {
    try {
      const response = await fetch('/api/material-requests?limit=1000');
      const data = await response.json();
      if (data.success) {
        setMaterialRequests(data.data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching material requests:', err);
    }
  };

  // Calculate quantity needed for low stock items
  const calculateQuantityNeeded = (material) => {
    const purchased = material.quantityPurchased || material.quantity || 0;
    const remaining = material.quantityRemaining || 0;
    const delivered = material.quantityDelivered || 0;
    
    // If material hasn't been delivered yet, suggest purchasing the full amount
    if (delivered === 0 && purchased > 0) {
      return purchased;
    }
    
    // If low stock, suggest replenishing to at least 50% of original purchased amount
    // Or if delivered, replenish to 50% of delivered amount
    const targetAmount = delivered > 0 ? delivered : purchased;
    const suggestedQuantity = Math.max(targetAmount * 0.5, targetAmount - remaining);
    
    // Round up to nearest reasonable amount
    return Math.ceil(suggestedQuantity);
  };

  // Check if material has an existing request
  const getExistingRequest = (material) => {
    return materialRequests.find(
      (req) =>
        req.materialName?.toLowerCase() === (material.name || material.materialName)?.toLowerCase() &&
        req.projectId?.toString() === material.projectId?.toString() &&
        ['requested', 'pending_approval', 'approved', 'converted_to_order'].includes(req.status)
    );
  };

  // Check if material is low stock
  const isLowStock = (material) => {
    const purchased = material.quantityPurchased || material.quantity || 0;
    const remaining = material.quantityRemaining || 0;
    const delivered = material.quantityDelivered || 0;
    
    // If not delivered yet, it's not low stock (it's pending delivery)
    if (delivered === 0 && purchased > 0) {
      return false;
    }
    
    // If delivered, check percentage
    if (delivered > 0) {
      const percentage = (remaining / delivered) * 100;
      return percentage < 20 && percentage > 0;
    }
    
    return false;
  };

  const getStockStatus = (material) => {
    const purchased = material.quantityPurchased || material.quantity || 0;
    const delivered = material.quantityDelivered || 0;
    const remaining = material.quantityRemaining || 0;
    
    // If not delivered yet, show pending delivery status
    if (delivered === 0 && purchased > 0) {
      return {
        status: 'pending_delivery',
        percentage: null,
        label: 'Pending Delivery',
        color: 'bg-gray-100 text-gray-800',
      };
    }
    
    // If delivered, calculate stock percentage based on delivered quantity
    if (delivered > 0) {
      const percentage = delivered > 0 ? (remaining / delivered) * 100 : 0;
      let color = 'bg-green-100 text-green-800';
      let label = `${percentage.toFixed(1)}%`;
      
      if (percentage === 0) {
        color = 'bg-red-100 text-red-800';
        label = 'Depleted';
      } else if (percentage < 20) {
        color = 'bg-yellow-100 text-yellow-800';
      } else if (percentage < 50) {
        color = 'bg-blue-100 text-blue-800';
      }
      
      return {
        status: 'in_stock',
        percentage,
        label,
        color,
      };
    }
    
    // Default: no stock
    return {
      status: 'no_stock',
      percentage: 0,
      label: '0%',
      color: 'bg-red-100 text-red-800',
    };
  };

  const getStockStatusColor = (percentage) => {
    if (percentage === null) return 'bg-gray-100 text-gray-800';
    if (percentage === 0) return 'bg-red-100 text-red-800';
    if (percentage < 20) return 'bg-yellow-100 text-yellow-800';
    if (percentage < 50) return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  const getWastageColor = (wastage) => {
    if (wastage > 20) return 'text-red-600 font-bold';
    if (wastage > 10) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Stock Tracking</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Monitor inventory levels and track wastage</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Items</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">{summary.totalItems}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <h3 className="text-sm font-medium text-yellow-700">Low Stock Alerts</h3>
            <p className="text-3xl font-bold text-yellow-900 mt-2">{summary.lowStockCount}</p>
            <p className="text-xs text-yellow-600 mt-1">&lt;20% remaining</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-6 border-l-4 border-blue-500">
            <h3 className="text-sm font-medium text-blue-700">Pending Delivery</h3>
            <p className="text-3xl font-bold text-blue-900 mt-2">{summary.pendingDelivery}</p>
          </div>
          <div className="bg-orange-50 rounded-lg shadow p-6 border-l-4 border-orange-500">
            <h3 className="text-sm font-medium text-orange-700">Pending Approval</h3>
            <p className="text-3xl font-bold text-orange-900 mt-2">{summary.pendingApproval}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Category</label>
              <input
                type="text"
                placeholder="Filter by category..."
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Floor</label>
              <input
                type="text"
                placeholder="Filter by floor..."
                value={filters.floor}
                onChange={(e) => setFilters({ ...filters, floor: e.target.value })}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.lowStockOnly}
                  onChange={(e) => setFilters({ ...filters, lowStockOnly: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Low stock only (&lt;20%)</span>
              </label>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ category: '', floor: '', lowStockOnly: false })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Stock Table */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading stock data...</p>
          </div>
        ) : materials.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600">No materials found</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Material Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Remaining
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Stock Level
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Wastage
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Last Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {materials.map((material) => {
                  const stockStatus = getStockStatus(material);
                  const wastage = material.wastage || 0;
                  const purchased = material.quantityPurchased || material.quantity || 0;
                  const delivered = material.quantityDelivered || 0;
                  const pendingDelivery = purchased - delivered;

                  return (
                    <tr key={material._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/items/${material._id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-900"
                        >
                          {material.name || material.materialName}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{material.category || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {purchased} {material.unit || ''}
                        </div>
                        {delivered > 0 && (
                          <div className="text-sm text-gray-600 leading-normal">
                            Delivered: {delivered} {material.unit || ''}
                          </div>
                        )}
                        {pendingDelivery > 0 && (
                          <div className="text-xs text-orange-600">
                            Pending: {pendingDelivery} {material.unit || ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {material.quantityRemaining || 0} {material.unit || ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.color}`}
                        >
                          {stockStatus.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm ${getWastageColor(wastage)}`}>
                          {wastage > 0 ? `${wastage.toFixed(1)}%` : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {material.updatedAt
                            ? new Date(material.updatedAt).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {material.supplierName || material.supplier || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col gap-2">
                          <Link
                            href={`/items/${material._id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </Link>
                          {/* Create Request Button for Low Stock Items */}
                          {isLowStock(material) && material.projectId && (() => {
                            const existingRequest = getExistingRequest(material);
                            const quantityNeeded = calculateQuantityNeeded(material);
                            
                            if (existingRequest) {
                              return (
                                <div className="flex flex-col gap-1">
                                  <Link
                                    href={`/material-requests/${existingRequest._id}`}
                                    className="text-xs text-green-600 hover:text-green-800 font-medium"
                                  >
                                    📋 Request: {existingRequest.requestNumber}
                                  </Link>
                                  <span className={`text-xs px-2 py-1 rounded-full inline-block ${
                                    existingRequest.status === 'approved'
                                      ? 'bg-green-100 text-green-800'
                                      : existingRequest.status === 'converted_to_order'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {existingRequest.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Pending'}
                                  </span>
                                </div>
                              );
                            }
                            
                            // Build URL with pre-filled parameters
                            const requestParams = new URLSearchParams({
                              materialName: material.name || material.materialName || '',
                              quantityNeeded: quantityNeeded.toString(),
                              projectId: material.projectId.toString(),
                              category: material.category || '',
                              categoryId: material.categoryId || '',
                              urgency: 'high',
                              unit: material.unit || 'piece',
                            });
                            
                            return (
                              <Link
                                href={`/material-requests/new?${requestParams.toString()}`}
                                className="text-xs px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition"
                              >
                                📋 Create Request
                              </Link>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

