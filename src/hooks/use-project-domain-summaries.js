/**
 * useProjectDomainSummaries Hook
 * Fetches lightweight summaries for all project domains
 * Used in project detail page to populate domain tiles
 */

import { useState, useEffect } from 'react';

export function useProjectDomainSummaries(projectId) {
  const [summaries, setSummaries] = useState({
    phases: { count: 0, atRisk: 0, allocated: 0, loading: true },
    floors: { count: 0, completed: 0, inProgress: 0, loading: true },
    materials: { count: 0, topCategory: '', totalCost: 0, loading: true },
    labour: { count: 0, totalHours: 0, totalCost: 0, loading: true },
    expenses: { count: 0, approved: 0, loading: true },
    progress: { photos: 0, milestones: 0, updates: 0, loading: true },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    fetchSummaries();
  }, [projectId]);

  const fetchSummaries = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all summaries in parallel
      const [
        phasesRes,
        floorsRes,
        materialsRes,
        labourRes,
        expensesRes,
        progressRes,
      ] = await Promise.all([
        fetch(`/api/phases?projectId=${projectId}&includeFinancials=true`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }).catch(() => ({ json: async () => ({ success: false, data: [] }) })),
        
        fetch(`/api/floors?projectId=${projectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }).catch(() => ({ json: async () => ({ success: false, data: [] }) })),
        
        fetch(`/api/materials?projectId=${projectId}&limit=100`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }).catch(() => ({ json: async () => ({ success: false, data: { materials: [] } }) })),
        
        fetch(`/api/labour/entries?projectId=${projectId}&limit=100`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }).catch(() => ({ json: async () => ({ success: false, data: { entries: [] } }) })),
        
        fetch(`/api/expenses?projectId=${projectId}&limit=100`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }).catch(() => ({ json: async () => ({ success: false, data: { expenses: [] } }) })),
        
        fetch(`/api/projects/${projectId}/progress`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }).catch(() => ({ json: async () => ({ success: false, data: {} }) })),
      ]);

      const [
        phasesData,
        floorsData,
        materialsData,
        labourData,
        expensesData,
        progressData,
      ] = await Promise.all([
        phasesRes.json(),
        floorsRes.json(),
        materialsRes.json(),
        labourRes.json(),
        expensesRes.json(),
        progressRes.json(),
      ]);

      // Process phases
      const phases = phasesData.success ? (phasesData.data || []) : [];
      const totalPhaseBudgets = phases.reduce((sum, phase) => {
        return sum + (phase.budgetAllocation?.total || 0);
      }, 0);
      const atRiskPhases = phases.filter(phase => {
        const financialSummary = phase.financialSummary || {
          utilizationPercentage: 0,
        };
        return financialSummary.utilizationPercentage > 100 || phase.status === 'on_hold';
      }).length;

      // Process floors
      const floors = floorsData.success ? (floorsData.data || []) : [];
      const completedFloors = floors.filter(f => f.status === 'COMPLETED').length;
      const inProgressFloors = floors.filter(f => f.status === 'IN_PROGRESS').length;

      // Process materials
      const materials = materialsData.success 
        ? (materialsData.data?.materials || materialsData.data || [])
        : [];
      const materialsTotalCost = materials.reduce((sum, item) => sum + (item.totalCost || 0), 0);
      // Find top category
      const categoryCounts = {};
      materials.forEach(item => {
        const category = item.category || 'Uncategorized';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
      const topCategory = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      // Process labour
      const labourEntries = labourData.success
        ? (labourData.data?.entries || labourData.data || [])
        : [];
      const labourTotalHours = labourEntries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0);
      const labourTotalCost = labourEntries.reduce((sum, entry) => sum + (entry.totalCost || 0), 0);

      // Process expenses
      const expenses = expensesData.success
        ? (expensesData.data?.expenses || expensesData.data || [])
        : [];
      const approvedExpenses = expenses
        .filter(exp => ['APPROVED', 'PAID'].includes(exp.status))
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);

      // Process progress
      const progress = progressData.success ? (progressData.data || {}) : {};
      const photos = progress.photos?.length || 0;
      const milestones = progress.milestones?.length || 0;
      const updates = progress.dailyUpdates?.length || 0;

      setSummaries({
        phases: {
          count: phases.length,
          atRisk: atRiskPhases,
          allocated: totalPhaseBudgets,
          loading: false,
        },
        floors: {
          count: floors.length,
          completed: completedFloors,
          inProgress: inProgressFloors,
          loading: false,
        },
        materials: {
          count: materials.length,
          topCategory,
          totalCost: materialsTotalCost,
          loading: false,
        },
        labour: {
          count: labourEntries.length,
          totalHours: labourTotalHours,
          totalCost: labourTotalCost,
          loading: false,
        },
        expenses: {
          count: expenses.length,
          approved: approvedExpenses,
          loading: false,
        },
        progress: {
          photos,
          milestones,
          updates,
          loading: false,
        },
      });
    } catch (err) {
      console.error('Error fetching domain summaries:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { summaries, loading, error, refetch: fetchSummaries };
}
