/**
 * Professional Services Reports Page
 * Displays professional services activity and financial reports
 * 
 * Route: /reports/professional-services
 * Auth: OWNER, PM, ACCOUNTANT
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingCard, LoadingSpinner, LoadingOverlay } from '@/components/loading';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState } from '@/components/empty-states';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

function ProfessionalServicesReportsContent() {
  const searchParams = useSearchParams();
  const {
    currentProject,
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  const [reportData, setReportData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  
  // Get projectId from context (prioritize current project over URL param)
  const projectIdFromContext = normalizeProjectId(currentProject?._id) || currentProjectId || '';
  const projectIdFromUrl = searchParams.get('projectId');
  const activeProjectId = projectIdFromContext || projectIdFromUrl || '';
  
  // Filters
  const [filters, setFilters] = useState({
    projectId: activeProjectId || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    type: searchParams.get('type') || 'all',
  });

  useEffect(() => {
    setProjects(accessibleProjects || []);
  }, [accessibleProjects]);

  useEffect(() => {
    if (projectIdFromContext && projectIdFromContext !== filters.projectId) {
      setFilters((prev) => ({ ...prev, projectId: projectIdFromContext }));
    }
  }, [projectIdFromContext, filters.projectId]);

  // Fetch report data
  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.type) params.append('type', filters.type);

      const response = await fetch(`/api/reports/professional-services?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch report data');
      }

      const data = await response.json();
      if (data.success) {
        setReportData(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch report data');
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setReportData(null);
      return;
    }
    if (!filters.projectId) {
      if (projectLoading) return;
      setLoading(false);
      setReportData(null);
      return;
    }
    fetchReport();
  }, [filters.projectId, filters.startDate, filters.endDate, filters.type, isEmpty, projectLoading]);

  const handleFilterChange = (key, value) => {
    const updatedFilters = key === 'projectId'
      ? { ...filters, projectId: value }
      : { ...filters, [key]: value };
    setFilters(updatedFilters);
    if (key === 'projectId' && value && value !== currentProjectId) {
      switchProject(value).catch((err) => {
        console.error('Error switching project:', err);
      });
    }
  };

  const handleExport = async (format = 'pdf') => {
    try {
      setExportLoading(true);
      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.type) params.append('type', filters.type);
      params.append('format', format);

      const response = await fetch(`/api/reports/professional-services/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `professional-services-report.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export report');
    } finally {
      setExportLoading(false);
    }
  };

  if (isEmpty) {
    return (
      <AppLayout>
        <NoProjectsEmptyState />
      </AppLayout>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <AppLayout>
      <div className="space-y-6">
        <LoadingOverlay
          isLoading={exportLoading}
          message="Preparing report export..."
          fullScreen
        />
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-600 mt-1">Activity and financial overview</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('pdf')}
              disabled={exportLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              {exportLoading ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={() => handleExport('xlsx')}
              disabled={exportLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              {exportLoading ? 'Exporting...' : 'Export Excel'}
            </button>
          </div>
        </div>

        <PrerequisiteGuide
          title="Reports rely on assignments and activities"
          description="Populate assignments, activities, and fees before reporting."
          prerequisites={[
            'Professional assignments exist',
            'Activities and fees are logged',
          ]}
          actions={[
            { href: '/professional-services', label: 'View Assignments' },
            { href: '/professional-activities', label: 'View Activities' },
            { href: '/professional-fees', label: 'View Fees' },
          ]}
          tip="Filter by project for clearer insights."
        />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Project</label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName || project.projectCode}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="architect">Architects</option>
                <option value="engineer">Engineers</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-6">
            <LoadingSpinner />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Report Data */}
        {!loading && !error && reportData && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-600">Total Assignments</h3>
                <p className="text-2xl font-bold text-gray-900 mt-2">{reportData.summary?.totalAssignments || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {reportData.summary?.architectsCount || 0} Architects, {reportData.summary?.engineersCount || 0} Engineers
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-600">Total Activities</h3>
                <p className="text-2xl font-bold text-gray-900 mt-2">{reportData.summary?.totalActivities || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {reportData.summary?.siteVisits || 0} Visits, {reportData.summary?.inspections || 0} Inspections
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-600">Total Fees</h3>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  KES {((reportData.summary?.totalFees || 0) / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {((reportData.summary?.paidFees || 0) / 1000).toFixed(0)}K Paid, {((reportData.summary?.pendingFees || 0) / 1000).toFixed(0)}K Pending
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-600">Fees by Type</h3>
                <p className="text-lg font-semibold text-gray-900 mt-2">
                  Arch: KES {((reportData.summary?.architectFees || 0) / 1000).toFixed(0)}K
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  Eng: KES {((reportData.summary?.engineerFees || 0) / 1000).toFixed(0)}K
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Activities by Month */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activities by Month</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.activitiesByMonth || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#3b82f6" name="Total" />
                    <Bar dataKey="siteVisits" fill="#10b981" name="Site Visits" />
                    <Bar dataKey="inspections" fill="#f59e0b" name="Inspections" />
                    <Bar dataKey="designRevisions" fill="#ef4444" name="Revisions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Fees by Month */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Fees by Month</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reportData.feesByMonth || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `KES ${(value / 1000).toFixed(0)}K`} />
                    <Legend />
                    <Bar dataKey="total" fill="#3b82f6" name="Total" />
                    <Bar dataKey="paid" fill="#10b981" name="Paid" />
                    <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Breakdown by Assignment</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Professional</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activities</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Fees</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.breakdown?.map((item) => (
                      <tr key={item.assignmentId}>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.professionalCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 capitalize">{item.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.library?.name || item.library?.companyName || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.activitiesCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          KES {((item.totalFees || 0) / 1000).toFixed(0)}K
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          KES {((item.paidFees || 0) / 1000).toFixed(0)}K
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === 'active' ? 'bg-green-100 text-green-800' :
                            item.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            item.status === 'terminated' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function ProfessionalServicesReportsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="bg-white rounded-lg shadow p-6">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <ProfessionalServicesReportsContent />
    </Suspense>
  );
}





