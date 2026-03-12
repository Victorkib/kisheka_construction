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

import { useEffect, useMemo, useState } from 'react';
import { LoadingButton, LoadingOverlay } from '@/components/loading';

export function StatementGenerator({ investorId, investorName, onClose }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [scopeMode, setScopeMode] = useState('all'); // 'all' | 'selected'
  const [availableProjects, setAvailableProjects] = useState([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

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

  useEffect(() => {
    const fetchInvestorProjects = async () => {
      if (!investorId) return;
      try {
        setLoadingProjects(true);
        const response = await fetch(`/api/investors/${investorId}/allocations`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const data = await response.json();
        if (data.success) {
          const projects = Array.isArray(data.data?.allocations) ? data.data.allocations : [];
          setAvailableProjects(projects);
        } else {
          setAvailableProjects([]);
        }
      } catch (err) {
        console.error('Fetch statement projects error:', err);
        setAvailableProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };
    fetchInvestorProjects();
  }, [investorId]);

  const scopedProjectIds = useMemo(() => {
    if (scopeMode !== 'selected') return [];
    return selectedProjectIds.filter(Boolean);
  }, [scopeMode, selectedProjectIds]);

  const addScopeQueryParams = (queryParams) => {
    if (scopeMode === 'selected' && scopedProjectIds.length > 0) {
      queryParams.set('projectIds', scopedProjectIds.join(','));
    }
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
      addScopeQueryParams(queryParams);

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
      addScopeQueryParams(queryParams);

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
      let filename = `Investor_Statement_${investorName || investorId}${scopeMode === 'selected' && scopedProjectIds.length > 0 ? '_Scoped' : ''}_${new Date().toISOString().split('T')[0]}`;
      
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
    <div className="ds-bg-surface rounded-lg shadow-lg p-6 space-y-6 relative">
      <LoadingOverlay 
        isLoading={generating} 
        message={investorName ? `Generating statement for ${investorName}...` : 'Generating statement...'} 
        fullScreen={false} 
      />
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold ds-text-primary">Generate Statement</h2>
          {investorName && (
            <p className="text-sm ds-text-secondary mt-1">For: {investorName}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ds-text-muted hover:ds-text-secondary transition"
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
          <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">
            Start Date (Optional)
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            max={endDate || undefined}
          />
        </div>
        <div>
          <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">
            End Date (Optional)
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            min={startDate || undefined}
          />
        </div>
      </div>

      {/* Project Scope Selection */}
      <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
        <h3 className="text-base font-semibold ds-text-primary mb-3">Project Scope</h3>
        <div className="flex flex-col md:flex-row gap-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="scopeMode"
              value="all"
              checked={scopeMode === 'all'}
              onChange={() => {
                setScopeMode('all');
                setSelectedProjectIds([]);
              }}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-semibold ds-text-primary">All Projects</div>
              <div className="text-xs ds-text-secondary">
                Includes all allocations and usage across every project.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="scopeMode"
              value="selected"
              checked={scopeMode === 'selected'}
              onChange={() => setScopeMode('selected')}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-semibold ds-text-primary">Selected Project(s)</div>
              <div className="text-xs ds-text-secondary">
                Generate a statement for one or multiple projects this investor is allocated to.
              </div>
            </div>
          </label>
        </div>

        {scopeMode === 'selected' && (
          <div className="mt-4">
            {loadingProjects ? (
              <div className="text-sm ds-text-secondary">Loading projects…</div>
            ) : availableProjects.length === 0 ? (
              <div className="text-sm ds-text-secondary">
                No allocated projects found for this investor. Allocate capital to projects first, then generate a scoped statement.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectIds(availableProjects.map((p) => p.projectId))}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border ds-border-subtle ds-bg-surface hover:ds-bg-surface-muted"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProjectIds([])}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border ds-border-subtle ds-bg-surface hover:ds-bg-surface-muted"
                  >
                    Clear
                  </button>
                  <div className="text-xs ds-text-muted">
                    Selected: {selectedProjectIds.length}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availableProjects.map((p) => {
                    const id = p.projectId;
                    const checked = selectedProjectIds.includes(id);
                    return (
                      <label key={id} className="flex items-start gap-2 p-2 rounded border ds-border-subtle ds-bg-surface cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...new Set([...selectedProjectIds, id])]
                              : selectedProjectIds.filter((x) => x !== id);
                            setSelectedProjectIds(next);
                          }}
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold ds-text-primary truncate">
                            {p.projectName || 'Project'}
                          </div>
                          <div className="text-xs ds-text-secondary truncate">
                            {p.projectCode ? `${p.projectCode} • ` : ''}Allocated: {formatCurrency(p.amount || 0)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs ds-text-muted mt-2">
                  Tip: For a single-project statement, select only one project.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded">
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
          className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Download JSON
        </button>
      </div>

      {/* Preview Section */}
      {showPreview && previewData && (
        <div className="border-t pt-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold ds-text-primary">Statement Preview</h3>
            <button
              onClick={() => setShowPreview(false)}
              className="text-sm ds-text-secondary hover:ds-text-primary"
            >
              Hide Preview
            </button>
          </div>

          <div className="ds-bg-surface-muted rounded-lg p-4 space-y-4">
            {/* Investor Info */}
            <div>
              <h4 className="font-semibold ds-text-primary mb-2">Investor Information</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="ds-text-secondary">Name:</span>{' '}
                  <span className="font-medium">{previewData.investor.name}</span>
                </div>
                {previewData.investor.email && (
                  <div>
                    <span className="ds-text-secondary">Email:</span>{' '}
                    <span className="font-medium">{previewData.investor.email}</span>
                  </div>
                )}
                <div>
                  <span className="ds-text-secondary">Type:</span>{' '}
                  <span className="font-medium">{previewData.investor.investmentType}</span>
                </div>
                <div>
                  <span className="ds-text-secondary">Status:</span>{' '}
                  <span className="font-medium">{previewData.investor.status}</span>
                </div>
              </div>
            </div>

            {/* Capital Usage */}
            <div>
              <h4 className="font-semibold ds-text-primary mb-2">Capital Usage</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="ds-text-secondary">Total Invested:</span>{' '}
                  <span className="font-medium text-green-600">
                    {formatCurrency(previewData.capitalUsage.totalInvested)}
                  </span>
                </div>
                <div>
                  <span className="ds-text-secondary">Capital Used:</span>{' '}
                  <span className="font-medium text-red-600">
                    {formatCurrency(previewData.capitalUsage.capitalUsed)}
                  </span>
                </div>
                <div>
                  <span className="ds-text-secondary">Remaining Balance:</span>{' '}
                  <span className="font-medium text-blue-600">
                    {formatCurrency(previewData.capitalUsage.capitalBalance)}
                  </span>
                </div>
                <div>
                  <span className="ds-text-secondary">Usage:</span>{' '}
                  <span className="font-medium">
                    {previewData.capitalUsage.usagePercentage}%
                  </span>
                </div>
              </div>
            </div>

            {/* Contributions Summary */}
            {previewData.contributions && previewData.contributions.list.length > 0 && (
              <div>
                <h4 className="font-semibold ds-text-primary mb-2">
                  Contributions ({previewData.contributions.count})
                </h4>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="ds-text-secondary">Total:</span>{' '}
                    <span className="font-medium">
                      {formatCurrency(previewData.contributions.totals.total)}
                    </span>
                  </div>
                  <div>
                    <span className="ds-text-secondary">Equity:</span>{' '}
                    <span className="font-medium">
                      {formatCurrency(previewData.contributions.totals.equity)}
                    </span>
                  </div>
                  <div>
                    <span className="ds-text-secondary">Loan:</span>{' '}
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
                <h4 className="font-semibold ds-text-primary mb-2">Period</h4>
                <div className="text-sm">
                  {previewData.period.startDate && (
                    <div>
                      <span className="ds-text-secondary">From:</span>{' '}
                      {formatDate(previewData.period.startDate)}
                    </div>
                  )}
                  {previewData.period.endDate && (
                    <div>
                      <span className="ds-text-secondary">To:</span>{' '}
                      {formatDate(previewData.period.endDate)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Project Breakdown */}
            {previewData.capitalUsage?.projectBreakdown && previewData.capitalUsage.projectBreakdown.length > 0 && (
              <div>
                <h4 className="font-semibold ds-text-primary mb-2">Project Breakdown</h4>
                <div className="space-y-2 text-sm">
                  {previewData.capitalUsage.projectBreakdown.map((project, idx) => (
                    <div key={idx} className="ds-bg-surface p-3 rounded border">
                      <div className="font-medium ds-text-primary">{project.projectName}</div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <span className="ds-text-secondary">Allocated:</span>{' '}
                          <span className="font-medium">{formatCurrency(project.allocatedAmount)}</span>
                        </div>
                        <div>
                          <span className="ds-text-secondary">Used:</span>{' '}
                          <span className="font-medium text-red-600">{formatCurrency(project.capitalUsed)}</span>
                        </div>
                        <div>
                          <span className="ds-text-secondary">Balance:</span>{' '}
                          <span className="font-medium text-blue-600">{formatCurrency(project.capitalBalance)}</span>
                        </div>
                        <div>
                          <span className="ds-text-secondary">Usage:</span>{' '}
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

