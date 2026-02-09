/**
 * Floors Tab
 * Floor-by-floor view for a phase (Basement/Superstructure focused)
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/loading';

const inferDefaultGroup = (phase) => {
  const name = (phase?.phaseName || '').toLowerCase();
  if (phase?.applicableFloors === 'basement' || name.includes('basement')) {
    return 'basement';
  }
  if (name.includes('superstructure')) {
    return 'superstructure';
  }
  return 'all';
};

export function FloorsTab({ phase, formatCurrency }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupFilter, setGroupFilter] = useState('auto'); // auto | basement | superstructure | all

  useEffect(() => {
    if (!phase?._id) return;
    const fetchFloors = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/phases/${phase._id}/floors`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch floor breakdown');
        }
        setData(result.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFloors();
  }, [phase?._id]);

  const effectiveGroup = useMemo(() => {
    if (groupFilter === 'auto') {
      return inferDefaultGroup(phase);
    }
    return groupFilter;
  }, [groupFilter, phase]);

  const floors = useMemo(() => {
    if (!data?.floors) return [];
    if (effectiveGroup === 'all') return data.floors;
    return data.floors.filter((floor) => floor.group === effectiveGroup);
  }, [data, effectiveGroup]);

  const maxTotal = useMemo(() => {
    return floors.reduce((max, floor) => {
      const total = (floor.totals.materials || 0)
        + (floor.totals.materialRequests || 0)
        + (floor.totals.purchaseOrders || 0)
        + (floor.totals.labour || 0)
        + (floor.totals.workItems || 0);
      return Math.max(max, total);
    }, 0);
  }, [floors]);

  const summary = useMemo(() => {
    const totals = {
      materials: 0,
      materialRequests: 0,
      purchaseOrders: 0,
      labour: 0,
      workItems: 0,
    };
    floors.forEach((floor) => {
      totals.materials += floor.totals.materials || 0;
      totals.materialRequests += floor.totals.materialRequests || 0;
      totals.purchaseOrders += floor.totals.purchaseOrders || 0;
      totals.labour += floor.totals.labour || 0;
      totals.workItems += floor.totals.workItems || 0;
    });
    return totals;
  }, [floors]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Floor Breakdown</h2>
            <p className="text-sm text-gray-600">
              Floors can appear in multiple phases. Use the filter to focus on basement or superstructure.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            {['auto', 'basement', 'superstructure', 'all'].map((group) => (
              <button
                key={group}
                onClick={() => setGroupFilter(group)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  groupFilter === group
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {group === 'auto' ? 'Auto' : group.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-gray-500">Materials</p>
            <p className="text-lg font-semibold text-gray-900">{formatCurrency(summary.materials)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Material Requests</p>
            <p className="text-lg font-semibold text-gray-900">{formatCurrency(summary.materialRequests)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Purchase Orders</p>
            <p className="text-lg font-semibold text-gray-900">{formatCurrency(summary.purchaseOrders)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Labour</p>
            <p className="text-lg font-semibold text-gray-900">{formatCurrency(summary.labour)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Work Items</p>
            <p className="text-lg font-semibold text-gray-900">{formatCurrency(summary.workItems)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Floor Heatmap</h3>
            <p className="text-sm text-gray-600">Darker tiles indicate higher total spend.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {floors.length === 0 && (
            <div className="col-span-full text-sm text-gray-500">
              No floors to display for this filter.
            </div>
          )}
          {floors.map((floor) => {
            const total = (floor.totals.materials || 0)
              + (floor.totals.materialRequests || 0)
              + (floor.totals.purchaseOrders || 0)
              + (floor.totals.labour || 0)
              + (floor.totals.workItems || 0);
            const intensity = maxTotal > 0 ? Math.min(0.9, Math.max(0.15, total / maxTotal)) : 0.15;
            const bgColor = `rgba(37, 99, 235, ${intensity})`;
            return (
              <Link
                key={floor.floorId}
                href={`/floors/${floor.floorId}`}
                className="rounded-lg p-3 text-white shadow-sm hover:shadow transition-shadow"
                style={{ backgroundColor: bgColor }}
              >
                <div className="text-xs uppercase tracking-wide opacity-90">
                  {floor.group === 'basement' ? 'Basement' : 'Superstructure'}
                </div>
                <div className="text-sm font-semibold">{floor.floorName}</div>
                <div className="text-xs mt-2">{formatCurrency(total)}</div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Floors</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Floor</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Materials</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Requests</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Labour</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Work Items</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {floors.length === 0 && (
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-500" colSpan={7}>
                    No floors found for this filter.
                  </td>
                </tr>
              )}
              {floors.map((floor) => {
                const total = (floor.totals.materials || 0)
                  + (floor.totals.materialRequests || 0)
                  + (floor.totals.purchaseOrders || 0)
                  + (floor.totals.labour || 0)
                  + (floor.totals.workItems || 0);
                const totalPercent = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
                const projectId = phase?.projectId;
                const phaseId = phase?._id;
                const floorId = floor.floorId;
                return (
                  <tr key={floor.floorId}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span>{floor.floorName}</span>
                        <span className="text-xs text-gray-500">{floor.group === 'basement' ? 'Basement' : 'Superstructure'}</span>
                        <Link href={`/floors/${floor.floorId}`} className="text-xs text-blue-600 hover:text-blue-800">
                          View floor
                        </Link>
                        <div className="mt-2 h-1.5 bg-gray-100 rounded-full">
                          <div
                            className="h-1.5 bg-blue-500 rounded-full"
                            style={{ width: `${totalPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{formatCurrency(floor.totals.materials)}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{formatCurrency(floor.totals.materialRequests)}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{formatCurrency(floor.totals.purchaseOrders)}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{formatCurrency(floor.totals.labour)}</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-700">{formatCurrency(floor.totals.workItems)}</td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">{formatCurrency(total)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/materials?projectId=${projectId}&phaseId=${phaseId}&floor=${floorId}`}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Materials
                        </Link>
                        <Link
                          href={`/material-requests?projectId=${projectId}&phaseId=${phaseId}&floorId=${floorId}`}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Requests
                        </Link>
                        <Link
                          href={`/purchase-orders?projectId=${projectId}&phaseId=${phaseId}&floorId=${floorId}`}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Orders
                        </Link>
                        <Link
                          href={`/labour/entries?projectId=${projectId}&phaseId=${phaseId}&floorId=${floorId}`}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Labour
                        </Link>
                        <Link
                          href={`/work-items?projectId=${projectId}&phaseId=${phaseId}&floorId=${floorId}`}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Work items
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
        <p className="text-sm font-medium">Unassigned floor entries</p>
        <p className="text-xs text-yellow-700">
          Items in this phase with no floor selected will appear here. Assign floors to improve visibility.
        </p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
          <div>
            Materials: {formatCurrency(data?.unassigned?.totals?.materials || 0)}
            <div>
              <Link
                href={`/materials?projectId=${phase?.projectId}&phaseId=${phase?._id}&floor=unassigned`}
                className="text-xs text-blue-700 hover:text-blue-900"
              >
                View materials
              </Link>
            </div>
          </div>
          <div>
            Requests: {formatCurrency(data?.unassigned?.totals?.materialRequests || 0)}
            <div>
              <Link
                href={`/material-requests?projectId=${phase?.projectId}&phaseId=${phase?._id}&floorId=unassigned`}
                className="text-xs text-blue-700 hover:text-blue-900"
              >
                View requests
              </Link>
            </div>
          </div>
          <div>
            Orders: {formatCurrency(data?.unassigned?.totals?.purchaseOrders || 0)}
            <div>
              <Link
                href={`/purchase-orders?projectId=${phase?.projectId}&phaseId=${phase?._id}&floorId=unassigned`}
                className="text-xs text-blue-700 hover:text-blue-900"
              >
                View orders
              </Link>
            </div>
          </div>
          <div>
            Labour: {formatCurrency(data?.unassigned?.totals?.labour || 0)}
            <div>
              <Link
                href={`/labour/entries?projectId=${phase?.projectId}&phaseId=${phase?._id}&floorId=unassigned`}
                className="text-xs text-blue-700 hover:text-blue-900"
              >
                View labour
              </Link>
            </div>
          </div>
          <div>
            Work Items: {formatCurrency(data?.unassigned?.totals?.workItems || 0)}
            <div>
              <Link
                href={`/work-items?projectId=${phase?.projectId}&phaseId=${phase?._id}&floorId=unassigned`}
                className="text-xs text-blue-700 hover:text-blue-900"
              >
                View work items
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FloorsTab;
