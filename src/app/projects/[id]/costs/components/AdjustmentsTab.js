/**
 * Adjustments Tab
 * Budget adjustments management
 */

'use client';

import { BudgetAdjustmentSection } from '@/components/budget/BudgetAdjustmentSection';

export function AdjustmentsTab({ projectId }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Budget Adjustment Section */}
      <div>
        <BudgetAdjustmentSection projectId={projectId} />
      </div>
    </div>
  );
}
