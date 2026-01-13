/**
 * Contingency Tab
 * Contingency reserve management
 */

'use client';

import { ContingencyBudgetCard } from '@/components/budget/ContingencyBudgetCard';

export function ContingencyTab({ projectId }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Contingency Budget Card */}
      <div>
        <ContingencyBudgetCard projectId={projectId} />
      </div>
    </div>
  );
}
