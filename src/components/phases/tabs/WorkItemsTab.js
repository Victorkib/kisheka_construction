/**
 * Phase Work Items Tab Component
 * Displays and manages work items for a phase
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, DollarSign, Users, Briefcase } from 'lucide-react';
import { WORK_ITEM_STATUSES, getStatusColor, getPriorityColor, getPriorityLabel } from '@/lib/constants/work-item-constants';

export function WorkItemsTab({ phase, canEdit, formatCurrency, formatDate }) {
  const [workItems, setWorkItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'list'
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (phase?._id) {
      fetchWorkItems();
    }
  }, [phase?._id]);

  const fetchWorkItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/work-items?phaseId=${phase._id}`);
      const data = await response.json();
      if (data.success) {
        setWorkItems(data.data?.workItems || data.data || []);
        
        // Calculate statistics
        const workItemStats = {
          total: data.data?.workItems?.length || 0,
          byStatus: {},
          byCategory: {},
          totalEstimatedHours: 0,
          totalActualHours: 0,
          totalEstimatedCost: 0,
          totalActualCost: 0,
          completionPercentage: 0
        };
        
        (data.data?.workItems || []).forEach(item => {
          const status = item.status || 'not_started';
          workItemStats.byStatus[status] = (workItemStats.byStatus[status] || 0) + 1;
          
          const category = item.category || 'other';
          workItemStats.byCategory[category] = (workItemStats.byCategory[category] || 0) + 1;
          
          workItemStats.totalEstimatedHours += item.estimatedHours || 0;
          workItemStats.totalActualHours += item.actualHours || 0;
          workItemStats.totalEstimatedCost += item.estimatedCost || 0;
          workItemStats.totalActualCost += item.actualCost || 0;
        });
        
        // Calculate completion percentage
        if (workItemStats.total > 0) {
          const completedItems = workItemStats.byStatus.completed || 0;
          workItemStats.completionPercentage = Math.round((completedItems / workItemStats.total) * 100);
        }
        
        setStats(workItemStats);
      }
    } catch (err) {
      console.error('Fetch work items error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkItems = filterStatus === 'all' 
    ? workItems 
    : workItems.filter(item => item.status === filterStatus);

  const kanbanColumns = [
    { id: 'not_started', title: 'Not Started', color: 'bg-gray-100' },
    { id: 'in_progress', title: 'In Progress', color: 'bg-blue-100' },
    { id: 'completed', title: 'Completed', color: 'bg-green-100' },
    { id: 'blocked', title: 'Blocked', color: 'bg-red-100' }
  ];

  const getItemsForColumn = (status) => {
    return filteredWorkItems.filter(item => item.status === status);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading work items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Total Items</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.total || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Completion</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats?.completionPercentage || 0}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Estimated Hours</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{stats?.totalEstimatedHours || 0}h</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Actual Hours</p>
            <p className="text-xl font-semibold text-blue-600 mt-1">{stats?.totalActualHours || 0}h</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Estimated Cost</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{formatCurrency(stats?.totalEstimatedCost || 0)}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {Object.entries(stats?.byStatus || {}).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                  {status.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-sm text-gray-600">{count}</span>
              </div>
            ))}
          </div>
          <Link
            href={`/work-items/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Work Item
          </Link>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              List
            </button>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            {WORK_ITEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Work Items Display */}
      {workItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No work items defined for this phase</p>
          <Link
            href={`/work-items/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Work Item
          </Link>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban Board */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {kanbanColumns.map((column) => {
            const columnItems = getItemsForColumn(column.id);
            return (
              <div key={column.id} className="bg-white rounded-lg shadow">
                <div className={`${column.color} p-4 rounded-t-lg`}>
                  <h3 className="font-semibold text-gray-900">
                    {column.title} ({columnItems.length})
                  </h3>
                </div>
                <div className="p-4 space-y-3 min-h-[400px]">
                  {columnItems.map((item) => (
                    <Link
                      key={item._id}
                      href={`/work-items/${item._id}`}
                      className="block border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm">{item.name}</h4>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(item.priority)}`}>
                          {getPriorityLabel(item.priority)}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        {item.estimatedHours > 0 && (
                          <span>{item.estimatedHours}h</span>
                        )}
                        {item.category && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded">
                            {item.category.replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        )}
                      </div>
                      {/* Labour Indicators */}
                      <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1 text-gray-600">
                            <Clock className="w-3 h-3" />
                            <span>
                              {item.actualHours || 0}/{item.estimatedHours || 0} hrs
                            </span>
                          </div>
                          {item.estimatedHours > 0 && (
                            <span className="text-gray-500">
                              {Math.min(100, Math.round(((item.actualHours || 0) / item.estimatedHours) * 100))}%
                            </span>
                          )}
                        </div>
                        {item.estimatedCost > 0 && (
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <DollarSign className="w-3 h-3" />
                            <span>
                              {formatCurrency(item.actualCost || 0)} / {formatCurrency(item.estimatedCost)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                          <Link
                            href={`/labour/entries?workItemId=${item._id}`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Labour →
                          </Link>
                          {canEdit && (
                            <>
                              <Link
                                href={`/labour/entries/new?workItemId=${item._id}&phaseId=${phase._id}&projectId=${phase.projectId}`}
                                className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium"
                                onClick={(e) => e.stopPropagation()}
                              >
                                + Entry
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {columnItems.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">No items</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Work Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Labour
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkItems.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/work-items/${item._id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {item.name}
                      </Link>
                      {item.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.category?.replace(/\b\w/g, l => l.toUpperCase()) || 'Other'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(item.priority)}`}>
                        {getPriorityLabel(item.priority)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.actualHours > 0 ? (
                        <span>{item.actualHours} / {item.estimatedHours || 0}h</span>
                      ) : (
                        <span>{item.estimatedHours || 0}h</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.actualCost > 0 ? (
                        <span>{formatCurrency(item.actualCost)} / {formatCurrency(item.estimatedCost || 0)}</span>
                      ) : (
                        <span>{formatCurrency(item.estimatedCost || 0)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                        {item.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Clock className="w-3 h-3" />
                          <span>
                            {item.actualHours || 0}/{item.estimatedHours || 0} hrs
                          </span>
                          {item.estimatedHours > 0 && (
                            <span className="text-gray-500 ml-1">
                              ({Math.min(100, Math.round(((item.actualHours || 0) / item.estimatedHours) * 100))}%)
                            </span>
                          )}
                        </div>
                        {item.estimatedCost > 0 && (
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <DollarSign className="w-3 h-3" />
                            <span>
                              {formatCurrency(item.actualCost || 0)} / {formatCurrency(item.estimatedCost)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Link
                            href={`/labour/entries?workItemId=${item._id}`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View →
                          </Link>
                          {canEdit && (
                            <>
                              <Link
                                href={`/labour/entries/new?workItemId=${item._id}&phaseId=${phase._id}&projectId=${phase.projectId}`}
                                className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium"
                              >
                                + Entry
                              </Link>
                              <Link
                                href={`/labour/batches/new?workItemId=${item._id}&defaultPhaseId=${phase._id}&projectId=${phase.projectId}`}
                                className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 font-medium"
                              >
                                Bulk
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/work-items/${item._id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkItemsTab;

