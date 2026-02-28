/**
 * Floor Finishing Works Tab
 * Presents a per-floor view of finishing-phase work items, split by
 * direct labour vs contract-based, using the finishing-works API.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FINISHING_WORK_CATEGORIES, FINISHING_EXECUTION_MODELS } from '@/lib/constants/finishing-work-constants';

export function FinishingWorksTab({ floor, formatCurrency }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [floorBudget, setFloorBudget] = useState(null);
  const [loadingBudget, setLoadingBudget] = useState(false);

  // Planner state
  const [phases, setPhases] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerError, setPlannerError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [plannerForm, setPlannerForm] = useState({
    phaseId: '',
    categoryCode: '',
    executionModel: '',
    subcontractorId: '',
    name: '',
    estimatedCost: '',
  });

  const finishingCategories = useMemo(() => FINISHING_WORK_CATEGORIES, []);

  const loadFinishingWorks = async (cancelTokenRef) => {
    if (!floor?._id) return;
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/floors/${floor._id}/finishing-works`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load finishing works');
      }

      if (cancelTokenRef.current) return;

      const payload = data.data || {};
      setItems(payload.items || []);
      setSummary(payload.summary || null);
    } catch (err) {
      if (!cancelTokenRef.current) {
        console.error('Error loading finishing works:', err);
        setError(err.message || 'Failed to load finishing works');
      }
    } finally {
      if (!cancelTokenRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const cancelRef = { current: false };
    loadFinishingWorks(cancelRef);
    return () => {
      cancelRef.current = true;
    };
  }, [floor?._id]);

  // Load floor budget allocation for PHASE-03 (finishing works)
  useEffect(() => {
    const fetchFloorBudget = async () => {
      if (!floor?._id) return;
      try {
        setLoadingBudget(true);
        const response = await fetch(`/api/floors/${floor._id}/budget`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });
        const data = await response.json();
        if (data.success) {
          setFloorBudget(data.data);
        }
      } catch (err) {
        console.error('Error loading floor budget:', err);
      } finally {
        setLoadingBudget(false);
      }
    };
    fetchFloorBudget();
  }, [floor?._id]);

  // Load finishing phases and floor-specific subcontractors once for planner
  useEffect(() => {
    const fetchPlannerData = async () => {
      if (!floor?._id || !floor?.projectId) return;
      try {
        setPlannerLoading(true);
        setPlannerError(null);

        const [phasesRes, subsRes] = await Promise.all([
          fetch(`/api/phases?projectId=${floor.projectId}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
          }),
          fetch(
            `/api/subcontractors?projectId=${floor.projectId}&floorId=${floor._id}&status=active`,
            {
              cache: 'no-store',
              headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
            }
          ),
        ]);

        const [phasesJson, subsJson] = await Promise.all([phasesRes.json(), subsRes.json()]);

        if (!phasesJson.success) {
          throw new Error(phasesJson.error || 'Failed to load phases');
        }
        if (!subsJson.success) {
          throw new Error(subsJson.error || 'Failed to load subcontractors');
        }

        const allPhases = phasesJson.data || [];
        const finishingPhases = allPhases.filter((p) => p.phaseType === 'finishing');
        setPhases(finishingPhases);

        const subs = subsJson.data?.subcontractors || subsJson.data || [];
        setSubcontractors(subs);

        // Preselect sensible defaults
        if (finishingPhases.length === 1 && !plannerForm.phaseId) {
          setPlannerForm((prev) => ({ ...prev, phaseId: finishingPhases[0]._id.toString() }));
        }
        if (!plannerForm.categoryCode && finishingCategories.length > 0) {
          setPlannerForm((prev) => ({ ...prev, categoryCode: finishingCategories[0].code }));
        }
      } catch (err) {
        console.error('Error loading finishing planner data:', err);
        setPlannerError(err.message || 'Failed to load finishing planner data');
      } finally {
        setPlannerLoading(false);
      }
    };

    fetchPlannerData();
  }, [floor?._id, floor?.projectId, finishingCategories.length]);

  const selectedCategory = useMemo(
    () => finishingCategories.find((c) => c.code === plannerForm.categoryCode) || null,
    [finishingCategories, plannerForm.categoryCode]
  );

  const effectiveExecutionModel = useMemo(() => {
    if (plannerForm.executionModel && FINISHING_EXECUTION_MODELS.includes(plannerForm.executionModel)) {
      return plannerForm.executionModel;
    }
    if (selectedCategory?.defaultExecutionModel) {
      return selectedCategory.defaultExecutionModel;
    }
    return 'direct_labour';
  }, [plannerForm.executionModel, selectedCategory]);

  const handlePlannerChange = (e) => {
    const { name, value } = e.target;
    setPlannerForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateFinishingWork = async (e) => {
    e.preventDefault();
    if (!floor?._id || !floor?.projectId) return;

    setPlannerError(null);

    // Basic validation
    if (!plannerForm.phaseId) {
      setPlannerError('Please select a finishing phase.');
      return;
    }
    if (!plannerForm.categoryCode) {
      setPlannerError('Please select a finishing category.');
      return;
    }

    const categoryLabel = selectedCategory?.name || plannerForm.categoryCode;
    const name =
      plannerForm.name && plannerForm.name.trim().length > 0
        ? plannerForm.name.trim()
        : `${categoryLabel} - ${floor.name || `Floor ${floor.floorNumber}`}`;

    const estimatedCost = plannerForm.estimatedCost
      ? parseFloat(plannerForm.estimatedCost)
      : 0;

    const body = {
      projectId: floor.projectId.toString(),
      phaseId: plannerForm.phaseId,
      name,
      description: selectedCategory?.description || '',
      category: categoryLabel,
      status: 'not_started',
      estimatedCost,
      floorId: floor._id.toString(),
      executionModel: effectiveExecutionModel,
      subcontractorId:
        effectiveExecutionModel === 'contract_based' && plannerForm.subcontractorId
          ? plannerForm.subcontractorId
          : null,
      notes: '',
    };

    try {
      setCreating(true);
      const response = await fetch('/api/work-items', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create finishing work item');
      }

      // Reset minimal fields for next entry
      setPlannerForm((prev) => ({
        ...prev,
        name: '',
        estimatedCost: '',
        subcontractorId: prev.subcontractorId,
      }));

      // Refresh list/summary
      const cancelRef = { current: false };
      await loadFinishingWorks(cancelRef);
    } catch (err) {
      console.error('Error creating finishing work item:', err);
      setPlannerError(err.message || 'Failed to create finishing work item');
    } finally {
      setCreating(false);
    }
  };

  const renderSummary = () => {
    if (!summary) return null;

    const direct = summary.directLabour || { estimatedCost: 0, actualCost: 0 };
    const contract = summary.contractBased || { estimatedCost: 0, actualCost: 0 };
    
    // Get PHASE-03 budget from floor budget allocation
    const phase03Budget = floorBudget?.budgetAllocation?.byPhase?.['PHASE-03'] || {};
    const totalBudget = phase03Budget.total || 0;
    const totalSpent = summary.totalActualCost || 0;
    const totalEstimated = summary.totalEstimatedCost || 0;
    const remaining = Math.max(0, totalBudget - totalSpent);
    const spentPercentage = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0;
    const directPercentage = totalEstimated > 0 ? ((direct.estimatedCost / totalEstimated) * 100).toFixed(1) : 0;
    const contractPercentage = totalEstimated > 0 ? ((contract.estimatedCost / totalEstimated) * 100).toFixed(1) : 0;

    return (
      <div className="space-y-4 mb-6">
        {/* Main Budget Summary Card */}
        <div className="ds-bg-surface border ds-border-subtle rounded-lg p-4">
          <h3 className="text-sm font-semibold ds-text-primary mb-3">Finishing Works Budget Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="ds-bg-surface rounded-lg shadow p-3">
              <p className="text-xs ds-text-secondary mb-1">Total Budget</p>
              <p className="text-lg font-bold ds-text-primary">
                {formatCurrency(totalBudget)}
              </p>
              {totalBudget === 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  No budget allocated yet
                </p>
              )}
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-3 border ds-border-subtle">
              <p className="text-xs ds-text-secondary mb-1">Spent</p>
              <p className={`text-lg font-bold ${totalSpent > totalBudget && totalBudget > 0 ? 'text-red-400' : 'ds-text-primary'}`}>
                {formatCurrency(totalSpent)}
              </p>
              <p className="text-xs ds-text-muted mt-1">
                {spentPercentage}% of budget
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-3">
              <p className="text-xs ds-text-secondary mb-1">Remaining</p>
              <p className={`text-lg font-bold ${remaining < 0 ? 'text-red-400' : remaining < totalBudget * 0.1 ? 'text-amber-400' : 'ds-text-primary'}`}>
                {formatCurrency(remaining)}
              </p>
              {totalBudget > 0 && (
                <p className="text-xs ds-text-muted mt-1">
                  {((remaining / totalBudget) * 100).toFixed(1)}% remaining
                </p>
              )}
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-3">
              <p className="text-xs ds-text-secondary mb-1">Total Estimated</p>
              <p className="text-lg font-bold ds-text-primary">
                {formatCurrency(totalEstimated)}
              </p>
              <p className="text-xs ds-text-muted mt-1">
                Actual: {formatCurrency(totalSpent)}
              </p>
            </div>
          </div>
          
          {/* Budget Progress Bar */}
          {totalBudget > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs ds-text-secondary mb-1">
                <span>Budget Utilization</span>
                <span>{spentPercentage}%</span>
              </div>
              <div className="w-full ds-bg-surface-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    totalSpent > totalBudget
                      ? 'bg-red-500'
                      : totalSpent > totalBudget * 0.9
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Execution Model Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="ds-bg-surface rounded-lg shadow p-4">
            <p className="text-xs ds-text-secondary mb-1">Direct Labour</p>
            <p className="text-lg font-bold ds-text-primary">
              {formatCurrency(direct.actualCost || direct.estimatedCost || 0)}
            </p>
            <p className="text-xs ds-text-muted mt-1">
              Est: {formatCurrency(direct.estimatedCost || 0)} • Act: {formatCurrency(direct.actualCost || 0)}
              {totalEstimated > 0 && ` • ${directPercentage}%`}
            </p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-4">
            <p className="text-xs ds-text-secondary mb-1">Contract-Based</p>
            <p className="text-lg font-bold ds-text-primary">
              {formatCurrency(contract.actualCost || contract.estimatedCost || 0)}
            </p>
            <p className="text-xs ds-text-muted mt-1">
              Est: {formatCurrency(contract.estimatedCost || 0)} • Act: {formatCurrency(contract.actualCost || 0)}
              {totalEstimated > 0 && ` • ${contractPercentage}%`}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderCategoryBreakdown = () => {
    if (!summary || !summary.byCategory) return null;
    const entries = Object.entries(summary.byCategory);
    if (entries.length === 0) return null;

    return (
      <div className="ds-bg-surface rounded-lg shadow p-4 mb-6">
        <h3 className="text-sm font-semibold ds-text-primary mb-3">
          Finishing Costs by Category
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {entries.map(([category, stats]) => (
            <div key={category} className="border ds-border-subtle rounded-lg p-3">
              <p className="text-xs ds-text-muted uppercase tracking-wide mb-1">
                {category}
              </p>
              <p className="text-sm font-semibold ds-text-primary">
                {formatCurrency(stats.actualCost || stats.estimatedCost || 0)}
              </p>
              <p className="text-xs ds-text-muted mt-1">
                Est: {formatCurrency(stats.estimatedCost || 0)} • Items:{' '}
                {stats.items || 0}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPlanner = () => {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-4 mb-4">
        <h3 className="text-sm font-semibold ds-text-primary mb-3">
          Plan New Finishing Work on this Floor
        </h3>
        {plannerError && (
          <div className="mb-3 bg-red-50 border border-red-400/60 text-red-700 px-3 py-2 rounded text-xs">
            {plannerError}
          </div>
        )}
        <form onSubmit={handleCreateFinishingWork} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium ds-text-secondary">Finishing Phase</label>
            <select
              name="phaseId"
              value={plannerForm.phaseId}
              onChange={handlePlannerChange}
              disabled={plannerLoading || creating}
              className="w-full px-2 py-1.5 border ds-border-subtle rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select finishing phase</option>
              {phases.map((p) => (
                <option key={p._id} value={p._id.toString()}>
                  {p.phaseCode} - {p.phaseName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium ds-text-secondary">Category</label>
            <select
              name="categoryCode"
              value={plannerForm.categoryCode}
              onChange={plannerLoading || creating ? undefined : handlePlannerChange}
              disabled={plannerLoading || creating}
              className="w-full px-2 py-1.5 border ds-border-subtle rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select category</option>
              {finishingCategories.map((cat) => (
                <option key={cat.code} value={cat.code}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium ds-text-secondary">Execution Model</label>
            <select
              name="executionModel"
              value={effectiveExecutionModel}
              onChange={plannerLoading || creating ? undefined : handlePlannerChange}
              disabled={plannerLoading || creating}
              className="w-full px-2 py-1.5 border ds-border-subtle rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {FINISHING_EXECUTION_MODELS.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === 'direct_labour' ? 'Direct Labour' : 'Contract-Based'}
                </option>
              ))}
            </select>
          </div>
          {effectiveExecutionModel === 'contract_based' && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium ds-text-secondary">Subcontractor (optional)</label>
                {subcontractors.length === 0 && (
                  <Link
                    href={`/subcontractors/new?projectId=${floor.projectId}&phaseId=${plannerForm.phaseId || ''}&floorId=${floor._id}`}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Create new
                  </Link>
                )}
              </div>
              <select
                name="subcontractorId"
                value={plannerForm.subcontractorId}
                onChange={plannerLoading || creating ? undefined : handlePlannerChange}
                disabled={plannerLoading || creating || subcontractors.length === 0}
                className="w-full px-2 py-1.5 border ds-border-subtle rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select subcontractor (optional)</option>
                {subcontractors.map((sub) => (
                  <option key={sub._id} value={sub._id.toString()}>
                    {sub.subcontractorName} ({sub.subcontractorType})
                  </option>
                ))}
              </select>
              {subcontractors.length === 0 && (
                <p className="text-xs ds-text-muted mt-1">
                  No subcontractors found. <Link href={`/subcontractors/new?projectId=${floor.projectId}&phaseId=${plannerForm.phaseId || ''}&floorId=${floor._id}`} className="text-blue-600 hover:text-blue-800 underline">Create one</Link> to link to this work.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium ds-text-secondary">Name (optional)</label>
            <input
              type="text"
              name="name"
              value={plannerForm.name}
              onChange={handlePlannerChange}
              disabled={creating}
              className="w-full px-2 py-1.5 border ds-border-subtle rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Electrical - Floor 2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium ds-text-secondary">Estimated Cost (optional)</label>
            <input
              type="number"
              name="estimatedCost"
              value={plannerForm.estimatedCost}
              onChange={handlePlannerChange}
              disabled={creating}
              className="w-full px-2 py-1.5 border ds-border-subtle rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              min="0"
              step="0.01"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating || plannerLoading}
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add Finishing Work'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderItems = () => {
    if (loading) {
      return (
        <div className="ds-bg-surface rounded-lg shadow p-6 text-center text-sm ds-text-secondary">
          Loading finishing works...
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      );
    }

    if (!items || items.length === 0) {
      return (
        <div className="ds-bg-surface rounded-lg shadow p-6 text-center text-sm ds-text-secondary">
          No finishing work items have been created for this floor yet.
        </div>
      );
    }

    return (
      <div className="ds-bg-surface rounded-lg shadow">
        <div className="px-4 py-3 border-b ds-border-subtle flex items-center justify-between">
          <h3 className="text-sm font-semibold ds-text-primary">
            Finishing Work Items ({items.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {items.map((item) => {
            const exec = item.executionModel || 'direct_labour';
            const isContract = exec === 'contract_based';
            const badgeClasses = isContract
              ? 'bg-purple-100 text-purple-800'
              : 'bg-green-100 text-green-800';

            return (
              <div
                key={item._id}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:ds-bg-surface-muted transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/work-items/${item._id}`}
                      className="text-sm font-semibold ds-text-primary truncate hover:text-blue-600 hover:underline"
                    >
                      {item.name || 'Work Item'}
                    </Link>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClasses}`}
                    >
                      {isContract ? 'Contract-Based' : 'Direct Labour'}
                    </span>
                    {item.phase?.phaseCode && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ds-bg-surface-muted ds-text-secondary">
                        {item.phase.phaseCode}
                      </span>
                    )}
                  </div>
                  {item.category && (
                    <p className="text-xs ds-text-muted mt-0.5">
                      Category: {item.category}
                    </p>
                  )}
                  {item.subcontractor && (
                    <div className="mt-0.5 space-y-0.5">
                      <p className="text-xs text-purple-700">
                        Subcontractor:{' '}
                        <Link
                          href={`/subcontractors/${item.subcontractor._id}`}
                          className="hover:text-purple-900 hover:underline"
                        >
                          {item.subcontractor.subcontractorName}
                        </Link>
                        {' '}({item.subcontractor.contractType})
                      </p>
                      {item.subcontractor.contractValue > 0 && (
                        <p className="text-xs text-purple-600">
                          Contract: {formatCurrency(item.subcontractor.contractValue)} • Paid:{' '}
                          {formatCurrency(item.subcontractor.totalPaid || 0)} (
                          {item.subcontractor.paymentProgress
                            ? `${item.subcontractor.paymentProgress.toFixed(1)}%`
                            : '0%'}
                          )
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start sm:items-end text-xs ds-text-secondary">
                  <div>
                    Est:{' '}
                    <span className="font-semibold">
                      {formatCurrency(item.estimatedCost || 0)}
                    </span>
                  </div>
                  <div>
                    Act:{' '}
                    <span className="font-semibold">
                      {formatCurrency(item.actualCost || 0)}
                    </span>
                  </div>
                  {item.status && (
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full ds-bg-surface-muted ds-text-secondary">
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderSummary()}
      {renderCategoryBreakdown()}
      {renderPlanner()}
      {renderItems()}
    </div>
  );
}

export default FinishingWorksTab;

