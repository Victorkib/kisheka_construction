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
      <div className="ds-bg-success/10 border ds-border-success/40 rounded-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <svg
            className="w-16 h-16 ds-text-success"
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
        <h2 className="text-2xl font-bold ds-text-success mb-2">Purchase Orders Created Successfully!</h2>
        <p className="ds-text-success">
          Your bulk material request has been processed and purchase orders have been sent to suppliers.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="ds-bg-surface rounded-lg border ds-border-subtle p-4">
          <p className="text-sm ds-text-secondary">Purchase Orders</p>
          <p className="text-3xl font-bold ds-text-primary">{summary.totalPOs || purchaseOrders.length}</p>
        </div>
        <div className="ds-bg-surface rounded-lg border ds-border-subtle p-4">
          <p className="text-sm ds-text-secondary">Suppliers</p>
          <p className="text-3xl font-bold ds-text-primary">{summary.totalSuppliers || 0}</p>
        </div>
        <div className="ds-bg-surface rounded-lg border ds-border-subtle p-4">
          <p className="text-sm ds-text-secondary">Materials</p>
          <p className="text-3xl font-bold ds-text-primary">{summary.totalMaterials || 0}</p>
        </div>
        <div className="ds-bg-surface rounded-lg border ds-border-subtle p-4">
          <p className="text-sm ds-text-secondary">Total Cost</p>
          <p className="text-3xl font-bold ds-text-primary">{formatCurrency(summary.totalCost || 0)}</p>
        </div>
      </div>

      {/* Purchase Orders List */}
      {purchaseOrders.length > 0 && (
        <div className="ds-bg-surface rounded-lg border ds-border-subtle p-6">
          <h3 className="text-lg font-semibold ds-text-primary mb-4">Created Purchase Orders</h3>
          <div className="space-y-3">
            {purchaseOrders.map((po) => (
              <div
                key={po.purchaseOrderId}
                className="border ds-border-subtle rounded-lg p-4 hover:ds-bg-surface-muted transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/purchase-orders/${po.purchaseOrderId}`}
                        className="text-lg font-semibold ds-text-accent-primary hover:ds-text-accent-hover"
                      >
                        {po.purchaseOrderNumber}
                      </Link>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full ds-bg-accent-subtle ds-text-accent-primary">
                        {po.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Sent'}
                      </span>
                    </div>
                    <p className="text-sm ds-text-secondary mt-1">
                      Supplier: <span className="font-medium">{po.supplierName}</span>
                    </p>
                    <p className="text-sm ds-text-secondary">
                      Materials: <span className="font-medium">{po.materialCount}</span> | Total:{' '}
                      <span className="font-medium">{formatCurrency(po.totalCost)}</span>
                    </p>
                  </div>
                  <Link
                    href={`/purchase-orders/${po.purchaseOrderId}`}
                    className="px-4 py-2 ds-bg-accent-primary rounded-lg hover:ds-bg-accent-hover text-sm font-medium"
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
          className="flex-1 px-6 py-3 ds-bg-accent-primary ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-accent-hover font-medium text-center"
        >
          View Batch Details
        </Link>
        <Link
          href="/purchase-orders"
          className="flex-1 px-6 py-3 ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-surface-muted font-medium text-center"
        >
          View All Purchase Orders
        </Link>
        <Link
          href="/material-requests/bulk"
          className="flex-1 px-6 py-3 ds-bg-success ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-success font-medium text-center"
        >
          Create Another Batch
        </Link>
      </div>
    </div>
  );
}

