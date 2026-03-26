/**
 * Phase Detail Page
 * Displays phase details, financial summary, and allows editing
 * 
 * Route: /phases/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { PhaseTabNavigation } from '@/components/phases/PhaseTabNavigation';
import { OverviewTab } from '@/components/phases/tabs/OverviewTab';
import { FinancialsTab } from '@/components/phases/tabs/FinancialsTab';
import { MaterialsTab } from '@/components/phases/tabs/MaterialsTab';
import { ExpensesTab } from '@/components/phases/tabs/ExpensesTab';
import { ResourcesTab } from '@/components/phases/tabs/ResourcesTab';
import { MilestonesTab } from '@/components/phases/tabs/MilestonesTab';
import { DocumentsTab } from '@/components/phases/tabs/DocumentsTab';
import { ReportsTab } from '@/components/phases/tabs/ReportsTab';
import { QualityTab } from '@/components/phases/tabs/QualityTab';
import { WorkItemsTab } from '@/components/phases/tabs/WorkItemsTab';
import { FloorsTab } from '@/components/phases/tabs/FloorsTab';
import { FinishingTab } from '@/components/phases/tabs/FinishingTab';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';

export default function PhaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [phase, setPhase] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingCompletion, setUpdatingCompletion] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [autoAdvanceStatus, setAutoAdvanceStatus] = useState(null);
  const [checkingAutoAdvance, setCheckingAutoAdvance] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [formData, setFormData] = useState({
    phaseName: '',
    phaseCode: '',
    description: '',
    status: 'not_started',
    completionPercentage: 0,
    startDate: '',
    plannedEndDate: '',
    actualEndDate: ''
  });

  useEffect(() => {
    fetchUser();
    fetchPhase();
  }, [params.id]);

  useEffect(() => {
    if (phase && phase.status !== 'completed' && params.id) {
      checkAutoAdvanceStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase?._id, phase?.status, params.id]);

  // Note: Tab components (MaterialsTab, ExpensesTab) fetch their own data
  // We keep materials/expenses state for Overview tab badge counts
  useEffect(() => {
    if (phase?._id && activeTab === 'overview') {
      // Fetch minimal data for overview tab badges
      fetchMaterials();
      fetchExpenses();
    }
  }, [phase?._id, activeTab]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        setCanEdit(['owner', 'pm', 'project_manager'].includes(role));
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchPhase = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(`/api/phases/${params.id}?includeFinancials=true`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch phase');
      }

      setPhase(data.data);
      
      // Populate form data
      setFormData({
        phaseName: data.data.phaseName || '',
        phaseCode: data.data.phaseCode || '',
        description: data.data.description || '',
        status: data.data.status || 'not_started',
        completionPercentage: data.data.completionPercentage || 0,
        startDate: data.data.startDate ? new Date(data.data.startDate).toISOString().split('T')[0] : '',
        plannedEndDate: data.data.plannedEndDate ? new Date(data.data.plannedEndDate).toISOString().split('T')[0] : '',
        actualEndDate: data.data.actualEndDate ? new Date(data.data.actualEndDate).toISOString().split('T')[0] : ''
      });
      
      // Fetch project
      if (data.data.projectId) {
        const projectResponse = await fetch(`/api/projects/${data.data.projectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const projectData = await projectResponse.json();
        if (projectData.success) {
          setProject(projectData.data);
        }
      }

      // Show success toast on refresh
      if (isRefresh) {
        toast.success('Phase data refreshed successfully');
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch phase error:', err);
      if (isRefresh) {
        toast.error('Failed to refresh phase data');
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleRefresh = async () => {
    await fetchPhase(true);
    // Also refresh materials and expenses if on overview tab
    if (activeTab === 'overview') {
      fetchMaterials();
      fetchExpenses();
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

  const getStatusColor = (status) => {
    const colors = {
      'not_started': 'ds-bg-surface-muted ds-text-primary',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'on_hold': 'bg-yellow-100 text-yellow-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
  };

  const handleStatusChange = async (newStatus) => {
    if (!canEdit) return;
    
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/phases/${params.id}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update status');
      }

      toast.showSuccess('Phase status updated successfully');
      fetchPhase();
    } catch (err) {
      toast.showError(err.message || 'Failed to update status');
      console.error('Update status error:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCompletionChange = async (newCompletion) => {
    if (!canEdit) return;
    
    setUpdatingCompletion(true);
    try {
      const response = await fetch(`/api/phases/${params.id}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({ completionPercentage: newCompletion }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update completion');
      }

      toast.showSuccess('Completion percentage updated successfully');
      fetchPhase();
    } catch (err) {
      toast.showError(err.message || 'Failed to update completion');
      console.error('Update completion error:', err);
    } finally {
      setUpdatingCompletion(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/phases/${params.id}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update phase');
      }

      toast.showSuccess('Phase updated successfully');
      setShowEditModal(false);
      fetchPhase();
    } catch (err) {
      setError(err.message);
      console.error('Update phase error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const fetchMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const response = await fetch(`/api/materials?phaseId=${phase._id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setMaterials(data.data?.materials || data.data || []);
      }
    } catch (err) {
      console.error('Fetch materials error:', err);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoadingExpenses(true);
      const response = await fetch(`/api/expenses?phaseId=${phase._id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setExpenses(data.data?.expenses || data.data || []);
      }
    } catch (err) {
      console.error('Fetch expenses error:', err);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const checkAutoAdvanceStatus = async () => {
    try {
      setCheckingAutoAdvance(true);
      const response = await fetch(`/api/phases/${params.id}/auto-advance`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setAutoAdvanceStatus(data.data);
      }
    } catch (err) {
      console.error('Check auto-advance error:', err);
    } finally {
      setCheckingAutoAdvance(false);
    }
  };

  const handleAutoAdvance = async () => {
    if (!autoAdvanceStatus?.canAdvance) {
      toast.showError(`Cannot auto-advance: ${autoAdvanceStatus?.reason || 'Unknown reason'}`);
      return;
    }

    if (!confirm('Are you sure you want to auto-advance this phase to completed? This action will mark the phase as 100% complete.')) {
      return;
    }

    setAutoAdvancing(true);
    try {
      const response = await fetch(`/api/phases/${params.id}/auto-advance`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to auto-advance phase');
      }

      toast.showSuccess('Phase auto-advanced successfully!');
      fetchPhase();
      setAutoAdvanceStatus(null);
    } catch (err) {
      toast.showError(err.message || 'Failed to auto-advance phase');
      console.error('Auto-advance error:', err);
    } finally {
      setAutoAdvancing(false);
    }
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

  if (error || !phase) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg text-sm sm:text-base">
            {error || 'Phase not found'}
          </div>
          <Link href="/phases" className="mt-4 inline-block ds-text-accent-primary hover:ds-text-accent-hover active:ds-text-accent-hover text-sm sm:text-base transition-colors touch-manipulation">
            ← Back to Phases
          </Link>
        </div>
      </AppLayout>
    );
  }

  // Define tabs with badges
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'financials', label: 'Financials', icon: '💰' },
    { id: 'materials', label: 'Materials', icon: '📦', badge: materials.length },
    { id: 'expenses', label: 'Expenses', icon: '💳', badge: expenses.length },
    { id: 'floors', label: 'Floors', icon: '🏢' },
    // Finishing tab only for finishing phases
    ...(phase.phaseType === 'finishing'
      ? [{ id: 'finishing', label: 'Finishing', icon: '🎨' }]
      : []),
    { id: 'work-items', label: 'Work Items', icon: '✅' },
    { id: 'resources', label: 'Resources', icon: '👥' },
    { id: 'milestones', label: 'Milestones', icon: '🎯', badge: phase.milestones?.length || 0 },
    { id: 'quality', label: 'Quality', icon: '✓', badge: phase.qualityCheckpoints?.length || 0 },
    { id: 'documents', label: 'Documents', icon: '📄', badge: phase.documents?.length || 0 },
    { id: 'reports', label: 'Reports', icon: '📈' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            phase={phase}
            project={project}
            canEdit={canEdit}
            onStatusChange={handleStatusChange}
            onCompletionChange={handleCompletionChange}
            updatingStatus={updatingStatus}
            updatingCompletion={updatingCompletion}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            getStatusColor={getStatusColor}
          />
        );
      case 'financials':
        return <FinancialsTab phase={phase} formatCurrency={formatCurrency} />;
      case 'materials':
        return <MaterialsTab phase={phase} formatCurrency={formatCurrency} formatDate={formatDate} />;
      case 'expenses':
        return <ExpensesTab phase={phase} formatCurrency={formatCurrency} formatDate={formatDate} />;
      case 'floors':
        return <FloorsTab phase={phase} formatCurrency={formatCurrency} />;
      case 'work-items':
        return <WorkItemsTab phase={phase} canEdit={canEdit} formatCurrency={formatCurrency} formatDate={formatDate} />;
      case 'finishing':
        return <FinishingTab phase={phase} project={project} formatCurrency={formatCurrency} />;
      case 'resources':
        return <ResourcesTab phase={phase} formatCurrency={formatCurrency} />;
      case 'milestones':
        return <MilestonesTab phase={phase} canEdit={canEdit} formatDate={formatDate} />;
      case 'quality':
        return <QualityTab phase={phase} canEdit={canEdit} formatDate={formatDate} />;
      case 'documents':
        return <DocumentsTab phase={phase} canEdit={canEdit} />;
      case 'reports':
        return <ReportsTab phase={phase} formatCurrency={formatCurrency} formatDate={formatDate} />;
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <div className="mb-4 sm:mb-6">
          <Breadcrumbs
            items={[
              { label: 'Projects', href: '/projects' },
              { label: project?.projectName || 'Project', href: project ? `/projects/${project._id}` : '/projects' },
              { label: 'Phases', href: project ? `/phases?projectId=${project._id}` : '/phases' },
              { label: phase.phaseName || 'Phase', href: null, current: true },
            ]}
          />
        </div>

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight break-words">{phase.phaseName}</h1>
              <p className="text-sm sm:text-base ds-text-secondary mt-1 break-words">{phase.description || 'No description'}</p>
              {project && (
                <Link 
                  href={`/projects/${project._id}`}
                  className="text-xs sm:text-sm ds-text-accent-primary hover:ds-text-accent-hover active:ds-text-accent-hover mt-2 inline-block transition-colors touch-manipulation"
                >
                  Project: {project.projectName} →
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 w-full md:w-auto">
              {/* Refresh button - available to all users */}
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="flex-1 sm:flex-none ds-bg-surface-muted0 text-white px-4 py-2.5 rounded-lg hover:bg-slate-600 active:bg-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium touch-manipulation"
                title="Refresh phase data and financial information"
              >
                {refreshing ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="hidden sm:inline">Refreshing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="hidden sm:inline">Refresh</span>
                  </>
                )}
              </button>
              {canEdit && (
                <>
                  <Link
                    href={`/phases/${params.id}/dashboard`}
                    className="flex-1 sm:flex-none bg-slate-600 text-white px-4 py-2.5 rounded-lg hover:bg-slate-700 active:bg-slate-800 transition-colors text-sm font-medium text-center touch-manipulation"
                  >
                    Dashboard
                  </Link>
                  {autoAdvanceStatus?.canAdvance && phase?.status !== 'completed' && (
                    <button
                      onClick={handleAutoAdvance}
                      disabled={autoAdvancing}
                      className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50 text-sm font-medium touch-manipulation"
                      title={autoAdvanceStatus.reason}
                    >
                      {autoAdvancing ? 'Auto-Advancing...' : 'Auto-Advance'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="flex-1 sm:flex-none ds-bg-accent-primary text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm font-medium touch-manipulation"
                  >
                    Edit Phase
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <PhaseTabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
        />

        {/* Tab Content */}
        <div className="mb-6">
          {renderTabContent()}
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="ds-bg-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg sm:text-xl font-bold ds-text-primary">Edit Phase</h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="ds-text-muted hover:ds-text-secondary active:ds-text-primary w-8 h-8 flex items-center justify-center touch-manipulation"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm sm:text-base">
                    {error}
                  </div>
                )}

                <form onSubmit={handleEditSubmit} className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="block text-sm font-medium ds-text-secondary mb-2">
                      Phase Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="phaseName"
                      value={formData.phaseName}
                      onChange={handleFormChange}
                      required
                      className="w-full px-3 py-2.5 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium ds-text-secondary mb-2">
                      Phase Code
                    </label>
                    <input
                      type="text"
                      name="phaseCode"
                      value={formData.phaseCode}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2.5 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium ds-text-secondary mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleFormChange}
                      rows={3}
                      className="w-full px-3 py-2.5 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium ds-text-secondary mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2.5 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium ds-text-secondary mb-2">
                        Planned End Date
                      </label>
                      <input
                        type="date"
                        name="plannedEndDate"
                        value={formData.plannedEndDate}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2.5 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                      />
                    </div>
                  </div>

                  {phase.status === 'completed' && (
                    <div>
                      <label className="block text-sm font-medium ds-text-secondary mb-2">
                        Actual End Date
                      </label>
                      <input
                        type="date"
                        name="actualEndDate"
                        value={formData.actualEndDate}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2.5 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                      />
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="w-full sm:w-auto px-6 py-2.5 border ds-border-subtle rounded-lg ds-text-secondary hover:ds-bg-surface-muted active:ds-bg-surface-muted transition-colors text-sm font-medium touch-manipulation"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      type="submit"
                      loading={saving}
                      className="w-full sm:w-auto px-6 py-2.5 ds-bg-accent-primary text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm font-medium touch-manipulation"
                    >
                      Save Changes
                    </LoadingButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

