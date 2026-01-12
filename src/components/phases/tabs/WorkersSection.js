/**
 * Workers Section Component
 * Displays workers who have labour entries for this phase
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Clock, DollarSign, TrendingUp, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading';
import { getSkillTypeLabel } from '@/lib/constants/labour-constants';

export function WorkersSection({ phase, formatCurrency }) {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10, // Show 10 workers per page
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    if (phase?._id) {
      // Reset pagination when phase changes
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [phase?._id]);

  useEffect(() => {
    if (phase?._id) {
      fetchWorkers();
    }
  }, [phase?._id, pagination.page]);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Ensure phase._id is a string (handle both ObjectId and string)
      const phaseId = phase._id?.toString ? phase._id.toString() : phase._id;
      
      if (!phaseId) {
        console.warn('WorkersSection: No phase ID available');
        setWorkers([]);
        setLoading(false);
        return;
      }
      
      // Fetch labour entries for this phase to get worker statistics
      // Include all statuses except deleted/rejected to show all active workers
      const response = await fetch(`/api/labour/entries?phaseId=${phaseId}&limit=1000`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch workers data');
      }

      const entries = data.data?.entries || [];
      
      console.log(`WorkersSection: Found ${entries.length} entries for phase ${phaseId}`);
      
      // Filter out deleted/rejected entries (only show active entries)
      const activeEntries = entries.filter(entry => {
        // Verify entry belongs to this phase
        const entryPhaseId = entry.phaseId?.toString ? entry.phaseId.toString() : entry.phaseId;
        const matchesPhase = entryPhaseId === phaseId;
        
        // Check status
        const hasValidStatus = entry.status && 
          entry.status !== 'deleted' && 
          entry.status !== 'rejected' &&
          entry.deletedAt === null;
        
        return matchesPhase && hasValidStatus;
      });
      
      console.log(`WorkersSection: ${activeEntries.length} active entries after filtering`);
      
      // Aggregate workers from entries
      const workerMap = new Map();
      
      activeEntries.forEach(entry => {
        const workerKey = entry.workerId || entry.workerName;
        if (!workerKey) return;
        
        if (!workerMap.has(workerKey)) {
          workerMap.set(workerKey, {
            workerId: entry.workerId,
            workerName: entry.workerName,
            skillType: entry.skillType,
            totalHours: 0,
            totalCost: 0,
            entryCount: 0,
            lastWorkDate: null,
          });
        }
        
        const worker = workerMap.get(workerKey);
        worker.totalHours += entry.totalHours || 0;
        worker.totalCost += entry.totalCost || 0;
        worker.entryCount += 1;
        
        const entryDate = new Date(entry.entryDate);
        if (!worker.lastWorkDate || entryDate > new Date(worker.lastWorkDate)) {
          worker.lastWorkDate = entry.entryDate;
        }
      });
      
      const allWorkersList = Array.from(workerMap.values())
        .sort((a, b) => b.totalCost - a.totalCost); // Sort by total cost
      
      // Calculate pagination
      const totalWorkers = allWorkersList.length;
      const totalPages = Math.ceil(totalWorkers / pagination.limit);
      const startIndex = (pagination.page - 1) * pagination.limit;
      const endIndex = startIndex + pagination.limit;
      const paginatedWorkers = allWorkersList.slice(startIndex, endIndex);
      
      setWorkers(paginatedWorkers);
      setPagination(prev => ({
        ...prev,
        total: totalWorkers,
        totalPages: totalPages,
      }));
      
      // Calculate statistics from ALL workers (not just paginated)
      const workersStats = {
        total: allWorkersList.length,
        totalHours: allWorkersList.reduce((sum, w) => sum + w.totalHours, 0),
        totalCost: allWorkersList.reduce((sum, w) => sum + w.totalCost, 0),
        totalEntries: allWorkersList.reduce((sum, w) => sum + w.entryCount, 0),
        bySkill: {},
        averageHoursPerWorker: allWorkersList.length > 0 
          ? allWorkersList.reduce((sum, w) => sum + w.totalHours, 0) / allWorkersList.length 
          : 0,
      };
      
      // Group by skill type
      allWorkersList.forEach(worker => {
        const skill = worker.skillType || 'unknown';
        if (!workersStats.bySkill[skill]) {
          workersStats.bySkill[skill] = {
            count: 0,
            totalHours: 0,
            totalCost: 0,
          };
        }
        workersStats.bySkill[skill].count += 1;
        workersStats.bySkill[skill].totalHours += worker.totalHours;
        workersStats.bySkill[skill].totalCost += worker.totalCost;
      });
      
      setStats(workersStats);
    } catch (err) {
      console.error('Fetch workers error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Workers</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Loading workers..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Workers</h3>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">Error loading workers: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Workers</h3>
        <Link
          href={`/labour/entries/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Labour Entry
        </Link>
      </div>

      {stats && stats.total === 0 ? (
        <div className="text-center py-8">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No workers have logged labour for this phase yet</p>
          <Link
            href={`/labour/entries/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Labour Entry
          </Link>
        </div>
      ) : (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-gray-600">Total Workers</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-green-600" />
                <p className="text-sm text-gray-600">Total Hours</p>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {stats?.totalHours?.toFixed(1) || 0}
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
                <p className="text-sm text-gray-600">Total Cost</p>
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(stats?.totalCost || 0)}
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                <p className="text-sm text-gray-600">Avg Hours/Worker</p>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                {stats?.averageHoursPerWorker?.toFixed(1) || 0}
              </p>
            </div>
          </div>

          {/* Workers List */}
          <div className="space-y-3">
            {workers.map((worker, index) => {
              // Calculate actual index for key (accounting for pagination)
              const actualIndex = (pagination.page - 1) * pagination.limit + index;
              return (
              <div
                key={worker.workerId || worker.workerName || actualIndex}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {worker.workerId ? (
                        <Link
                          href={`/labour/workers/${worker.workerId}`}
                          className="font-semibold text-gray-900 hover:text-blue-600"
                        >
                          {worker.workerName}
                        </Link>
                      ) : (
                        <span className="font-semibold text-gray-900">{worker.workerName}</span>
                      )}
                      {worker.skillType && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          {getSkillTypeLabel(worker.skillType)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Hours:</span> {worker.totalHours.toFixed(1)}
                      </div>
                      <div>
                        <span className="font-medium">Cost:</span> {formatCurrency(worker.totalCost)}
                      </div>
                      <div>
                        <span className="font-medium">Entries:</span> {worker.entryCount}
                      </div>
                      <div>
                        <span className="font-medium">Last Work:</span> {formatDate(worker.lastWorkDate)}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <Link
                      href={`/labour/entries?phaseId=${phase._id}&workerId=${worker.workerId || worker.workerName}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Entries →
                    </Link>
                  </div>
                </div>
              </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} workers
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            pagination.page === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                          aria-label={`Go to page ${pageNum}`}
                          aria-current={pagination.page === pageNum ? 'page' : undefined}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Link to view all entries */}
          <div className="mt-4 text-center">
            <Link
              href={`/labour/entries?phaseId=${phase._id}`}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View all labour entries for this phase →
            </Link>
          </div>

          {/* Link to Workers Registry */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Link
              href="/labour/workers"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Manage Workers →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default WorkersSection;
