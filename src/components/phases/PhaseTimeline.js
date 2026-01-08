/**
 * Phase Timeline Component
 * Displays phases in a timeline view showing dependencies, sequencing, and status
 * 
 * @param {Object} props
 * @param {Array} props.phases - Array of phase objects
 * @param {string} props.projectId - Project ID
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function PhaseTimeline({ phases = [], projectId }) {
  const [sortedPhases, setSortedPhases] = useState([]);
  const [dependencyMap, setDependencyMap] = useState(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (phases && phases.length > 0) {
      processPhases();
    }
  }, [phases]);

  const processPhases = () => {
    // Sort phases by sequence
    const sorted = [...phases].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    
    // Build dependency map
    const depMap = new Map();
    sorted.forEach(phase => {
      const phaseId = phase._id?.toString() || phase.id?.toString();
      if (phase.dependsOn && Array.isArray(phase.dependsOn)) {
        depMap.set(phaseId, phase.dependsOn.map(dep => dep.toString()));
      } else {
        depMap.set(phaseId, []);
      }
    });
    
    setSortedPhases(sorted);
    setDependencyMap(depMap);
  };

  const getStatusColor = (status) => {
    const colors = {
      'not_started': 'bg-gray-200 border-gray-400',
      'in_progress': 'bg-blue-200 border-blue-500',
      'completed': 'bg-green-200 border-green-500',
      'on_hold': 'bg-yellow-200 border-yellow-500',
      'cancelled': 'bg-red-200 border-red-500'
    };
    return colors[status] || 'bg-gray-200 border-gray-400';
  };

  const getStatusTextColor = (status) => {
    const colors = {
      'not_started': 'text-gray-700',
      'in_progress': 'text-blue-700',
      'completed': 'text-green-700',
      'on_hold': 'text-yellow-700',
      'cancelled': 'text-red-700'
    };
    return colors[status] || 'text-gray-700';
  };

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPhaseDependencies = (phaseId) => {
    const deps = dependencyMap.get(phaseId?.toString()) || [];
    return sortedPhases.filter(p => 
      deps.includes(p._id?.toString() || p.id?.toString())
    );
  };

  const getDependentPhases = (phaseId) => {
    const phaseIdStr = phaseId?.toString();
    return sortedPhases.filter(p => {
      const deps = dependencyMap.get(p._id?.toString() || p.id?.toString()) || [];
      return deps.includes(phaseIdStr);
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Phase Timeline</h3>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!sortedPhases || sortedPhases.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Phase Timeline</h3>
        <p className="text-gray-500 text-sm">No phases available for this project.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Phase Timeline</h3>
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-200 border border-gray-400 rounded"></div>
            <span>Not Started</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-200 border border-blue-500 rounded"></div>
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-200 border border-green-500 rounded"></div>
            <span>Completed</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {sortedPhases.map((phase, index) => {
          const phaseId = phase._id?.toString() || phase.id?.toString();
          const dependencies = getPhaseDependencies(phaseId);
          const dependents = getDependentPhases(phaseId);
          const hasDependencies = dependencies.length > 0;
          const hasDependents = dependents.length > 0;

          return (
            <div
              key={phaseId}
              className={`border-2 rounded-lg p-4 ${getStatusColor(phase.status)} transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 border-gray-400 font-bold text-sm text-gray-700">
                      {phase.sequence || index + 1}
                    </div>
                    <div>
                      <Link
                        href={`/phases/${phaseId}`}
                        className={`font-semibold text-lg hover:underline ${getStatusTextColor(phase.status)}`}
                      >
                        {phase.phaseName || phase.name}
                      </Link>
                      {phase.phaseCode && (
                        <span className="ml-2 text-sm text-gray-600">({phase.phaseCode})</span>
                      )}
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(phase.status)} ${getStatusTextColor(phase.status)}`}>
                      {phase.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                    </span>
                  </div>

                  {phase.description && (
                    <p className="text-sm text-gray-700 mb-2 ml-11">{phase.description}</p>
                  )}

                  <div className="ml-11 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Start:</span>{' '}
                      <span className="font-medium">{formatDate(phase.startDate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Planned End:</span>{' '}
                      <span className="font-medium">{formatDate(phase.plannedEndDate)}</span>
                    </div>
                    {phase.actualEndDate && (
                      <div>
                        <span className="text-gray-600">Actual End:</span>{' '}
                        <span className="font-medium text-green-700">{formatDate(phase.actualEndDate)}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Progress:</span>{' '}
                      <span className="font-medium">{phase.completionPercentage || 0}%</span>
                    </div>
                  </div>

                  {/* Dependencies */}
                  {hasDependencies && (
                    <div className="mt-3 ml-11 pt-3 border-t border-gray-300">
                      <p className="text-xs font-medium text-gray-600 mb-1">Depends on:</p>
                      <div className="flex flex-wrap gap-2">
                        {dependencies.map(dep => {
                          const depId = dep._id?.toString() || dep.id?.toString();
                          return (
                            <Link
                              key={depId}
                              href={`/phases/${depId}`}
                              className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                            >
                              {dep.phaseName || dep.name} {dep.status === 'completed' && '✓'}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dependents */}
                  {hasDependents && (
                    <div className="mt-2 ml-11 pt-2 border-t border-gray-300">
                      <p className="text-xs font-medium text-gray-600 mb-1">Required by:</p>
                      <div className="flex flex-wrap gap-2">
                        {dependents.map(dep => {
                          const depId = dep._id?.toString() || dep.id?.toString();
                          return (
                            <Link
                              key={depId}
                              href={`/phases/${depId}`}
                              className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                            >
                              {dep.phaseName || dep.name}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-3 ml-11">
                    <div className="w-full bg-white rounded-full h-2 border border-gray-300">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          phase.completionPercentage >= 100
                            ? 'bg-green-600'
                            : phase.completionPercentage >= 75
                            ? 'bg-blue-600'
                            : phase.completionPercentage >= 50
                            ? 'bg-yellow-600'
                            : 'bg-gray-400'
                        }`}
                        style={{ width: `${Math.min(100, phase.completionPercentage || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="ml-4">
                  <Link
                    href={`/phases/${phaseId}`}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-600 mb-2">Timeline Legend:</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-200 border border-gray-400 rounded"></div>
            <span>Not Started</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-200 border border-blue-500 rounded"></div>
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-200 border border-green-500 rounded"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-200 border border-yellow-500 rounded"></div>
            <span>On Hold</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhaseTimeline;

