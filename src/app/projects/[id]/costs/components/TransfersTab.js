/**
 * Transfers Tab
 * Budget transfers management
 */

'use client';

import { BudgetTransferSection } from '@/components/budget/BudgetTransferSection';

export function TransfersTab({ projectId }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Budget Transfer Section */}
      <div>
        <BudgetTransferSection projectId={projectId} />
      </div>
    </div>
  );
}
