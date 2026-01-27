import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectDependencyCounts } from '../src/lib/project-dependencies.js';

test('getProjectDependencyCounts returns expected counts', async () => {
  const counts = {
    materials: 3,
    expenses: 2,
    initialExpenses: 1,
    floors: 4,
    phases: 5,
    workItems: 6,
    labourEntries: 7,
    labourBatches: 8,
    labourCostSummaries: 9,
    materialRequests: 10,
    materialRequestBatches: 11,
    purchaseOrders: 12,
    equipment: 13,
    subcontractors: 14,
    professionalServices: 15,
    professionalFees: 16,
    professionalActivities: 17,
    siteReports: 18,
    supervisorSubmissions: 19,
    budgetReallocations: 20,
    budgetAdjustments: 21,
    budgetTransfers: 22,
    contingencyDraws: 23,
    approvals: 24,
    projectMemberships: 25,
    projectTeams: 26,
    notifications: 27,
    auditLogs: 28,
  };

  const db = {
    collection(name) {
      if (!(name in counts)) {
        throw new Error(`Unexpected collection: ${name}`);
      }
      return {
        countDocuments: async () => counts[name],
      };
    },
  };

  const result = await getProjectDependencyCounts(db, '507f1f77bcf86cd799439011');
  assert.deepEqual(result, counts);
});
