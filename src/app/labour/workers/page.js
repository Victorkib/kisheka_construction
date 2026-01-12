/**
 * Workers Registry Page
 * Manage worker profiles with full CRUD operations
 * 
 * Route: /labour/workers
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton, LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { 
  Plus, Search, Filter, Download, Edit, Trash2, Eye, 
  Users, Clock, DollarSign, CheckCircle, XCircle, 
  Phone, Mail, Calendar, Briefcase, User, FileText
} from 'lucide-react';
import { ConfirmationModal } from '@/components/modals';
import { 
  VALID_SKILL_TYPES, 
  VALID_WORKER_TYPES,
  VALID_EMPLOYMENT_TYPES,
  VALID_WORKER_STATUSES,
  getSkillTypeLabel, 
  getWorkerTypeLabel 
} from '@/lib/constants/labour-constants';

function WorkersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState(null);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    workerType: searchParams.get('workerType') || '',
    status: searchParams.get('status') || '',
    skillType: searchParams.get('skillType') || '',
    search: searchParams.get('search') || '',
  });

  // Fetch workers
  useEffect(() => {
    fetchWorkers();
  }, [filters, pagination.page, pagination.limit]);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.workerType && { workerType: filters.workerType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.skillType && { skillType: filters.skillType }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/labour/workers?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch workers');
      }

      setWorkers(data.data?.workers || []);
      setPagination(prev => ({
        ...prev,
        total: data.data?.pagination?.total || 0,
        totalPages: data.data?.pagination?.totalPages || 0,
      }));

      // Update URL
      router.replace(`/labour/workers?${queryParams.toString()}`, { scroll: false });
    } catch (err) {
      console.error('Error fetching workers:', err);
      setError(err.message);
      toast.showError('Failed to load workers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (workerId) => {
    setDeletingId(workerId);
    try {
      const response = await fetch(`/api/labour/workers/${workerId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete worker');
      }

      toast.showSuccess('Worker deleted successfully');
      fetchWorkers();
      setShowDeleteModal(false);
      setWorkerToDelete(null);
    } catch (err) {
      console.error('Error deleting worker:', err);
      toast.showError(err.message || 'Failed to delete worker');
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewWorker = async (workerId) => {
    try {
      const response = await fetch(`/api/labour/workers/${workerId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch worker details');
      }

      setSelectedWorker(data.data);
      setShowWorkerModal(true);
    } catch (err) {
      console.error('Error fetching worker:', err);
      toast.showError('Failed to load worker details');
    }
  };

  const handleEditWorker = async (workerId) => {
    try {
      const response = await fetch(`/api/labour/workers/${workerId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch worker details');
      }

      setEditingWorker(data.data);
      setShowEditModal(true);
    } catch (err) {
      console.error('Error fetching worker:', err);
      toast.showError('Failed to load worker details');
    }
  };

  const handleExport = async () => {
    try {
      // Build export query
      const queryParams = new URLSearchParams({
        limit: '10000', // Get all for export
        ...(filters.workerType && { workerType: filters.workerType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.skillType && { skillType: filters.skillType }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/labour/workers?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch workers for export');
      }

      const workersData = data.data?.workers || [];

      // Convert to CSV
      const headers = [
        'Employee ID',
        'Name',
        'Type',
        'Status',
        'Skills',
        'Hourly Rate',
        'Daily Rate',
        'Employment Type',
        'Phone',
        'Email',
        'Total Hours',
        'Total Earned',
        'Average Rating',
      ];

      const rows = workersData.map((worker) => [
        worker.employeeId || '',
        worker.workerName || '',
        getWorkerTypeLabel(worker.workerType) || '',
        worker.status || '',
        (worker.skillTypes || []).join(', '),
        worker.defaultHourlyRate || 0,
        worker.defaultDailyRate || '',
        worker.employmentType || '',
        worker.phoneNumber || '',
        worker.email || '',
        worker.statistics?.totalHoursWorked || 0,
        worker.statistics?.totalEarned || 0,
        worker.statistics?.averageRating?.toFixed(2) || 0,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `workers_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.showSuccess('Workers exported successfully');
    } catch (err) {
      console.error('Error exporting workers:', err);
      toast.showError('Failed to export workers');
    }
  };

  const resetFilters = () => {
    setFilters({
      workerType: '',
      status: '',
      skillType: '',
      search: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  if (loading && workers.length === 0) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading workers..." />
          </div>
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
            <h1 className="text-3xl font-bold text-gray-900">Workers Registry</h1>
            <p className="text-gray-600 mt-1">Manage worker profiles and track performance</p>
          </div>
          <div className="flex items-center gap-3">
            {canAccess('create_labour_entry') && (
              <Link
                href="/labour/entries/new"
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Entry
              </Link>
            )}
            {canAccess('create_labour_batch') && (
              <Link
                href="/labour/batches/new"
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Users className="w-5 h-5" />
                Bulk Entry
              </Link>
            )}
            {canAccess('create_worker_profile') && (
              <>
                <Link
                  href="/labour/workers/new"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Worker
                </Link>
                <Link
                  href="/labour/workers/bulk/new"
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Users className="w-5 h-5" />
                  Bulk Create
                </Link>
              </>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, search: e.target.value }));
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    placeholder="Search by name, ID, phone..."
                    className="w-full pl-10 pr-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Worker Type</label>
                <select
                  value={filters.workerType}
                  onChange={(e) => {
                    setFilters(prev => ({ ...prev, workerType: e.target.value }));
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  {VALID_WORKER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {getWorkerTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => {
                    setFilters(prev => ({ ...prev, status: e.target.value }));
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  {VALID_WORKER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skill Type</label>
                <select
                  value={filters.skillType}
                  onChange={(e) => {
                    setFilters(prev => ({ ...prev, skillType: e.target.value }));
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Skills</option>
                  {VALID_SKILL_TYPES.map((skill) => (
                    <option key={skill} value={skill}>
                      {getSkillTypeLabel(skill)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(filters.workerType || filters.status || filters.skillType || filters.search) && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={resetFilters}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Workers Table */}
        {loading && workers.length === 0 ? (
          <LoadingTable rows={5} columns={8} />
        ) : workers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No workers found</p>
            {canAccess('create_worker_profile') && (
              <Link
                href="/labour/workers/new"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Add your first worker
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Worker
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Skills
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hours (Month)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Earned
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workers.map((worker) => {
                    const stats = worker.statistics || {};
                    const thisMonthHours = 0; // TODO: Calculate this month's hours
                    
                    return (
                      <tr key={worker._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-gray-900">{worker.workerName}</div>
                            <div className="text-sm text-gray-500">{worker.employeeId}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {getWorkerTypeLabel(worker.workerType)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className="flex flex-wrap gap-1">
                            {(worker.skillTypes || []).slice(0, 2).map((skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                              >
                                {getSkillTypeLabel(skill)}
                              </span>
                            ))}
                            {(worker.skillTypes || []).length > 2 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                +{(worker.skillTypes || []).length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div>
                            {worker.defaultHourlyRate?.toLocaleString()} KES/hr
                            {worker.defaultDailyRate && (
                              <div className="text-xs text-gray-500">
                                {worker.defaultDailyRate.toLocaleString()} KES/day
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              worker.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : worker.status === 'inactive'
                                ? 'bg-gray-100 text-gray-800'
                                : worker.status === 'terminated'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {worker.status?.charAt(0).toUpperCase() + worker.status?.slice(1).replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {thisMonthHours.toFixed(1)} hrs
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {stats.totalEarned?.toLocaleString() || '0'} KES
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {canAccess('create_labour_entry') && (
                              <Link
                                href={`/labour/entries/new?workerId=${worker.userId || worker._id}`}
                                className="text-green-600 hover:text-green-900"
                                title="Create Entry for this Worker"
                              >
                                <Plus className="w-4 h-4" />
                              </Link>
                            )}
                            <button
                              onClick={() => handleViewWorker(worker._id)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canAccess('edit_worker_profile') && (
                              <button
                                onClick={() => handleEditWorker(worker._id)}
                                className="text-green-600 hover:text-green-900"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canAccess('delete_worker_profile') && (
                              <button
                                onClick={() => {
                                  setWorkerToDelete(worker);
                                  setShowDeleteModal(true);
                                }}
                                className="text-red-600 hover:text-red-900"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} workers
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setWorkerToDelete(null);
          }}
          onConfirm={() => {
            if (workerToDelete) {
              handleDelete(workerToDelete._id);
            }
          }}
          title="Delete Worker"
          message={`Are you sure you want to delete ${workerToDelete?.workerName}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={deletingId === workerToDelete?._id}
        />

        {/* Worker Detail Modal */}
        {showWorkerModal && selectedWorker && (
          <WorkerDetailModal
            worker={selectedWorker}
            onClose={() => {
              setShowWorkerModal(false);
              setSelectedWorker(null);
            }}
            onEdit={() => {
              setShowWorkerModal(false);
              handleEditWorker(selectedWorker._id);
            }}
          />
        )}

        {/* Edit Worker Modal */}
        {showEditModal && editingWorker && (
          <EditWorkerModal
            worker={editingWorker}
            onClose={() => {
              setShowEditModal(false);
              setEditingWorker(null);
            }}
            onSave={() => {
              setShowEditModal(false);
              setEditingWorker(null);
              fetchWorkers();
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

// Worker Detail Modal Component
function WorkerDetailModal({ worker, onClose, onEdit }) {
  const { canAccess } = usePermissions();
  const stats = worker.statistics || {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Worker Details</h2>
          <div className="flex items-center gap-2">
            {canAccess('edit_worker_profile') && (
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Edit className="w-4 h-4 inline mr-2" />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Action Buttons */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            {canAccess('create_labour_entry') && (
              <>
                <Link
                  href={`/labour/entries/new?workerId=${worker.userId || worker._id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Entry
                </Link>
                <Link
                  href={`/labour/batches/new?workerId=${worker.userId || worker._id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  <FileText className="w-4 h-4" />
                  Add to Bulk Entry
                </Link>
              </>
            )}
            <Link
              href={`/labour/entries?workerId=${worker.userId || worker._id}`}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <Eye className="w-4 h-4" />
              View All Entries
            </Link>
          </div>

          {/* Basic Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <p className="text-gray-900">{worker.workerName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Employee ID</label>
                <p className="text-gray-900">{worker.employeeId}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Worker Type</label>
                <p className="text-gray-900">{getWorkerTypeLabel(worker.workerType)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <span
                  className={`inline-block px-2 py-1 text-xs rounded-full ${
                    worker.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : worker.status === 'inactive'
                      ? 'bg-gray-100 text-gray-800'
                      : worker.status === 'terminated'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {worker.status?.charAt(0).toUpperCase() + worker.status?.slice(1).replace(/_/g, ' ')}
                </span>
              </div>
              {worker.phoneNumber && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <p className="text-gray-900">{worker.phoneNumber}</p>
                </div>
              )}
              {worker.email && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <p className="text-gray-900">{worker.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Skills & Rates */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills & Rates</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Skills</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(worker.skillTypes || []).map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                    >
                      {getSkillTypeLabel(skill)}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Hourly Rate</label>
                <p className="text-gray-900">{worker.defaultHourlyRate?.toLocaleString()} KES/hr</p>
              </div>
              {worker.defaultDailyRate && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Daily Rate</label>
                  <p className="text-gray-900">{worker.defaultDailyRate.toLocaleString()} KES/day</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Employment Type</label>
                <p className="text-gray-900">
                  {worker.employmentType?.charAt(0).toUpperCase() + worker.employmentType?.slice(1).replace(/_/g, ' ')}
                </p>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Total Hours</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.totalHoursWorked?.toFixed(1) || '0'}
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Total Earned</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {stats.totalEarned?.toLocaleString() || '0'} KES
                </div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Entries</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.entryCount || '0'}
                </div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-700">Rating</span>
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.averageRating?.toFixed(1) || '0'}/5
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Edit Worker Modal Component
function EditWorkerModal({ worker, onClose, onSave }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    workerName: worker.workerName || '',
    employeeId: worker.employeeId || '',
    workerType: worker.workerType || 'internal',
    phoneNumber: worker.phoneNumber || '',
    email: worker.email || '',
    skillTypes: worker.skillTypes || [],
    defaultHourlyRate: worker.defaultHourlyRate || 0,
    defaultDailyRate: worker.defaultDailyRate || '',
    employmentType: worker.employmentType || 'casual',
    status: worker.status || 'active',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/labour/workers/${worker._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update worker');
      }

      toast.showSuccess('Worker updated successfully');
      onSave();
    } catch (err) {
      console.error('Error updating worker:', err);
      toast.showError(err.message || 'Failed to update worker');
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skillTypes: prev.skillTypes.includes(skill)
        ? prev.skillTypes.filter(s => s !== skill)
        : [...prev.skillTypes, skill],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Edit Worker</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Worker Name *
              </label>
              <input
                type="text"
                value={formData.workerName}
                onChange={(e) => setFormData(prev => ({ ...prev, workerName: e.target.value }))}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee ID *
              </label>
              <input
                type="text"
                value={formData.employeeId}
                onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Worker Type *
              </label>
              <select
                value={formData.workerType}
                onChange={(e) => setFormData(prev => ({ ...prev, workerType: e.target.value }))}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {VALID_WORKER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {getWorkerTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {VALID_WORKER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hourly Rate (KES) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.defaultHourlyRate}
                onChange={(e) => setFormData(prev => ({ ...prev, defaultHourlyRate: parseFloat(e.target.value) || 0 }))}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Daily Rate (KES)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.defaultDailyRate}
                onChange={(e) => setFormData(prev => ({ ...prev, defaultDailyRate: e.target.value ? parseFloat(e.target.value) : '' }))}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employment Type *
              </label>
              <select
                value={formData.employmentType}
                onChange={(e) => setFormData(prev => ({ ...prev, employmentType: e.target.value }))}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {VALID_EMPLOYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Skills
            </label>
            <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {VALID_SKILL_TYPES.map((skill) => (
                  <label key={skill} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.skillTypes.includes(skill)}
                      onChange={() => toggleSkill(skill)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{getSkillTypeLabel(skill)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkersPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        </div>
      </AppLayout>
    }>
      <WorkersPageContent />
    </Suspense>
  );
}
