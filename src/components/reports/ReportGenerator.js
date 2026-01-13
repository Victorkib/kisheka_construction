/**
 * Report Generator Component
 * Allows users to generate and export various project reports
 */

'use client';

import { useState } from 'react';

export function ReportGenerator({ projectId }) {
  const [reportType, setReportType] = useState('financial');
  const [options, setOptions] = useState({
    includeForecast: true,
    includeTrends: true,
    includeRecommendations: true,
    dateRange: {
      enabled: false,
      start: '',
      end: '',
    },
  });
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const reportTypes = [
    { value: 'financial', label: 'Comprehensive Financial Report', description: 'Complete financial overview with all categories, forecasts, trends, and recommendations' },
    { value: 'summary', label: 'Cost Category Summary', description: 'Quick summary of all cost categories' },
    { value: 'phases', label: 'Phase-Wise Report', description: 'Detailed breakdown by project phases' },
  ];

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setReportData(null);

    try {
      let url = `/api/projects/${projectId}/reports/${reportType}`;
      const params = new URLSearchParams();

      if (reportType === 'financial') {
        if (!options.includeForecast) params.append('includeForecast', 'false');
        if (!options.includeTrends) params.append('includeTrends', 'false');
        if (!options.includeRecommendations) params.append('includeRecommendations', 'false');
        if (options.dateRange.enabled && options.dateRange.start && options.dateRange.end) {
          params.append('startDate', options.dateRange.start);
          params.append('endDate', options.dateRange.end);
        }
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate report');
      }

      setReportData(result.data);
    } catch (err) {
      console.error('Generate report error:', err);
      setError(err.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportJSON = () => {
    if (!reportData) return;

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-${projectId}-${reportType}-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!reportData) return;

    // Convert report data to CSV format
    let csv = '';

    if (reportType === 'summary' && reportData.categories) {
      csv = 'Category,Budgeted,Spent,Remaining,Usage %\n';
      Object.entries(reportData.categories).forEach(([cat, data]) => {
        csv += `${cat},${data.budgeted},${data.spent || data.used || 0},${data.remaining},${data.usagePercentage.toFixed(2)}\n`;
      });
    } else if (reportType === 'phases' && reportData.phases) {
      csv = 'Phase Name,Phase Code,Budget,Spending,Remaining,Usage %\n';
      reportData.phases.forEach(phase => {
        csv += `${phase.phaseName},${phase.phaseCode || ''},${phase.budget},${phase.spending.total},${phase.remaining},${phase.usagePercentage.toFixed(2)}\n`;
      });
    } else if (reportType === 'financial' && reportData.budgets) {
      csv = 'Category,Budgeted,Spent,Remaining,Usage %\n';
      Object.entries(reportData.budgets).forEach(([cat, data]) => {
        csv += `${cat},${data.budgeted},${data.spent || data.used || 0},${data.remaining},${data.usagePercentage.toFixed(2)}\n`;
      });
    }

    const dataBlob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-${projectId}-${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Report Generator
        </h3>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Report Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Report Type <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {reportTypes.map((type) => (
            <label
              key={type.value}
              className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                reportType === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="reportType"
                value={type.value}
                checked={reportType === type.value}
                onChange={(e) => setReportType(e.target.value)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{type.label}</div>
                <div className="text-xs text-gray-600 mt-1">{type.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Options (for financial report) */}
      {reportType === 'financial' && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-3">Report Options</h4>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeForecast}
                onChange={(e) => setOptions({ ...options, includeForecast: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Include Forecast</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeTrends}
                onChange={(e) => setOptions({ ...options, includeTrends: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Include Trends</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeRecommendations}
                onChange={(e) => setOptions({ ...options, includeRecommendations: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Include Recommendations</span>
            </label>
            <div className="pt-2 border-t">
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={options.dateRange.enabled}
                  onChange={(e) => setOptions({
                    ...options,
                    dateRange: { ...options.dateRange, enabled: e.target.checked },
                  })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Filter by Date Range</span>
              </label>
              {options.dateRange.enabled && (
                <div className="grid grid-cols-2 gap-3 ml-6">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={options.dateRange.start}
                      onChange={(e) => setOptions({
                        ...options,
                        dateRange: { ...options.dateRange, start: e.target.value },
                      })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={options.dateRange.end}
                      onChange={(e) => setOptions({
                        ...options,
                        dateRange: { ...options.dateRange, end: e.target.value },
                      })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div className="mb-6">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {generating ? 'Generating Report...' : 'Generate Report'}
        </button>
      </div>

      {/* Report Display */}
      {reportData && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Generated Report</h4>
            <div className="flex gap-2">
              <button
                onClick={handleExportJSON}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
              >
                Export JSON
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* Report Preview */}
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            {reportType === 'summary' && reportData.categories && (
              <div className="space-y-3">
                <h5 className="font-semibold text-gray-900">Cost Category Summary</h5>
                <div className="grid grid-cols-5 gap-2 text-xs font-semibold text-gray-700 border-b pb-2">
                  <div>Category</div>
                  <div className="text-right">Budgeted</div>
                  <div className="text-right">Spent</div>
                  <div className="text-right">Remaining</div>
                  <div className="text-right">Usage %</div>
                </div>
                {Object.entries(reportData.categories).map(([cat, data]) => (
                  <div key={cat} className="grid grid-cols-5 gap-2 text-sm border-b pb-2">
                    <div className="font-medium">{cat.toUpperCase()}</div>
                    <div className="text-right">{formatCurrency(data.budgeted)}</div>
                    <div className="text-right">{formatCurrency(data.spent || data.used || 0)}</div>
                    <div className="text-right">{formatCurrency(data.remaining)}</div>
                    <div className="text-right">{data.usagePercentage.toFixed(1)}%</div>
                  </div>
                ))}
                <div className="grid grid-cols-5 gap-2 text-sm font-semibold text-gray-900 pt-2 border-t">
                  <div>TOTAL</div>
                  <div className="text-right">{formatCurrency(reportData.total.budgeted)}</div>
                  <div className="text-right">{formatCurrency(reportData.total.spent)}</div>
                  <div className="text-right">{formatCurrency(reportData.total.remaining)}</div>
                  <div className="text-right"></div>
                </div>
              </div>
            )}

            {reportType === 'phases' && reportData.phases && (
              <div className="space-y-3">
                <h5 className="font-semibold text-gray-900">Phase-Wise Breakdown</h5>
                {reportData.phases.map((phase) => (
                  <div key={phase.phaseId} className="border border-gray-200 rounded-lg p-3">
                    <div className="font-semibold text-gray-900 mb-2">
                      {phase.phaseName} {phase.phaseCode ? `(${phase.phaseCode})` : ''}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Budget: </span>
                        <span className="font-medium">{formatCurrency(phase.budget)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Spending: </span>
                        <span className="font-medium">{formatCurrency(phase.spending.total)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Remaining: </span>
                        <span className="font-medium">{formatCurrency(phase.remaining)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Usage: </span>
                        <span className="font-medium">{phase.usagePercentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {reportType === 'financial' && reportData.budgets && (
              <div className="space-y-4">
                <div>
                  <h5 className="font-semibold text-gray-900 mb-2">Summary</h5>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Total Budget: </span>
                      <span className="font-medium">{formatCurrency(reportData.summary.totalBudget)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Spending: </span>
                      <span className="font-medium">{formatCurrency(reportData.summary.totalSpending)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Remaining: </span>
                      <span className="font-medium">{formatCurrency(reportData.summary.totalRemaining)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Usage: </span>
                      <span className="font-medium">{reportData.summary.overallUsagePercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h5 className="font-semibold text-gray-900 mb-2">Cost Categories</h5>
                  {Object.entries(reportData.budgets).map(([cat, data]) => (
                    <div key={cat} className="mb-2 p-2 bg-white rounded border border-gray-200">
                      <div className="font-medium text-gray-900 mb-1">{cat.toUpperCase()}</div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>Budget: {formatCurrency(data.budgeted)}</div>
                        <div>Spent: {formatCurrency(data.spent || data.used || 0)}</div>
                        <div>Remaining: {formatCurrency(data.remaining)}</div>
                        <div>Usage: {data.usagePercentage.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 text-xs text-gray-500 text-center">
              Report generated: {new Date(reportData.generatedAt).toLocaleString('en-KE')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
