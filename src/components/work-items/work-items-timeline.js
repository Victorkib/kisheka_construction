/**
 * Work Items Timeline / Gantt Chart Component
 * Visual timeline view of work items with dependencies
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/loading';

export function WorkItemsTimeline({ projectId, phaseId }) {
  const [loading, setLoading] = useState(true);
  const [workItems, setWorkItems] = useState([]);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'list'
  const [zoomLevel, setZoomLevel] = useState('week'); // 'day', 'week', 'month'

  useEffect(() => {
    if (projectId || phaseId) {
      fetchWorkItems();
    }
  }, [projectId, phaseId]);

  const fetchWorkItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      if (phaseId) params.set('phaseId', phaseId);
      params.set('limit', '100');

      const response = await fetch(`/api/work-items?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch work items');
      }

      setWorkItems(data.data?.workItems || []);
    } catch (err) {
      console.error('Error fetching work items for timeline:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate timeline date range
  const { startDate, endDate, items } = useMemo(() => {
    if (workItems.length === 0) {
      return { startDate: null, endDate: null, items: [] };
    }

    // Filter items with dates
    const itemsWithDates = workItems.filter(
      item => item.startDate || item.plannedEndDate
    );

    if (itemsWithDates.length === 0) {
      return { startDate: null, endDate: null, items: [] };
    }

    // Find min and max dates
    let minDate = new Date();
    let maxDate = new Date();

    itemsWithDates.forEach(item => {
      if (item.startDate) {
        const start = new Date(item.startDate);
        if (start < minDate) minDate = start;
      }
      if (item.plannedEndDate) {
        const end = new Date(item.plannedEndDate);
        if (end > maxDate) maxDate = end;
      }
      if (item.actualEndDate) {
        const end = new Date(item.actualEndDate);
        if (end > maxDate) maxDate = end;
      }
    });

    // Add padding (1 week before and after)
    minDate = new Date(minDate);
    minDate.setDate(minDate.getDate() - 7);
    maxDate = new Date(maxDate);
    maxDate.setDate(maxDate.getDate() + 7);

    return {
      startDate: minDate,
      endDate: maxDate,
      items: itemsWithDates
    };
  }, [workItems]);

  // Generate timeline headers based on zoom level
  const timelineHeaders = useMemo(() => {
    if (!startDate || !endDate) return [];

    const headers = [];
    const current = new Date(startDate);
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    if (zoomLevel === 'day') {
      while (current <= endDate) {
        headers.push({
          date: new Date(current),
          label: current.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }),
          width: `${100 / totalDays}%`
        });
        current.setDate(current.getDate() + 1);
      }
    } else if (zoomLevel === 'week') {
      let weekNum = 1;
      while (current <= endDate) {
        const weekStart = new Date(current);
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        headers.push({
          date: weekStart,
          label: `Week ${weekNum}`,
          width: `${100 / Math.ceil(totalDays / 7)}%`
        });
        current.setDate(current.getDate() + 7);
        weekNum++;
      }
    } else if (zoomLevel === 'month') {
      let monthNum = 1;
      while (current <= endDate) {
        headers.push({
          date: new Date(current),
          label: current.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' }),
          width: `${100 / Math.ceil(totalDays / 30)}%`
        });
        current.setMonth(current.getMonth() + 1);
        monthNum++;
      }
    }

    return headers;
  }, [startDate, endDate, zoomLevel]);

  // Calculate item position and width
  const getItemStyle = (item) => {
    if (!startDate || !endDate) return {};

    const totalDuration = endDate - startDate;
    const itemStart = item.startDate ? new Date(item.startDate) : startDate;
    const itemEnd = item.plannedEndDate || item.actualEndDate || new Date();

    const left = ((itemStart - startDate) / totalDuration) * 100;
    const width = Math.max(((itemEnd - itemStart) / totalDuration) * 100, 2); // Minimum 2% width

    // Status colors
    const statusColors = {
      not_started: 'bg-gray-400',
      in_progress: 'bg-blue-500',
      completed: 'bg-green-500',
      blocked: 'bg-red-500'
    };

    return {
      left: `${left}%`,
      width: `${width}%`,
      backgroundColor: statusColors[item.status] || statusColors.not_started
    };
  };

  if (loading) {
    return (
      <div className="ds-bg-surface rounded-xl shadow p-6">
        <LoadingSpinner text="Loading timeline..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-400/60 text-red-800 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  if (workItems.length === 0) {
    return (
      <div className="ds-bg-surface rounded-xl shadow p-6 text-center">
        <p className="ds-text-muted">No work items to display</p>
      </div>
    );
  }

  return (
    <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle overflow-hidden">
      {/* Controls */}
      <div className="p-4 border-b ds-border-subtle flex flex-wrap gap-2 justify-between items-center">
        <h3 className="text-lg font-bold ds-text-primary">Work Items Timeline</h3>
        
        <div className="flex gap-2">
          {/* Zoom Level */}
          <select
            value={zoomLevel}
            onChange={(e) => setZoomLevel(e.target.value)}
            className="px-3 py-1.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg text-sm font-medium"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>

          {/* View Mode */}
          <button
            onClick={() => setViewMode(viewMode === 'timeline' ? 'list' : 'timeline')}
            className="px-3 py-1.5 ds-bg-accent-primary text-white rounded-lg text-sm font-medium hover:ds-bg-accent-hover transition-colors"
          >
            {viewMode === 'timeline' ? 'Switch to List' : 'Switch to Timeline'}
          </button>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        <div className="overflow-x-auto">
          {/* Timeline Header */}
          <div className="min-w-[800px]">
            <div className="flex border-b ds-border-subtle ds-bg-surface-muted">
              <div className="w-48 flex-shrink-0 p-3 border-r ds-border-subtle font-semibold text-sm ds-text-primary">
                Work Item
              </div>
              <div className="flex-1 flex">
                {timelineHeaders.map((header, idx) => (
                  <div
                    key={idx}
                    className="p-2 border-r ds-border-subtle text-xs font-medium ds-text-secondary text-center"
                    style={{ width: header.width }}
                  >
                    {header.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Rows */}
            <div className="divide-y ds-border-subtle">
              {items.map((item) => (
                <div key={item._id} className="flex ds-bg-surface hover:ds-bg-surface-muted transition-colors">
                  {/* Item Name */}
                  <div className="w-48 flex-shrink-0 p-3 border-r ds-border-subtle">
                    <Link
                      href={`/work-items/${item._id}`}
                      className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover block truncate"
                      title={item.name}
                    >
                      {item.name}
                    </Link>
                    <div className="flex gap-1 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        item.status === 'completed' ? 'bg-green-100 text-green-700' :
                        item.status === 'blocked' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {item.status?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Timeline Bar */}
                  <div className="flex-1 relative h-12">
                    {startDate && endDate && (
                      <div
                        className="absolute h-8 top-2 rounded-md shadow-sm text-white text-xs font-medium px-2 flex items-center overflow-hidden"
                        style={getItemStyle(item)}
                      >
                        <span className="truncate">{Math.round(((new Date(item.plannedEndDate || new Date()) - new Date(item.startDate || new Date())) / (1000 * 60 * 60 * 24)))} days</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="divide-y ds-border-subtle">
          {items.map((item) => (
            <div key={item._id} className="p-4 hover:ds-bg-surface-muted transition-colors">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <Link
                    href={`/work-items/${item._id}`}
                    className="text-base font-semibold ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    {item.name}
                  </Link>
                  <div className="flex gap-2 mt-2 text-sm ds-text-secondary">
                    <span>📅 {item.startDate ? new Date(item.startDate).toLocaleDateString() : 'No start date'}</span>
                    <span>→</span>
                    <span>📅 {item.plannedEndDate ? new Date(item.plannedEndDate).toLocaleDateString() : 'No end date'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                    item.status === 'completed' ? 'bg-green-100 text-green-700' :
                    item.status === 'blocked' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {item.status?.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
