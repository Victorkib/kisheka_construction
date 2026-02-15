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
import { LoadingButton, LoadingOverlay } from '@/components/loading';
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
      const response = await fetch(`/api/projects/${projectId}/thresholds`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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

      const summaryResponse = await fetch(`/api/discrepancies/summary?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!summaryResponse.ok) {
        throw new Error(`HTTP ${summaryResponse.status}: Failed to fetch summary`);
      }

      const summaryData = await summaryResponse.json();

      if (!summaryData.success) {
        throw new Error(summaryData.error || 'Failed to fetch summary');
      }

      setSummary(summaryData.data);

      // Fetch suppliers with error handling
      try {
        const suppliersResponse = await fetch(`/api/discrepancies/suppliers?${params.toString()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });

        if (!suppliersResponse.ok) {
          throw new Error(`HTTP ${suppliersResponse.status}: Failed to fetch suppliers`);
        }

        const suppliersData = await suppliersResponse.json();

        if (suppliersData.success) {
          setSuppliers(suppliersData.data?.suppliers || suppliersData.data || []);
        } else {
          console.warn('Failed to fetch suppliers:', suppliersData.error);
          setSuppliers([]);
        }
      } catch (suppliersErr) {
        console.error('Error fetching suppliers:', suppliersErr);
        setSuppliers([]);
      }

      // Fetch discrepancies with error handling
      try {
        const discrepanciesResponse = await fetch(`/api/discrepancies/check?${params.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (!discrepanciesResponse.ok) {
          throw new Error(`HTTP ${discrepanciesResponse.status}: Failed to fetch discrepancies`);
        }

        const discrepanciesData = await discrepanciesResponse.json();

        if (discrepanciesData.success) {
          setDiscrepancies(discrepanciesData.data?.discrepancies || discrepanciesData.data || []);
        } else {
          console.warn('Failed to fetch discrepancies:', discrepanciesData.error);
          setDiscrepancies([]);
        }
      } catch (discrepanciesErr) {
        console.error('Error fetching discrepancies:', discrepanciesErr);
        setDiscrepancies([]);
      }

      // Fetch trends with error handling
      try {
        const trendsResponse = await fetch(`/api/discrepancies/trends?${params.toString()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });

        if (!trendsResponse.ok) {
          throw new Error(`HTTP ${trendsResponse.status}: Failed to fetch trends`);
        }

        const trendsData = await trendsResponse.json();

        if (trendsData.success) {
          setTrends(trendsData.data?.trends || trendsData.data || []);
        } else {
          console.warn('Failed to fetch trends:', trendsData.error);
          setTrends([]);
        }
      } catch (trendsErr) {
        console.error('Error fetching trends:', trendsErr);
        setTrends([]);
      }

      // Fetch category analysis with error handling
      try {
        const categoriesResponse = await fetch(`/api/discrepancies/categories?${params.toString()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });

        if (!categoriesResponse.ok) {
          throw new Error(`HTTP ${categoriesResponse.status}: Failed to fetch category analysis`);
        }

        const categoriesData = await categoriesResponse.json();

        if (categoriesData.success) {
          setCategoryAnalysis(categoriesData.data?.categories || categoriesData.data || []);
        } else {
          console.warn('Failed to fetch category analysis:', categoriesData.error);
          setCategoryAnalysis([]);
        }
      } catch (categoriesErr) {
        console.error('Error fetching category analysis:', categoriesErr);
        setCategoryAnalysis([]);
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
      const response = await fetch('/api/projects', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
      // Validate project IDs before fetching
      const validProjectIds = selectedProjects.filter((id) => {
        const project = projects.find((p) => p._id === id);
        return project !== undefined;
      });

      if (validProjectIds.length < 2) {
        toast.showError('Please select at least 2 valid projects for comparison');
        setComparisonData([]);
        setLoadingComparison(false);
        return;
      }

      // Fetch data for each project with individual error handling
      const comparisonPromises = validProjectIds.map(async (projId) => {
        try {
          const params = new URLSearchParams({ projectId: projId });
          if (!showAllTime) {
            if (dateRange.startDate) params.append('startDate', dateRange.startDate);
            if (dateRange.endDate) params.append('endDate', dateRange.endDate);
          }

          const summaryResponse = await fetch(`/api/discrepancies/summary?${params.toString()}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          });
          
          if (!summaryResponse.ok) {
            throw new Error(`HTTP ${summaryResponse.status}`);
          }

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
        } catch (err) {
          // Log error but continue with other projects
          const project = projects.find((p) => p._id === projId);
          const projectName = project?.projectName || project?.projectCode || projId;
          console.error(`Error fetching data for project ${projectName}:`, err);
          // Return error object so user knows which project failed
          return {
            projectId: projId,
            projectName,
            error: true,
            errorMessage: err.message || 'Failed to fetch data',
          };
        }
      });

      const results = await Promise.all(comparisonPromises);
      const validResults = results.filter((r) => r !== null && !r.error);
      const errorResults = results.filter((r) => r && r.error);

      // Show warning if some projects failed
      if (errorResults.length > 0 && validResults.length > 0) {
        toast.showWarning(
          `Failed to load data for ${errorResults.length} project(s). Showing available data.`
        );
      } else if (errorResults.length > 0 && validResults.length === 0) {
        toast.showError('Failed to load comparison data for all selected projects');
      }

      setComparisonData(validResults);
    } catch (err) {
      console.error('Error fetching comparison data:', err);
      toast.showError('Failed to load comparison data');
      setComparisonData([]);
    } finally {
      setLoadingComparison(false);
    }
  }, [selectedProjects, showAllTime, dateRange.startDate, dateRange.endDate, projects, toast]);

  useEffect(() => {
    if (comparisonMode && selectedProjects.length >= 2 && projects.length > 0) {
      fetchComparisonData();
    } else if (!comparisonMode) {
      setComparisonData([]);
    }
  }, [comparisonMode, selectedProjects, projects.length, fetchComparisonData]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
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
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
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

  // Prepare chart data with validation
  // Prepare chart data with comprehensive validation
  const severityData = summary && summary.severityBreakdown
    ? [
        { 
          name: 'Critical', 
          value: Math.max(0, parseFloat(summary.severityBreakdown.critical) || 0), 
          color: '#ef4444' 
        },
        { 
          name: 'High', 
          value: Math.max(0, parseFloat(summary.severityBreakdown.high) || 0), 
          color: '#f59e0b' 
        },
        { 
          name: 'Medium', 
          value: Math.max(0, parseFloat(summary.severityBreakdown.medium) || 0), 
          color: '#eab308' 
        },
        { 
          name: 'Low', 
          value: Math.max(0, parseFloat(summary.severityBreakdown.low) || 0), 
          color: '#3b82f6' 
        },
      ].filter((item) => !isNaN(item.value) && item.value > 0)
    : [];

  // Validate and prepare supplier data
  const supplierVarianceData = (Array.isArray(suppliers) ? suppliers : [])
    .slice(0, 10)
    .map((supplier) => {
      const variance = Math.max(0, parseFloat(supplier?.totalVariance) || 0);
      const varianceCost = Math.max(0, parseFloat(supplier?.totalVarianceCost) || 0);
      const deliveryAccuracy = Math.max(0, Math.min(100, parseFloat(supplier?.deliveryAccuracy) || 0));
      
      return {
        name: (supplier?.supplierName || 'Unknown').substring(0, 30), // Limit name length
        variance: isNaN(variance) ? 0 : variance,
        varianceCost: isNaN(varianceCost) ? 0 : varianceCost,
        deliveryAccuracy: isNaN(deliveryAccuracy) ? 0 : deliveryAccuracy,
      };
    })
    .filter((item) => !isNaN(item.variance) && !isNaN(item.varianceCost));

  // Validate and prepare discrepancy breakdown data
  const discrepancyBreakdown = (Array.isArray(discrepancies) ? discrepancies : [])
    .slice(0, 10)
    .map((d) => {
      const variance = Math.max(0, parseFloat(d?.metrics?.variance) || 0);
      const loss = Math.max(0, parseFloat(d?.metrics?.loss) || 0);
      const totalCost = Math.max(0, parseFloat(d?.metrics?.totalDiscrepancyCost) || 0);
      
      return {
        name: (d?.materialName || 'Unknown Material').substring(0, 40), // Limit name length
        variance: isNaN(variance) ? 0 : variance,
        loss: isNaN(loss) ? 0 : loss,
        totalCost: isNaN(totalCost) ? 0 : totalCost,
      };
    })
    .filter((item) => !isNaN(item.variance) && !isNaN(item.loss) && !isNaN(item.totalCost));

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
        <LoadingOverlay
          isLoading={exporting.pdf || exporting.excel || exporting.csv || savingThresholds}
          message="Processing analytics..."
          fullScreen
        />
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-base font-semibold text-gray-700 leading-normal">Materials with Issues</h3>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {summary.materialsWithIssues || 0} / {summary.totalMaterials || 0}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 leading-normal">
                    {summary.totalMaterials > 0
                      ? ((summary.materialsWithIssues / summary.totalMaterials) * 100).toFixed(1)
                      : 0}
                    % of total
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-base font-semibold text-gray-700 leading-normal">Average Wastage</h3>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">
                    {summary.metrics?.averageWastage?.toFixed(1) || summary.metrics?.totalWastage?.toFixed(1) || '0.0'}%
                  </p>
                  <p className="text-sm text-gray-700 mt-1 leading-normal">
                    {summary.materialsWithWastage || summary.totalMaterials || 0} materials analyzed
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-base font-semibold text-gray-700 leading-normal">Total Variance Cost</h3>
                  <p className="text-3xl font-bold text-orange-600 mt-2">
                    {formatCurrency(summary.metrics?.totalVarianceCost || 0)}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 leading-normal">
                    {(summary.metrics?.totalVariance || 0).toFixed(2)} units
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-base font-semibold text-gray-700 leading-normal">Total Loss Cost</h3>
                  <p className="text-3xl font-bold text-red-600 mt-2">
                    {formatCurrency(summary.metrics?.totalLossCost || 0)}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 leading-normal">
                    {(summary.metrics?.totalLoss || 0).toFixed(2)} units
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-base font-semibold text-gray-700 leading-normal">Total Discrepancy Cost</h3>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    {formatCurrency(summary.metrics?.totalDiscrepancyCost || 0)}
                  </p>
                  <p className="text-sm text-gray-700 mt-1 leading-normal">Combined impact</p>
                </div>
              </div>
            )}

            {summary && summary.severityBreakdown && severityData.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Severity Breakdown</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    {severityData.length > 0 ? (
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
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-gray-500">
                        No severity data available
                      </div>
                    )}
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

            {supplierVarianceData.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Supplier Performance</h2>
                {supplierVarianceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={supplierVarianceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45} 
                        textAnchor="end" 
                        height={100}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip
                        formatter={(value, name) => {
                          if (isNaN(value)) return 'N/A';
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
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-gray-500">
                    No supplier data available
                  </div>
                )}
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
                              {(discrepancy.metrics?.variance || 0).toFixed(2)} units
                            </div>
                            <div className="text-sm text-gray-700 leading-normal">
                              {(discrepancy.metrics?.variancePercentage || 0).toFixed(2)}%
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {(discrepancy.metrics?.loss || 0).toFixed(2)} units
                            </div>
                            <div className="text-sm text-gray-700 leading-normal">
                              {(discrepancy.metrics?.lossPercentage || 0).toFixed(2)}%
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-red-600">
                              {formatCurrency(discrepancy.metrics?.totalDiscrepancyCost || 0)}
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
                    {categoryAnalysis.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={categoryAnalysis.slice(0, 10).map((cat) => ({
                          category: (cat.category || 'Other').substring(0, 20),
                          materialsWithIssues: Math.max(0, parseFloat(cat.materialsWithIssues) || 0),
                          totalDiscrepancyCost: Math.max(0, parseFloat(cat.totalDiscrepancyCost) || 0),
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip
                            formatter={(value, name) => {
                              if (isNaN(value)) return 'N/A';
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
                    ) : (
                      <div className="flex items-center justify-center h-[300px] text-gray-500">
                        No category data available
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 leading-tight">Top Categories by Wastage</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {categoryAnalysis.slice(0, 10).map((cat, index) => {
                        const materialsWithIssues = Math.max(0, parseFloat(cat.materialsWithIssues) || 0);
                        const totalMaterials = Math.max(0, parseFloat(cat.totalMaterials) || 0);
                        const totalDiscrepancyCost = Math.max(0, parseFloat(cat.totalDiscrepancyCost) || 0);
                        const issueRate = totalMaterials > 0 
                          ? ((materialsWithIssues / totalMaterials) * 100)
                          : 0;
                        
                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{cat.category || 'Other'}</p>
                              <p className="text-sm text-gray-700">
                                {materialsWithIssues} / {totalMaterials} materials with issues
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-red-600">{formatCurrency(totalDiscrepancyCost)}</p>
                              <p className="text-sm text-gray-700 leading-normal">{issueRate.toFixed(1)}% issue rate</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {trends.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Historical Trends</h2>
                {trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={trends.map((t) => ({
                      ...t,
                      variance: Math.max(0, parseFloat(t.variance) || 0),
                      loss: Math.max(0, parseFloat(t.loss) || 0),
                      wastage: Math.max(0, Math.min(100, parseFloat(t.wastage) || 0)),
                      varianceCost: Math.max(0, parseFloat(t.varianceCost) || 0),
                      lossCost: Math.max(0, parseFloat(t.lossCost) || 0),
                      totalDiscrepancyCost: Math.max(0, parseFloat(t.totalDiscrepancyCost) || 0),
                    })).filter((t) => !isNaN(t.variance) && !isNaN(t.loss))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="monthLabel" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip
                        formatter={(value, name) => {
                          if (isNaN(value)) return 'N/A';
                          if (name === 'varianceCost' || name === 'lossCost' || name === 'totalDiscrepancyCost') {
                            return formatCurrency(value);
                          }
                          if (name === 'wastage') {
                            return `${value.toFixed(2)}%`;
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
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="loss"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        name="Loss (units)"
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="totalDiscrepancyCost"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        name="Total Cost Impact"
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-gray-500">
                    No trend data available
                  </div>
                )}
              </div>
            )}

            {discrepancyBreakdown.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Discrepancy Breakdown by Material</h2>
                {discrepancyBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={discrepancyBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip
                        formatter={(value, name) => {
                          if (isNaN(value)) return 'N/A';
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
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-gray-500">
                    No discrepancy breakdown data available
                  </div>
                )}
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