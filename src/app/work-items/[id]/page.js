/**
 * Work Item Detail Page
 * Displays work item details, tracking, and allows editing
 * 
 * Route: /work-items/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import { WORK_ITEM_STATUSES, WORK_ITEM_CATEGORIES, WORK_ITEM_PRIORITIES, getStatusColor, getPriorityColor, getPriorityLabel } from '@/lib/constants/work-item-constants';

export default function WorkItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const { canAccess, user } = usePermissions();
  const [workItem, setWorkItem] = useState(null);
  const [phase, setPhase] = useState(null);
  const [project, setProject] = useState(null);
  const [dependencies, setDependencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    status: 'not_started',
    estimatedHours: '',
    actualHours: '',
    estimatedCost: '',
    actualCost: '',
    startDate: '',
    plannedEndDate: '',
    priority: 3,
    notes: ''
  });

  useEffect(() => {
    fetchWorkItem();
  }, [params.id]);

  useEffect(() => {
    if (user) {
      const role = user.role?.toLowerCase();
      setCanEdit(['owner', 'pm', 'project_manager'].includes(role));
      setCanDelete(role === 'owner');
    }
  }, [user]);

  const fetchWorkItem = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/work-items/${params.id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch work item');
      }

      setWorkItem(data.data);
      
      // Populate form data
      setFormData({
        name: data.data.name || '',
        description: data.data.description || '',
        category: data.data.category || '',
        status: data.data.status || 'not_started',
        estimatedHours: data.data.estimatedHours || '',
        actualHours: data.data.actualHours || '',
        estimatedCost: data.data.estimatedCost || '',
        actualCost: data.data.actualCost || '',
        startDate: data.data.startDate ? new Date(data.data.startDate).toISOString().split('T')[0] : '',
        plannedEndDate: data.data.plannedEndDate ? new Date(data.data.plannedEndDate).toISOString().split('T')[0] : '',
        priority: data.data.priority || 3,
        notes: data.data.notes || ''
      });
      
      // Fetch phase
      if (data.data.phaseId) {
        const phaseResponse = await fetch(`/api/phases/${data.data.phaseId}`);
        const phaseData = await phaseResponse.json();
        if (phaseData.success) {
          setPhase(phaseData.data);
          
          // Fetch project
          if (phaseData.data.projectId) {
            const projectResponse = await fetch(`/api/projects/${phaseData.data.projectId}`);
            const projectData = await projectResponse.json();
            if (projectData.success) {
              setProject(projectData.data);
            }
          }
        }
      }

      // Fetch dependencies
      if (data.data.dependencies && data.data.dependencies.length > 0) {
        const depIds = data.data.dependencies.map(id => id.toString()).join(',');
        const depResponse = await fetch(`/api/work-items?${data.data.dependencies.map((id, idx) => `_id=${id}`).join('&')}`);
        // Actually, we need to fetch each dependency individually or use a different approach
        // For now, we'll just store the IDs
        setDependencies(data.data.dependencies);
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch work item error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/work-items/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : 0,
          actualHours: formData.actualHours ? parseFloat(formData.actualHours) : 0,
          estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : 0,
          actualCost: formData.actualCost ? parseFloat(formData.actualCost) : 0,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update work item');
      }

      toast.showSuccess('Work item updated successfully');
      setShowEditModal(false);
      fetchWorkItem();
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to update work item');
      console.error('Update work item error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/work-items/${params.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete work item');
      }

      toast.showSuccess('Work item deleted successfully');
      router.push('/work-items');
    } catch (err) {
      toast.showError(err.message || 'Failed to delete work item');
      console.error('Delete work item error:', err);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
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
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  if (error || !workItem) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Work item not found'}
          </div>
          <Link href="/work-items" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Work Items
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/work-items" className="text-blue-600 hover:text-blue-800 mb-4 inline-block font-medium">
            ← Back to Work Items
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{workItem.name}</h1>
              <p className="text-gray-600 mt-1">
                {workItem.category?.replace(/\b\w/g, l => l.toUpperCase()) || 'Work Item'}
              </p>
              {project && phase && (
                <div className="mt-2 space-x-4 text-sm">
                  <Link 
                    href={`/projects/${project._id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Project: {project.projectName}
                  </Link>
                  <span className="text-gray-400">•</span>
                  <Link 
                    href={`/phases/${phase._id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Phase: {phase.phaseName}
                  </Link>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-2.5 rounded-lg hover:from-red-700 hover:to-red-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Information Card */}
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 rounded-xl border-2 border-blue-200 p-4 sm:p-5 mb-6 shadow-lg transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm sm:text-base font-bold text-gray-900">Work Item Details</h3>
                <button
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-white/80 hover:bg-white border border-blue-300 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label={isInfoExpanded ? 'Collapse information' : 'Expand information'}
                  aria-expanded={isInfoExpanded}
                >
                  <svg 
                    className={`w-4 h-4 sm:w-5 sm:h-5 text-blue-600 transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {isInfoExpanded ? (
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed mt-1 animate-fadeIn">
                  This work item represents a specific task in your construction phase. Track its progress, time spent, costs incurred, and ensure dependencies are met before starting.
                </p>
              ) : (
                <p className="text-xs text-gray-500 italic mt-1 animate-fadeIn">
                  Click to expand
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-200">
            <p className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Status</p>
            <span className={`inline-block px-4 py-2 text-sm font-bold rounded-full mb-4 ${getStatusColor(workItem.status)}`}>
              {workItem.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
            </span>
            <p className="text-sm font-semibold text-gray-600 mt-6 mb-2 uppercase tracking-wide">Priority</p>
            <span className={`inline-block px-4 py-2 text-sm font-bold rounded-full ${getPriorityColor(workItem.priority || 3)}`}>
              {getPriorityLabel(workItem.priority || 3)}
            </span>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border border-blue-200 p-6 hover:shadow-xl transition-shadow duration-200">
            <p className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Estimated Hours</p>
            <p className="text-3xl font-bold text-blue-700 mb-4">
              {workItem.estimatedHours || 0}<span className="text-base font-normal text-blue-600">h</span>
            </p>
            <p className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Actual Hours</p>
            <p className="text-2xl font-bold text-blue-600">
              {workItem.actualHours || 0}<span className="text-base font-normal text-blue-500">h</span>
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg border border-green-200 p-6 hover:shadow-xl transition-shadow duration-200">
            <p className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Estimated Cost</p>
            <p className="text-2xl font-bold text-green-700 mb-4">
              {formatCurrency(workItem.estimatedCost || 0)}
            </p>
            <p className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Actual Cost</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(workItem.actualCost || 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-200">
            <p className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Schedule</p>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">
                <span className="font-semibold">Start:</span> {formatDate(workItem.startDate)}
              </p>
              {workItem.plannedEndDate && (
                <p className="text-sm font-medium text-gray-900">
                  <span className="font-semibold">Planned:</span> {formatDate(workItem.plannedEndDate)}
                </p>
              )}
              {workItem.actualEndDate && (
                <p className="text-sm font-semibold text-blue-600">
                  <span className="font-bold">Actual:</span> {formatDate(workItem.actualEndDate)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {workItem.description && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Description
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-900 whitespace-pre-wrap font-medium leading-relaxed">{workItem.description}</p>
            </div>
          </div>
        )}

        {/* Dependencies */}
        {workItem.dependencies && workItem.dependencies.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Dependencies
            </h2>
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <p className="text-sm font-medium text-gray-900">
                This work item depends on <span className="font-bold text-yellow-700">{workItem.dependencies.length}</span> other work item(s).
              </p>
            </div>
          </div>
        )}

        {/* Notes */}
        {workItem.notes && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Notes
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-900 whitespace-pre-wrap font-medium leading-relaxed">{workItem.notes}</p>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && canEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
              <div className="p-8">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Work Item
                  </h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handleEditSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Work Item Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Description <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      placeholder="Describe the work item..."
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all duration-200 font-medium resize-y"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Category <span className="text-red-600">*</span>
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                      >
                        <option value="" className="text-gray-500">Select Category</option>
                        {WORK_ITEM_CATEGORIES.map((category) => (
                          <option key={category} value={category} className="text-gray-900">
                            {category.replace(/\b\w/g, l => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Priority
                      </label>
                      <select
                        name="priority"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                      >
                        {WORK_ITEM_PRIORITIES.map((priority) => (
                          <option key={priority} value={priority} className="text-gray-900">
                            {priority} - {priority === 1 ? 'Critical' : priority === 2 ? 'High' : priority === 3 ? 'Medium' : priority === 4 ? 'Low' : 'Very Low'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Estimated Hours <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">hrs</span>
                        <input
                          type="number"
                          name="estimatedHours"
                          value={formData.estimatedHours}
                          onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                          min="0"
                          step="0.1"
                          className="w-full px-4 pr-16 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Actual Hours <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">hrs</span>
                        <input
                          type="number"
                          name="actualHours"
                          value={formData.actualHours}
                          onChange={(e) => setFormData({ ...formData, actualHours: e.target.value })}
                          min="0"
                          step="0.1"
                          className="w-full px-4 pr-16 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Estimated Cost (KES) <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">KES</span>
                        <input
                          type="number"
                          name="estimatedCost"
                          value={formData.estimatedCost}
                          onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                          min="0"
                          step="0.01"
                          className="w-full pl-12 pr-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Actual Cost (KES) <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">KES</span>
                        <input
                          type="number"
                          name="actualCost"
                          value={formData.actualCost}
                          onChange={(e) => setFormData({ ...formData, actualCost: e.target.value })}
                          min="0"
                          step="0.01"
                          className="w-full pl-12 pr-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Start Date <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Planned End Date <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                      </label>
                      <input
                        type="date"
                        name="plannedEndDate"
                        value={formData.plannedEndDate}
                        onChange={(e) => setFormData({ ...formData, plannedEndDate: e.target.value })}
                        min={formData.startDate}
                        className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                    >
                      {WORK_ITEM_STATUSES.map((status) => (
                        <option key={status} value={status} className="text-gray-900">
                          {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Notes <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={4}
                      placeholder="Additional notes about this work item..."
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all duration-200 font-medium resize-y"
                    />
                  </div>

                  <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      type="submit"
                      loading={saving}
                      className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </LoadingButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Work Item"
          message={`Are you sure you want to delete "${workItem.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmColor="red"
          isLoading={deleting}
        />
      </div>
    </AppLayout>
  );
}

