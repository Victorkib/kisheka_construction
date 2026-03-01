/**
 * Equipment List Page
 * Displays all equipment with filtering, sorting, and pagination
 * 
 * Route: /equipment
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
import { EQUIPMENT_TYPES, EQUIPMENT_STATUSES, ACQUISITION_TYPES } from '@/lib/constants/equipment-constants';
import { fetchNoCache } from '@/lib/fetch-helpers';

function EquipmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const {
    currentProject,
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  
  // Get projectId from context (prioritize current project over URL param)
  const projectIdFromContext = normalizeProjectId(currentProject?._id) || currentProjectId || '';
  const projectIdFromUrl = searchParams.get('projectId');
  const activeProjectId = projectIdFromContext || projectIdFromUrl || '';
  
  // Filters
  const [filters, setFilters] = useState({
    projectId: activeProjectId || '',
    phaseId: searchParams.get('phaseId') || '',
    status: searchParams.get('status') || '',
    equipmentType: searchParams.get('equipmentType') || '',
    acquisitionType: searchParams.get('acquisitionType') || '',
    search: searchParams.get('search') || '',
  });

  useEffect(() => {
    if (projectIdFromContext && projectIdFromContext !== filters.projectId) {
      setFilters((prev) => ({ ...prev, projectId: projectIdFromContext, phaseId: '' }));
    }
  }, [projectIdFromContext, filters.projectId]);

  const fetchEquipment = useCallback(async () => {
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
        ...(filters.equipmentType && { equipmentType: filters.equipmentType }),
        ...(filters.acquisitionType && { acquisitionType: filters.acquisitionType }),
      });

      const response = await fetchNoCache(`/api/equipment?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch equipment');
      }

      setEquipment(data.data.equipment || []);
      setPagination(prev => {
        const newPagination = data.data.pagination || prev;
        // Only update if values actually changed
        if (prev.page === newPagination.page && 
            prev.limit === newPagination.limit && 
            prev.total === newPagination.total && 
            prev.pages === newPagination.pages) {
          return prev; // Return same reference to prevent re-render
        }
        return newPagination;
      });
    } catch (err) {
      setError(err.message);
      console.error('Fetch equipment error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.projectId, filters.phaseId, filters.status, filters.equipmentType, filters.acquisitionType, pagination.page, pagination.limit]);

  // Fetch equipment
  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setEquipment([]);
      return;
    }
    if (!filters.projectId) {
      if (projectLoading) return;
      setLoading(false);
      setEquipment([]);
      return;
    }
    
    fetchEquipment();
  }, [fetchEquipment, isEmpty, projectLoading, filters.projectId]);

  const handleFilterChange = (key, value) => {
    let updatedFilters = { ...filters, [key]: value };
    if (key === 'projectId') {
      updatedFilters = { ...filters, projectId: value, phaseId: '' };
      if (value && value !== currentProjectId) {
        switchProject(value).catch((err) => {
          console.error('Error switching project:', err);
        });
      }
    }
    setFilters(updatedFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
    
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/equipment?${params.toString()}`, { scroll: false });
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
      'assigned': 'bg-blue-100 text-blue-800',
      'in_use': 'bg-green-100 text-green-800',
      'returned': 'ds-bg-surface-muted ds-text-primary',
      'maintenance': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
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
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary">Equipment</h1>
            <p className="text-sm sm:text-base ds-text-secondary mt-1">Manage equipment assignments and tracking</p>
          </div>
          <Link
            href={`/equipment/new${filters.projectId ? `?projectId=${filters.projectId}` : ''}`}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 touch-manipulation text-sm sm:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Equipment
          </Link>
        </div>

        {/* Information Card */}
        <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 rounded-xl border-2 border-green-400/60 p-4 sm:p-6 mb-6 shadow-lg transition-all duration-300">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-lg sm:text-xl font-bold ds-text-primary flex items-center gap-2">
                  What is Equipment?
                </h3>
                <button
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 ds-bg-surface/80 hover:ds-bg-surface active:ds-bg-surface border border-green-400/60 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 touch-manipulation"
                  aria-label={isInfoExpanded ? 'Collapse information' : 'Expand information'}
                  aria-expanded={isInfoExpanded}
                >
                  <svg 
                    className={`w-5 h-5 sm:w-6 sm:h-6 text-green-600 transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} 
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
                  <p className="text-sm sm:text-base ds-text-secondary leading-relaxed">
                    Equipment assignments track machinery, tools, and vehicles used in construction phases. Equipment can be rented, purchased, or owned, and includes items like excavators, cranes, generators, scaffolding, and more. Track utilization, costs, suppliers, and ensure proper resource allocation.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="ds-bg-surface/60 rounded-lg p-4 border border-green-400/60">
                      <h4 className="font-semibold ds-text-primary mb-2 flex items-center gap-2 text-sm sm:text-base">
                        <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Who uses this?
                      </h4>
                      <p className="text-xs sm:text-sm ds-text-secondary leading-relaxed">
                        <strong>Project Managers</strong> and <strong>Owners</strong> use equipment management to track costs, utilization, and ensure proper resource allocation. <strong>Site Supervisors</strong> use it to coordinate equipment availability and schedule usage.
                      </p>
                    </div>
                    <div className="ds-bg-surface/60 rounded-lg p-4 border border-green-400/60">
                      <h4 className="font-semibold ds-text-primary mb-2 flex items-center gap-2 text-sm sm:text-base">
                        <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Why it's important?
                      </h4>
                      <p className="text-xs sm:text-sm ds-text-secondary leading-relaxed">
                        Proper equipment management ensures cost control, tracks utilization rates, manages supplier relationships, helps optimize resource allocation across phases, and prevents equipment conflicts or downtime.
                      </p>
                    </div>
                  </div>
                  <div className="pt-4 border-t-2 border-green-400/60">
                    <h4 className="font-semibold ds-text-primary mb-3 flex items-center gap-2 text-sm sm:text-base">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Common Examples:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {['Excavators', 'Cranes', 'Concrete Mixers', 'Generators', 'Scaffolding', 'Compactors', 'Loaders', 'Welding Equipment'].map((example) => (
                        <span key={example} className="px-2.5 sm:px-3 py-1 sm:py-1.5 ds-bg-surface rounded-full text-xs sm:text-sm font-medium ds-text-secondary border border-green-400/60 shadow-sm hover:shadow-md transition-shadow">
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm ds-text-muted italic mt-1 animate-fadeIn">
                  Click to expand for more information
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-semibold ds-text-primary mb-2">Project</label>
              <select
                value={filters.projectId || ''}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
              >
                <option value="" className="ds-text-muted">All Projects</option>
                {accessibleProjects.map((project) => (
                  <option key={project._id} value={project._id} className="ds-text-primary">
                    {project.projectName || project.projectCode || 'Unnamed Project'}
                  </option>
                ))}
              </select>
            </div>
            <PhaseFilter
              projectId={filters.projectId}
              value={filters.phaseId}
              onChange={(value) => handleFilterChange('phaseId', value)}
            />
            <div>
              <label className="block text-sm font-semibold ds-text-primary mb-2">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
              >
                <option value="" className="ds-text-muted">All Statuses</option>
                {EQUIPMENT_STATUSES.map((status) => (
                  <option key={status} value={status} className="ds-text-primary">
                    {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold ds-text-primary mb-2">Type</label>
              <select
                value={filters.equipmentType || ''}
                onChange={(e) => handleFilterChange('equipmentType', e.target.value)}
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
              >
                <option value="" className="ds-text-muted">All Types</option>
                {EQUIPMENT_TYPES.map((type) => (
                  <option key={type} value={type} className="ds-text-primary">
                    {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold ds-text-primary mb-2">Acquisition</label>
              <select
                value={filters.acquisitionType || ''}
                onChange={(e) => handleFilterChange('acquisitionType', e.target.value)}
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
              >
                <option value="" className="ds-text-muted">All Types</option>
                {ACQUISITION_TYPES.map((type) => (
                  <option key={type} value={type} className="ds-text-primary">
                    {type.replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <button
                onClick={() => {
                  setFilters({ projectId: '', phaseId: '', status: '', equipmentType: '', acquisitionType: '', search: '' });
                  router.push('/equipment', { scroll: false });
                }}
                className="w-full px-4 py-2.5 border-2 ds-border-subtle hover:ds-bg-surface-muted active:ds-bg-surface-muted hover:border-ds-border-strong ds-text-primary font-semibold rounded-lg transition-all duration-200 touch-manipulation"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Equipment Table */}
        {loading ? (
          <LoadingTable />
        ) : error ? (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : equipment.length === 0 ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <p className="ds-text-muted mb-4">No equipment found</p>
            <Link
              href={`/equipment/new${filters.projectId ? `?projectId=${filters.projectId}` : ''}`}
              className="inline-block px-4 py-2.5 ds-bg-accent-primary text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors touch-manipulation font-medium"
            >
              Add First Equipment
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block ds-bg-surface rounded-xl shadow-lg border ds-border-subtle overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ds-border-subtle">
                <thead className="bg-gradient-to-br from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Equipment Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Acquisition
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Phase
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Utilization
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold ds-text-primary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                  {equipment.map((eq) => (
                    <tr key={eq._id} className="hover:bg-blue-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/equipment/${eq._id}`}
                          className="text-sm font-semibold ds-text-accent-primary hover:ds-text-accent-hover transition-colors"
                        >
                          {eq.equipmentName}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-primary">
                        {eq.equipmentType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Other'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-secondary">
                        {eq.acquisitionType?.replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-secondary">
                        {eq.phaseName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-secondary">
                        {formatDate(eq.startDate)} - {eq.endDate ? formatDate(eq.endDate) : <span className="ds-text-accent-primary font-semibold">Ongoing</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold ds-text-primary">
                        {formatCurrency(eq.totalCost || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold ds-text-primary">
                            {eq.utilization?.utilizationPercentage?.toFixed(1) || 0}%
                          </span>
                          <div className="w-16 ds-bg-surface-muted rounded-full h-2">
                            <div
                              className="ds-bg-accent-primary h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, eq.utilization?.utilizationPercentage || 0)}%`
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(eq.status)}`}>
                          {eq.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/equipment/${eq._id}`}
                          className="ds-text-accent-primary hover:ds-text-accent-hover font-semibold transition-colors"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

              {/* Desktop Pagination */}
              {pagination.pages > 1 && (
                <div className="ds-bg-surface-muted px-4 sm:px-6 py-4 border-t ds-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-sm ds-text-secondary text-center sm:text-left">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} equipment
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border-2 ds-border-subtle rounded-lg ds-text-primary font-semibold hover:ds-bg-surface-muted active:ds-bg-surface-muted hover:border-ds-border-strong disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 touch-manipulation"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm ds-text-secondary font-medium flex items-center">
                      Page {pagination.page} of {pagination.pages}
                    </span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.pages}
                      className="px-4 py-2 border-2 ds-border-subtle rounded-lg ds-text-primary font-semibold hover:ds-bg-surface-muted active:ds-bg-surface-muted hover:border-ds-border-strong disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 touch-manipulation"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {equipment.map((eq) => (
                <div
                  key={eq._id}
                  className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/equipment/${eq._id}`}
                        className="text-base font-semibold ds-text-accent-primary hover:ds-text-accent-hover block truncate"
                      >
                        {eq.equipmentName}
                      </Link>
                      <p className="text-sm ds-text-secondary mt-0.5">
                        {eq.equipmentType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Other'}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-bold rounded-full flex-shrink-0 ml-2 ${getStatusColor(eq.status)}`}>
                      {eq.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b ds-border-subtle">
                    <div>
                      <p className="text-xs ds-text-muted mb-0.5">Acquisition</p>
                      <p className="text-sm font-medium ds-text-primary">
                        {eq.acquisitionType?.replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs ds-text-muted mb-0.5">Phase</p>
                      <p className="text-sm font-medium ds-text-primary truncate">
                        {eq.phaseName || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs ds-text-muted mb-0.5">Total Cost</p>
                      <p className="text-sm font-bold ds-text-primary">
                        {formatCurrency(eq.totalCost || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs ds-text-muted mb-0.5">Utilization</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold ds-text-primary">
                          {eq.utilization?.utilizationPercentage?.toFixed(1) || 0}%
                        </span>
                        <div className="flex-1 max-w-16 ds-bg-surface-muted rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, eq.utilization?.utilizationPercentage || 0)}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Period */}
                  <div className="mb-3 pb-3 border-b ds-border-subtle">
                    <p className="text-xs ds-text-muted mb-0.5">Period</p>
                    <p className="text-sm ds-text-secondary">
                      {formatDate(eq.startDate)} - {eq.endDate ? formatDate(eq.endDate) : <span className="text-blue-600 font-semibold">Ongoing</span>}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-3">
                    <Link
                      href={`/equipment/${eq._id}`}
                      className="block text-center px-4 py-2.5 bg-blue-500/10 ds-text-accent-primary text-sm font-semibold rounded-lg hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors touch-manipulation border border-blue-400/60"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              ))}

              {/* Mobile Pagination */}
              {pagination.pages > 1 && (
                <div className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle">
                  <div className="text-sm ds-text-secondary text-center mb-3">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} equipment
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="flex-1 px-4 py-2.5 border-2 ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted active:ds-bg-surface-muted ds-text-primary font-semibold transition-all duration-200 touch-manipulation"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2.5 text-sm ds-text-secondary font-medium">
                      {pagination.page} / {pagination.pages}
                    </span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.pages}
                      className="flex-1 px-4 py-2.5 border-2 ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted active:ds-bg-surface-muted ds-text-primary font-semibold transition-all duration-200 touch-manipulation"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default function EquipmentPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    }>
      <EquipmentPageContent />
    </Suspense>
  );
}

