/**
 * Wastage Analytics Dashboard
 * Displays variance, loss, and wastage analytics with charts and supplier performance
 * 
 * Route: /dashboard/analytics/wastage
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton } from '@/components/loading';
import { exportToPDF, exportToExcel, exportToCSV } from '@/lib/export-helpers';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

function WastageAnalyticsPageContent() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const [projectId, setProjectId] = useState(searchParams.get('projectId') || '');
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonData, setComparisonData] = useState([]);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [summary, setSummary] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectsFetched, setProjectsFetched] = useState(false);
  const [exporting, setExporting] = useState({ pdf: false, excel: false, csv: false });
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [showAllTime, setShowAllTime] = useState(true);
  const [trends, setTrends] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryAnalysis, setCategoryAnalysis] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [thresholdForm, setThresholdForm] = useState({
    variancePercentage: 5,
    varianceAmount: 100,
    lossPercentage: 10,
    lossAmount: 50,
    wastagePercentage: 15,
  });
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [discrepancyStatuses, setDiscrepancyStatuses] = useState({});
  const [resolvingDiscrepancy, setResolvingDiscrepancy] = useState(null);
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionForm, setResolutionForm] = useState({ status: 'resolved', notes: '' });
  const { canAccess } = usePermissions();
  const canUpdateThresholds = canAccess('view_reports');

  // Define fetchThresholds before useEffects that use it
  const fetchThresholds = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/thresholds`);
      const data = await response.json();
      if (data.success && data.data) {
        const thresholds = data.data.thresholds || data.data;
        setThresholds(thresholds);
        setThresholdForm(thresholds);
      }
    } catch (err) {
      console.error('Error fetching thresholds:', err);
    }
  }, [projectId]);

  // Define fetchAnalytics before useEffects that use it
  const fetchAnalytics = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ projectId });
      if (!showAllTime) {
        if (dateRange.startDate) {
          params.append('startDate', dateRange.startDate);
        }
        if (dateRange.endDate) {
          params.append('endDate', dateRange.endDate);
        }
      }
      if (selectedCategory) {
        params.append('category', selectedCategory);
      }

      const summaryResponse = await fetch(`/api/discrepancies/summary?${params.toString()}`);
      const summaryData = await summaryResponse.json();

      if (!summaryData.success) {
        throw new Error(summaryData.error || 'Failed to fetch summary');
      }

      setSummary(summaryData.data);

      const suppliersResponse = await fetch(`/api/discrepancies/suppliers?${params.toString()}`);
      const suppliersData = await suppliersResponse.json();

      if (suppliersData.success) {
        setSuppliers(suppliersData.data.suppliers || []);
      }

      const discrepanciesResponse = await fetch(`/api/discrepancies/check?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const discrepanciesData = await discrepanciesResponse.json();

      if (discrepanciesData.success) {
        setDiscrepancies(discrepanciesData.data.discrepancies || []);
      }

      const trendsResponse = await fetch(`/api/discrepancies/trends?${params.toString()}`);
      const trendsData = await trendsResponse.json();

      if (trendsData.success) {
        setTrends(trendsData.data.trends || []);
      }

      const categoriesResponse = await fetch(`/api/discrepancies/categories?${params.toString()}`);
      const categoriesData = await categoriesResponse.json();

      if (categoriesData.success) {
        setCategoryAnalysis(categoriesData.data.categories || []);
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch analytics error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, showAllTime, dateRange.startDate, dateRange.endDate, selectedCategory]);

  // Define fetchProjects before useEffects that use it
  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjectsFetched(true); // Mark as fetched regardless of success/failure
      
      if (data.success) {
        // API returns projects array directly in data.data
        const projectsList = Array.isArray(data.data) ? data.data : [];
        setProjects(projectsList);
        if (projectsList.length > 0 && !projectId) {
          setProjectId(projectsList[0]._id);
        } else if (projectsList.length === 0) {
          // No projects available, set loading to false
          setLoading(false);
        }
      } else {
        // API call failed, set loading to false
        setLoading(false);
        setError(data.error || 'Failed to fetch projects');
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setProjectsFetched(true); // Mark as fetched even on error
      // Error occurred, set loading to false
      setLoading(false);
      setError('Failed to load projects. Please try again.');
    }
  };

  const fetchComparisonData = useCallback(async () => {
    if (selectedProjects.length < 2) {
      setComparisonData([]);
      return;
    }

    setLoadingComparison(true);
    try {
      const comparisonPromises = selectedProjects.map(async (projId) => {
        const params = new URLSearchParams({ projectId: projId });
        if (!showAllTime) {
          if (dateRange.startDate) params.append('startDate', dateRange.startDate);
          if (dateRange.endDate) params.append('endDate', dateRange.endDate);
        }

        const summaryResponse = await fetch(`/api/discrepancies/summary?${params.toString()}`);
        const summaryData = await summaryResponse.json();

        if (summaryData.success && summaryData.data) {
          const project = projects.find((p) => p._id === projId);
          return {
            projectId: projId,
            projectName: project?.projectName || project?.projectCode || 'Unknown',
            ...summaryData.data,
          };
        }
        return null;
      });

      const results = await Promise.all(comparisonPromises);
      setComparisonData(results.filter((r) => r !== null));
    } catch (err) {
      console.error('Error fetching comparison data:', err);
      setComparisonData([]);
    } finally {
      setLoadingComparison(false);
    }
  }, [selectedProjects, showAllTime, dateRange.startDate, dateRange.endDate, projects]);

  useEffect(() => {
    if (comparisonMode && selectedProjects.length >= 2 && projects.length > 0) {
      fetchComparisonData();
    } else if (!comparisonMode) {
      setComparisonData([]);
    }
  }, [comparisonMode, selectedProjects, projects.length, fetchComparisonData]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data.categories || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  // useEffects - defined after all functions
  useEffect(() => {
    fetchProjects();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (projectId && !comparisonMode) {
      fetchAnalytics();
      fetchThresholds();
    } else if (!projectId && !comparisonMode) {
      // If no projectId and not in comparison mode, set loading to false
      setLoading(false);
    }
  }, [projectId, comparisonMode, fetchAnalytics, fetchThresholds]);

  const handleSaveThresholds = async () => {
    if (!projectId) return;
    setSavingThresholds(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/thresholds`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholds: thresholdForm }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        const thresholds = data.data.thresholds || data.data;
        setThresholds(thresholds);
        setShowThresholdModal(false);
        toast.showSuccess('Thresholds updated successfully! Re-running analysis...');
        fetchAnalytics();
      } else {
        toast.showError('Failed to update thresholds: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      toast.showError('Error updating thresholds: ' + err.message);
      console.error('Save thresholds error:', err);
    } finally {
      setSavingThresholds(false);
    }
  };

  const applyPreset = (preset) => {
    const presets = {
      strict: {
        variancePercentage: 2,
        varianceAmount: 50,
        lossPercentage: 5,
        lossAmount: 25,
        wastagePercentage: 8,
      },
      moderate: {
        variancePercentage: 5,
        varianceAmount: 100,
        lossPercentage: 10,
        lossAmount: 50,
        wastagePercentage: 15,
      },
      lenient: {
        variancePercentage: 10,
        varianceAmount: 200,
        lossPercentage: 20,
        lossAmount: 100,
        wastagePercentage: 25,
      },
    };
    setThresholdForm(presets[preset]);
  };

  const handleResolveDiscrepancy = async (materialId) => {
    setResolvingDiscrepancy(materialId);
    setShowResolutionModal(true);
    setResolutionForm({ status: 'resolved', notes: '' });
  };

  const handleSaveResolution = async () => {
    if (!resolvingDiscrepancy) return;
    try {
      const response = await fetch(`/api/discrepancies/${resolvingDiscrepancy}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: resolutionForm.status,
          resolutionNotes: resolutionForm.notes,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setDiscrepancyStatuses((prev) => ({
          ...prev,
          [resolvingDiscrepancy]: resolutionForm.status,
        }));
        setShowResolutionModal(false);
        setResolvingDiscrepancy(null);
        toast.showSuccess('Discrepancy status updated successfully!');
        fetchAnalytics();
      } else {
        toast.showError('Failed to update discrepancy: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      toast.showError('Error updating discrepancy: ' + err.message);
      console.error('Save resolution error:', err);
    }
  };

  const filteredDiscrepancies = discrepancies.filter((d) => {
    if (statusFilter === 'all') return true;
    const status = discrepancyStatuses[d.materialId] || d.status || 'open';
    return status === statusFilter;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getSeverityColor = (severity) => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800',
      HIGH: 'bg-orange-100 text-orange-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      LOW: 'bg-blue-100 text-blue-800',
      NONE: 'bg-gray-100 text-gray-600',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-red-100 text-red-800',
      investigating: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      false_positive: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const handleExportPDF = async () => {
    if (!summary || !projectId) {
      toast.showError('Please select a project and wait for data to load');
      return;
    }

    setExporting((prev) => ({ ...prev, pdf: true }));
    try {
      const project = projects.find((p) => p._id === projectId);
      const projectName = project ? (project.projectName || project.projectCode) : 'All Projects';
      await exportToPDF(
        {
          summary,
          discrepancies,
          suppliers,
        },
        projectName
      );
    } catch (err) {
      toast.showError('Failed to export PDF: ' + err.message);
      console.error('Export PDF error:', err);
    } finally {
      setExporting((prev) => ({ ...prev, pdf: false }));
    }
  };

  const handleExportExcel = async () => {
    if (!summary || !projectId) {
      toast.showError('Please select a project and wait for data to load');
      return;
    }

    setExporting((prev) => ({ ...prev, excel: true }));
    try {
      const project = projects.find((p) => p._id === projectId);
      const projectName = project ? (project.projectName || project.projectCode) : 'All Projects';
      await exportToExcel(
        {
          summary,
          discrepancies,
          suppliers,
        },
        projectName
      );
    } catch (err) {
      toast.showError('Failed to export Excel: ' + err.message);
      console.error('Export Excel error:', err);
    } finally {
      setExporting((prev) => ({ ...prev, excel: false }));
    }
  };

  const handleExportCSV = async () => {
    if (!summary || !projectId) {
      toast.showError('Please select a project and wait for data to load');
      return;
    }

    setExporting((prev) => ({ ...prev, csv: true }));
    try {
      const project = projects.find((p) => p._id === projectId);
      const projectName = project ? (project.projectName || project.projectCode) : 'All Projects';
      await exportToCSV(
        {
          summary,
          discrepancies,
          suppliers,
        },
        projectName
      );
    } catch (err) {
      toast.showError('Failed to export CSV: ' + err.message);
      console.error('Export CSV error:', err);
    } finally {
      setExporting((prev) => ({ ...prev, csv: false }));
    }
  };

  const severityData = summary
    ? [
        { name: 'Critical', value: summary.severityBreakdown.critical, color: '#ef4444' },
        { name: 'High', value: summary.severityBreakdown.high, color: '#f59e0b' },
        { name: 'Medium', value: summary.severityBreakdown.medium, color: '#eab308' },
        { name: 'Low', value: summary.severityBreakdown.low, color: '#3b82f6' },
      ].filter((item) => item.value > 0)
    : [];

  const supplierVarianceData = suppliers
    .slice(0, 10)
    .map((supplier) => ({
      name: supplier.supplierName || 'Unknown',
      variance: supplier.totalVariance || 0,
      varianceCost: supplier.totalVarianceCost || 0,
      deliveryAccuracy: supplier.deliveryAccuracy || 0,
    }));

  const discrepancyBreakdown = discrepancies.slice(0, 10).map((d) => ({
    name: d.materialName,
    variance: d.metrics.variance,
    loss: d.metrics.loss,
    totalCost: d.metrics.totalDiscrepancyCost,
  }));

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-700">Loading analytics...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error Loading Analytics</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setError(null);
                      if (projectId) {
                        fetchAnalytics();
                      }
                    }}
                    className="text-sm font-medium text-red-800 hover:text-red-900 underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Empty state - no projects (only show after projects have been fetched)
  if (projectsFetched && projects.length === 0 && !loading && !error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Found</h3>
            <p className="text-gray-700 mb-4">You need to have at least one project to view wastage analytics.</p>
            <Link
              href="/projects/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Create Your First Project
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Wastage & Loss Analytics</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Track variance, loss, and wastage across your project</p>
          </div>
          {summary && projectId && (
            <div className="flex gap-2">
              {canUpdateThresholds && (
                <button
                  onClick={() => setShowThresholdModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  ⚙️ Thresholds
                </button>
              )}
              <LoadingButton
                onClick={handleExportPDF}
                isLoading={exporting.pdf}
                loadingText="Exporting..."
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                📄 PDF
              </LoadingButton>
              <LoadingButton
                onClick={handleExportExcel}
                isLoading={exporting.excel}
                loadingText="Exporting..."
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                📊 Excel
              </LoadingButton>
              <LoadingButton
                onClick={handleExportCSV}
                isLoading={exporting.csv}
                loadingText="Exporting..."
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                📋 CSV
              </LoadingButton>
            </div>
          )}
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={comparisonMode}
                onChange={(e) => {
                  setComparisonMode(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedProjects([]);
                    setComparisonData([]);
                  }
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-base font-semibold text-gray-700 leading-normal">Compare Multiple Projects</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {!comparisonMode ? (
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">Select Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                >
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.projectName || project.projectCode}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="md:col-span-3">
                <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">Select Projects to Compare (2-5 projects)</label>
                <div className="flex flex-wrap gap-2">
                  {projects.map((project) => (
                    <label key={project._id} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(project._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (selectedProjects.length < 5) {
                              setSelectedProjects([...selectedProjects, project._id]);
                            }
                          } else {
                            setSelectedProjects(selectedProjects.filter((id) => id !== project._id));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-900">{project.projectName || project.projectCode}</span>
                    </label>
                  ))}
                </div>
                {selectedProjects.length > 0 && (
                  <p className="text-sm text-gray-700 mt-2 leading-normal">
                    {selectedProjects.length} project{selectedProjects.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">Category Filter</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category._id} value={category.name || category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">Date Range</label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllTime}
                    onChange={(e) => {
                      setShowAllTime(e.target.checked);
                      if (e.target.checked) {
                        setDateRange({ startDate: '', endDate: '' });
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">All Time</span>
                </label>
              </div>
              {!showAllTime && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="End Date"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {!comparisonMode && !projectId ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-700">Please select a project to view analytics</p>
          </div>
        ) : comparisonMode && selectedProjects.length < 2 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-700">Please select at least 2 projects to compare</p>
          </div>
        ) : comparisonMode ? (
          <>
            {loadingComparison ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-700">Loading comparison data...</p>
              </div>
            ) : comparisonData.length > 0 ? (
              <>
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Project Ranking by Wastage</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">Rank</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">Project</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">Critical</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">High</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">Materials with Issues</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">Total Cost Impact</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {comparisonData
                          .sort((a, b) => b.metrics.totalDiscrepancyCost - a.metrics.totalDiscrepancyCost)
                          .map((project, index) => (
                            <tr key={project.projectId} className={index === 0 ? 'bg-red-50' : index === comparisonData.length - 1 ? 'bg-green-50' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                  index === 0 ? 'bg-red-100 text-red-800' :
                                  index === comparisonData.length - 1 ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  #{index + 1}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{project.projectName}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                                  {project.severityBreakdown.critical}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-800">
                                  {project.severityBreakdown.high}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {project.materialsWithIssues} / {project.totalMaterials}
                                </div>
                                <div className="text-sm text-gray-700 leading-normal">
                                  {project.totalMaterials > 0 ? ((project.materialsWithIssues / project.totalMaterials) * 100).toFixed(1) : 0}%
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-red-600">
                                  {formatCurrency(project.metrics.totalDiscrepancyCost)}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Cost Impact Comparison</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={comparisonData.map((p) => ({
                        name: p.projectName,
                        cost: p.metrics.totalDiscrepancyCost,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="cost" fill="#ef4444" name="Cost Impact" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Critical Issues Comparison</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={comparisonData.map((p) => ({
                        name: p.projectName,
                        critical: p.severityBreakdown.critical,
                        high: p.severityBreakdown.high,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="critical" fill="#ef4444" name="Critical" />
                        <Bar dataKey="high" fill="#f59e0b" name="High" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                    <h3 className="text-lg md:text-xl font-semibold text-green-900 mb-3 leading-tight">✅ Best Performing Project</h3>
                    {comparisonData.length > 0 && (() => {
                      const best = comparisonData.reduce((min, p) => 
                        p.metrics.totalDiscrepancyCost < min.metrics.totalDiscrepancyCost ? p : min
                      , comparisonData[0]);
                      return (
                        <div>
                          <p className="text-2xl font-bold text-green-900">{best.projectName}</p>
                          <p className="text-sm text-green-700 mt-2">
                            Cost Impact: {formatCurrency(best.metrics.totalDiscrepancyCost)}
                          </p>
                          <p className="text-sm text-green-700">
                            Issues: {best.materialsWithIssues} / {best.totalMaterials} materials
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
                    <h3 className="text-lg md:text-xl font-semibold text-red-900 mb-3 leading-tight">⚠️ Worst Performing Project</h3>
                    {comparisonData.length > 0 && (() => {
                      const worst = comparisonData.reduce((max, p) => 
                        p.metrics.totalDiscrepancyCost > max.metrics.totalDiscrepancyCost ? p : max
                      , comparisonData[0]);
                      return (
                        <div>
                          <p className="text-2xl font-bold text-red-900">{worst.projectName}</p>
                          <p className="text-sm text-red-700 mt-2">
                            Cost Impact: {formatCurrency(worst.metrics.totalDiscrepancyCost)}
                          </p>
                          <p className="text-sm text-red-700">
                            Issues: {worst.materialsWithIssues} / {worst.totalMaterials} materials
                          </p>
                          <p className="text-sm text-red-700">
                            Critical: {worst.severityBreakdown.critical} | High: {worst.severityBreakdown.high}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-700">No comparison data available</p>
              </div>
            )}
          </>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-base font-semibold text-gray-700 leading-normal">Materials with Issues</h3>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {summary.materialsWithIssues} / {summary.totalMaterials}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 leading-normal">
                    {summary.totalMaterials > 0
                      ? ((summary.materialsWithIssues / summary.totalMaterials) * 100).toFixed(1)
                      : 0}
                    % of total
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-base font-semibold text-gray-700 leading-normal">Total Variance Cost</h3>
                  <p className="text-3xl font-bold text-orange-600 mt-2">
                    {formatCurrency(summary.metrics.totalVarianceCost)}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 leading-normal">
                    {summary.metrics.totalVariance.toFixed(2)} units
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-base font-semibold text-gray-700 leading-normal">Total Loss Cost</h3>
                  <p className="text-3xl font-bold text-red-600 mt-2">
                    {formatCurrency(summary.metrics.totalLossCost)}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 leading-normal">
                    {summary.metrics.totalLoss.toFixed(2)} units
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-base font-semibold text-gray-700 leading-normal">Total Discrepancy Cost</h3>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    {formatCurrency(summary.metrics.totalDiscrepancyCost)}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 leading-normal">Combined impact</p>
                </div>
              </div>
            )}

            {summary && summary.severityBreakdown && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Severity Breakdown</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={severityData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value, percent }) =>
                            `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                          }
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {severityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col justify-center space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">Critical</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getSeverityColor('CRITICAL')}`}>
                        {summary.severityBreakdown.critical}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">High</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getSeverityColor('HIGH')}`}>
                        {summary.severityBreakdown.high}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">Medium</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getSeverityColor('MEDIUM')}`}>
                        {summary.severityBreakdown.medium}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">Low</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getSeverityColor('LOW')}`}>
                        {summary.severityBreakdown.low}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {suppliers.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Supplier Performance</h2>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={supplierVarianceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'varianceCost') return formatCurrency(value);
                        if (name === 'deliveryAccuracy') return `${value.toFixed(2)}%`;
                        return value.toFixed(2);
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="variance" fill="#ef4444" name="Variance (units)" />
                    <Bar
                      yAxisId="right"
                      dataKey="varianceCost"
                      fill="#f59e0b"
                      name="Variance Cost"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {discrepancies.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 leading-tight">Top Discrepancies</h2>
                  <div className="flex items-center gap-3">
                    <label className="text-base font-semibold text-gray-700 leading-normal">Filter by Status:</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="all">All</option>
                      <option value="open">Open</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                      <option value="false_positive">False Positive</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                          Material
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                          Supplier
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                          Variance
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                          Loss
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                          Cost Impact
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                          Severity
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredDiscrepancies.slice(0, 20).map((discrepancy) => {
                        const status = discrepancyStatuses[discrepancy.materialId] || discrepancy.status || 'open';
                        return (
                        <tr key={discrepancy.materialId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link
                              href={`/items/${discrepancy.materialId}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              {discrepancy.materialName}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{discrepancy.supplierName || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {discrepancy.metrics.variance.toFixed(2)} units
                            </div>
                            <div className="text-sm text-gray-700 leading-normal">
                              {discrepancy.metrics.variancePercentage.toFixed(2)}%
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {discrepancy.metrics.loss.toFixed(2)} units
                            </div>
                            <div className="text-sm text-gray-700 leading-normal">
                              {discrepancy.metrics.lossPercentage.toFixed(2)}%
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-red-600">
                              {formatCurrency(discrepancy.metrics.totalDiscrepancyCost)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-semibold ${getSeverityColor(
                                discrepancy.severity
                              )}`}
                            >
                              {discrepancy.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(status)}`}>
                              {status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <Link
                                href={`/items/${discrepancy.materialId}`}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                View
                              </Link>
                              {status !== 'resolved' && status !== 'false_positive' && canUpdateThresholds && (
                                <button
                                  onClick={() => handleResolveDiscrepancy(discrepancy.materialId)}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Resolve
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
              </div>
            )}

            {categoryAnalysis.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Category Analysis</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={categoryAnalysis.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          formatter={(value, name) => {
                            if (name === 'totalDiscrepancyCost' || name === 'varianceCost' || name === 'lossCost') {
                              return formatCurrency(value);
                            }
                            return value.toFixed(2);
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="materialsWithIssues" fill="#ef4444" name="Materials with Issues" />
                        <Bar
                          yAxisId="right"
                          dataKey="totalDiscrepancyCost"
                          fill="#8b5cf6"
                          name="Total Cost Impact"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 leading-tight">Top Categories by Wastage</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {categoryAnalysis.slice(0, 10).map((cat, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{cat.category || 'Other'}</p>
                            <p className="text-sm text-gray-700">
                              {cat.materialsWithIssues} / {cat.totalMaterials} materials with issues
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-red-600">{formatCurrency(cat.totalDiscrepancyCost)}</p>
                            <p className="text-sm text-gray-700 leading-normal">{cat.issueRate.toFixed(1)}% issue rate</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {trends.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Historical Trends</h2>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthLabel" angle={-45} textAnchor="end" height={100} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'varianceCost' || name === 'lossCost' || name === 'totalDiscrepancyCost') {
                          return formatCurrency(value);
                        }
                        return value.toFixed(2);
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="variance"
                      stroke="#ef4444"
                      strokeWidth={2}
                      name="Variance (units)"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="loss"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      name="Loss (units)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="totalDiscrepancyCost"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      name="Total Cost Impact"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {discrepancyBreakdown.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Discrepancy Breakdown by Material</h2>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={discrepancyBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'totalCost') return formatCurrency(value);
                        return value.toFixed(2);
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="variance" fill="#ef4444" name="Variance (units)" />
                    <Bar yAxisId="left" dataKey="loss" fill="#f59e0b" name="Loss (units)" />
                    <Bar
                      yAxisId="right"
                      dataKey="totalCost"
                      fill="#8b5cf6"
                      name="Cost Impact"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {!summary && !loading && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-700">No discrepancy data available for this project</p>
              </div>
            )}
          </>
        )}

        {showResolutionModal && resolvingDiscrepancy && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Resolve Discrepancy</h2>
                  <button
                    onClick={() => {
                      setShowResolutionModal(false);
                      setResolvingDiscrepancy(null);
                    }}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-base text-gray-700 mb-6 leading-relaxed">
                  Update the status and add resolution notes for this discrepancy.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                      Status
                    </label>
                    <select
                      value={resolutionForm.status}
                      onChange={(e) => setResolutionForm((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="open">Open</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                      <option value="false_positive">False Positive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                      Resolution Notes
                    </label>
                    <textarea
                      value={resolutionForm.notes}
                      onChange={(e) => setResolutionForm((prev) => ({ ...prev, notes: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Add notes about the resolution..."
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowResolutionModal(false);
                      setResolvingDiscrepancy(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    onClick={handleSaveResolution}
                    isLoading={false}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Save Resolution
                  </LoadingButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {showThresholdModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Configure Wastage Thresholds</h2>
                  <button
                    onClick={() => setShowThresholdModal(false)}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-base text-gray-700 mb-6 leading-relaxed">
                  Set custom thresholds for variance, loss, and wastage detection. Alerts will be triggered when these thresholds are exceeded.
                </p>

                <div className="mb-6">
                  <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">Quick Presets</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => applyPreset('strict')}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition text-sm"
                    >
                      Strict
                    </button>
                    <button
                      onClick={() => applyPreset('moderate')}
                      className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition text-sm"
                    >
                      Moderate (Default)
                    </button>
                    <button
                      onClick={() => applyPreset('lenient')}
                      className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm"
                    >
                      Lenient
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                      Variance Percentage Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={thresholdForm.variancePercentage}
                      onChange={(e) => setThresholdForm((prev) => ({ ...prev, variancePercentage: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-sm text-gray-700 mt-1 leading-normal">Alert if variance exceeds this percentage of purchased quantity</p>
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                      Variance Amount Threshold (units)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={thresholdForm.varianceAmount}
                      onChange={(e) => setThresholdForm((prev) => ({ ...prev, varianceAmount: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-sm text-gray-700 mt-1 leading-normal">Alert if variance exceeds this absolute amount (0 to disable)</p>
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                      Loss Percentage Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={thresholdForm.lossPercentage}
                      onChange={(e) => setThresholdForm((prev) => ({ ...prev, lossPercentage: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-sm text-gray-700 mt-1 leading-normal">Alert if loss exceeds this percentage of delivered quantity</p>
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                      Loss Amount Threshold (units)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={thresholdForm.lossAmount}
                      onChange={(e) => setThresholdForm((prev) => ({ ...prev, lossAmount: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-sm text-gray-700 mt-1 leading-normal">Alert if loss exceeds this absolute amount (0 to disable)</p>
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                      Wastage Percentage Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={thresholdForm.wastagePercentage}
                      onChange={(e) => setThresholdForm((prev) => ({ ...prev, wastagePercentage: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-sm text-gray-700 mt-1 leading-normal">Alert if total wastage exceeds this percentage of purchased quantity</p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowThresholdModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    onClick={handleSaveThresholds}
                    isLoading={savingThresholds}
                    loadingText="Saving..."
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Save Thresholds
                  </LoadingButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function WastageAnalyticsPage() {
  return (
    <Suspense fallback={(
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-700">Loading wastage analytics...</p>
          </div>
        </div>
      </AppLayout>
    )}>
      <WastageAnalyticsPageContent />
    </Suspense>
  );
}