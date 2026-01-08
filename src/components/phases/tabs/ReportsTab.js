/**
 * Phase Reports Tab Component
 * Displays links to phase reports and quick stats
 */

'use client';

import Link from 'next/link';

export function ReportsTab({ phase, formatCurrency, formatDate }) {
  const financialSummary = phase.financialSummary || {
    budgetTotal: phase.budgetAllocation?.total || 0,
    actualTotal: phase.actualSpending?.total || 0,
    remaining: phase.financialStates?.remaining || 0,
    variance: 0,
    variancePercentage: 0,
    utilizationPercentage: 0
  };

  // Calculate timeline adherence
  const timelineAdherence = phase.plannedEndDate && phase.actualEndDate
    ? ((new Date(phase.actualEndDate) - new Date(phase.plannedEndDate)) / (1000 * 60 * 60 * 24))
    : phase.plannedEndDate && phase.status !== 'completed'
    ? ((new Date() - new Date(phase.plannedEndDate)) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Completion</p>
          <p className="text-3xl font-bold text-gray-900">
            {phase.completionPercentage || 0}%
          </p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                phase.completionPercentage >= 100
                  ? 'bg-green-600'
                  : phase.completionPercentage >= 75
                  ? 'bg-blue-600'
                  : phase.completionPercentage >= 50
                  ? 'bg-yellow-600'
                  : 'bg-gray-400'
              }`}
              style={{ width: `${Math.min(100, phase.completionPercentage || 0)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Budget Utilization</p>
          <p className="text-3xl font-bold text-gray-900">
            {financialSummary.utilizationPercentage.toFixed(1)}%
          </p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                financialSummary.utilizationPercentage > 100
                  ? 'bg-red-600'
                  : financialSummary.utilizationPercentage > 80
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              }`}
              style={{
                width: `${Math.min(100, financialSummary.utilizationPercentage)}%`
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Timeline Adherence</p>
          {timelineAdherence !== null ? (
            <>
              <p className={`text-2xl font-bold ${
                timelineAdherence > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {timelineAdherence > 0 ? '+' : ''}{Math.round(timelineAdherence)} days
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {timelineAdherence > 0 ? 'Behind schedule' : 'On or ahead of schedule'}
              </p>
            </>
          ) : (
            <p className="text-lg text-gray-500">N/A</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Budget Variance</p>
          <p className={`text-2xl font-bold ${
            financialSummary.variance > 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {formatCurrency(financialSummary.variance)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {financialSummary.variancePercentage > 0 ? '+' : ''}
            {financialSummary.variancePercentage.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Report Links */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href={`/phases/${phase._id}/reports/financial`}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Financial Report</h4>
                <p className="text-sm text-gray-600">
                  Comprehensive financial analysis including budget vs actual, spending trends, and cost breakdowns
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link
            href={`/phases/${phase._id}/reports/progress`}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Progress Report</h4>
                <p className="text-sm text-gray-600">
                  Phase progress tracking, milestone completion, and timeline analysis
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link
            href={`/phases/${phase._id}/reports/resources`}
            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Resource Report</h4>
                <p className="text-sm text-gray-600">
                  Resource utilization, worker assignments, and equipment tracking
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Materials Report</h4>
                <p className="text-sm text-gray-600">
                  Material consumption, inventory levels, and procurement analysis
                </p>
                <p className="text-xs text-gray-500 mt-2">Coming soon</p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Data</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              // TODO: Implement CSV export
              alert('CSV export coming soon');
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Export to CSV
          </button>
          <button
            onClick={() => {
              // TODO: Implement PDF export
              alert('PDF export coming soon');
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Export to PDF
          </button>
          <button
            onClick={() => {
              // TODO: Implement Excel export
              alert('Excel export coming soon');
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Export to Excel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReportsTab;

