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
          className="px-4 py-2 ds-bg-success text-white rounded-lg hover:ds-bg-success text-sm font-medium cursor-pointer"
        >
          📥 Export CSV
        </button>
      )}

      {/* Import Button */}
      <button
        onClick={() => setShowImportModal(true)}
        className="px-4 py-2 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover text-sm font-medium cursor-pointer"
      >
        📤 Import CSV
      </button>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="ds-bg-surface rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold ds-text-primary">Import Materials from CSV</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setCsvText('');
                  setImportError(null);
                  setImportResults(null);
                }}
                className="ds-text-muted hover:ds-text-secondary cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold ds-text-secondary mb-2">
                  Paste CSV Content
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`Format: Material Name, Quantity, Unit, Category, Cost\nExample:\nCement, 500, bag, Structural Materials, 850\nRebars, 600, piece, Structural Materials, 1200`}
                  rows={10}
                  className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary font-mono text-sm"
                />
                <p className="text-xs ds-text-secondary mt-1">
                  CSV format: Material Name, Quantity, Unit, Category (optional), Cost (optional)
                </p>
              </div>

              {importError && (
                <div className="ds-bg-danger/10 border ds-border-danger/40 ds-text-danger px-4 py-3 rounded-lg">
                  {importError}
                </div>
              )}

              {importResults && (
                <div className="ds-bg-accent-subtle border ds-border-accent-subtle rounded-lg p-4">
                  <p className="text-sm font-medium ds-text-primary mb-2">Import Results:</p>
                  <ul className="text-sm ds-text-secondary space-y-1">
                    <li>Total parsed: {importResults.totalParsed}</li>
                    <li>Valid: {importResults.validCount}</li>
                    {importResults.errorCount > 0 && (
                      <li className="ds-text-danger">Errors: {importResults.errorCount}</li>
                    )}
                  </ul>
                  {importResults.errors && importResults.errors.length > 0 && (
                    <div className="mt-2 text-xs ds-text-danger">
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
                  className="px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted ds-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <LoadingButton
                  onClick={handleImport}
                  isLoading={importing}
                  loadingText="Importing..."
                  disabled={!csvText.trim()}
                  className="px-4 py-2 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

