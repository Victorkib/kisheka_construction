/**
 * Indirect Costs Tab
 * Indirect costs management
 */

'use client';

import { IndirectCostsBudgetCard } from '@/components/budget/IndirectCostsBudgetCard';
import { IndirectCostsDetailBreakdown } from '@/components/budget/IndirectCostsDetailBreakdown';
import Link from 'next/link';

export function IndirectCostsTab({ projectId }) {
  return (
    <div className="space-y-6">
      {/* Indirect Costs Budget Card */}
      <div>
        <IndirectCostsBudgetCard projectId={projectId} />
      </div>

      {/* Detailed Breakdown - Shows both expenses and labour entries */}
      <div>
        <IndirectCostsDetailBreakdown projectId={projectId} />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Link
            href="/expenses/new"
            className="p-3 sm:p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-xl sm:text-2xl mb-2">💳</div>
            <div className="text-sm sm:text-base font-semibold text-gray-900">Add Expense</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Create indirect cost expense</div>
          </Link>
          <Link
            href="/labour/entries/new"
            className="p-3 sm:p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition text-center"
          >
            <div className="text-xl sm:text-2xl mb-2">👷</div>
            <div className="text-sm sm:text-base font-semibold text-gray-900">Add Labour</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Create indirect labour entry</div>
          </Link>
          <Link
            href="/expenses"
            className="p-3 sm:p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-xl sm:text-2xl mb-2">📋</div>
            <div className="text-sm sm:text-base font-semibold text-gray-900">View All</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Browse all transactions</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
