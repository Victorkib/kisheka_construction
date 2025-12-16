/**
 * Step 7: Success Summary Component
 * Shows success message and summary after purchase orders are created
 */

'use client';

import Link from 'next/link';

export function Step7SuccessSummary({ batchId, purchaseOrders = [], summary = {} }) {
  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'KES 0';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <svg
            className="w-16 h-16 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-green-900 mb-2">Purchase Orders Created Successfully!</h2>
        <p className="text-green-700">
          Your bulk material request has been processed and purchase orders have been sent to suppliers.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Purchase Orders</p>
          <p className="text-3xl font-bold text-gray-900">{summary.totalPOs || purchaseOrders.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Suppliers</p>
          <p className="text-3xl font-bold text-gray-900">{summary.totalSuppliers || 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Materials</p>
          <p className="text-3xl font-bold text-gray-900">{summary.totalMaterials || 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Total Cost</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(summary.totalCost || 0)}</p>
        </div>
      </div>

      {/* Purchase Orders List */}
      {purchaseOrders.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Created Purchase Orders</h3>
          <div className="space-y-3">
            {purchaseOrders.map((po) => (
              <div
                key={po.purchaseOrderId}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/purchase-orders/${po.purchaseOrderId}`}
                        className="text-lg font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {po.purchaseOrderNumber}
                      </Link>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {po.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Sent'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Supplier: <span className="font-medium">{po.supplierName}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Materials: <span className="font-medium">{po.materialCount}</span> | Total:{' '}
                      <span className="font-medium">{formatCurrency(po.totalCost)}</span>
                    </p>
                  </div>
                  <Link
                    href={`/purchase-orders/${po.purchaseOrderId}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href={`/material-requests/bulk/${batchId}`}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-center"
        >
          View Batch Details
        </Link>
        <Link
          href="/purchase-orders"
          className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-center"
        >
          View All Purchase Orders
        </Link>
        <Link
          href="/material-requests/bulk"
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-center"
        >
          Create Another Batch
        </Link>
      </div>
    </div>
  );
}

