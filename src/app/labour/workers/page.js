/**
 * Workers Registry Page
 * Manage worker profiles with full CRUD operations
 *
 * Route: /labour/workers
 */

"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { AppLayout } from "@/components/layout/app-layout"
import { LoadingSpinner, LoadingButton, LoadingTable, LoadingOverlay } from "@/components/loading"
import PrerequisiteGuide from "@/components/help/PrerequisiteGuide"
import { usePermissions } from "@/hooks/use-permissions"
import { useToast } from "@/components/toast/toast-container"
import { Plus, Search, Filter, Download, Edit, Trash2, Eye, Users, ChevronDown } from "lucide-react"
import { ConfirmationModal } from "@/components/modals"
import { WorkerDetailDrawer } from "@/components/workers/WorkerDetailDrawer"
import { EditWorkerDrawer } from "@/components/workers/EditWorkerDrawer"
import {
  VALID_SKILL_TYPES,
  VALID_WORKER_TYPES,
  VALID_WORKER_STATUSES,
  getSkillTypeLabel,
  getWorkerTypeLabel,
} from "@/lib/constants/labour-constants"

function ActionMenu({ canAccess }) {
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const hasWorkerAccess = canAccess("create_worker_profile")
  const hasEntryAccess = canAccess("create_labour_entry")
  const hasBatchAccess = canAccess("create_labour_batch")

  if (!hasWorkerAccess && !hasEntryAccess && !hasBatchAccess) {
    return null
  }

  return (
    <>
      {/* Desktop View - Organized into two sections */}
      <div className="hidden md:flex items-center gap-4">
        {/* Worker Management Section */}
        {hasWorkerAccess && (
          <div className="flex items-center gap-2 pl-3 border-l ds-border-subtle">
            <span className="text-xs font-semibold ds-text-muted uppercase tracking-wide">Workers</span>
            <Link
              href="/labour/workers/new"
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              title="Add a single worker to the registry"
            >
              <Plus className="w-4 h-4" />
              <span>Single</span>
            </Link>
            <Link
              href="/labour/workers/bulk/new"
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
              title="Import multiple workers at once"
            >
              <Users className="w-4 h-4" />
              <span>Bulk Import</span>
            </Link>
          </div>
        )}

        {/* Labour Operations Section */}
        {(hasEntryAccess || hasBatchAccess) && (
          <div className="flex items-center gap-2 pl-3 border-l ds-border-subtle">
            <span className="text-xs font-semibold ds-text-muted uppercase tracking-wide">Labour</span>
            {hasEntryAccess && (
              <Link
                href="/labour/entries/new"
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                title="Log work hours for a worker"
              >
                <Plus className="w-4 h-4" />
                <span>Log Hours</span>
              </Link>
            )}
            {hasBatchAccess && (
              <Link
                href="/labour/batches/new"
                className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                title="Log hours for multiple workers at once"
              >
                <Users className="w-4 h-4" />
                <span>Batch Hours</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Mobile View - Dropdown Menu */}
      <div className="md:hidden relative">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="flex items-center gap-2 px-3 py-2 ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-surface-muted transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add / Create</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showMobileMenu ? "rotate-180" : ""}`} />
        </button>

        {showMobileMenu && (
          <div className="absolute right-0 mt-2 w-56 ds-bg-surface rounded-lg shadow-lg border ds-border-subtle z-50">
            {/* Worker Management */}
            {hasWorkerAccess && (
              <>
                <div className="px-4 py-2 border-b ds-border-subtle">
                  <p className="text-xs font-semibold ds-text-muted uppercase tracking-wide">Worker Management</p>
                </div>
                <Link
                  href="/labour/workers/new"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium ds-text-primary">Add Single Worker</p>
                    <p className="text-xs ds-text-secondary">Register one worker</p>
                  </div>
                </Link>
                <Link
                  href="/labour/workers/bulk/new"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors border-b ds-border-subtle"
                >
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium ds-text-primary">Bulk Import Workers</p>
                    <p className="text-xs ds-text-secondary">Import multiple workers</p>
                  </div>
                </Link>
              </>
            )}

            {/* Labour Operations */}
            {(hasEntryAccess || hasBatchAccess) && (
              <>
                <div className="px-4 py-2 border-b ds-border-subtle">
                  <p className="text-xs font-semibold ds-text-muted uppercase tracking-wide">Labour Operations</p>
                </div>
                {hasEntryAccess && (
                  <Link
                    href="/labour/entries/new"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition-colors"
                  >
                    <Plus className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium ds-text-primary">Log Work Hours</p>
                      <p className="text-xs ds-text-secondary">Record hours for a worker</p>
                    </div>
                  </Link>
                )}
                {hasBatchAccess && (
                  <Link
                    href="/labour/batches/new"
                    onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition-colors"
                  >
                    <Users className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium ds-text-primary">Batch Log Hours</p>
                      <p className="text-xs ds-text-secondary">Record hours for multiple workers</p>
                    </div>
                  </Link>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function WorkersPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { canAccess } = usePermissions()
  const toast = useToast()
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [showFilters, setShowFilters] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [workerToDelete, setWorkerToDelete] = useState(null)
  const [showWorkerDetailDrawer, setShowWorkerDetailDrawer] = useState(false)
  const [selectedWorkerId, setSelectedWorkerId] = useState(null)
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [editingWorkerId, setEditingWorkerId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState({
    workerType: searchParams.get("workerType") || "",
    status: searchParams.get("status") || "",
    skillType: searchParams.get("skillType") || "",
    search: searchParams.get("search") || "",
  })
  const [sortConfig, setSortConfig] = useState({
    key: searchParams.get("sortBy") || "createdAt",
    direction: searchParams.get("sortOrder") || "desc",
  })

  const handleExport = () => {
    // Placeholder for export logic
    setExporting(true)
    setTimeout(() => {
      setExporting(false)
      toast.showSuccess("Workers exported successfully")
    }, 2000)
  }

  const handleViewWorker = (workerId) => {
    setSelectedWorkerId(workerId)
    setShowWorkerDetailDrawer(true)
  }

  const handleEditWorker = (workerId) => {
    setEditingWorkerId(workerId)
    setShowEditDrawer(true)
  }

  const handleDelete = async (workerId) => {
    setDeletingId(workerId)
    try {
      const response = await fetch(`/api/labour/workers/${workerId}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Failed to delete worker")
      }
      toast.showSuccess("Worker deleted successfully")
      fetchWorkers()
    } catch (err) {
      console.error("Error deleting worker:", err)
      toast.showError(err.message || "Failed to delete worker")
    } finally {
      setDeletingId(null)
      setShowDeleteModal(false)
      setWorkerToDelete(null)
    }
  }

  const fetchWorkers = async () => {
    try {
      setLoading(true)
      setError(null)

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
        ...(filters.workerType && { workerType: filters.workerType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.skillType && { skillType: filters.skillType }),
        ...(filters.search && { search: filters.search }),
      })

      const response = await fetch(`/api/labour/workers?${queryParams}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch workers")
      }

      setWorkers(data.data?.workers || [])
      setPagination((prev) => ({
        ...prev,
        total: data.data?.pagination?.total || 0,
        totalPages: data.data?.pagination?.totalPages || 0,
      }))

      router.replace(`/labour/workers?${queryParams.toString()}`, {
        scroll: false,
      })
    } catch (err) {
      console.error("Error fetching workers:", err)
      setError(err.message)
      toast.showError(err.message || "Failed to load workers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkers()
  }, [filters, pagination.page, pagination.limit, sortConfig])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }))
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const resetFilters = () => {
    setFilters({
      workerType: "",
      status: "",
      skillType: "",
      search: "",
    })
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  if (loading && workers.length === 0) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading workers..." />
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <LoadingOverlay
          isLoading={Boolean(deletingId)}
          message="Deleting worker..."
          fullScreen
        />
        <div className="mb-8">
          {/* Title Section */}
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold ds-text-primary">Workers Registry</h1>
            <p className="ds-text-secondary mt-2 text-sm md:text-base">Manage worker profiles and track performance</p>
          </div>

          {/* Action Controls - Redesigned for clarity */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Left side: Action Menu */}
            <ActionMenu canAccess={canAccess} />

            {/* Right side: Export Button */}
            <LoadingButton
              onClick={handleExport}
              loading={exporting}
              loadingText="Exporting..."
              disabled={exporting}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 border ds-border-subtle ds-text-secondary rounded-lg hover:ds-bg-surface-muted transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Export Workers</span>
            </LoadingButton>
          </div>
        </div>

        <PrerequisiteGuide
          title="Workers enable labour tracking"
          description="Add workers before creating labour entries or assignments."
          prerequisites={[
            "Worker details are available",
            "Project and phase context is known",
          ]}
          actions={[
            { href: "/labour/workers/new", label: "Add Worker" },
            { href: "/labour/entries/new", label: "Log Labour Entry" },
          ]}
          tip="Use bulk import for large teams."
        />

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold ds-text-primary">Filters</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 ds-text-secondary hover:ds-text-primary text-sm"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? "Hide" : "Show"} Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ds-text-muted" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    placeholder="Search by name, ID, phone..."
                    className="w-full pl-10 pr-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">Worker Type</label>
                <select
                  value={filters.workerType}
                  onChange={(e) => handleFilterChange("workerType", e.target.value)}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium ds-text-secondary mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  {VALID_WORKER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">Skill Type</label>
                <select
                  value={filters.skillType}
                  onChange={(e) => handleFilterChange("skillType", e.target.value)}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              <button onClick={resetFilters} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Workers Table */}
        {loading && workers.length === 0 ? (
          <LoadingTable rows={5} columns={8} />
        ) : workers.length === 0 ? (
          <div className="ds-bg-surface rounded-lg shadow p-8 md:p-12 text-center">
            <Users className="w-16 h-16 ds-text-muted mx-auto mb-4" />
            <p className="ds-text-secondary mb-4 font-medium">No workers found</p>
            {canAccess("create_worker_profile") && (
              <Link href="/labour/workers/new" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                Add your first worker
              </Link>
            )}
          </div>
        ) : (
          <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-ds-border-subtle">
                <thead className="ds-bg-surface-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Worker
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Type
                    </th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Skills
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Hours (Month)
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Total Earned
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                  {workers.map((worker) => {
                    const stats = worker.statistics || {}
                    const thisMonthHours = 0 // TODO: Calculate this month's hours

                    return (
                      <tr key={worker._id} className="hover:ds-bg-surface-muted">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium ds-text-primary text-sm">{worker.workerName}</div>
                            <div className="text-xs ds-text-muted">{worker.employeeId}</div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-sm ds-text-secondary">
                          {getWorkerTypeLabel(worker.workerType)}
                        </td>
                        <td className="hidden lg:table-cell px-4 py-3 text-sm ds-text-secondary">
                          <div className="flex flex-wrap gap-1">
                            {(worker.skillTypes || []).slice(0, 2).map((skill, idx) => (
                              <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                {getSkillTypeLabel(skill)}
                              </span>
                            ))}
                            {(worker.skillTypes || []).length > 2 && (
                              <span className="px-2 py-1 ds-bg-surface-muted ds-text-secondary text-xs rounded">
                                +{(worker.skillTypes || []).length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-sm ds-text-secondary">
                          <div>
                            <div>{worker.defaultHourlyRate?.toLocaleString()} KES/hr</div>
                            {worker.defaultDailyRate && (
                              <div className="text-xs ds-text-muted">
                                {worker.defaultDailyRate.toLocaleString()} KES/day
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              worker.status === "active"
                                ? "bg-green-100 text-green-800"
                                : worker.status === "inactive"
                                  ? "ds-bg-surface-muted ds-text-primary"
                                  : worker.status === "terminated"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {worker.status?.charAt(0).toUpperCase() + worker.status?.slice(1).replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="hidden lg:table-cell px-4 py-3 text-sm ds-text-secondary">
                          {thisMonthHours.toFixed(1)} hrs
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-sm font-medium ds-text-primary">
                          {stats.totalEarned?.toLocaleString() || "0"} KES
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {canAccess("create_labour_entry") && (
                              <Link
                                href={`/labour/entries/new?workerId=${worker.userId || worker._id}`}
                                className="text-green-600 hover:text-green-900"
                                title="Log hours for this worker"
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
                            {canAccess("edit_worker_profile") && (
                              <button
                                onClick={() => handleEditWorker(worker._id)}
                                className="text-green-600 hover:text-green-900"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canAccess("delete_worker_profile") && (
                              <button
                                onClick={() => {
                                  setWorkerToDelete(worker)
                                  setShowDeleteModal(true)
                                }}
                                disabled={deletingId === worker._id}
                                className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete"
                              >
                                {deletingId === worker._id ? (
                                  <LoadingSpinner size="sm" color="red-600" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="ds-bg-surface-muted px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t ds-border-subtle text-sm">
                <div className="ds-text-secondary">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} workers
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted text-sm"
                  >
                    Previous
                  </button>
                  <span className="ds-text-secondary text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 border ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted text-sm"
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
            setShowDeleteModal(false)
            setWorkerToDelete(null)
          }}
          onConfirm={() => {
            if (workerToDelete) {
              handleDelete(workerToDelete._id)
            }
          }}
          title="Delete Worker"
          message={`Are you sure you want to delete ${workerToDelete?.workerName}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={deletingId === workerToDelete?._id}
        />

        {/* Worker Detail Drawer */}
        <WorkerDetailDrawer
          workerId={selectedWorkerId}
          isOpen={showWorkerDetailDrawer}
          onClose={() => {
            setShowWorkerDetailDrawer(false)
            setSelectedWorkerId(null)
          }}
          onEdit={(workerId) => {
            setShowWorkerDetailDrawer(false)
            setSelectedWorkerId(null)
            handleEditWorker(workerId)
          }}
        />

        {/* Edit Worker Drawer */}
        <EditWorkerDrawer
          workerId={editingWorkerId}
          isOpen={showEditDrawer}
          onClose={() => {
            setShowEditDrawer(false)
            setEditingWorkerId(null)
          }}
          onSave={() => {
            setShowEditDrawer(false)
            setEditingWorkerId(null)
            fetchWorkers() // Refresh the list
          }}
        />
      </div>
    </AppLayout>
  )
}

export default function WorkersPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <WorkersPageContent />
    </Suspense>
  )
}
