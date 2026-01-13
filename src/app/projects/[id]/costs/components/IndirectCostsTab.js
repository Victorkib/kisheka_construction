/**
 * Indirect Costs Tab
 * Indirect costs management
 */

'use client';

import { IndirectCostsBudgetCard } from '@/components/budget/IndirectCostsBudgetCard';
import Link from 'next/link';

export function IndirectCostsTab({ projectId }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Indirect Costs Budget Card */}
      <div>
        <IndirectCostsBudgetCard projectId={projectId} />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Link
            href="/expenses/new"
            className="p-3 sm:p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-xl sm:text-2xl mb-2">➕</div>
            <div className="text-sm sm:text-base font-semibold text-gray-900">Add Indirect Expense</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Create a new indirect cost expense</div>
          </Link>
          <Link
            href="/expenses"
            className="p-3 sm:p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-xl sm:text-2xl mb-2">📋</div>
            <div className="text-sm sm:text-base font-semibold text-gray-900">View All Expenses</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Browse all expenses</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
