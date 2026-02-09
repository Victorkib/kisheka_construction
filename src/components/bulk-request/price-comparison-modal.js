/**
 * Price Comparison Modal Component
 * Displays price comparison across suppliers and allows selection
 */

'use client';

import { useState, useEffect } from 'react';
import { LoadingButton } from '@/components/loading';
import { BaseModal } from '@/components/modals/BaseModal';

export function PriceComparisonModal({
  isOpen,
  onClose,
  materials = [],
  onSupplierSelected,
  currentProjectId,
}) {
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (isOpen && materials.length > 0) {
      fetchPriceComparison();
    }
  }, [isOpen, materials]);

  const fetchPriceComparison = async () => {
    try {
      setLoading(true);
      setError(null);

      // Prepare materials for comparison
      const materialsForComparison = materials.map((m) => ({
        materialRequestId: m.materialRequestId || m._id?.toString() || null,
        name: m.name || m.materialName,
        quantity: m.quantity || m.quantityNeeded,
        unit: m.unit,
        categoryId: m.categoryId || null,
        estimatedUnitCost: m.estimatedUnitCost || null,
      }));

      const response = await fetch('/api/suppliers/compare-prices', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({ materials: materialsForComparison }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to compare prices');
      }

      setComparisons(data.data.comparisons || []);
      setSummary(data.data.summary || null);
    } catch (err) {
      setError(err.message);
      console.error('Price comparison error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'KES 0';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceLabel = (confidence) => {
    switch (confidence) {
      case 'high':
        return 'High';
      case 'medium':
        return 'Medium';
      case 'low':
      default:
        return 'Low';
    }
  };

  const handleSelectSupplier = (supplier) => {
    if (onSupplierSelected) {
      onSupplierSelected(supplier);
    }
    onClose();
  };

  if (!isOpen) return null;

  // Find cheapest supplier
  const cheapestSupplier =
    comparisons.length > 0 && comparisons[0].hasHistoricalData ? comparisons[0] : null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-6xl"
      variant="blue"
      showCloseButton={true}
      isLoading={loading}
      loadingMessage="Comparing prices..."
      preventCloseDuringLoading={true}
    >
      <div className="max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-xl border-b border-gray-200/50 px-8 py-6 flex justify-between items-center shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Price Comparison</h2>
            <p className="text-sm text-gray-600 mt-1">
              Compare prices across {comparisons.length} supplier(s) for {materials.length} material(s)
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {error ? (
            <div className="bg-gradient-to-br from-red-50/80 to-red-100/80 backdrop-blur-sm border border-red-200/50 text-red-800 px-6 py-4 rounded-xl shadow-lg">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 p-2 bg-gradient-to-br from-red-400 to-red-600 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="font-semibold">{error}</p>
              </div>
            </div>
          ) : comparisons.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-block p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">No suppliers found for comparison</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              {summary && (
                <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 backdrop-blur-sm border border-blue-200/50 rounded-xl p-6 mb-6 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-1">
                        Best Price
                      </p>
                      <p className="text-lg font-bold text-blue-900 mb-2">
                        {summary.cheapestSupplier}
                      </p>
                      <p className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {formatCurrency(summary.cheapestTotal)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="inline-block px-4 py-2 bg-white/60 backdrop-blur-sm rounded-lg border border-blue-200/50">
                        <p className="text-sm font-semibold text-blue-900">
                          {summary.suppliersWithData} of {summary.totalSuppliers}
                        </p>
                        <p className="text-xs text-blue-700">
                          suppliers have historical data
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Comparison Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200/50 shadow-lg">
                <table className="min-w-full divide-y divide-gray-200/50">
                  <thead className="bg-gradient-to-br from-gray-50/80 to-gray-100/80 backdrop-blur-sm sticky top-0">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Supplier
                      </th>
                      {materials.map((material, index) => (
                        <th
                          key={index}
                          className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider"
                        >
                          <div>
                            <div className="font-bold text-gray-900">{material.name || material.materialName}</div>
                            <div className="text-xs font-normal text-gray-500 mt-1">
                              {material.quantity || material.quantityNeeded} {material.unit}
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Total Cost
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/50 backdrop-blur-sm divide-y divide-gray-200/30">
                    {comparisons.map((comparison, supplierIndex) => {
                      const isCheapest =
                        cheapestSupplier &&
                        comparison.supplierId.toString() === cheapestSupplier.supplierId.toString();
                      const hasData = comparison.hasHistoricalData;

                      return (
                        <tr
                          key={comparison.supplierId.toString()}
                          className={`transition-all duration-200 ${
                            isCheapest 
                              ? 'bg-gradient-to-r from-green-50/80 to-emerald-50/80 border-l-4 border-green-500 shadow-sm' 
                              : 'hover:bg-gray-50/80'
                          } ${!hasData ? 'opacity-75' : ''}`}
                        >
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                {comparison.supplierName}
                                {isCheapest && (
                                  <span className="inline-flex px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md">
                                    Best Price
                                  </span>
                                )}
                              </div>
                              {comparison.supplierEmail && (
                                <div className="text-xs text-gray-500 mt-1">{comparison.supplierEmail}</div>
                              )}
                              {!hasData && (
                                <div className="text-xs text-yellow-700 mt-1 font-medium">
                                  No historical data
                                </div>
                              )}
                            </div>
                          </td>
                          {comparison.materials.map((material, matIndex) => (
                            <td key={matIndex} className="px-6 py-5">
                              {material.estimatedUnitCost ? (
                                <div>
                                  <div className="text-sm font-bold text-gray-900">
                                    {formatCurrency(material.estimatedTotalCost)}
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1 font-medium">
                                    {formatCurrency(material.estimatedUnitCost)}/{material.unit}
                                  </div>
                                  {material.confidence && (
                                    <div className="mt-2">
                                      <span
                                        className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full ${getConfidenceColor(
                                          material.confidence
                                        )} shadow-sm`}
                                      >
                                        {getConfidenceLabel(material.confidence)}
                                      </span>
                                    </div>
                                  )}
                                  {material.historicalData && (
                                    <div className="text-xs text-gray-500 mt-1 font-medium">
                                      {material.historicalData.dataPoints} data point(s)
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-400 font-medium">N/A</div>
                              )}
                            </td>
                          ))}
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="text-lg font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                              {formatCurrency(comparison.totalEstimatedCost)}
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <button
                              onClick={() => handleSelectSupplier(comparison)}
                              className="relative px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 text-sm font-semibold transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 active:scale-100"
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="mt-8 p-5 bg-gradient-to-br from-gray-50/80 to-gray-100/80 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-lg">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-4">Legend</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 bg-gradient-to-br from-green-400 to-emerald-600 rounded-lg border-2 border-green-500 shadow-sm"></span>
                    <span className="font-medium">Best Price</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800 shadow-sm">
                      High
                    </span>
                    <span className="text-xs">High confidence (5+ data points)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex px-3 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800 shadow-sm">
                      Medium
                    </span>
                    <span className="text-xs">Medium confidence (2-4 data points)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex px-3 py-1 text-xs font-bold rounded-full bg-gray-100 text-gray-800 shadow-sm">
                      Low
                    </span>
                    <span className="text-xs">Low confidence (1 data point or estimated)</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-xl border-t border-gray-200/50 px-8 py-5 flex justify-end shadow-lg">
          <button
            onClick={onClose}
            className="px-6 py-3 text-sm font-semibold text-gray-700 bg-white/60 backdrop-blur-sm border border-gray-300/50 rounded-xl hover:bg-white/80 hover:border-gray-400/50 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

