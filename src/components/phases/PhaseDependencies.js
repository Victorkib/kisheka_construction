/**
 * Phase Dependencies Component
 * Displays prerequisite phases, dependent phases, and dependency information
 * 
 * @param {Object} props
 * @param {Object} props.phase - Phase object
 * @param {string} props.projectId - Project ID
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function PhaseDependencies({ phase, projectId }) {
  const [prerequisites, setPrerequisites] = useState([]);
  const [dependents, setDependents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canStartInfo, setCanStartInfo] = useState(null);

  useEffect(() => {
    if (phase?._id) {
      fetchDependencies();
    }
  }, [phase?._id]);

  const fetchDependencies = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch prerequisites and dependents
      const [prereqResponse, dependentsResponse, canStartResponse] = await Promise.all([
        fetch(`/api/phases/${phase._id}/prerequisites`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/phases/${phase._id}/dependents`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/phases/${phase._id}/can-start`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
      ]);

      const prereqData = await prereqResponse.json();
      const dependentsData = await dependentsResponse.json();
      const canStartData = await canStartResponse.json();

      if (prereqData.success) {
        setPrerequisites(prereqData.data || []);
      }

      if (dependentsData.success) {
        setDependents(dependentsData.data || []);
      }

      if (canStartData.success) {
        setCanStartInfo(canStartData.data);
      }
    } catch (err) {
      console.error('Error fetching dependencies:', err);
      setError('Failed to load dependency information');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'not_started': 'bg-gray-100 text-gray-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'on_hold': 'bg-yellow-100 text-yellow-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Dependencies</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const hasDependencies = (prerequisites.length > 0 || dependents.length > 0 || phase?.dependsOn?.length > 0);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Phase Dependencies</h3>
        {canStartInfo && !canStartInfo.canStart && (
          <span className="px-3 py-1 text-sm font-medium rounded-full bg-yellow-100 text-yellow-800">
            Cannot Start Yet
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {!hasDependencies && !error && (
        <div className="text-gray-500 text-sm">
          <p>This phase has no dependencies.</p>
          <p className="mt-2">It can be started independently.</p>
        </div>
      )}

      {hasDependencies && (
        <div className="space-y-6">
          {/* Prerequisites Section */}
          {prerequisites.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Prerequisite Phases ({prerequisites.length})
              </h4>
              <div className="space-y-2">
                {prerequisites.map((prereq) => (
                  <div
                    key={prereq.phaseId}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Link
                          href={`/phases/${prereq.phaseId}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {prereq.phaseName}
                        </Link>
                        {prereq.phaseCode && (
                          <span className="ml-2 text-xs text-gray-500">({prereq.phaseCode})</span>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(prereq.status)}`}>
                            {prereq.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}
                          </span>
                          {prereq.completionPercentage !== undefined && (
                            <span>{prereq.completionPercentage}% Complete</span>
                          )}
                        </div>
                        {prereq.actualEndDate && (
                          <div className="mt-1 text-xs text-gray-500">
                            Completed: {formatDate(prereq.actualEndDate)}
                          </div>
                        )}
                        {!prereq.actualEndDate && prereq.plannedEndDate && (
                          <div className="mt-1 text-xs text-gray-500">
                            Planned End: {formatDate(prereq.plannedEndDate)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Can Start After Date */}
          {phase?.canStartAfter && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-900">Earliest Start Date</p>
                  <p className="text-sm text-blue-700 mt-1">
                    This phase can start after: <strong>{formatDate(phase.canStartAfter)}</strong>
                  </p>
                  {new Date(phase.canStartAfter) > new Date() && (
                    <p className="text-xs text-blue-600 mt-1">
                      Waiting for prerequisite phases to complete
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cannot Start Warning */}
          {canStartInfo && !canStartInfo.canStart && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-900">Cannot Start Phase</p>
                  <p className="text-sm text-yellow-700 mt-1">{canStartInfo.reason}</p>
                  {canStartInfo.blockingPhases && canStartInfo.blockingPhases.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-yellow-800">Blocking Phases:</p>
                      <ul className="mt-1 space-y-1">
                        {canStartInfo.blockingPhases.map((blocking) => (
                          <li key={blocking.phaseId} className="text-xs text-yellow-700">
                            • {blocking.phaseName} ({blocking.status}, {blocking.completionPercentage}% complete)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Dependent Phases Section */}
          {dependents.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Dependent Phases ({dependents.length})
              </h4>
              <p className="text-xs text-gray-500 mb-2">Phases that depend on this phase:</p>
              <div className="space-y-2">
                {dependents.map((dependent) => (
                  <div
                    key={dependent.phaseId}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Link
                          href={`/phases/${dependent.phaseId}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {dependent.phaseName}
                        </Link>
                        {dependent.phaseCode && (
                          <span className="ml-2 text-xs text-gray-500">({dependent.phaseCode})</span>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(dependent.status)}`}>
                            {dependent.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'}
                          </span>
                        </div>
                        {dependent.canStartAfter && (
                          <div className="mt-1 text-xs text-gray-500">
                            Can start after: {formatDate(dependent.canStartAfter)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PhaseDependencies;


