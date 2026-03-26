/**
 * Phase Finishing Tab
 * Aggregated finishing work view by floor for a finishing phase.
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

export function FinishingTab({ phase, project, formatCurrency }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!phase?._id) return;

    const controller = new AbortController();

    const loadFinishing = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/phases/${phase._id}/finishing-works`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        const json = await response.json();
        if (!json.success) {
          throw new Error(json.error || 'Failed to load finishing works for phase');
        }

        setData(json.data);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Error loading phase finishing works:', err);
        setError(err.message || 'Failed to load phase finishing works');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadFinishing();

    return () => controller.abort();
  }, [phase?._id]);

  const summary = data?.summary || null;
  const items = data?.items || [];

  const floorsArray = useMemo(() => {
    if (!summary || !summary.byFloor) return [];
    return Object.entries(summary.byFloor)
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => (b.totalActualCost || 0) - (a.totalActualCost || 0));
  }, [summary]);

  const categoriesArray = useMemo(() => {
    if (!summary || !summary.byCategory) return [];
    return Object.entries(summary.byCategory)
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => (b.actualCost || b.estimatedCost || 0) - (a.actualCost || a.estimatedCost || 0));
  }, [summary]);

  const renderSummary = () => {
    if (!summary) return null;

    const totalEstimated = summary.totalEstimatedCost || 0;
    const totalActual = summary.totalActualCost || 0;

    return (
      <div className="ds-bg-surface rounded-lg shadow p-4 mb-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold ds-text-primary">Finishing Overview</h3>
            <p className="text-xs ds-text-secondary mt-1">
              Phase {phase.phaseCode} · {phase.phaseName}
            </p>
          </div>
          {project && (
            <div className="text-xs ds-text-secondary">
              Project:{' '}
              <Link
                href={`/projects/${project._id}`}
                className="ds-text-accent-primary hover:ds-text-accent-hover underline"
              >
                {project.projectCode} - {project.projectName}
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="ds-bg-surface rounded-lg border ds-border-subtle p-3">
            <p className="text-xs ds-text-secondary mb-1">Total Estimated</p>
            <p className="text-lg font-bold ds-text-primary">
              {formatCurrency(totalEstimated)}
            </p>
          </div>
          <div className="ds-bg-surface rounded-lg border ds-border-subtle p-3">
            <p className="text-xs ds-text-secondary mb-1">Total Actual</p>
            <p className="text-lg font-bold ds-text-accent-primary">
              {formatCurrency(totalActual)}
            </p>
          </div>
          <div className="ds-bg-surface rounded-lg border ds-border-subtle p-3">
            <p className="text-xs ds-text-secondary mb-1">Direct Labour (Est)</p>
            <p className="text-sm font-semibold ds-text-primary">
              {formatCurrency(summary.directLabour?.estimatedCost || 0)}
            </p>
            <p className="text-xs ds-text-muted mt-1">
              Act: {formatCurrency(summary.directLabour?.actualCost || 0)}
            </p>
          </div>
          <div className="ds-bg-surface rounded-lg border ds-border-subtle p-3">
            <p className="text-xs ds-text-secondary mb-1">Contract-Based (Est)</p>
            <p className="text-sm font-semibold ds-text-primary">
              {formatCurrency(summary.contractBased?.estimatedCost || 0)}
            </p>
            <p className="text-xs ds-text-muted mt-1">
              Act: {formatCurrency(summary.contractBased?.actualCost || 0)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderFloors = () => {
    if (!floorsArray.length) {
      return (
        <div className="ds-bg-surface rounded-lg shadow p-4 mb-4 text-sm ds-text-secondary">
          No finishing work items have been created for this phase yet.
        </div>
      );
    }

    return (
      <div className="ds-bg-surface rounded-lg shadow p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold ds-text-primary">Finishing by Floor</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="ds-text-secondary border-b ds-border-subtle">
                <th className="text-left py-2 pr-4 font-medium">Floor</th>
                <th className="text-right py-2 px-2 font-medium">Items</th>
                <th className="text-right py-2 px-2 font-medium">Estimated</th>
                <th className="text-right py-2 px-2 font-medium">Actual</th>
                <th className="text-right py-2 pl-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {floorsArray.map((floor) => {
                const label =
                  floor.floorName ||
                  (floor.floorNumber === 0
                    ? 'Ground Floor'
                    : floor.floorNumber < 0
                    ? `Basement ${Math.abs(floor.floorNumber)}`
                    : floor.floorNumber > 0
                    ? `Floor ${floor.floorNumber}`
                    : 'Unassigned');

                const floorLink = floor.floorId
                  ? `/floors/${floor.floorId}?tab=finishing`
                  : null;

                const labourLink =
                  project && floor.floorId
                    ? `/labour/entries?projectId=${project._id}&floorId=${floor.floorId}&phaseId=${phase._id}`
                    : null;

                return (
                  <tr key={floor.key} className="border-b ds-border-subtle last:border-0">
                    <td className="py-2 pr-4">
                      {floorLink ? (
                        <Link
                          href={floorLink}
                          className="ds-text-accent-primary hover:ds-text-accent-hover underline font-medium"
                        >
                          {label}
                        </Link>
                      ) : (
                        <span className="ds-text-secondary">{label}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right ds-text-secondary">
                      {floor.itemCount || 0}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {formatCurrency(floor.totalEstimatedCost || 0)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {formatCurrency(floor.totalActualCost || 0)}
                    </td>
                    <td className="py-2 pl-2 text-right space-x-2">
                      {floorLink && (
                        <Link
                          href={floorLink}
                          className="inline-flex items-center px-2 py-1 rounded text-[11px] ds-bg-surface-muted ds-text-secondary hover:ds-bg-surface"
                        >
                          View finishing
                        </Link>
                      )}
                      {labourLink && (
                        <Link
                          href={labourLink}
                          className="inline-flex items-center px-2 py-1 rounded text-[11px] ds-bg-accent-primary/10 ds-text-accent-primary hover:ds-bg-accent-primary/20"
                        >
                          Labour
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCategories = () => {
    if (!categoriesArray.length) return null;

    return (
      <div className="ds-bg-surface rounded-lg shadow p-4 mb-4">
        <h3 className="text-sm font-semibold ds-text-primary mb-3">
          Finishing Costs by Category
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {categoriesArray.map((cat) => (
            <div key={cat.category} className="border ds-border-subtle rounded-lg p-3">
              <p className="text-xs ds-text-muted uppercase tracking-wide mb-1">
                {cat.category}
              </p>
              <p className="text-sm font-semibold ds-text-primary">
                {formatCurrency(cat.actualCost || cat.estimatedCost || 0)}
              </p>
              <p className="text-xs ds-text-muted mt-1">
                Est: {formatCurrency(cat.estimatedCost || 0)} • Items: {cat.items || 0}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderItems = () => {
    if (!items.length) return null;

    return (
      <div className="ds-bg-surface rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold ds-text-primary">
            Finishing Work Items ({items.length})
          </h3>
        </div>
        <div className="divide-y ds-border-subtle">
          {items.map((item) => {
            const isContract = item.executionModel === 'contract_based';
            const badgeClasses = isContract
              ? 'bg-purple-500/20 text-purple-600 border border-purple-500/40'
              : 'bg-green-500/20 text-green-600 border border-green-500/40';

            const floorLabel = item.floor
              ? item.floor.name ||
                (item.floor.floorNumber === 0
                  ? 'Ground Floor'
                  : item.floor.floorNumber < 0
                  ? `Basement ${Math.abs(item.floor.floorNumber)}`
                  : item.floor.floorNumber > 0
                  ? `Floor ${item.floor.floorNumber}`
                  : 'Floor')
              : null;

            const floorLink = item.floor?._id
              ? `/floors/${item.floor._id}?tab=finishing`
              : null;

            const labourLink =
              project && item.floor?._id
                ? `/labour/entries/new?projectId=${project._id}&phaseId=${phase._id}&floorId=${item.floor._id}&workItemId=${item._id}`
                : null;

            return (
              <div
                key={item._id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/work-items/${item._id}`}
                      className="text-sm font-semibold ds-text-primary hover:ds-text-accent-primary hover:underline"
                    >
                      {item.name || 'Work Item'}
                    </Link>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClasses}`}
                    >
                      {isContract ? 'Contract-Based' : 'Direct Labour'}
                    </span>
                    {item.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ds-bg-surface-muted ds-text-secondary">
                        {item.category}
                      </span>
                    )}
                    {floorLabel && floorLink && (
                      <Link
                        href={floorLink}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ds-bg-surface-muted ds-text-secondary hover:ds-text-accent-primary"
                      >
                        {floorLabel}
                      </Link>
                    )}
                    {item.subcontractor && (
                      <Link
                        href={`/subcontractors/${item.subcontractor._id}`}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ds-bg-surface-muted ds-text-accent-primary hover:ds-text-accent-hover"
                      >
                        {item.subcontractor.subcontractorName}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end text-xs ds-text-secondary gap-1">
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
                  <div className="flex flex-wrap gap-2 mt-1">
                    {labourLink && (
                      <Link
                        href={labourLink}
                        className="inline-flex items-center px-2 py-1 rounded text-[11px] ds-bg-accent-primary text-white hover:ds-bg-accent-hover"
                      >
                        Log labour
                      </Link>
                    )}
                    <Link
                      href={`/work-items/${item._id}`}
                      className="inline-flex items-center px-2 py-1 rounded text-[11px] ds-bg-surface-muted ds-text-secondary hover:ds-bg-surface"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6 text-center text-sm ds-text-secondary">
        Loading finishing works...
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-bg-danger/10 border ds-border-danger/40 ds-text-danger px-4 py-3 rounded text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderSummary()}
      {renderFloors()}
      {renderCategories()}
      {renderItems()}
    </div>
  );
}

export default FinishingTab;

