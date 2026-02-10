/**
 * Floor Detail Page
 * Displays floor information and allows editing (PM/OWNER only)
 * 
 * Route: /floors/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { useToast } from '@/components/toast';
import { ConfirmationModal } from '@/components/modals';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { FloorTabNavigation } from '@/components/floors/FloorTabNavigation';
import { FloorOverviewTab } from '@/components/floors/tabs/OverviewTab';
import { FloorCostsTab } from '@/components/floors/tabs/CostsTab';
import { FloorActivityTab } from '@/components/floors/tabs/ActivityTab';
import { FloorProgressSection } from '@/components/floors/FloorProgressSection';

export default function FloorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const floorId = params.id;

  const [floor, setFloor] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [dependencies, setDependencies] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [floorSummary, setFloorSummary] = useState({
    materials: { count: 0, totalCost: 0 },
    requests: { count: 0, totalEstimated: 0 },
    purchaseOrders: { count: 0, totalCost: 0 },
    labour: { count: 0, totalCost: 0, totalHours: 0 },
    workItems: { count: 0, totalCost: 0, phaseCount: 0 },
    equipment: { count: 0, totalCost: 0 },
  });
  const [ledgerItems, setLedgerItems] = useState([]);
  const [phaseBreakdown, setPhaseBreakdown] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  const [formData, setFormData] = useState({
    status: 'NOT_STARTED',
    totalBudget: 0,
    actualCost: 0,
    startDate: '',
    completionDate: '',
    description: '',
  });

  useEffect(() => {
    fetchUser();
    fetchFloor();
  }, [floorId]);

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
        const hasPermission = ['owner', 'pm', 'project_manager'].includes(role);
        setCanEdit(hasPermission);
        setCanDelete(hasPermission);
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchFloor = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/floors/${floorId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch floor');
      }

      const floorData = data.data;
      setFloor(floorData);

      // Fetch project if projectId exists
      if (floorData.projectId) {
        try {
          const response = await fetch(`/api/projects/${floorData.projectId}`, {
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
        } catch (err) {
          console.error('Error fetching project:', err);
        }
      }

      // Populate form data
      setFormData({
        status: floorData.status || 'NOT_STARTED',
        totalBudget: floorData.totalBudget || 0,
        actualCost: floorData.actualCost || 0,
        startDate: floorData.startDate
          ? new Date(floorData.startDate).toISOString().split('T')[0]
          : '',
        completionDate: floorData.completionDate
          ? new Date(floorData.completionDate).toISOString().split('T')[0]
          : '',
        description: floorData.description || '',
      });
      
      // Check dependencies for deletion
      if (floorData._id) {
        checkDependencies(floorData._id, floorData.projectId);
        loadFloorInsights(floorData);
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch floor error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFloorInsights = async (floorData) => {
    if (!floorData?._id || !floorData?.projectId) {
      return;
    }
    setInsightsLoading(true);
    const floorId = floorData._id.toString();
    const projectId = floorData.projectId.toString();

    const toNumber = (value) => {
      if (typeof value === 'number') return value;
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const safeGet = async (url) => {
      const response = await fetch(url);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load data');
      }
      return data.data;
    };

    try {
      const [
        materialsData,
        requestsData,
        purchaseOrdersData,
        labourData,
        workItemsData,
        equipmentData,
      ] = await Promise.all([
        safeGet(`/api/materials?projectId=${projectId}&floor=${floorId}&limit=200&sortBy=createdAt&sortOrder=desc`),
        safeGet(`/api/material-requests?projectId=${projectId}&floorId=${floorId}&limit=200&sortBy=createdAt&sortOrder=desc`),
        safeGet(`/api/purchase-orders?projectId=${projectId}&floorId=${floorId}&limit=200&sortBy=createdAt&sortOrder=desc`),
        safeGet(`/api/labour/entries?projectId=${projectId}&floorId=${floorId}&limit=200&sortBy=entryDate&sortOrder=desc`),
        safeGet(`/api/work-items?projectId=${projectId}&floorId=${floorId}&limit=200&sortBy=createdAt&sortOrder=desc`),
        safeGet(`/api/equipment?projectId=${projectId}&limit=200`),
      ]);

      const materials = materialsData?.materials || materialsData || [];
      const requests = requestsData?.requests || requestsData || [];
      const orders = purchaseOrdersData?.orders || purchaseOrdersData || [];
      const labourEntries = labourData?.entries || labourData || [];
      const workItems = workItemsData?.workItems || workItemsData || [];
      const equipment = equipmentData?.equipment || equipmentData || [];

      const materialsTotal = materials.reduce((sum, item) => sum + toNumber(item.totalCost), 0);
      const requestsTotal = requests.reduce((sum, item) => sum + toNumber(item.estimatedCost), 0);
      const ordersTotal = orders.reduce((sum, item) => sum + toNumber(item.totalCost), 0);
      const labourTotal = labourEntries.reduce((sum, item) => sum + toNumber(item.totalCost), 0);
      const labourHours = labourEntries.reduce((sum, item) => sum + toNumber(item.totalHours), 0);
      const workItemsTotal = workItems.reduce(
        (sum, item) => sum + toNumber(item.actualCost || item.estimatedCost),
        0
      );

      const floorPhaseIds = new Set(
        workItems.map((item) => item.phaseId?.toString()).filter(Boolean)
      );
      const floorEquipment = equipment.filter((item) => {
        if (!item.phaseId) return false;
        return floorPhaseIds.has(item.phaseId.toString());
      });
      const equipmentTotal = floorEquipment.reduce((sum, item) => sum + toNumber(item.totalCost), 0);

      const phaseMap = workItems.reduce((acc, item) => {
        const key = item.phaseId?.toString() || 'unknown';
        if (!acc[key]) {
          acc[key] = {
            phaseId: item.phaseId,
            phaseName: item.phaseName || 'Unknown Phase',
            count: 0,
            totalCost: 0,
          };
        }
        acc[key].count += 1;
        acc[key].totalCost += toNumber(item.actualCost || item.estimatedCost);
        return acc;
      }, {});

      const phaseSummary = Object.values(phaseMap)
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 5);

      setFloorSummary({
        materials: { count: materials.length, totalCost: materialsTotal },
        requests: { count: requests.length, totalEstimated: requestsTotal },
        purchaseOrders: { count: orders.length, totalCost: ordersTotal },
        labour: { count: labourEntries.length, totalCost: labourTotal, totalHours: labourHours },
        workItems: { count: workItems.length, totalCost: workItemsTotal, phaseCount: phaseSummary.length },
        equipment: { count: floorEquipment.length, totalCost: equipmentTotal },
      });
      setPhaseBreakdown(phaseSummary);

      const ledger = [
        ...materials.slice(0, 10).map((item) => ({
          id: item._id,
          type: 'Material',
          title: item.name || item.materialName || 'Material',
          amount: toNumber(item.totalCost),
          date: item.createdAt || item.updatedAt,
          link: `/items/${item._id}`,
        })),
        ...requests.slice(0, 10).map((item) => ({
          id: item._id,
          type: 'Material Request',
          title: item.requestNumber || item.materialName || 'Material Request',
          amount: toNumber(item.estimatedCost),
          date: item.createdAt || item.updatedAt,
          link: `/material-requests/${item._id}`,
        })),
        ...orders.slice(0, 10).map((item) => ({
          id: item._id,
          type: 'Purchase Order',
          title: item.purchaseOrderNumber || item.materialName || 'Purchase Order',
          amount: toNumber(item.totalCost),
          date: item.createdAt || item.sentAt,
          link: `/purchase-orders/${item._id}`,
        })),
        ...labourEntries.slice(0, 10).map((item) => ({
          id: item._id,
          type: 'Labour Entry',
          title: item.workerName || item.entryNumber || 'Labour Entry',
          amount: toNumber(item.totalCost),
          date: item.entryDate || item.createdAt,
          link: null,
        })),
        ...workItems.slice(0, 10).map((item) => ({
          id: item._id,
          type: 'Work Item',
          title: item.name || 'Work Item',
          amount: toNumber(item.actualCost || item.estimatedCost),
          date: item.updatedAt || item.createdAt,
          link: `/work-items/${item._id}`,
        })),
        ...floorEquipment.slice(0, 10).map((item) => ({
          id: item._id,
          type: 'Equipment',
          title: item.equipmentName || 'Equipment',
          amount: toNumber(item.totalCost),
          date: item.startDate || item.createdAt,
          link: `/equipment/${item._id}`,
        })),
      ]
        .filter((item) => item.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20);

      setLedgerItems(ledger);
    } catch (insightsError) {
      console.error('Error loading floor insights:', insightsError);
    } finally {
      setInsightsLoading(false);
    }
  };

  const checkDependencies = async (floorId, projectId) => {
    try {
      // Check if floor has dependencies
      const [materialsRes, requestsRes] = await Promise.all([
        fetch(`/api/materials?projectId=${projectId}&floor=${floorId}&limit=1`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/material-requests?projectId=${projectId}&floorId=${floorId}&limit=1`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
      ]);
      
      const materialsData = await materialsRes.json();
      const requestsData = await requestsRes.json();
      
      const materialCount = materialsData.data?.length || 0;
      const requestCount = requestsData.data?.pagination?.total || requestsData.data?.requests?.length || 0;
      
      if (materialCount > 0 || requestCount > 0) {
        setDependencies({
          materials: materialCount,
          requests: requestCount,
        });
      }
    } catch (err) {
      console.error('Error checking dependencies:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'totalBudget' || name === 'actualCost' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/floors/${floorId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          ...formData,
          description: formData.description.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update floor');
      }

      setFloor(data.data);
      setEditMode(false);
      toast.showSuccess('Floor updated successfully');
      // Refresh to get updated data
      fetchFloor();
    } catch (err) {
      setError(err.message);
      toast.showError(err.message);
      console.error('Update floor error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/floors/${floorId}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete floor');
      }

      toast.showSuccess('Floor deleted successfully');
      // Redirect to floors list or project page
      if (floor?.projectId) {
        router.push(`/floors?projectId=${floor.projectId}`);
      } else {
        router.push('/floors');
      }
    } catch (err) {
      setDeleteError(err.message);
      toast.showError(err.message);
      console.error('Delete floor error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      NOT_STARTED: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading floor...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !floor) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
          <Link href="/floors" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Floors
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!floor) {
    return null;
  }

  const budgetVariance = (formData.totalBudget || 0) - (formData.actualCost || 0);
  const budgetPercentage = formData.totalBudget > 0
    ? ((formData.actualCost / formData.totalBudget) * 100).toFixed(1)
    : 0;

  // Prepare tabs
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'costs', label: 'Costs', icon: '💰', badge: floorSummary.materials.count + floorSummary.labour.count },
    { id: 'activity', label: 'Activity', icon: '📊', badge: ledgerItems.length },
    { id: 'progress', label: 'Progress', icon: '📈' },
  ];

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <FloorOverviewTab
            floor={floor}
            project={project}
            canEdit={canEdit}
            onStatusChange={(status) => {
              setFormData(prev => ({ ...prev, status }));
              handleSave();
            }}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            getStatusColor={getStatusBadgeColor}
            floorSummary={floorSummary}
          />
        );
      case 'costs':
        return (
          <FloorCostsTab
            floor={floor}
            floorSummary={floorSummary}
            formatCurrency={formatCurrency}
          />
        );
      case 'activity':
        return (
          <FloorActivityTab
            floor={floor}
            ledgerItems={ledgerItems}
            phaseBreakdown={phaseBreakdown}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            floorSummary={floorSummary}
          />
        );
      case 'progress':
        return <FloorProgressSection floorId={floorId} canEdit={canEdit} />;
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs
            items={[
              { label: 'Projects', href: '/projects' },
              { label: project?.projectName || 'Project', href: project ? `/projects/${floor.projectId}` : '/projects' },
              { label: 'Floors', href: floor.projectId ? `/floors?projectId=${floor.projectId}` : '/floors' },
              { label: floor.name || `Floor ${floor.floorNumber}`, href: null, current: true },
            ]}
          />
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                {floor.name || (() => {
                  if (floor.floorNumber === undefined || floor.floorNumber === null) return 'N/A';
                  if (floor.floorNumber < 0) return `Basement ${Math.abs(floor.floorNumber)}`;
                  if (floor.floorNumber === 0) return 'Ground Floor';
                  return `Floor ${floor.floorNumber}`;
                })()}
              </h1>
              <p className="text-gray-600 mt-1">
                Floor Number: {floor.floorNumber !== undefined ? (
                  floor.floorNumber < 0 ? `Basement ${Math.abs(floor.floorNumber)} (${floor.floorNumber})` :
                  floor.floorNumber === 0 ? `Ground Floor (${floor.floorNumber})` :
                  `Floor ${floor.floorNumber} (${floor.floorNumber})`
                ) : 'N/A'}
                {project && (
                  <span className="ml-4">
                    • Project: <Link href={`/projects/${floor.projectId}`} className="text-blue-600 hover:underline">
                      {project.projectCode} - {project.projectName}
                    </Link>
                  </span>
                )}
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                {editMode ? (
                  <>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        fetchFloor(); // Reset form
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Edit Floor
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Delete Floor
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <FloorTabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
        />

        {/* Tab Content */}
        <div className="mb-6">
          {renderTabContent()}
        </div>

        {/* Edit Mode Form (shown when editMode is true) */}
        {editMode && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Floor Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  >
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Total Budget (KES)</label>
                  <input
                    type="number"
                    name="totalBudget"
                    value={formData.totalBudget}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Actual Cost (KES)</label>
                  <input
                    type="number"
                    name="actualCost"
                    value={formData.actualCost}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Completion Date</label>
                  <input
                    type="date"
                    name="completionDate"
                    value={formData.completionDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>
        )}


        {/* Project Link */}
        {floor.projectId && project && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Project</h2>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Project Code:</span> {project.projectCode}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Project Name:</span> {project.projectName}
              </p>
              {project.location && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Location:</span> {project.location}
                </p>
              )}
              <Link
                href={`/projects/${floor.projectId}`}
                className="inline-block mt-4 text-blue-600 hover:text-blue-900 underline"
              >
                View Full Project Details →
              </Link>
            </div>
          </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <ConfirmationModal
            isOpen={showDeleteModal}
            onClose={() => {
              setShowDeleteModal(false);
              setDeleteError(null);
            }}
            onConfirm={handleDelete}
            title="Delete Floor"
            message={
              <div>
                <p className="mb-2">
                  Are you sure you want to delete <strong>{floor?.name || `Floor ${floor?.floorNumber}`}</strong>?
                </p>
                {dependencies && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                    <p className="text-sm text-yellow-800 font-semibold mb-1">Warning:</p>
                    <p className="text-sm text-yellow-700">
                      This floor is currently used by {dependencies.materials} material(s) and {dependencies.requests} material request(s).
                      You must reassign or remove these items before deleting the floor.
                    </p>
                  </div>
                )}
                {deleteError && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 mt-3">
                    <p className="text-sm text-red-800">{deleteError}</p>
                  </div>
                )}
                <p className="text-sm text-gray-600 mt-3">This action cannot be undone.</p>
              </div>
            }
            confirmText="Delete Floor"
            cancelText="Cancel"
            confirmColor="red"
            isLoading={deleting}
          />
        )}
      </AppLayout>
    );
}

