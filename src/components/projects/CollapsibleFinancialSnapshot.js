/**
 * CollapsibleFinancialSnapshot Component
 * Optional detailed financial view that can be expanded/collapsed
 * Shows budget vs actual charts and phase budget summary
 * 
 * @param {Object} props
 * @param {string} props.projectId - Project ID
 * @param {Object} props.budget - Budget data (optional, will fetch if not provided)
 * @param {Object} props.phaseData - Phase financial data (optional, will fetch if not provided)
 */

'use client';

import { useState, useEffect } from 'react';
import { BudgetVisualization } from '@/components/budget/BudgetVisualization';

export function CollapsibleFinancialSnapshot({ projectId, budget, phaseData: initialPhaseData }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phaseData, setPhaseData] = useState(initialPhaseData || null);
  const [budgetData, setBudgetData] = useState(budget || null);

  useEffect(() => {
    if (isExpanded && projectId && (!budgetData || !phaseData)) {
      fetchFinancialData();
    }
  }, [isExpanded, projectId]);

  const fetchFinancialData = async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const [projectRes, phasesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/phases?projectId=${projectId}&includeFinancials=true`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
      ]);

      const projectResult = await projectRes.json();
      const phasesResult = await phasesRes.json();

      if (projectResult.success) {
        setBudgetData(projectResult.data.budget);
      }

      if (phasesResult.success) {
        setPhaseData(phasesResult.data || []);
      }
    } catch (err) {
      console.error('Error fetching financial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    const colors = {
      'not_started': 'bg-gray-100 text-gray-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'on_hold': 'bg-yellow-100 text-yellow-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
        aria-expanded={isExpanded}
        aria-controls="financial-snapshot-content"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Detailed Financial Snapshot
          </h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            Optional
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content - Collapsible */}
      {isExpanded && (
        <div id="financial-snapshot-content" className="px-6 py-4 border-t border-gray-200">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-sm text-gray-600">Loading financial data...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Budget Visualization */}
              {budgetData && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Budget Breakdown</h4>
                  <BudgetVisualization budget={budgetData} />
                </div>
              )}

              {/* Phase Budget Summary */}
              {phaseData && phaseData.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Phase Budget Summary</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phase
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Budget
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Spent
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Remaining
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Progress
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {phaseData.map((phase) => {
                          const financialSummary = phase.financialSummary || {
                            budgetTotal: phase.budgetAllocation?.total || 0,
                            actualTotal: phase.actualSpending?.total || 0,
                            remaining: phase.financialStates?.remaining || 0,
                            utilizationPercentage: 0
                          };
                          
                          return (
                            <tr key={phase._id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{phase.phaseName}</div>
                                <div className="text-xs text-gray-500">{phase.phaseCode}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(phase.status)}`}>
                                  {phase.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                                {formatCurrency(financialSummary.budgetTotal)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                                {formatCurrency(financialSummary.actualTotal)}
                              </td>
                              <td className={`px-4 py-3 whitespace-nowrap text-right text-sm font-medium ${
                                financialSummary.remaining < 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {formatCurrency(financialSummary.remaining)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center justify-center">
                                  <div className="w-full max-w-[100px] bg-gray-200 rounded-full h-2">
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
                                  <span className="ml-2 text-xs text-gray-600">
                                    {financialSummary.utilizationPercentage.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Link to Full Cost Management */}
              <div className="pt-4 border-t border-gray-200">
                <a
                  href={`/projects/${projectId}/costs`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  View Full Cost Management →
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CollapsibleFinancialSnapshot;
