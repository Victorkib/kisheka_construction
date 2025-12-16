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

function PurchaseOrderResponsePageContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params?.token;
  const actionParam = searchParams?.get('action');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [purchaseOrder, setPurchaseOrder] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const [action, setAction] = useState(actionParam || null);

  const [formData, setFormData] = useState({
    supplierNotes: '',
    finalUnitCost: '',
    quantityOrdered: '',
    deliveryDate: '',
    notes: ''
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

      const response = await fetch(`/api/purchase-orders/respond/${token}`);
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

      const response = await fetch(`/api/purchase-orders/${purchaseOrder._id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          token,
          ...formData
        })
      });

      const data = await response.json();

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
      const response = await fetch(`/api/purchase-orders/${purchaseOrder._id}/download?token=${token}`);
      
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading purchase order...</p>
        </div>
      </div>
    );
  }

  if (error && !purchaseOrder) {
    const isTokenUsed = error.includes('already been used');
    const isExpired = error.includes('expired');
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="text-6xl mb-4">{isTokenUsed || isExpired ? '🔒' : '⚠️'}</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isTokenUsed ? 'Link Already Used' : isExpired ? 'Link Expired' : 'Error'}
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            {isTokenUsed && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-left">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This response link can only be used once for security reasons. 
                  If you need to make changes to your response, please contact the buyer directly.
                </p>
              </div>
            )}
            <p className="text-xs text-gray-500">
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
          title: 'Order Rejected',
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
          message: 'Your modification request has been submitted for review.',
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">{successContent.icon}</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{successContent.title}</h2>
            {successContent.orderNumber && (
              <p className="text-sm text-gray-500 mb-4">
                Order Number: <span className="font-semibold">{successContent.orderNumber}</span>
              </p>
            )}
            <p className="text-gray-700 mb-6">{successContent.message}</p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-blue-900 mb-2">What happens next?</p>
              <ul className="text-sm text-blue-800 space-y-1">
                {successContent.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-gray-500">
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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Purchase Order Response</h1>
              <p className="text-gray-600">
                Order Number: <span className="font-semibold">{purchaseOrder.purchaseOrderNumber}</span>
              </p>
              {supplier && (
                <p className="text-sm text-gray-500 mt-1">
                  Supplier: {supplier.name}
                </p>
              )}
            </div>
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPDF}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              {downloadingPDF ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Download PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Batch Information (for bulk orders) */}
        {purchaseOrder.isBulkOrder && purchaseOrder.batch && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">Batch Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-blue-700">Batch Number</p>
                <p className="font-medium text-blue-900">
                  {purchaseOrder.batch.batchNumber}
                  {purchaseOrder.batch.batchName && ` - ${purchaseOrder.batch.batchName}`}
                </p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Total Materials</p>
                <p className="font-medium text-blue-900">
                  {purchaseOrder.materials?.length || purchaseOrder.materialRequests?.length || 0} item(s)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Purchase Order Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h2>
          
          {/* Bulk Order - Show Materials Table */}
          {purchaseOrder.isBulkOrder && purchaseOrder.materials && Array.isArray(purchaseOrder.materials) && purchaseOrder.materials.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-gray-800 mb-3">Materials in this Order</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {purchaseOrder.materials.map((material, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {material.materialName}
                          {material.description && (
                            <div className="text-xs text-gray-500 mt-1">{material.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{material.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{material.unit}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(material.unitCost)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          {formatCurrency(material.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="4" className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                        Total:
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">
                        {formatCurrency(purchaseOrder.totalCost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            /* Single Order - Show Standard Details */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Material</p>
                <p className="font-medium text-gray-900">{purchaseOrder.materialName}</p>
              </div>
              {purchaseOrder.description && (
                <div>
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="font-medium text-gray-900">{purchaseOrder.description}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Quantity</p>
                <p className="font-medium text-gray-900">
                  {purchaseOrder.quantityOrdered} {purchaseOrder.unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Unit Cost</p>
                <p className="font-medium text-gray-900">{formatCurrency(purchaseOrder.unitCost)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Cost</p>
                <p className="font-medium text-lg text-blue-600">{formatCurrency(purchaseOrder.totalCost)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Delivery Date</p>
                <p className="font-medium text-gray-900">{formatDate(purchaseOrder.deliveryDate)}</p>
              </div>
            </div>
          )}
          
          <div className={`mt-6 pt-6 border-t border-gray-200 ${purchaseOrder.isBulkOrder ? '' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}`}>
            {purchaseOrder.terms && (
              <div className={purchaseOrder.isBulkOrder ? 'mb-4' : ''}>
                <p className="text-sm text-gray-600">Terms</p>
                <p className="font-medium text-gray-900">{purchaseOrder.terms}</p>
              </div>
            )}
            {purchaseOrder.notes && (
              <div className={purchaseOrder.isBulkOrder ? '' : 'md:col-span-2'}>
                <p className="text-sm text-gray-600">Notes</p>
                <p className="font-medium text-gray-900">{purchaseOrder.notes}</p>
              </div>
            )}
            {!purchaseOrder.isBulkOrder && (
              <div>
                <p className="text-sm text-gray-600">Delivery Date</p>
                <p className="font-medium text-gray-900">{formatDate(purchaseOrder.deliveryDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Selection */}
        {!action && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">How would you like to respond?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setAction('accept')}
                className="p-4 border-2 border-green-500 rounded-lg hover:bg-green-50 transition text-center"
              >
                <div className="text-3xl mb-2">✅</div>
                <div className="font-semibold text-green-700">Accept Order</div>
                <div className="text-sm text-gray-600 mt-1">Confirm this order</div>
              </button>
              <button
                onClick={() => setAction('reject')}
                className="p-4 border-2 border-red-500 rounded-lg hover:bg-red-50 transition text-center"
              >
                <div className="text-3xl mb-2">❌</div>
                <div className="font-semibold text-red-700">Reject Order</div>
                <div className="text-sm text-gray-600 mt-1">Decline this order</div>
              </button>
              <button
                onClick={() => setAction('modify')}
                className="p-4 border-2 border-yellow-500 rounded-lg hover:bg-yellow-50 transition text-center"
              >
                <div className="text-3xl mb-2">✏️</div>
                <div className="font-semibold text-yellow-700">Modify Order</div>
                <div className="text-sm text-gray-600 mt-1">Request changes</div>
              </button>
            </div>
          </div>
        )}

        {/* Response Form */}
        {action && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {action === 'accept' && 'Accept Order'}
              {action === 'reject' && 'Reject Order'}
              {action === 'modify' && 'Request Modifications'}
            </h2>

            {action === 'accept' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Final Unit Cost (Optional - leave blank to use original)
                  </label>
                  <input
                    type="number"
                    name="finalUnitCost"
                    value={formData.finalUnitCost}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder={purchaseOrder.unitCost?.toString()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    name="supplierNotes"
                    value={formData.supplierNotes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Any additional notes..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {action === 'reject' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="supplierNotes"
                    value={formData.supplierNotes}
                    onChange={handleChange}
                    rows={4}
                    required
                    placeholder="Please provide a reason for rejecting this order..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {action === 'modify' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Quantity (Optional)
                  </label>
                  <input
                    type="number"
                    name="quantityOrdered"
                    value={formData.quantityOrdered}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder={purchaseOrder.quantityOrdered?.toString()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Unit Cost (Optional)
                  </label>
                  <input
                    type="number"
                    name="finalUnitCost"
                    value={formData.finalUnitCost}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder={purchaseOrder.unitCost?.toString()}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Delivery Date (Optional)
                  </label>
                  <input
                    type="date"
                    name="deliveryDate"
                    value={formData.deliveryDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modification Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    required
                    placeholder="Please explain the requested modifications..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={() => setAction(null)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting || !action}
                className={`px-6 py-2 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  action === 'accept' ? 'bg-green-600 hover:bg-green-700' :
                  action === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  action === 'modify' ? 'bg-yellow-600 hover:bg-yellow-700' :
                  'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {submitting ? 'Submitting...' : 
                  action === 'accept' ? 'Accept Order' :
                  action === 'reject' ? 'Reject Order' :
                  action === 'modify' ? 'Submit Modification Request' :
                  'Select an Action'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function PurchaseOrderResponsePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PurchaseOrderResponsePageContent />
    </Suspense>
  );
}

