/**
 * Preconstruction Tab
 * Preconstruction costs management
 */

'use client';

import { PreconstructionBudgetCard } from '@/components/budget/PreconstructionBudgetCard';
import Link from 'next/link';

export function PreconstructionTab({ projectId }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Preconstruction Budget Card */}
      <div>
        <PreconstructionBudgetCard projectId={projectId} />
      </div>

      {/* Quick Actions */}
      <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 border-2 ds-border-subtle">
        <h3 className="text-base sm:text-lg font-semibold ds-text-primary mb-3 sm:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Link
            href="/initial-expenses/new"
            className="p-3 sm:p-4 border-2 ds-border-subtle rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-xl sm:text-2xl mb-2">➕</div>
            <div className="text-sm sm:text-base font-semibold ds-text-primary">Add Initial Expense</div>
            <div className="text-xs sm:text-sm ds-text-secondary mt-1">Create a new preconstruction expense</div>
          </Link>
          <Link
            href="/initial-expenses"
            className="p-3 sm:p-4 border-2 ds-border-subtle rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-xl sm:text-2xl mb-2">📋</div>
            <div className="text-sm sm:text-base font-semibold ds-text-primary">View All Expenses</div>
            <div className="text-xs sm:text-sm ds-text-secondary mt-1">Browse all initial expenses</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
