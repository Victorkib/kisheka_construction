/**
 * Bulk Material Request Supplier Assignment Page
 * Assign suppliers to materials in a batch
 * 
 * Route: /material-requests/bulk/[batchId]/assign-suppliers
 */

'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingButton, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { SingleSupplierAssignment } from '@/components/bulk-request/single-supplier-assignment';
import { MultiSupplierAssignment } from '@/components/bulk-request/multi-supplier-assignment';
import { PriceComparisonModal } from '@/components/bulk-request/price-comparison-modal';
import { convertToSupplierGroups, validateSupplierAssignments } from '@/lib/helpers/supplier-grouping';

const normalizeId = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return normalizeId(value[0]);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return value.$oid;
  if (typeof value === 'object' && value._id) return normalizeId(value._id);
  return value.toString?.() || '';
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount || 0);
};

function SupplierAssignmentPageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { canAccess, user } = usePermissions();
  const toast = useToast();

  const [batch, setBatch] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('single'); // 'single' or 'multiple'
  const [singleAssignment, setSingleAssignment] = useState(null);
  const [multipleAssignments, setMultipleAssignments] = useState([]);
  const [showPriceComparison, setShowPriceComparison] = useState(false);
  const [projectFinances, setProjectFinances] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState(null);

  // Draft storage key
  const DRAFT_STORAGE_KEY = `supplier_assignment_draft_${params.batchId}`;

  useEffect(() => {
    if (params.batchId) {
      fetchBatch();
      fetchSuppliers();
      restoreDraft();
    }
  }, [params.batchId]);

  useEffect(() => {
    const projectId = normalizeId(batch?.projectId);
    if (!projectId) return;

    const fetchFinances = async () => {
      try {
        setFinanceLoading(true);
        setFinanceError(null);
        const response = await fetch(`/api/project-finances?projectId=${projectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch project finances');
        }
        setProjectFinances(data.data || null);
      } catch (err) {
        setFinanceError(err.message);
      } finally {
        setFinanceLoading(false);
      }
    };

    fetchFinances();
  }, [batch?.projectId]);

  // Check if returning from supplier creation
  // Use a ref to track if we've already handled the supplierCreated event
  const supplierCreatedHandledRef = useRef(false);
  
  useEffect(() => {
    const supplierCreated = searchParams.get('supplierCreated');
    if (supplierCreated === 'true' && !supplierCreatedHandledRef.current) {
      supplierCreatedHandledRef.current = true;
      toast.showSuccess('Supplier created successfully! Refreshing suppliers list...');
      fetchSuppliers();
      // Remove the parameter from URL after a short delay to ensure toast is shown
      setTimeout(() => {
        router.replace(`/material-requests/bulk/${params.batchId}/assign-suppliers`, { scroll: false });
        // Reset the ref after URL is cleaned so it can be triggered again if needed
        setTimeout(() => {
          supplierCreatedHandledRef.current = false;
        }, 500);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.toString(), params.batchId]); // Use searchParams.toString() to avoid object reference issues

  // Save draft to localStorage whenever assignments change
  // Use a debounce-like approach to avoid excessive writes
  const draftSaveTimeoutRef = useRef(null);
  
  useEffect(() => {
    if (params.batchId && (singleAssignment || multipleAssignments.length > 0)) {
      // Clear existing timeout
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current);
      }
      
      // Debounce the save operation to avoid excessive localStorage writes
      draftSaveTimeoutRef.current = setTimeout(() => {
        const draft = {
          mode,
          singleAssignment,
          multipleAssignments,
          savedAt: new Date().toISOString(),
        };
        try {
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        } catch (err) {
          console.error('Error saving draft:', err);
        }
      }, 300); // Wait 300ms before saving
    }
    
    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, [mode, singleAssignment, multipleAssignments, params.batchId, DRAFT_STORAGE_KEY]);

  const restoreDraft = () => {
    try {
      const draftJson = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draftJson) {
        const draft = JSON.parse(draftJson);
        if (draft.mode) setMode(draft.mode);
        if (draft.singleAssignment) setSingleAssignment(draft.singleAssignment);
        if (draft.multipleAssignments && Array.isArray(draft.multipleAssignments)) {
          setMultipleAssignments(draft.multipleAssignments);
        }
        console.log('[Supplier Assignment] Restored draft from localStorage');
      }
    } catch (err) {
      console.error('Error restoring draft:', err);
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (err) {
      console.error('Error clearing draft:', err);
    }
  };

  const fetchBatch = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/material-requests/bulk/${params.batchId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch batch');
      }

      setBatch(data.data);

      // Check if batch is approved
      if (data.data.status !== 'approved') {
        setError('Batch must be approved before assigning suppliers');
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch batch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers?status=active&limit=100', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setSuppliers(data.data.suppliers || []);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  // Memoize callbacks to prevent infinite re-render loops
  // These callbacks are passed to child components, so they need stable references
  const handleSingleAssignmentChange = useCallback((assignment) => {
    setSingleAssignment(assignment);
  }, []); // ✅ Stable reference - no dependencies needed

  const handleMultipleAssignmentChange = useCallback((assignments) => {
    setMultipleAssignments(assignments);
  }, []); // ✅ Stable reference - no dependencies needed

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      let assignments = [];

      if (mode === 'single') {
        // Single supplier mode
        if (!singleAssignment?.supplierId || !singleAssignment?.deliveryDate) {
          throw new Error('Please select a supplier and delivery date');
        }

        const materialRequestIds = (batch.materialRequests || []).map(
          (req) => req._id?.toString() || req.id?.toString()
        );

        assignments = [
          {
            supplierId: singleAssignment.supplierId,
            materialRequestIds: materialRequestIds,
            deliveryDate: singleAssignment.deliveryDate,
            terms: singleAssignment.terms || '',
            notes: singleAssignment.notes || '',
          },
        ];
      } else {
        // Multiple supplier mode
        const validation = validateSupplierAssignments(
          convertToSupplierGroups(multipleAssignments)
        );
        if (!validation.isValid) {
          throw new Error(validation.errors.join(', '));
        }

        assignments = convertToSupplierGroups(multipleAssignments);
      }

      // Submit to API
      const response = await fetch('/api/purchase-orders/bulk', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          batchId: params.batchId,
          assignments,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create purchase orders');
      }

      // Show appropriate message based on partial success
      if (data.data.partialSuccess) {
        toast.showWarning(
          `Partially successful: Created ${data.data.summary.succeeded} of ${data.data.summary.attempted} purchase order(s). ${data.data.summary.failed} failed.`
        );
      } else {
        toast.showSuccess(
          `Successfully created ${data.data.summary.totalPOs} purchase order(s) for ${data.data.summary.totalSuppliers} supplier(s)`
        );
      }

      // Clear draft after successful submission
      clearDraft();

      // Redirect to success page or batch detail
      router.push(`/material-requests/bulk/${params.batchId}/success`);
    } catch (err) {
      setError(err.message);
      toast.showError(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Get return URL for supplier creation
  const getSupplierCreationUrl = () => {
    const returnTo = encodeURIComponent(`/material-requests/bulk/${params.batchId}/assign-suppliers?supplierCreated=true`);
    return `/suppliers/new?returnTo=${returnTo}`;
  };

  if (!canAccess('create_bulk_purchase_orders')) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to assign suppliers.</p>
            <Link href="/material-requests" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
              ← Back to Material Requests
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable rows={5} columns={6} />
        </div>
      </AppLayout>
    );
  }

  if (error && !batch) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
          <Link href="/material-requests" className="text-blue-600 hover:text-blue-800">
            ← Back to Material Requests
          </Link>
        </div>
      </AppLayout>
    );
  }

  const materialRequests = batch?.materialRequests || [];
  const projectId = normalizeId(batch?.projectId);
  const availableCapital = projectFinances?.availableCapital ?? null;
  const totalInvested = projectFinances?.totalInvested ?? null;
  const estimatedBatchCost = batch?.totals?.totalEstimatedCost || 0;
  
  // OPTIONAL CAPITAL: Determine capital status
  const capitalNotSet = totalInvested === null || totalInvested === 0;
  const hasCapital = availableCapital !== null && availableCapital > 0;
  const isCapitalShort = !capitalNotSet && availableCapital !== null && availableCapital < estimatedBatchCost;
  
  const returnTo = `/material-requests/bulk/${params.batchId}/assign-suppliers`;

  const canProceed =
    mode === 'single'
      ? singleAssignment?.supplierId && singleAssignment?.deliveryDate
      : multipleAssignments.every((a) => a.supplierId && a.deliveryDate);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingOverlay
          isLoading={submitting}
          message="Assigning suppliers..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/material-requests/bulk/${params.batchId}`}
            className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block"
          >
            ← Back to Batch Details
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Assign Suppliers</h1>
          <p className="text-gray-600 mt-2">
            Batch: <span className="font-medium">{batch?.batchNumber}</span>
            {batch?.batchName && ` - ${batch.batchName}`}
          </p>
          {batch?.project && (
            <p className="text-gray-600 mt-1">
              Project: <span className="font-medium">{batch.project.projectName}</span>
              {batch.project.projectCode && ` (${batch.project.projectCode})`}
            </p>
          )}
        </div>

        {/* Capital Availability */}
        {(financeLoading || projectFinances || financeError) && (
          <div className={`mb-6 rounded-lg border px-4 py-3 ${
            financeError
              ? 'bg-red-50 border-red-200 text-red-700'
              : capitalNotSet
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : !hasCapital
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : isCapitalShort
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                    : 'bg-green-50 border-green-200 text-green-800'
          }`}>
            {financeLoading ? (
              <p className="text-sm">Checking project capital availability...</p>
            ) : financeError ? (
              <p className="text-sm">Capital check failed: {financeError}</p>
            ) : (
              <div className="text-sm">
                <p className="font-semibold">
                  {capitalNotSet
                    ? 'ℹ️ No Capital Invested'
                    : !hasCapital
                      ? '⚠️ Insufficient Capital'
                      : isCapitalShort
                        ? '⚠️ Capital Warning'
                        : '✓ Capital Available'}
                </p>
                {capitalNotSet ? (
                  <>
                    <p className="mt-1">
                      No capital has been invested in this project. You can still create purchase orders - all spending will be tracked. Add capital later to enable capital validation.
                    </p>
                    <p className="text-xs mt-2">
                      Batch estimated cost: {formatCurrency(estimatedBatchCost)}. Final PO totals may vary if overrides are applied.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1">
                      Available: <span className="font-medium">{formatCurrency(availableCapital)}</span>
                      {projectFinances?.committedCost !== undefined && (
                        <> • Committed: <span className="font-medium">{formatCurrency(projectFinances.committedCost)}</span></>
                      )}
                      {projectFinances?.totalUsed !== undefined && (
                        <> • Used: <span className="font-medium">{formatCurrency(projectFinances.totalUsed)}</span></>
                      )}
                    </p>
                    <p className="text-xs mt-1">
                      Batch estimated cost: {formatCurrency(estimatedBatchCost)}. Final PO totals may vary if overrides are applied.
                    </p>
                    {!hasCapital && (
                      <p className="text-xs mt-2">
                        ⚠️ Insufficient capital available. Purchase orders will be created but capital validation will occur. Add capital to ensure sufficient funds.
                      </p>
                    )}
                    {hasCapital && isCapitalShort && (
                      <p className="text-xs mt-2">
                        ⚠️ Available capital is below the batch estimate. Some purchase orders may fail capital validation unless capital is increased.
                      </p>
                    )}
                  </>
                )}
                {projectId && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/financing?projectId=${projectId}&returnTo=${encodeURIComponent(returnTo)}`}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
                    >
                      Open Financing
                    </Link>
                    <Link
                      href={`/investors?projectId=${projectId}&returnTo=${encodeURIComponent(returnTo)}`}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
                    >
                      Allocate Funds (Investors)
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Mode Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Assignment Mode</h2>
          <div className="flex gap-4 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-6 py-3 font-medium transition-colors ${
                mode === 'single'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Single Supplier
            </button>
            <button
              type="button"
              onClick={() => setMode('multiple')}
              className={`px-6 py-3 font-medium transition-colors ${
                mode === 'multiple'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Multiple Suppliers
            </button>
          </div>
        </div>

        {/* Price Comparison Button */}
        {materialRequests.length > 0 && (
          <div className="mb-6 flex justify-end">
            <button
              onClick={() => setShowPriceComparison(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              💰 Compare Prices
            </button>
          </div>
        )}

        {/* Empty Suppliers State */}
        {suppliers.length === 0 && !loading && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-8 mb-6 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Suppliers Found</h3>
              <p className="text-gray-700 mb-6">
                You need to add suppliers before you can assign them to materials. 
                Your assignment progress will be saved automatically.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href={getSupplierCreationUrl()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-block"
                >
                  + Add New Supplier
                </Link>
                <Link
                  href="/suppliers"
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium inline-block"
                >
                  View All Suppliers
                </Link>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                💡 Tip: You can also use the sidebar to navigate to Suppliers. Your work here will be saved.
              </p>
            </div>
          </div>
        )}

        {/* Assignment Form */}
        {suppliers.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            {mode === 'single' ? (
              <SingleSupplierAssignment
                materialRequests={materialRequests}
                suppliers={suppliers}
                onAssignmentChange={handleSingleAssignmentChange}
                initialData={singleAssignment}
              />
            ) : (
              <MultiSupplierAssignment
                materialRequests={materialRequests}
                suppliers={suppliers}
                onAssignmentChange={handleMultipleAssignmentChange}
                initialData={multipleAssignments}
              />
            )}
          </div>
        )}

        {/* Quick Add Supplier Link (when suppliers exist but user wants to add more) */}
        {suppliers.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-5 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <p className="text-base font-semibold text-blue-900">
                    Need to add another supplier?
                  </p>
                </div>
                <p className="text-sm text-blue-700 mt-1">
                  💾 Your current assignments will be saved automatically. You can add multiple suppliers and return here.
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={getSupplierCreationUrl()}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm whitespace-nowrap shadow-md transition-all hover:shadow-lg flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Supplier
                </Link>
                <Link
                  href="/suppliers"
                  className="px-5 py-2.5 border-2 border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 font-medium text-sm whitespace-nowrap transition-all flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  View All
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Price Comparison Modal */}
        <PriceComparisonModal
          isOpen={showPriceComparison}
          onClose={() => setShowPriceComparison(false)}
          materials={materialRequests.map((req) => ({
            materialRequestId: req._id?.toString() || req.id?.toString(),
            name: req.materialName,
            quantity: req.quantityNeeded,
            unit: req.unit,
            categoryId: req.categoryId?.toString(),
            estimatedUnitCost: req.estimatedUnitCost,
          }))}
          onSupplierSelected={(supplier) => {
            // Auto-fill supplier in the assignment form
            if (mode === 'single') {
              setSingleAssignment((prev) => ({
                ...prev,
                supplierId: supplier.supplierId.toString(),
              }));
            } else {
              // For multiple mode, set supplier for all materials
              setMultipleAssignments((prev) =>
                prev.map((assignment) => ({
                  ...assignment,
                  supplierId: supplier.supplierId.toString(),
                }))
              );
            }
            setShowPriceComparison(false);
          }}
          currentProjectId={batch?.projectId?.toString()}
        />

        {/* Actions */}
        <div className="flex justify-between items-center">
          <Link
            href={`/material-requests/bulk/${params.batchId}`}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
          >
            Cancel
          </Link>
          <LoadingButton
            onClick={handleSubmit}
            isLoading={submitting}
            loadingText="Creating Purchase Orders..."
            disabled={!canProceed || submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Create Purchase Orders
          </LoadingButton>
        </div>
        {capitalNotSet && (
          <p className="mt-3 text-xs text-blue-700">
            ℹ️ No capital invested. Purchase orders will be created and spending will be tracked. Add capital later to enable capital validation.
          </p>
        )}
        {!capitalNotSet && !hasCapital && (
          <p className="mt-3 text-xs text-amber-700">
            ⚠️ Insufficient capital. Purchase orders will be created but may fail capital validation. Add capital to ensure sufficient funds.
          </p>
        )}
      </div>
    </AppLayout>
  );
}

export default function SupplierAssignmentPage() {
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
      <SupplierAssignmentPageContent />
    </Suspense>
  );
}

