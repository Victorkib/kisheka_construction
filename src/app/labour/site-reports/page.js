/**
 * Site Reports Page
 * List all site reports
 *
 * Route: /labour/site-reports
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingSelect } from '@/components/loading';
import { useToast } from '@/components/toast/toast-container';
import { FileText, Plus, Eye } from 'lucide-react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { NoProjectsEmptyState } from '@/components/empty-states';

export default function SiteReportsPage() {
  const toast = useToast();
  const {
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [phases, setPhases] = useState([]);
  const [filters, setFilters] = useState({
    projectId: currentProjectId || '',
    phaseId: '',
    status: 'all',
    search: '',
  });

  useEffect(() => {
    if (currentProjectId && currentProjectId !== filters.projectId) {
      setFilters((prev) => ({ ...prev, projectId: currentProjectId, phaseId: '' }));
    }
  }, [currentProjectId, filters.projectId]);

  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setReports([]);
      return;
    }
    if (!filters.projectId) {
      if (projectLoading) return;
      setLoading(false);
      setReports([]);
      return;
    }
    fetchReports();
  }, [filters.projectId, filters.phaseId, filters.status, isEmpty, projectLoading]);

  useEffect(() => {
    if (filters.projectId) {
      fetchPhases(filters.projectId);
    } else {
      setPhases([]);
      setFilters((prev) => ({ ...prev, phaseId: '' }));
    }
  }, [filters.projectId]);

  const fetchPhases = async (projectId) => {
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching phases:', error);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.projectId) params.set('projectId', filters.projectId);
      if (filters.phaseId) params.set('phaseId', filters.phaseId);
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);

      const response = await fetch(`/api/labour/site-reports?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setReports(data.data?.reports || []);
      } else {
        throw new Error(data.error || 'Failed to load site reports');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.showError('Failed to load site reports');
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter((report) => {
    if (!filters.search) return true;
    const needle = filters.search.toLowerCase();
    return (
      report.reportNumber?.toLowerCase().includes(needle) ||
      report.reportedByName?.toLowerCase().includes(needle) ||
      report.projectName?.toLowerCase().includes(needle) ||
      report.phaseName?.toLowerCase().includes(needle)
    );
  });

  if (isEmpty && !loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Site Reports</h1>
            <p className="text-gray-600 mt-1">Capture site updates with photos and labour details</p>
          </div>
          <NoProjectsEmptyState />
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading site reports..." />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Site Reports</h1>
            <p className="text-gray-600 mt-1">Capture site updates with photos and labour details</p>
          </div>
          <Link
            href="/labour/site-reports/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Site Report
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <LoadingSelect
                value={filters.projectId}
                onChange={(e) => {
                  const nextProjectId = e.target.value;
                  setFilters({ ...filters, projectId: nextProjectId, phaseId: '' });
                  if (nextProjectId && nextProjectId !== currentProjectId) {
                    switchProject(nextProjectId).catch((err) => {
                      console.error('Error switching project:', err);
                    });
                  }
                }}
              >
                <option value="">All Projects</option>
                {accessibleProjects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName}
                  </option>
                ))}
              </LoadingSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
              <LoadingSelect
                value={filters.phaseId}
                onChange={(e) => setFilters({ ...filters, phaseId: e.target.value })}
                disabled={!filters.projectId}
              >
                <option value="">All Phases</option>
                {phases.map((phase) => (
                  <option key={phase._id} value={phase._id}>
                    {phase.phaseName}
                  </option>
                ))}
              </LoadingSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <LoadingSelect
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="converted">Converted</option>
                <option value="rejected">Rejected</option>
              </LoadingSelect>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search by report or name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No site reports found</p>
            <p className="text-sm text-gray-500">Create a report to capture site progress.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phase</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reported By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entries</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReports.map((report) => (
                  <tr key={report._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {report.reportNumber}
                      <div className="text-xs text-gray-500">
                        {new Date(report.entryDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {report.projectName || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {report.phaseName || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {report.reportedByName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {report.labourEntries?.length || 0} workers
                      <div className="text-xs text-gray-500">
                        {report.attachments?.length || 0} files
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                      {report.status?.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/labour/site-reports/${report._id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
