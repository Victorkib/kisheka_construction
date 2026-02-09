/**
 * Statement Generator Component
 * 
 * Provides UI for generating and downloading investor statements
 * Supports JSON, PDF, and Excel formats
 * 
 * @component
 * @param {string} investorId - Investor ID
 * @param {string} investorName - Investor name (for display)
 * @param {function} onClose - Callback when component should close (optional)
 */

'use client';

import { useState } from 'react';
import { LoadingButton, LoadingOverlay } from '@/components/loading';

export function StatementGenerator({ investorId, investorName, onClose }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleGeneratePreview = async () => {
    setGenerating(true);
    setError(null);
    setPreviewData(null);
    setShowPreview(false);

    try {
      const queryParams = new URLSearchParams({
        format: 'json',
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const response = await fetch(`/api/investors/${investorId}/statements?${queryParams}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate statement');
      }

      setPreviewData(data.data);
      setShowPreview(true);
    } catch (err) {
      setError(err.message || 'Failed to generate statement preview');
      console.error('Generate preview error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (format) => {
    setGenerating(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        format: format === 'xlsx' ? 'excel' : format,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });

      const response = await fetch(`/api/investors/${investorId}/statements?${queryParams}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate ${format.toUpperCase()} statement`);
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Investor_Statement_${investorName || investorId}_${new Date().toISOString().split('T')[0]}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      } else {
        filename += format === 'pdf' ? '.pdf' : format === 'excel' || format === 'xlsx' ? '.xlsx' : '.json';
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
      setError(err.message || `Failed to download ${format.toUpperCase()} statement`);
      console.error('Download error:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6 relative">
      <LoadingOverlay 
        isLoading={generating} 
        message={investorName ? `Generating statement for ${investorName}...` : 'Generating statement...'} 
        fullScreen={false} 
      />
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Generate Statement</h2>
          {investorName && (
            <p className="text-sm text-gray-600 mt-1">For: {investorName}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Date Range Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
            Start Date (Optional)
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            max={endDate || undefined}
          />
        </div>
        <div>
          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
            End Date (Optional)
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            min={startDate || undefined}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <LoadingButton
          onClick={handleGeneratePreview}
          isLoading={generating && !showPreview}
          loadingText="Generating..."
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Preview Statement
        </LoadingButton>

        <LoadingButton
          onClick={() => handleDownload('pdf')}
          isLoading={generating}
          loadingText="Generating PDF..."
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Download PDF
        </LoadingButton>

        <LoadingButton
          onClick={() => handleDownload('excel')}
          isLoading={generating}
          loadingText="Generating Excel..."
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Download Excel
        </LoadingButton>

        <button
          onClick={() => handleDownload('json')}
          disabled={generating}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Download JSON
        </button>
      </div>

      {/* Preview Section */}
      {showPreview && previewData && (
        <div className="border-t pt-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Statement Preview</h3>
            <button
              onClick={() => setShowPreview(false)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Hide Preview
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            {/* Investor Info */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Investor Information</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-700">Name:</span>{' '}
                  <span className="font-medium">{previewData.investor.name}</span>
                </div>
                {previewData.investor.email && (
                  <div>
                    <span className="text-gray-700">Email:</span>{' '}
                    <span className="font-medium">{previewData.investor.email}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-700">Type:</span>{' '}
                  <span className="font-medium">{previewData.investor.investmentType}</span>
                </div>
                <div>
                  <span className="text-gray-700">Status:</span>{' '}
                  <span className="font-medium">{previewData.investor.status}</span>
                </div>
              </div>
            </div>

            {/* Capital Usage */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Capital Usage</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-700">Total Invested:</span>{' '}
                  <span className="font-medium text-green-600">
                    {formatCurrency(previewData.capitalUsage.totalInvested)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-700">Capital Used:</span>{' '}
                  <span className="font-medium text-red-600">
                    {formatCurrency(previewData.capitalUsage.capitalUsed)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-700">Remaining Balance:</span>{' '}
                  <span className="font-medium text-blue-600">
                    {formatCurrency(previewData.capitalUsage.capitalBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-700">Usage:</span>{' '}
                  <span className="font-medium">
                    {previewData.capitalUsage.usagePercentage}%
                  </span>
                </div>
              </div>
            </div>

            {/* Contributions Summary */}
            {previewData.contributions && previewData.contributions.list.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">
                  Contributions ({previewData.contributions.count})
                </h4>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-gray-700">Total:</span>{' '}
                    <span className="font-medium">
                      {formatCurrency(previewData.contributions.totals.total)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-700">Equity:</span>{' '}
                    <span className="font-medium">
                      {formatCurrency(previewData.contributions.totals.equity)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-700">Loan:</span>{' '}
                    <span className="font-medium">
                      {formatCurrency(previewData.contributions.totals.loan)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Period */}
            {(previewData.period.startDate || previewData.period.endDate) && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Period</h4>
                <div className="text-sm">
                  {previewData.period.startDate && (
                    <div>
                      <span className="text-gray-700">From:</span>{' '}
                      {formatDate(previewData.period.startDate)}
                    </div>
                  )}
                  {previewData.period.endDate && (
                    <div>
                      <span className="text-gray-700">To:</span>{' '}
                      {formatDate(previewData.period.endDate)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Project Breakdown */}
            {previewData.capitalUsage?.projectBreakdown && previewData.capitalUsage.projectBreakdown.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Project Breakdown</h4>
                <div className="space-y-2 text-sm">
                  {previewData.capitalUsage.projectBreakdown.map((project, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border">
                      <div className="font-medium text-gray-900">{project.projectName}</div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <span className="text-gray-700">Allocated:</span>{' '}
                          <span className="font-medium">{formatCurrency(project.allocatedAmount)}</span>
                        </div>
                        <div>
                          <span className="text-gray-700">Used:</span>{' '}
                          <span className="font-medium text-red-600">{formatCurrency(project.capitalUsed)}</span>
                        </div>
                        <div>
                          <span className="text-gray-700">Balance:</span>{' '}
                          <span className="font-medium text-blue-600">{formatCurrency(project.capitalBalance)}</span>
                        </div>
                        <div>
                          <span className="text-gray-700">Usage:</span>{' '}
                          <span className="font-medium">
                            {project.allocatedAmount > 0 
                              ? ((project.capitalUsed / project.allocatedAmount) * 100).toFixed(1)
                              : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

