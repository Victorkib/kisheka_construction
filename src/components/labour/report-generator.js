/**
 * Report Generator Component
 * Reusable component for generating and displaying labour reports
 */

'use client';

import { useState, useEffect } from 'react';
import { Calendar, Filter, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading';

export function ReportGenerator({
  reportType,
  apiEndpoint,
  title,
  description,
  defaultFilters = {},
  children,
  onDataLoaded,
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [filters, setFilters] = useState({
    projectId: defaultFilters.projectId || '',
    phaseId: defaultFilters.phaseId || '',
    dateFrom: defaultFilters.dateFrom || '',
    dateTo: defaultFilters.dateTo || '',
    groupBy: defaultFilters.groupBy || '',
    ...defaultFilters,
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (filters.projectId) {
      fetchPhases(filters.projectId);
    } else {
      setPhases([]);
    }
  }, [filters.projectId]);

  useEffect(() => {
    if (filters.projectId) {
      generateReport();
    }
  }, [filters, filters.projectId]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      if (result.success) {
        setProjects(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchPhases = async (projectId) => {
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`);
      const result = await response.json();
      if (result.success) {
        setPhases(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching phases:', error);
    }
  };

  const generateReport = async () => {
    if (!filters.projectId) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const response = await fetch(`${apiEndpoint}?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate report');
      }

      setData(result.data);
      if (onDataLoaded) {
        onDataLoaded(result.data);
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      // Reset dependent filters
      if (key === 'projectId') {
        newFilters.phaseId = '';
      }
      return newFilters;
    });
  };

  const handleExport = async (format = 'json') => {
    if (!data) return;

    try {
      let content, mimeType, filename;

      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}.json`;
      } else if (format === 'csv') {
        // Simple CSV conversion (can be enhanced)
        content = convertToCSV(data);
        mimeType = 'text/csv';
        filename = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting report:', err);
      alert('Failed to export report');
    }
  };

  const convertToCSV = (data) => {
    // Simple CSV conversion - can be enhanced based on data structure
    if (data.summary) {
      return `Metric,Value\nTotal Hours,${data.summary.totalHours || 0}\nTotal Cost,${data.summary.totalCost || 0}\n`;
    }
    return JSON.stringify(data);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        {description && <p className="text-gray-600">{description}</p>}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project <span className="text-red-600">*</span>
            </label>
            <select
              value={filters.projectId}
              onChange={(e) => handleFilterChange('projectId', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectName}
                </option>
              ))}
            </select>
          </div>

          {phases.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phase</label>
              <select
                value={filters.phaseId}
                onChange={(e) => handleFilterChange('phaseId', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Phases</option>
                {phases.map((phase) => (
                  <option key={phase._id} value={phase._id}>
                    {phase.phaseName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Additional Filters */}
        {filters.groupBy !== undefined && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Group By</label>
            <select
              value={filters.groupBy}
              onChange={(e) => handleFilterChange('groupBy', e.target.value)}
              className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Default</option>
              <option value="phase">Phase</option>
              <option value="worker">Worker</option>
              <option value="skill">Skill</option>
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={generateReport}
            disabled={!filters.projectId || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Generating...' : 'Generate Report'}
          </button>

          {data && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('json')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow p-12">
          <div className="flex items-center justify-center">
            <LoadingSpinner size="lg" text="Generating report..." />
          </div>
        </div>
      )}

      {/* Report Content */}
      {!loading && data && (
        <div className="bg-white rounded-lg shadow">
          {children ? children(data) : <DefaultReportView data={data} />}
        </div>
      )}

      {/* No Data State */}
      {!loading && !data && filters.projectId && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No data available for the selected filters</p>
        </div>
      )}

      {/* Initial State */}
      {!loading && !data && !filters.projectId && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-blue-800">Please select a project to generate a report</p>
        </div>
      )}
    </div>
  );
}

/**
 * Default Report View
 * Simple table view when no custom renderer is provided
 */
function DefaultReportView({ data }) {
  if (!data) return null;

  return (
    <div className="p-6">
      <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

