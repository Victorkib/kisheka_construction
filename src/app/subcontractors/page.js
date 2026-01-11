/**
 * Subcontractors List Page
 * Displays all subcontractors with filtering, sorting, and pagination
 * 
 * Route: /subcontractors
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState } from '@/components/empty-states';
import { PhaseFilter } from '@/components/filters/PhaseFilter';
import { SUBCONTRACTOR_TYPES, SUBCONTRACTOR_STATUSES, CONTRACT_TYPES, calculateTotalPaid, calculateTotalUnpaid } from '@/lib/constants/subcontractor-constants';

function SubcontractorsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const { currentProject, isEmpty } = useProjectContext();
  const [subcontractors, setSubcontractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [projects, setProjects] = useState([]);
  const [isInfoExpanded, setIsInfoExpanded] = useState(true);
  
  // Get projectId from context (prioritize current project over URL param)
  const projectIdFromContext = normalizeProjectId(currentProject?._id);
  const projectIdFromUrl = searchParams.get('projectId');
  const activeProjectId = projectIdFromContext || projectIdFromUrl || '';
  
  // Filters
  const [filters, setFilters] = useState({
    projectId: activeProjectId,
    phaseId: searchParams.get('phaseId') || '',
    status: searchParams.get('status') || '',
    subcontractorType: searchParams.get('subcontractorType') || '',
    search: searchParams.get('search') || '',
  });

  const fetchProjects = async () => {
    try {
      // Use /api/projects/accessible to respect project-based organization and user memberships
      const response = await fetch('/api/projects/accessible');
      const data = await response.json();
      if (data.success) {
        // API returns projects array directly in data.data
        const projectsList = Array.isArray(data.data) ? data.data : [];
        setProjects(projectsList);
      } else {
        console.error('Failed to fetch accessible projects:', data.error);
        setProjects([]);
      }
    } catch (err) {
      console.error('Error fetching accessible projects:', err);
      setProjects([]);
    }
  };

  const fetchSubcontractors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.phaseId && { phaseId: filters.phaseId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.subcontractorType && { subcontractorType: filters.subcontractorType }),
      });

      const response = await fetch(`/api/subcontractors?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch subcontractors');
      }

      setSubcontractors(data.data.subcontractors || []);
      setPagination(prev => data.data.pagination || prev);
    } catch (err) {
      setError(err.message);
      console.error('Fetch subcontractors error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  // Fetch subcontractors
  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setSubcontractors([]);
      return;
    }
    
    fetchSubcontractors();
  }, [fetchSubcontractors, isEmpty]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
    
    const params = new URLSearchParams();
    Object.entries({ ...filters, [key]: value }).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/subcontractors?${params.toString()}`, { scroll: false });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'active': 'bg-green-100 text-green-800',
      'completed': 'bg-blue-100 text-blue-800',
      'terminated': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isEmpty) {
    return (
      <AppLayout>
        <NoProjectsEmptyState />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Subcontractors</h1>
            <p className="text-gray-600 mt-1">Manage subcontractor assignments and contracts</p>
          </div>
          <Link
            href={`/subcontractors/new${activeProjectId ? `?projectId=${activeProjectId}` : ''}`}
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-2.5 rounded-lg hover:from-purple-700 hover:to-purple-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Subcontractor
          </Link>
        </div>

        {/* Information Card */}
        <div className="bg-gradient-to-br from-purple-50 via-violet-50 to-purple-100 rounded-xl border-2 border-purple-200 p-4 sm:p-6 mb-6 shadow-lg transition-all duration-300">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  What are Subcontractors?
                </h3>
                <button
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-white/80 hover:bg-white border border-purple-300 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  aria-label={isInfoExpanded ? 'Collapse information' : 'Expand information'}
                  aria-expanded={isInfoExpanded}
                >
                  <svg 
                    className={`w-5 h-5 sm:w-6 sm:h-6 text-purple-600 transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {isInfoExpanded ? (
                <div className="space-y-4 animate-fadeIn">
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                    Subcontractors are external contractors and service providers hired for specific work in construction phases. This includes construction labour (skilled, unskilled, supervisory), professional services (architects, engineers, surveyors, consultants), and specialized technicians (HVAC, lift technicians, fire safety, security).
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/60 rounded-lg p-4 border border-purple-200">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2 text-sm sm:text-base">
                        <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Who uses this?
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                        <strong>Project Managers</strong> and <strong>Owners</strong> use subcontractor management to track contracts, payments, performance, and ensure proper contractor coordination. This helps manage multiple contractors working on the same project.
                      </p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-4 border border-purple-200">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2 text-sm sm:text-base">
                        <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Why it's important?
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                        Subcontractor management ensures proper contract tracking, payment scheduling, performance monitoring, helps coordinate multiple contractors, and provides accountability for external work performed on your project.
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 border-t-2 border-purple-200">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
                      <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Common Examples:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {['Masons & Steel Fixers', 'Electricians & Plumbers', 'Architects & Engineers', 'Surveyors', 'HVAC Specialists', 'Lift Technicians', 'Site Supervisors'].map((example) => (
                        <span key={example} className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-white rounded-full text-xs sm:text-sm font-medium text-gray-700 border border-purple-300 shadow-sm hover:shadow-md transition-shadow">
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-500 italic mt-1 animate-fadeIn">
                  Click to expand for more information
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Project</label>
              <select
                value={filters.projectId || ''}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
              >
                <option value="" className="text-gray-500">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id} className="text-gray-900">
                    {project.projectName || project.projectCode || 'Unnamed Project'}
                  </option>
                ))}
              </select>
            </div>
            <PhaseFilter
              projectId={activeProjectId}
              value={filters.phaseId}
              onChange={(value) => handleFilterChange('phaseId', value)}
            />
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
              >
                <option value="" className="text-gray-500">All Statuses</option>
                {SUBCONTRACTOR_STATUSES.map((status) => (
                  <option key={status} value={status} className="text-gray-900">
                    {status.replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Type</label>
              <select
                value={filters.subcontractorType || ''}
                onChange={(e) => handleFilterChange('subcontractorType', e.target.value)}
                className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
              >
                <option value="" className="text-gray-500">All Types</option>
                {SUBCONTRACTOR_TYPES.map((type) => (
                  <option key={type} value={type} className="text-gray-900">
                    {type.replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ projectId: '', phaseId: '', status: '', subcontractorType: '', search: '' });
                  router.push('/subcontractors', { scroll: false });
                }}
                className="w-full px-4 py-2.5 border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-all duration-200 hover:border-gray-400"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Subcontractors Table */}
        {loading ? (
          <LoadingTable />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : subcontractors.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-700 mb-4 font-semibold text-lg">No subcontractors found</p>
            <Link
              href={`/subcontractors/new${activeProjectId ? `?projectId=${activeProjectId}` : ''}`}
              className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Add First Subcontractor
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-purple-600 to-purple-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Subcontractor
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Phase
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Contract Value
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Paid / Unpaid
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subcontractors.map((sub) => {
                    const totalPaid = calculateTotalPaid(sub.paymentSchedule || []);
                    const totalUnpaid = calculateTotalUnpaid(sub.paymentSchedule || []);
                    return (
                      <tr key={sub._id} className="hover:bg-purple-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/subcontractors/${sub._id}`}
                            className="text-sm font-bold text-gray-900 hover:text-purple-600 transition-colors"
                          >
                            {sub.subcontractorName}
                          </Link>
                          {sub.contactPerson && (
                            <p className="text-xs text-gray-600 mt-1 font-medium">{sub.contactPerson}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                          {sub.subcontractorType?.replace(/\b\w/g, l => l.toUpperCase()) || 'Other'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                          {sub.phaseName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {formatCurrency(sub.contractValue || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div>
                            <span className="text-green-600 font-semibold">{formatCurrency(totalPaid)}</span>
                            <span className="text-gray-400 mx-1">/</span>
                            <span className="text-orange-600 font-semibold">{formatCurrency(totalUnpaid)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1.5 text-xs font-bold rounded-full ${getStatusColor(sub.status)}`}>
                            {sub.status?.toUpperCase() || 'UNKNOWN'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/subcontractors/${sub._id}`}
                            className="text-purple-600 hover:text-purple-800 font-semibold transition-colors"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t-2 border-gray-200 flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} subcontractors
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-white hover:border-purple-500 hover:text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-white hover:border-purple-500 hover:text-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function SubcontractorsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    }>
      <SubcontractorsPageContent />
    </Suspense>
  );
}

