/**
 * Budget Variance Chart Component
 * Visualizes budget vs actual labour costs
 */

'use client';

import { AlertCircle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

export function BudgetVarianceChart({ data }) {
  if (!data || !data.variance) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">No budget variance data available</p>
      </div>
    );
  }

  const { variance, summary } = data;
  const isProjectLevel = !data.phase;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Budget Allocated</p>
          <p className="text-2xl font-bold text-blue-600">
            {summary.budgetAllocated.toLocaleString()} KES
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Actual Cost</p>
          <p className="text-2xl font-bold text-green-600">
            {summary.actualCost.toLocaleString()} KES
          </p>
        </div>
        <div
          className={`border rounded-lg p-4 ${
            summary.variance >= 0
              ? 'bg-red-50 border-red-200'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <p className="text-sm font-medium text-gray-700 mb-2">Variance</p>
          <div className="flex items-center gap-2">
            {summary.variance >= 0 ? (
              <TrendingUp className="w-5 h-5 text-red-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-green-600" />
            )}
            <p
              className={`text-2xl font-bold ${
                summary.variance >= 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {summary.variance >= 0 ? '+' : ''}
              {summary.variance.toLocaleString()} KES
            </p>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {summary.variancePercentage >= 0 ? '+' : ''}
            {summary.variancePercentage.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Variance Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isProjectLevel ? 'Project' : 'Phase'} Budget Variance
          </h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {variance.map((item, index) => {
              const utilization = item.budgetAllocated > 0
                ? (item.actualCost / item.budgetAllocated) * 100
                : 0;
              const isOverBudget = item.actualCost > item.budgetAllocated;
              const varianceAmount = item.actualCost - item.budgetAllocated;
              const variancePercent = item.budgetAllocated > 0
                ? (varianceAmount / item.budgetAllocated) * 100
                : 0;

              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {isProjectLevel ? item.projectName : item.phaseName}
                      </h4>
                      {item.phaseCode && (
                        <p className="text-sm text-gray-600">{item.phaseCode}</p>
                      )}
                    </div>
                    <div
                      className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                        isOverBudget
                          ? 'bg-red-100 text-red-800'
                          : utilization > 80
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {isOverBudget ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium">
                        {utilization.toFixed(1)}% Used
                      </span>
                    </div>
                  </div>

                  {/* Budget Bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Budget: {item.budgetAllocated.toLocaleString()} KES</span>
                      <span className="text-gray-600">Actual: {item.actualCost.toLocaleString()} KES</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 relative overflow-hidden">
                      {/* Budget indicator */}
                      <div
                        className="absolute left-0 top-0 h-full bg-blue-300 border-r-2 border-blue-600"
                        style={{ width: '100%' }}
                      />
                      {/* Actual cost indicator */}
                      <div
                        className={`absolute left-0 top-0 h-full ${
                          isOverBudget ? 'bg-red-500' : 'bg-green-500'
                        }`}
                        style={{
                          width: `${Math.min(utilization, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Variance Details */}
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Variance</p>
                      <p
                        className={`text-sm font-semibold ${
                          varianceAmount >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {varianceAmount >= 0 ? '+' : ''}
                        {varianceAmount.toLocaleString()} KES
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Variance %</p>
                      <p
                        className={`text-sm font-semibold ${
                          variancePercent >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {variancePercent >= 0 ? '+' : ''}
                        {variancePercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {variance.some((item) => item.actualCost > item.budgetAllocated) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Budget Overrun Detected</p>
              <p className="text-xs text-red-700 mt-1">
                {variance.filter((item) => item.actualCost > item.budgetAllocated).length}{' '}
                {isProjectLevel ? 'project(s)' : 'phase(s)'} have exceeded their allocated budget
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

