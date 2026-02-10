/**
 * Floor Overview Tab Component
 * Displays floor overview, status, and key metrics with comprehensive data
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function FloorOverviewTab({ floor, project, canEdit, onStatusChange, formatDate, formatCurrency, getStatusColor, floorSummary }) {
  const [phases, setPhases] = useState([]);
  const [phasesLoading, setPhasesLoading] = useState(true);

  useEffect(() => {
    if (floor?._id && floor?.projectId) {
      fetchPhases();
    }
  }, [floor?._id, floor?.projectId]);

  const fetchPhases = async () => {
    try {
      setPhasesLoading(true);
      // Fetch phases that have work items on this floor
      const response = await fetch(`/api/work-items?floorId=${floor._id}&projectId=${floor.projectId}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await response.json();
      
      if (data.success) {
        const workItems = data.data?.workItems || data.data || [];
        // Get unique phase IDs
        const phaseIds = [...new Set(workItems.map(item => item.phaseId?.toString()).filter(Boolean))];
        
        if (phaseIds.length > 0) {
          // Fetch phase details
          const phasesRes = await fetch(`/api/phases?projectId=${floor.projectId}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          });
          const phasesData = await phasesRes.json();
          
          if (phasesData.success) {
            const allPhases = phasesData.data || [];
            const relevantPhases = allPhases.filter(p => phaseIds.includes(p._id?.toString()));
            setPhases(relevantPhases);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    } finally {
      setPhasesLoading(false);
    }
  };

  const budgetUtilization = floor.totalBudget > 0 
    ? ((floor.actualCost || 0) / floor.totalBudget) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Floor Status and Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Status</p>
          {canEdit ? (
            <select
              value={floor.status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="ON_HOLD">On Hold</option>
            </select>
          ) : (
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(floor.status)}`}>
              {floor.status?.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Floor Number</p>
          <p className="text-lg font-semibold text-gray-900">{floor.floorNumber}</p>
          <p className="text-sm text-gray-600 mt-4">Type</p>
          <p className="text-sm font-semibold text-gray-900">
            {floor.floorNumber < 0 ? 'Basement' : floor.floorNumber === 0 ? 'Ground' : 'Upper'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Timeline</p>
          <div className="space-y-2 text-sm">
            {floor.startDate && (
              <div>
                <span className="text-gray-500">Start:</span>{' '}
                <span className="font-medium text-gray-900">{formatDate(floor.startDate)}</span>
              </div>
            )}
            {floor.completionDate && (
              <div>
                <span className="text-gray-500">Completed:</span>{' '}
                <span className="font-medium text-green-600">{formatDate(floor.completionDate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600">Materials</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{floorSummary?.materials?.count || 0}</p>
          <p className="text-xs text-gray-500">{formatCurrency(floorSummary?.materials?.totalCost || 0)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600">Labour</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{floorSummary?.labour?.count || 0}</p>
          <p className="text-xs text-gray-500">{formatCurrency(floorSummary?.labour?.totalCost || 0)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600">Work Items</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{floorSummary?.workItems?.count || 0}</p>
          <p className="text-xs text-gray-500">{formatCurrency(floorSummary?.workItems?.totalCost || 0)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600">Budget Used</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{budgetUtilization.toFixed(1)}%</p>
          <p className="text-xs text-gray-500">{formatCurrency(floor.actualCost || 0)} / {formatCurrency(floor.totalBudget || 0)}</p>
        </div>
      </div>

      {/* Phases Working on This Floor */}
      {!phasesLoading && phases.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Phases Working on This Floor</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {phases.map((phase) => (
              <Link
                key={phase._id}
                href={`/phases/${phase._id}`}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{phase.phaseName}</p>
                    <p className="text-xs text-gray-500">{phase.phaseCode}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(phase.status)}`}>
                    {phase.status?.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Floor Description */}
      {floor.description && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{floor.description}</p>
        </div>
      )}

      {/* Project Link */}
      {project && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <span className="font-medium">Project:</span>{' '}
            <Link
              href={`/projects/${project._id}`}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {project.projectName}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default FloorOverviewTab;
