/**
 * Bulk Material Request Success Page
 * Shows success summary after purchase orders are created
 * 
 * Route: /material-requests/bulk/[batchId]/success
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { Step7SuccessSummary } from '@/components/bulk-request/step7-success-summary';

function SuccessPageContent() {
  const params = useParams();
  const [batch, setBatch] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (params.batchId) {
      fetchData();
    }
  }, [params.batchId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch batch
      const batchResponse = await fetch(`/api/material-requests/bulk/${params.batchId}`);
      const batchData = await batchResponse.json();

      if (!batchData.success) {
        throw new Error(batchData.error || 'Failed to fetch batch');
      }

      setBatch(batchData.data);

      // Fetch purchase orders if batch has PO IDs
      if (batchData.data.purchaseOrderIds && batchData.data.purchaseOrderIds.length > 0) {
        const poPromises = batchData.data.purchaseOrderIds.map((poId) =>
          fetch(`/api/purchase-orders/${poId}`).then((res) => res.json())
        );

        const poResults = await Promise.all(poPromises);
        const successfulPOs = poResults
          .filter((result) => result.success)
          .map((result) => result.data);

        setPurchaseOrders(successfulPOs);
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch data error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable rows={5} columns={6} />
        </div>
      </AppLayout>
    );
  }

  if (error || !batch) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error || 'Batch not found'}
          </div>
        </div>
      </AppLayout>
    );
  }

  // Calculate summary from purchase orders
  const summary = {
    totalPOs: purchaseOrders.length,
    totalSuppliers: new Set(purchaseOrders.map((po) => po.supplierId?.toString())).size,
    totalMaterials: purchaseOrders.reduce((sum, po) => sum + (po.materials?.length || 1), 0),
    totalCost: purchaseOrders.reduce((sum, po) => sum + (po.totalCost || 0), 0),
  };

  // Format purchase orders for display
  const formattedPOs = purchaseOrders.map((po) => ({
    purchaseOrderId: po._id?.toString() || po.id?.toString(),
    purchaseOrderNumber: po.purchaseOrderNumber,
    supplierId: po.supplierId?.toString(),
    supplierName: po.supplierName,
    materialCount: po.materials?.length || 1,
    totalCost: po.totalCost,
    status: po.status,
  }));

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Step7SuccessSummary
          batchId={params.batchId}
          purchaseOrders={formattedPOs}
          summary={summary}
        />
      </div>
    </AppLayout>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={5} columns={6} />
          </div>
        </AppLayout>
      }
    >
      <SuccessPageContent />
    </Suspense>
  );
}

