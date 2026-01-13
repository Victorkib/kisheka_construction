/**
 * Labour Entries List Page
 * Displays all labour entries with filtering, sorting, and pagination
 * 
 * Route: /labour/entries
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingSelect, LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { Plus, Search, Filter, Download, Edit, Trash2, CheckCircle, XCircle, Eye, Calendar, Clock, DollarSign, Users } from 'lucide-react';
import { ConfirmationModal } from '@/components/modals';

function LabourEntriesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [summary, setSummary] = useState({ totalHours: 0, totalCost: 0, entryCount: 0 });
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [workItems, setWorkItems] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [loadingWorkItems, setLoadingWorkItems] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || '',
    phaseId: searchParams.get('phaseId') || '',
    floorId: searchParams.get('floorId') || '',
    workerId: searchParams.get('workerId') || '',
    batchId: searchParams.get('batchId') || '',
    workItemId: searchParams.get('workItemId') || '',
    status: searchParams.get('status') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    search: searchParams.get('search') || '',
  });

  // Sort config
  const [sortConfig, setSortConfig] = useState({
    key: searchParams.get('sortBy') || 'entryDate',
    direction: searchParams.get('sortOrder') || 'desc',
  });

  // Fetch projects and workers for filters
  useEffect(() => {
    fetchProjects();
    fetchWorkers();
  }, []);

  // Fetch phases when project changes
  useEffect(() => {
    if (filters.projectId) {
      fetchPhases(filters.projectId);
    } else {
      setPhases([]);
      setWorkItems([]);
    }
  }, [filters.projectId]);

  // Fetch work items when phase changes
  useEffect(() => {
    if (filters.phaseId && filters.projectId) {
      fetchWorkItems(filters.projectId, filters.phaseId);
    } else {
      setWorkItems([]);
    }
  }, [filters.phaseId, filters.projectId]);

  // Fetch entries when filters or pagination changes
  useEffect(() => {
    fetchEntries();
  }, [filters, pagination.page, pagination.limit, sortConfig]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/projects/accessible');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchPhases = async (projectId) => {
    if (!projectId) return;
    setLoadingPhases(true);
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    } finally {
      setLoadingPhases(false);
    }
  };

  const fetchWorkers = async () => {
    setLoadingWorkers(true);
    try {
      const response = await fetch('/api/labour/workers?status=active&limit=100');
      const data = await response.json();
      if (data.success) {
        setWorkers(data.data?.workers || []);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    } finally {
      setLoadingWorkers(false);
    }
  };

  const fetchWorkItems = async (projectId, phaseId) => {
    if (!projectId || !phaseId) return;
    setLoadingWorkItems(true);
    try {
      const response = await fetch(`/api/work-items?projectId=${projectId}&phaseId=${phaseId}`);
      const data = await response.json();
      if (data.success) {
        setWorkItems(data.data?.workItems || data.data || []);
      }
    } catch (err) {
      console.error('Error fetching work items:', err);
      setWorkItems([]);
    } finally {
      setLoadingWorkItems(false);
    }
  };

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.phaseId && { phaseId: filters.phaseId }),
        ...(filters.floorId && { floorId: filters.floorId }),
        ...(filters.workerId && { workerId: filters.workerId }),
        ...(filters.batchId && { batchId: filters.batchId }),
        ...(filters.workItemId && { workItemId: filters.workItemId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/labour/entries?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch labour entries');
      }

      setEntries(data.data?.entries || []);
      setPagination(prev => ({
        ...prev,
        total: data.data?.pagination?.total || 0,
        totalPages: data.data?.pagination?.totalPages || 0,
      }));
      setSummary(data.data?.summary || { totalHours: 0, totalCost: 0, entryCount: 0 });

      // Update URL with current filters
      const newParams = new URLSearchParams(queryParams);
      router.replace(`/labour/entries?${newParams.toString()}`, { scroll: false });
    } catch (err) {
      console.error('Error fetching entries:', err);
      setError(err.message);
      toast.showError(err.message || 'Failed to load labour entries');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit, sortConfig, router, toast]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      projectId: currentProject?._id || '',
      phaseId: '',
      floorId: '',
      workerId: '',
      batchId: '',
      workItemId: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      search: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleDelete = async (entryId) => {
    setDeletingId(entryId);
    try {
      const response = await fetch(`/api/labour/entries/${entryId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete entry');
      }

      toast.showSuccess('Labour entry deleted successfully');
      fetchEntries();
    } catch (err) {
      console.error('Error deleting entry:', err);
      toast.showError(err.message || 'Failed to delete entry');
    } finally {
      setDeletingId(null);
      setShowDeleteModal(false);
      setEntryToDelete(null);
    }
  };

  const handleApprove = async (entryId) => {
    setApprovingId(entryId);
    try {
      const response = await fetch(`/api/labour/entries/${entryId}/approve`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve entry');
      }

      toast.showSuccess('Labour entry approved successfully');
      fetchEntries();
    } catch (err) {
      console.error('Error approving entry:', err);
      toast.showError(err.message || 'Failed to approve entry');
    } finally {
      setApprovingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'bg-gray-100 text-gray-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-600',
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badges[status] || badges.draft}`}>
        {status?.replace(/_/g, ' ').toUpperCase()}
      </span>
    );
  };

  const canEdit = canAccess('edit_labour_entry');
  const canDelete = canAccess('delete_labour_entry');
  const canApprove = canAccess('approve_labour_entry');

  if (loading && entries.length === 0) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Labour Entries</h1>
            <p className="text-gray-600 mt-1">View and manage all labour entries</p>
          </div>
          <Link
            href="/labour/entries/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Entry
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Total Hours</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.totalHours.toFixed(1)} hrs
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Total Cost</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.totalCost.toLocaleString()} KES
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">Total Entries</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.entryCount}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
            >
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filters</span>
              {showFilters ? '▼' : '▶'}
            </button>
          </div>

          {showFilters && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <LoadingSelect
                  value={filters.projectId}
                  onChange={(e) => handleFilterChange('projectId', e.target.value)}
                  loading={loadingProjects}
                  loadingText="Loading projects..."
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Projects</option>
                  {projects.map((project) => (
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
                  onChange={(e) => handleFilterChange('phaseId', e.target.value)}
                  loading={loadingPhases}
                  loadingText="Loading phases..."
                  disabled={!filters.projectId}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Work Item</label>
                <LoadingSelect
                  value={filters.workItemId}
                  onChange={(e) => handleFilterChange('workItemId', e.target.value)}
                  loading={loadingWorkItems}
                  loadingText="Loading work items..."
                  disabled={!filters.phaseId}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Work Items</option>
                  {workItems.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name} ({item.category || 'Other'})
                    </option>
                  ))}
                </LoadingSelect>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Worker</label>
                <LoadingSelect
                  value={filters.workerId}
                  onChange={(e) => handleFilterChange('workerId', e.target.value)}
                  loading={loadingWorkers}
                  loadingText="Loading workers..."
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Workers</option>
                  {workers.map((worker) => (
                    <option key={worker._id} value={worker._id}>
                      {worker.workerName}
                    </option>
                  ))}
                </LoadingSelect>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Search by worker name, skill type..."
                    className="w-full pl-10 pr-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="w-full px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Entries Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {entries.length === 0 && !loading ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No labour entries found</p>
              <Link
                href="/labour/entries/new"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Create your first entry →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('entryDate')}>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Date
                        {sortConfig.key === 'entryDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('workerName')}>
                      <div className="flex items-center gap-1">
                        Worker
                        {sortConfig.key === 'workerName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Skill Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Work Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('totalHours')}>
                      <div className="flex items-center gap-1">
                        Hours
                        {sortConfig.key === 'totalHours' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('totalCost')}>
                      <div className="flex items-center gap-1">
                        Cost
                        {sortConfig.key === 'totalCost' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {entries.map((entry) => (
                    <tr key={entry._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {new Date(entry.entryDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{entry.workerName}</div>
                        {entry.workerType && (
                          <div className="text-xs text-gray-500 capitalize">{entry.workerType}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {entry.skillType?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {entry.batchId ? (
                          <Link
                            href={`/labour/batches/${entry.batchId}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {entry.batchNumber || 'View Batch'}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {entry.workItemId && entry.workItemName ? (
                          <Link
                            href={`/work-items/${entry.workItemId}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                            title={entry.workItemCategory || 'Work Item'}
                          >
                            {entry.workItemName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {entry.totalHours?.toFixed(1)} hrs
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {entry.totalCost?.toLocaleString()} KES
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getStatusBadge(entry.status)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/labour/entries/${entry._id}`}
                            className="text-blue-600 hover:text-blue-800"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {canEdit && entry.status === 'draft' && (
                            <Link
                              href={`/labour/entries/${entry._id}`}
                              className="text-gray-600 hover:text-gray-800"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                          )}
                          {canApprove && entry.status === 'pending_approval' && (
                            <button
                              onClick={() => handleApprove(entry._id)}
                              disabled={approvingId === entry._id}
                              className="text-green-600 hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Approve"
                            >
                              {approvingId === entry._id ? (
                                <LoadingSpinner size="sm" color="green-600" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {canDelete && (entry.status === 'draft' || entry.status === 'rejected') && (
                            <button
                              onClick={() => {
                                setEntryToDelete(entry);
                                setShowDeleteModal(true);
                              }}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete"
                              disabled={deletingId === entry._id}
                            >
                              {deletingId === entry._id ? (
                                <LoadingSpinner size="sm" color="red-600" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setEntryToDelete(null);
        }}
        onConfirm={() => entryToDelete && handleDelete(entryToDelete._id)}
        title="Delete Labour Entry"
        message={`Are you sure you want to delete the labour entry for ${entryToDelete?.workerName}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deletingId === entryToDelete?._id}
      />
    </AppLayout>
  );
}

export default function LabourEntriesPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    }>
      <LabourEntriesPageContent />
    </Suspense>
  );
}

