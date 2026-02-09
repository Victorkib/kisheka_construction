/**
 * Purchase Order Response Page
 * Public page for suppliers to respond to purchase orders via secure token
 * 
 * Route: /purchase-orders/respond/[token]
 * Auth: None (public, token-based)
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { getRejectionReasonOptions, getSubcategoryOptions } from '@/lib/rejection-reasons';
import { SupplierResponseInterface } from '@/components/purchase-orders/SupplierResponseInterface';

function PurchaseOrderResponsePageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params?.token;
  const actionParam = searchParams?.get('action');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [action, setAction] = useState(actionParam || null);

  // Get rejection reason options
  const rejectionReasonOptions = getRejectionReasonOptions();
  const [selectedReason, setSelectedReason] = useState('');
  const subcategoryOptions = selectedReason ? getSubcategoryOptions(selectedReason) : [];

  const [formData, setFormData] = useState({
    supplierNotes: '',
    finalUnitCost: '',
    quantityOrdered: '',
    deliveryDate: '',
    notes: '',
    rejectionReason: '',
    rejectionSubcategory: '',
  });

  useEffect(() => {
    if (token) {
      fetchPurchaseOrder();
    }
  }, [token]);

  const fetchPurchaseOrder = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/purchase-orders/respond/${token}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        // Check if token was already used
        if (response.status === 410 && data.error?.includes('already been used')) {
          throw new Error('This response link has already been used. Please contact the buyer if you need to make changes.');
        }
        throw new Error(data.error || 'Failed to load purchase order');
      }

      setPurchaseOrder(data.data.purchaseOrder);
      setSupplier(data.data.supplier);
      
      // Pre-fill form with current values
      if (data.data.purchaseOrder) {
        setFormData(prev => ({
          ...prev,
          finalUnitCost: data.data.purchaseOrder.unitCost?.toString() || '',
          quantityOrdered: data.data.purchaseOrder.quantityOrdered?.toString() || '',
          deliveryDate: data.data.purchaseOrder.deliveryDate 
            ? new Date(data.data.purchaseOrder.deliveryDate).toISOString().split('T')[0]
            : ''
        }));
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch purchase order error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Handle rejection reason change to reset subcategory
    if (name === 'rejectionReason') {
      setSelectedReason(value);
      setFormData(prev => ({
        ...prev,
        rejectionReason: value,
        rejectionSubcategory: '' // Reset subcategory when main reason changes
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!purchaseOrder) {
        throw new Error('Purchase order not loaded');
      }

      // Validate action is selected
      if (!action || !['accept', 'reject', 'modify'].includes(action)) {
        setError('Please select an action (Accept, Reject, or Modify)');
        setSubmitting(false);
        return;
      }

      if (action === 'reject' && !formData.supplierNotes.trim()) {
        setError('Please provide a reason for rejection');
        setSubmitting(false);
        return;
      }

      if (action === 'modify' && !formData.notes.trim()) {
        setError('Please provide notes explaining the requested modifications');
        setSubmitting(false);
        return;
      }

      // CRITICAL FIX: Bulk orders should not use this handler
      // They should use SupplierResponseInterface component instead
      if (purchaseOrder.isBulkOrder) {
        setError('Bulk orders require material-level responses. Please use the bulk order response interface above.');
        setSubmitting(false);
        return;
      }

      const respondResponse = await fetch(`/api/purchase-orders/${purchaseOrder._id}/respond`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          action,
          finalUnitCost: formData.finalUnitCost ? parseFloat(formData.finalUnitCost) : null,
          quantityOrdered: formData.quantityOrdered ? parseFloat(formData.quantityOrdered) : null,
          deliveryDate: formData.deliveryDate || null,
          supplierNotes: formData.supplierNotes || null,
          notes: formData.notes || null,
          rejectionReason: formData.rejectionReason || null,
          rejectionSubcategory: formData.rejectionSubcategory || null,
        }),
      });

      const data = await respondResponse.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to process response');
      }

      setSuccess(true);
      // Don't redirect - supplier should stay on success page
    } catch (err) {
      setError(err.message);
      console.error('Submit response error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDownloadPDF = async () => {
    if (!purchaseOrder || !token) return;

    setDownloadingPDF(true);
    setError(null);

    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrder._id}/download?token=${token}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to download PDF');
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Purchase_Order_${purchaseOrder.purchaseOrderNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Get blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message || 'Failed to download PDF');
      console.error('Download PDF error:', err);
    } finally {
      setDownloadingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-6 text-lg font-medium text-gray-800">Loading purchase order details...</p>
          <p className="mt-2 text-sm text-gray-600">Please wait while we retrieve your information</p>
        </div>
      </div>
    );
  }

  if (error && !purchaseOrder) {
    const isTokenUsed = error.includes('already been used');
    const isExpired = error.includes('expired');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 border border-gray-200">
          <div className="text-center space-y-4">
            <div className="text-7xl mb-4">{isTokenUsed || isExpired ? '🔒' : '⚠️'}</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isTokenUsed ? 'Link Already Used' : isExpired ? 'Link Expired' : 'Error Loading Order'}
            </h2>
            <p className="text-base font-medium text-gray-800 mb-6 p-4 bg-gray-100 rounded-lg border border-gray-300">{error}</p>
            {isTokenUsed && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 mb-5 text-left">
                <p className="text-sm font-semibold text-amber-900 mb-2">Important Notice</p>
                <p className="text-sm text-amber-800">
                  This response link can only be used once for security reasons. 
                  If you need to make changes to your response, please contact the buyer directly.
                </p>
              </div>
            )}
            <p className="text-sm text-gray-600 font-medium">
              You can safely close this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    // Determine success message based on action
    const getSuccessContent = () => {
      if (action === 'accept') {
        return {
          icon: '✅',
          title: 'Order Accepted Successfully',
          message: 'Your acceptance has been recorded and the buyer has been notified.',
          orderNumber: purchaseOrder?.purchaseOrderNumber,
          instructions: [
            'You can close this page',
            'You will receive confirmation via email/SMS',
            'The buyer will process your order shortly'
          ]
        };
      } else if (action === 'reject') {
        return {
          icon: '❌',
          title: 'Order Rejected Successfully',
          message: 'Your rejection has been recorded and the buyer has been notified.',
          orderNumber: purchaseOrder?.purchaseOrderNumber,
          instructions: [
            'You can close this page',
            'The buyer will be notified of your decision',
            'If you need to discuss this order, please contact the buyer directly'
          ]
        };
      } else {
        return {
          icon: '✏️',
          title: 'Modification Request Submitted',
          message: 'Your modification request has been submitted for buyer review.',
          orderNumber: purchaseOrder?.purchaseOrderNumber,
          instructions: [
            'You can close this page',
            'The buyer will review your request',
            'You will be notified of the decision via email/SMS'
          ]
        };
      }
    };

    const successContent = getSuccessContent();

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-white rounded-xl shadow-xl p-10 border border-gray-300">
          <div className="text-center space-y-6">
            <div className="text-7xl mb-2">{successContent.icon}</div>
            <h1 className="text-2xl font-bold text-gray-900">{successContent.title}</h1>
            {successContent.orderNumber && (
              <p className="text-base font-medium text-gray-800 bg-gray-100 rounded-lg py-2 px-4 inline-block">
                Order Number: <span className="font-bold text-blue-700 ml-1">{successContent.orderNumber}</span>
              </p>
            )}
            <p className="text-lg text-gray-800 font-medium px-4">{successContent.message}</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-left">
              <p className="text-base font-bold text-blue-900 mb-3">What happens next?</p>
              <ul className="text-sm text-blue-900 space-y-2.5">
                {successContent.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-700 mr-3 mt-0.5">•</span>
                    <span className="font-medium">{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-6 border-t border-gray-300">
              <p className="text-xs font-medium text-gray-600">
                This link has been used and is no longer active. You can safely close this page.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!purchaseOrder) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">Purchase Order Response Portal</h1>
              <p className="text-base text-gray-700">
                Order Number: <span className="font-bold text-blue-700 ml-1">{purchaseOrder.purchaseOrderNumber}</span>
              </p>
              {supplier && (
                <p className="text-sm font-medium text-gray-800 bg-gray-100 rounded-lg py-2 px-4 inline-block">
                  Supplier: <span className="font-semibold text-gray-900 ml-1">{supplier.name}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPDF}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-md hover:shadow-lg transition-all duration-200"
            >
              {downloadingPDF ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Downloading PDF...</span>
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-base">Download Purchase Order PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 font-medium px-5 py-4 rounded-xl mb-8 shadow-sm">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="font-semibold">{error}</span>
            </div>
          </div>
        )}

        {/* Batch Information (for bulk orders) */}
        {purchaseOrder.isBulkOrder && purchaseOrder.batch && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-300 rounded-xl p-7 mb-8">
            <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Batch Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-700 mb-1">Batch Number</p>
                <p className="text-lg font-bold text-blue-900">
                  {purchaseOrder.batch.batchNumber}
                  {purchaseOrder.batch.batchName && <span className="text-base font-semibold text-gray-800 ml-2">- {purchaseOrder.batch.batchName}</span>}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-700 mb-1">Total Materials</p>
                <p className="text-lg font-bold text-blue-900">
                  {purchaseOrder.materials?.length || purchaseOrder.materialRequests?.length || 0} item(s)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Purchase Order Details */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-300">
          <h2 className="text-xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-300 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Order Details
          </h2>
          
          {/* Bulk Order - Show Materials Table */}
          {purchaseOrder.isBulkOrder && purchaseOrder.materials && Array.isArray(purchaseOrder.materials) && purchaseOrder.materials.length > 0 ? (
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Materials in this Order</h3>
              <div className="overflow-x-auto rounded-xl border border-gray-300 shadow-sm">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Material</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Unit</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Unit Cost</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-300">
                    {purchaseOrder.materials.map((material, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{material.materialName}</p>
                            {material.description && (
                              <p className="text-sm text-gray-700 mt-1">{material.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-gray-900">{material.quantity}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-gray-900">{material.unit}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(material.unitCost)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-900">{formatCurrency(material.totalCost)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td colSpan="4" className="px-6 py-4 text-right">
                        <span className="text-sm font-bold text-gray-900">Total Order Amount:</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-blue-700">{formatCurrency(purchaseOrder.totalCost)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            /* Single Order - Show Standard Details */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-100 p-5 rounded-xl border border-gray-300">
                <p className="text-sm font-medium text-gray-700 mb-1">Material</p>
                <p className="text-lg font-bold text-gray-900">{purchaseOrder.materialName}</p>
              </div>
              {purchaseOrder.description && (
                <div className="bg-gray-100 p-5 rounded-xl border border-gray-300 md:col-span-2">
                  <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                  <p className="text-base font-medium text-gray-900">{purchaseOrder.description}</p>
                </div>
              )}
              <div className="bg-gray-100 p-5 rounded-xl border border-gray-300">
                <p className="text-sm font-medium text-gray-700 mb-1">Quantity</p>
                <p className="text-lg font-bold text-gray-900">
                  {purchaseOrder.quantityOrdered} <span className="text-base font-medium text-gray-800">{purchaseOrder.unit}</span>
                </p>
              </div>
              <div className="bg-gray-100 p-5 rounded-xl border border-gray-300">
                <p className="text-sm font-medium text-gray-700 mb-1">Unit Cost</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(purchaseOrder.unitCost)}</p>
              </div>
              <div className="bg-blue-100 p-5 rounded-xl border border-blue-300">
                <p className="text-sm font-medium text-blue-700 mb-1">Total Cost</p>
                <p className="text-xl font-bold text-blue-900">{formatCurrency(purchaseOrder.totalCost)}</p>
              </div>
              <div className="bg-gray-100 p-5 rounded-xl border border-gray-300">
                <p className="text-sm font-medium text-gray-700 mb-1">Delivery Date</p>
                <p className="text-lg font-bold text-gray-900">{formatDate(purchaseOrder.deliveryDate)}</p>
              </div>
            </div>
          )}
          
          <div className={`mt-8 pt-8 border-t border-gray-300 ${purchaseOrder.isBulkOrder ? '' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}`}>
            {purchaseOrder.terms && (
              <div className={purchaseOrder.isBulkOrder ? 'mb-6' : ''}>
                <p className="text-sm font-medium text-gray-700 mb-2">Terms & Conditions</p>
                <p className="text-base font-medium text-gray-900 bg-gray-100 p-4 rounded-lg border border-gray-300">{purchaseOrder.terms}</p>
              </div>
            )}
            {purchaseOrder.notes && (
              <div className={purchaseOrder.isBulkOrder ? '' : 'md:col-span-2'}>
                <p className="text-sm font-medium text-gray-700 mb-2">Additional Notes</p>
                <p className="text-base font-medium text-gray-900 bg-gray-100 p-4 rounded-lg border border-gray-300">{purchaseOrder.notes}</p>
              </div>
            )}
            {!purchaseOrder.isBulkOrder && purchaseOrder.deliveryDate && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Scheduled Delivery Date</p>
                <p className="text-base font-bold text-gray-900 bg-gray-100 p-4 rounded-lg border border-gray-300">{formatDate(purchaseOrder.deliveryDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* CRITICAL FIX: Use SupplierResponseInterface for bulk orders */}
        {purchaseOrder.isBulkOrder ? (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-300">
            <SupplierResponseInterface
              order={purchaseOrder}
              token={token}
              onResponse={async (payload) => {
                try {
                  setSubmitting(true);
                  setError(null);

                  const bulkRespondResponse = await fetch(`/api/purchase-orders/${purchaseOrder._id}/respond`, {
                    method: 'POST',
                    cache: 'no-store',
                    headers: {
                      'Content-Type': 'application/json',
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache',
                    },
                    body: JSON.stringify(payload)
                  });

                  const data = await bulkRespondResponse.json();

                  if (!data.success) {
                    throw new Error(data.error || 'Failed to process response');
                  }

                  setSuccess(true);
                } catch (err) {
                  setError(err.message);
                  console.error('Response submission error:', err);
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          </div>
        ) : (
          <>
            {/* Action Selection for Single Orders */}
            {!action && (
              <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-300">
                <h2 className="text-xl font-bold text-gray-900 mb-6">How would you like to respond to this order?</h2>
                <p className="text-base text-gray-700 mb-8">Please select one of the following options to proceed:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                onClick={() => setAction('accept')}
                className="p-6 border-2 border-green-600 rounded-xl hover:bg-green-50 transition-all duration-200 text-center group hover:shadow-lg"
              >
                <div className="text-4xl mb-4">✅</div>
                <div className="font-bold text-lg text-green-800 mb-2">Accept Order</div>
                <div className="text-sm text-gray-700">Confirm and accept this purchase order as presented</div>
                <div className="mt-4 text-sm font-medium text-green-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to accept this order
                </div>
              </button>
              <button
                onClick={() => setAction('reject')}
                className="p-6 border-2 border-red-600 rounded-xl hover:bg-red-50 transition-all duration-200 text-center group hover:shadow-lg"
              >
                <div className="text-4xl mb-4">❌</div>
                <div className="font-bold text-lg text-red-800 mb-2">Reject Order</div>
                <div className="text-sm text-gray-700">Decline this purchase order and provide a reason</div>
                <div className="mt-4 text-sm font-medium text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to reject this order
                </div>
              </button>
              <button
                onClick={() => setAction('modify')}
                className="p-6 border-2 border-amber-600 rounded-xl hover:bg-amber-50 transition-all duration-200 text-center group hover:shadow-lg"
              >
                <div className="text-4xl mb-4">✏️</div>
                <div className="font-bold text-lg text-amber-800 mb-2">Request Modifications</div>
                <div className="text-sm text-gray-700">Request changes to terms, pricing, or delivery</div>
                <div className="mt-4 text-sm font-medium text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to request changes
                </div>
              </button>
            </div>
          </div>
            )}

            {/* Response Form for Single Orders */}
            {action && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 border border-gray-300">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-300">
              {action === 'accept' && 'Accept Purchase Order'}
              {action === 'reject' && 'Reject Purchase Order'}
              {action === 'modify' && 'Request Order Modifications'}
            </h2>

            {action === 'accept' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-base font-semibold text-gray-800 mb-3">
                    Final Unit Cost <span className="text-gray-600 text-sm font-normal">(Optional - leave blank to use original amount)</span>
                  </label>
                  <input
                    type="number"
                    name="finalUnitCost"
                    value={formData.finalUnitCost}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder={`Current: ${formatCurrency(purchaseOrder.unitCost)}`}
                    className="w-full px-4 py-3 text-base text-gray-900 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 placeholder:text-gray-500"
                  />
                  <p className="text-sm text-gray-600 mt-2">Enter a new unit cost if different from the original amount</p>
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-800 mb-3">
                    Additional Notes <span className="text-gray-600 text-sm font-normal">(Optional)</span>
                  </label>
                  <textarea
                    name="supplierNotes"
                    value={formData.supplierNotes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Enter any additional notes or comments for the buyer..."
                    className="w-full px-4 py-3 text-base text-gray-900 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 placeholder:text-gray-500"
                  />
                  <p className="text-sm text-gray-600 mt-2">Add any notes or special instructions for the buyer</p>
                </div>
              </div>
            )}

            {action === 'reject' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-base font-semibold text-gray-800 mb-3">
                    Rejection Reason Category <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="rejectionReason"
                    value={formData.rejectionReason}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 text-base text-gray-900 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                  >
                    <option value="" className="text-gray-500">Select a reason category...</option>
                    {rejectionReasonOptions.map((reason) => (
                      <option key={reason.value} value={reason.value} className="text-gray-900">
                        {reason.label} - {reason.description}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-600 mt-2">Choose the main reason for rejecting this order</p>
                </div>

                {formData.rejectionReason && subcategoryOptions.length > 0 && (
                  <div>
                    <label className="block text-base font-semibold text-gray-800 mb-3">
                      Specific Reason <span className="text-red-600">*</span>
                    </label>
                    <select
                      name="rejectionSubcategory"
                      value={formData.rejectionSubcategory}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 text-base text-gray-900 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                    >
                      <option value="" className="text-gray-500">Select specific reason...</option>
                      {subcategoryOptions.map((subcategory) => (
                        <option key={subcategory.value} value={subcategory.value} className="text-gray-900">
                          {subcategory.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-600 mt-2">Choose the specific reason for your rejection</p>
                  </div>
                )}

                <div>
                  <label className="block text-base font-semibold text-gray-800 mb-3">
                    Additional Details & Explanation <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    name="supplierNotes"
                    value={formData.supplierNotes}
                    onChange={handleChange}
                    rows={5}
                    required
                    placeholder="Please provide detailed explanation about why you are rejecting this order..."
                    className="w-full px-4 py-3 text-base text-gray-900 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 placeholder:text-gray-500"
                  />
                  <p className="text-sm text-gray-600 mt-2">Provide clear details to help the buyer understand your decision</p>
                </div>
              </div>
            )}

            {action === 'modify' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-base font-semibold text-gray-800 mb-3">
                      New Quantity <span className="text-gray-600 text-sm font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      name="quantityOrdered"
                      value={formData.quantityOrdered}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder={`Current: ${purchaseOrder.quantityOrdered}`}
                      className="w-full px-4 py-3 text-base text-gray-900 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-semibold text-gray-800 mb-3">
                      New Unit Cost <span className="text-gray-600 text-sm font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      name="finalUnitCost"
                      value={formData.finalUnitCost}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder={`Current: ${formatCurrency(purchaseOrder.unitCost)}`}
                      className="w-full px-4 py-3 text-base text-gray-900 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 placeholder:text-gray-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-800 mb-3">
                    New Delivery Date <span className="text-gray-600 text-sm font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    name="deliveryDate"
                    value={formData.deliveryDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 text-base text-gray-900 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200"
                  />
                  <p className="text-sm text-gray-600 mt-2">Select a new delivery date if different from the original</p>
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-800 mb-3">
                    Modification Request Details <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={5}
                    required
                    placeholder="Please explain in detail the modifications you are requesting, including reasons for the changes..."
                    className="w-full px-4 py-3 text-base text-gray-900 bg-white border-2 border-gray-400 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 placeholder:text-gray-500"
                  />
                  <p className="text-sm text-gray-600 mt-2">Clearly describe all requested changes and the reasons for them</p>
                </div>
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-gray-300 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => setAction(null)}
                className="px-8 py-3 border-2 border-gray-400 text-gray-800 font-semibold rounded-xl hover:bg-gray-100 transition-all duration-200 flex-1"
              >
                ← Back to Options
              </button>
              <button
                type="submit"
                disabled={submitting || !action}
                className={`px-8 py-3 rounded-xl text-white font-bold text-base transition-all duration-200 flex-1 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  action === 'accept' ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800' :
                  action === 'reject' ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800' :
                  action === 'modify' ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800' :
                  'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </span>
                ) : (
                  action === 'accept' ? '✓ Confirm & Accept Order' :
                  action === 'reject' ? '✗ Submit Rejection' :
                  action === 'modify' ? '📝 Submit Modification Request' :
                  'Select an Action'
                )}
              </button>
            </div>
          </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PurchaseOrderResponsePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-6 text-lg font-medium text-gray-800">Loading response portal...</p>
          <p className="mt-2 text-sm text-gray-600">Please wait a moment</p>
        </div>
      </div>
    }>
      <PurchaseOrderResponsePageContent />
    </Suspense>
  );
}