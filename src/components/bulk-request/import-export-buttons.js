/**
 * Import/Export Buttons Component
 * Provides import and export functionality for bulk requests
 */

'use client';

import { useState } from 'react';
import { exportBatchToCSV, downloadCSV } from '@/lib/helpers/export-helpers';
import { LoadingButton } from '@/components/loading';

export function ImportExportButtons({ batch, materialRequests = [], onImportComplete }) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importResults, setImportResults] = useState(null);

  const handleExportCSV = () => {
    if (!batch || !materialRequests || materialRequests.length === 0) {
      alert('No data to export');
      return;
    }

    const csvContent = exportBatchToCSV(batch, materialRequests);
    const filename = `batch-${batch.batchNumber || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  const handleImport = async () => {
    if (!csvText.trim()) {
      setImportError('Please paste CSV content');
      return;
    }

    try {
      setImporting(true);
      setImportError(null);
      setImportResults(null);

      const response = await fetch('/api/material-requests/bulk/import', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          batchId: batch._id,
          csvText: csvText,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to import materials');
      }

      setImportResults(data.data);

      if (data.data.materials && data.data.materials.length > 0 && onImportComplete) {
        onImportComplete(data.data.materials);
        setShowImportModal(false);
        setCsvText('');
      }
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      {/* Export Button */}
      {batch && materialRequests.length > 0 && (
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          📥 Export CSV
        </button>
      )}

      {/* Import Button */}
      <button
        onClick={() => setShowImportModal(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
      >
        📤 Import CSV
      </button>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Import Materials from CSV</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setCsvText('');
                  setImportError(null);
                  setImportResults(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Paste CSV Content
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`Format: Material Name, Quantity, Unit, Category, Cost\nExample:\nCement, 500, bag, Structural Materials, 850\nRebars, 600, piece, Structural Materials, 1200`}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-600 mt-1">
                  CSV format: Material Name, Quantity, Unit, Category (optional), Cost (optional)
                </p>
              </div>

              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                  {importError}
                </div>
              )}

              {importResults && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">Import Results:</p>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>Total parsed: {importResults.totalParsed}</li>
                    <li>Valid: {importResults.validCount}</li>
                    {importResults.errorCount > 0 && (
                      <li className="text-red-700">Errors: {importResults.errorCount}</li>
                    )}
                  </ul>
                  {importResults.errors && importResults.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-700">
                      <p className="font-medium">Errors:</p>
                      <ul className="list-disc list-inside">
                        {importResults.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {importResults.errors.length > 5 && (
                          <li>... and {importResults.errors.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setCsvText('');
                    setImportError(null);
                    setImportResults(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <LoadingButton
                  onClick={handleImport}
                  isLoading={importing}
                  loadingText="Importing..."
                  disabled={!csvText.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Import Materials
                </LoadingButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

