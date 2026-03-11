/**
 * Add Expense Page
 * Form for creating new expense entries
 * 
 * Route: /expenses/new
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { LoadingOverlay, LoadingButton } from '@/components/loading';

function NewExpensePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams?.get('projectId');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [phaseError, setPhaseError] = useState(null);

  const [formData, setFormData] = useState({
    projectId: '',
    amount: '',
    category: '',
    phaseId: '',
    description: '',
    vendor: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    referenceNumber: '',
    receiptFileUrl: null,
    notes: '',
    currency: 'KES',
    isIndirectCost: false, // NEW: Flag for indirect costs
    indirectCostCategory: '', // NEW: Indirect cost category
  });
  const [budgetInfo, setBudgetInfo] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState(null);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Update projectId if provided in URL
  useEffect(() => {
    if (projectIdFromUrl) {
      setFormData((prev) => ({ ...prev, projectId: projectIdFromUrl }));
    }
  }, [projectIdFromUrl]);

  // Fetch phases when projectId changes
  useEffect(() => {
    if (formData.projectId) {
      fetchPhases(formData.projectId);
    } else {
      setPhases([]);
      setFormData((prev) => ({ ...prev, phaseId: '' }));
    }
  }, [formData.projectId]);

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
      if (data.success) {
        setProjects(data.data || []);
        // Auto-select first project if available
        if (data.data && data.data.length > 0 && !formData.projectId) {
          setFormData((prev) => ({ ...prev, projectId: data.data[0]._id }));
        }
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    }
  };

  const fetchPhases = async (projectId) => {
    if (!projectId) {
      setPhases([]);
      setPhaseError(null);
      return;
    }
    setLoadingPhases(true);
    setPhaseError(null);
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        const phasesList = data.data || [];
        setPhases(phasesList);
        // Clear phase selection if current phase is not in the new list
        setFormData((prev) => {
          const currentPhaseId = prev.phaseId;
          const phaseExists = phasesList.some(p => p._id === currentPhaseId);
          return {
            ...prev,
            phaseId: phaseExists ? currentPhaseId : ''
          };
        });
        // Show error if no phases available
        if (phasesList.length === 0) {
          setPhaseError('No phases found for this project. Please create phases first.');
        }
      } else {
        setPhases([]);
        setPhaseError(data.error || 'Failed to load phases. Please try again.');
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
      setPhases([]);
      setPhaseError('Failed to load phases. Please check your connection and try again.');
    } finally {
      setLoadingPhases(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    const newFormData = { ...formData };
    newFormData[name] = newValue;
    
    // Auto-suggest isIndirectCost based on category
    if (name === 'category') {
      const indirectCategories = ['utilities', 'transport', 'safety'];
      const suggestedIsIndirect = indirectCategories.includes(value);
      
      // Auto-map category to indirectCostCategory
      const categoryMap = {
        'utilities': 'utilities',
        'transport': 'transportation',
        'safety': 'safetyCompliance',
        'accommodation': 'siteOverhead',
      };
      
      newFormData.isIndirectCost = suggestedIsIndirect;
      newFormData.indirectCostCategory = categoryMap[value] || '';
    }
    
    // Clear indirectCostCategory if isIndirectCost is unchecked
    if (name === 'isIndirectCost' && !checked) {
      newFormData.indirectCostCategory = '';
      setBudgetInfo(null); // Clear budget info when indirect cost is unchecked
    }
    
    setFormData(newFormData);
    
    // Validate budget when project, amount, or indirect cost settings change
    if (name === 'projectId' || name === 'amount' || name === 'isIndirectCost' || name === 'indirectCostCategory' || name === 'category') {
      if (name === 'projectId' || name === 'isIndirectCost' || name === 'category') {
        // Reset budget info when project or indirect cost settings change
        setBudgetInfo(null);
      }
      // Validate budget after a short delay (debounce) for amount changes
      if (name === 'amount' && newValue && newFormData.isIndirectCost && newFormData.indirectCostCategory) {
        setTimeout(() => {
          validateIndirectCostsBudget(newFormData);
        }, 500);
      } else if ((name === 'isIndirectCost' || name === 'indirectCostCategory') && newFormData.amount && newFormData.isIndirectCost && newFormData.indirectCostCategory) {
        // Also validate if indirect cost settings change and amount exists
        setTimeout(() => {
          validateIndirectCostsBudget(newFormData);
        }, 300);
      }
    }
  };

  const validateIndirectCostsBudget = async (formDataToUse = formData) => {
    if (!formDataToUse.projectId || !formDataToUse.amount || !formDataToUse.isIndirectCost || !formDataToUse.indirectCostCategory) {
      setBudgetInfo(null);
      return;
    }

    const amount = parseFloat(formDataToUse.amount);
    if (isNaN(amount) || amount <= 0) {
      setBudgetInfo(null);
      return;
    }

    setBudgetLoading(true);
    setBudgetError(null);

    try {
      // Fetch indirect costs summary
      const response = await fetch(`/api/projects/${formDataToUse.projectId}/indirect-costs`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const summaryResult = await summaryResponse.json();

      if (!summaryResult.success) {
        throw new Error(summaryResult.error || 'Failed to fetch budget information');
      }

      const summary = summaryResult.data;
      const available = summary.remaining || 0;
      const budgeted = summary.budgeted || 0;
      
      // OPTIONAL BUDGET: If budget is 0, allow operation (spending will still be tracked)
      const budgetNotSet = budgeted === 0;
      const isValid = budgetNotSet ? true : (amount <= available);
      const usageAfter = budgeted > 0 
        ? ((summary.spent + amount) / budgeted) * 100 
        : 0;

      setBudgetInfo({
        budgeted,
        spent: summary.spent,
        available,
        isValid,
        shortfall: budgetNotSet ? 0 : Math.max(0, amount - available),
        usageAfter,
        warning: usageAfter >= 80 && usageAfter < 100,
        exceeded: budgetNotSet ? false : (amount > available), // Don't mark as exceeded if budget not set
        budgetNotSet, // Add flag to indicate budget is not set
      });
    } catch (err) {
      console.error('Budget validation error:', err);
      setBudgetError(err.message);
      setBudgetInfo(null);
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.projectId || !formData.amount || !formData.category || !formData.description || !formData.vendor) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (parseFloat(formData.amount) <= 0) {
      setError('Amount must be greater than 0');
      setLoading(false);
      return;
    }

    // Phase is required for phase tracking and financial management
    if (!formData.phaseId || formData.phaseId.trim() === '') {
      setError('Phase selection is required for phase tracking and financial management. Please select a phase for this expense.');
      setLoading(false);
      return;
    }

    // Check indirect costs budget validation before submitting (only if marked as indirect)
    // OPTIONAL BUDGET: Only block if budget is set AND exceeded
    // If budget is not set, allow the operation (spending will still be tracked)
    if (formData.isIndirectCost && formData.indirectCostCategory && budgetInfo && budgetInfo.exceeded && !budgetInfo.budgetNotSet) {
      setError(`Cannot create expense: Insufficient indirect costs budget. Available: ${new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(budgetInfo.available)}, Required: ${new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(parseFloat(formData.amount))}`);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create expense');
      }

      // Redirect to expense detail page
      router.push(`/expenses/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      console.error('Create expense error:', err);
    } finally {
      setLoading(false);
    }
  };

  const expenseCategories = [
    { value: 'equipment_rental', label: 'Equipment Rental' },
    { value: 'transport', label: 'Transport' },
    { value: 'accommodation', label: 'Accommodation' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'safety', label: 'Safety' },
    { value: 'permits', label: 'Permits' },
    { value: 'training', label: 'Training' },
    { value: 'excavation', label: 'Excavation' },
    { value: 'earthworks', label: 'Earthworks' },
    { value: 'construction_services', label: 'Construction Services' },
    { value: 'other', label: 'Other' },
  ];

  const paymentMethods = [
    { value: 'CASH', label: 'Cash' },
    { value: 'M_PESA', label: 'M-Pesa' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'CHEQUE', label: 'Cheque' },
  ];

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <LoadingOverlay isLoading={loading} message="Creating expense..." fullScreen={false} />
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/expenses"
            className="ds-text-accent-primary hover:ds-text-accent-hover active:ds-text-accent-hover mb-4 inline-block text-sm sm:text-base transition-colors touch-manipulation"
          >
            ← Back to Expenses
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Add New Expense</h1>
          <p className="text-sm sm:text-base ds-text-secondary mt-2">Create a new expense entry</p>
          <div className="mt-4 bg-blue-50 border border-blue-400/60 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-blue-800 font-semibold mb-1">💡 When to use Expenses vs Materials:</p>
            <ul className="text-xs sm:text-sm text-blue-700 list-disc list-inside space-y-1">
              <li><strong>Use Expenses</strong> for services, work performed, rentals, and operational costs (e.g., excavation, equipment rental, transport, utilities)</li>
              <li><strong>Use Materials</strong> for physical items you purchase with quantities (e.g., cement, steel, tiles, paint)</li>
              <li>Expenses are deducted from your <strong>Contingency Budget</strong></li>
            </ul>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="ds-bg-surface rounded-lg shadow border ds-border-subtle p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Project Selection */}
          <div>
            <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              name="projectId"
              value={formData.projectId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectName || project.projectCode}
                </option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className="text-sm ds-text-secondary mt-1 leading-normal">
                No projects found. Please create a project first.
              </p>
            )}
          </div>

          {/* Amount and Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="px-3 py-2.5 border ds-border-subtle rounded-l-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus ds-bg-surface-muted touch-manipulation"
                >
                  <option value="KES">KES</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                  className={`flex-1 px-3 py-2.5 ds-bg-surface ds-text-primary border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted touch-manipulation ${
                    budgetInfo?.exceeded ? 'border-red-400/60 focus:ring-red-500' : 'ds-border-subtle'
                  }`}
                />
              </div>
              
              {/* Indirect Costs Budget Validation Info - Only show if marked as indirect cost */}
              {formData.isIndirectCost && formData.indirectCostCategory && (
                <>
                  {budgetLoading && (
                    <div className="mt-2 text-sm ds-text-secondary">
                      <span className="inline-flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 ds-text-accent-primary" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Validating budget...
                      </span>
                    </div>
                  )}

                  {budgetInfo && !budgetLoading && (
                    <div className={`mt-2 p-3 rounded-lg border ${
                      budgetInfo.budgetNotSet
                        ? 'bg-blue-50 border-blue-400/60'
                        : budgetInfo.exceeded 
                          ? 'bg-red-50 border-red-400/60' 
                          : budgetInfo.warning 
                            ? 'bg-yellow-50 border-yellow-400/60' 
                            : 'bg-green-50 border-green-400/60'
                    }`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className={`text-sm font-semibold ${
                            budgetInfo.budgetNotSet
                              ? 'text-blue-800'
                              : budgetInfo.exceeded 
                                ? 'text-red-800' 
                                : budgetInfo.warning 
                                  ? 'text-yellow-800' 
                                  : 'text-green-800'
                          }`}>
                            {budgetInfo.budgetNotSet
                              ? 'ℹ️ No Budget Set'
                              : budgetInfo.exceeded 
                                ? '⚠️ Insufficient Indirect Costs Budget' 
                                : budgetInfo.warning 
                                  ? '⚠️ Budget Warning' 
                                  : '✓ Budget Available'}
                          </p>
                          <p className="text-xs ds-text-secondary mt-1">
                            {budgetInfo.budgetNotSet
                              ? 'Operation allowed - spending will be tracked. Set budget later to enable budget validation.'
                              : `Available: ${new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(budgetInfo.available)}`}
                          </p>
                        </div>
                        {budgetInfo.exceeded && !budgetInfo.budgetNotSet && (
                          <p className="text-sm font-semibold text-red-800">
                            Shortfall: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(budgetInfo.shortfall)}
                          </p>
                        )}
                      </div>
                      {budgetInfo.warning && !budgetInfo.exceeded && !budgetInfo.budgetNotSet && (
                        <p className="text-xs text-yellow-700">
                          Indirect costs budget usage will be {budgetInfo.usageAfter.toFixed(1)}% after this expense
                        </p>
                      )}
                      {budgetInfo.exceeded && (
                        <p className="text-xs text-red-700">
                          This expense exceeds available indirect costs budget. Please adjust the amount or increase the budget.
                        </p>
                      )}
                    </div>
                  )}

                  {budgetError && (
                    <div className="mt-2 p-2 ds-bg-surface-muted border ds-border-subtle rounded text-xs ds-text-secondary">
                      Could not validate budget: {budgetError}
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted touch-manipulation"
              >
                <option value="">Select category</option>
                {expenseCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Construction Phase */}
          <div>
            <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">
              Construction Phase <span className="text-red-500">*</span>
            </label>
            {!formData.projectId ? (
              <div className="px-3 py-2 bg-yellow-50 border border-yellow-400/60 rounded-lg text-yellow-700 text-sm">
                Please select a project first to see available phases
              </div>
            ) : loadingPhases ? (
              <div className="px-3 py-2 ds-bg-surface-muted border ds-border-subtle rounded-lg ds-text-secondary text-sm flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 ds-border-subtle"></div>
                Loading phases...
              </div>
            ) : phaseError ? (
              <div className="space-y-2">
                <div className="px-3 py-2 bg-red-50 border border-red-400/60 rounded-lg text-red-700 text-sm">
                  {phaseError}
                </div>
                <Link
                  href={`/phases?projectId=${formData.projectId}`}
                  className="text-sm ds-text-accent-primary hover:underline"
                  target="_blank"
                >
                  Create phases for this project →
                </Link>
              </div>
            ) : phases.length === 0 ? (
              <div className="space-y-2">
                <div className="px-3 py-2 bg-red-50 border border-red-400/60 rounded-lg text-red-700 text-sm">
                  No phases available for this project. You must create at least one phase before creating an expense.
                </div>
                <Link
                  href={`/phases?projectId=${formData.projectId}`}
                  className="text-sm ds-text-accent-primary hover:underline"
                  target="_blank"
                >
                  Create phases for this project →
                </Link>
              </div>
            ) : (
              <select
                name="phaseId"
                value={formData.phaseId}
                onChange={handleChange}
                required
                disabled={loadingPhases || loading || !formData.projectId}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select a phase (required)</option>
                {phases.map((phase) => (
                  <option key={phase._id} value={phase._id}>
                    {phase.phaseName || phase.name || 'Unnamed Phase'} {phase.status ? `(${phase.status.replace('_', ' ')})` : ''}
                  </option>
                ))}
              </select>
            )}
            {formData.projectId && phases.length > 0 && !formData.phaseId && (
              <p className="mt-1 text-sm text-red-600">
                Phase selection is required for phase tracking and financial management.
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Describe the expense..."
              required
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted"
            />
          </div>

          {/* Vendor and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">
                Vendor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="vendor"
                value={formData.vendor}
                onChange={handleChange}
                placeholder="Vendor name"
                required
                className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted touch-manipulation"
              />
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 pr-12 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted cursor-pointer touch-manipulation"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    const input = e.target.closest('.relative').querySelector('input[type="date"]');
                    if (input) {
                      input.showPicker?.();
                      input.focus();
                    }
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-auto cursor-pointer hover:ds-bg-surface-muted active:ds-bg-surface rounded-r-lg transition-colors touch-manipulation min-h-[44px]"
                  aria-label="Open date picker"
                  tabIndex={-1}
                >
                  <svg className="w-5 h-5 ds-text-secondary hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Payment Method and Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">
                Payment Method
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted touch-manipulation"
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">
                Reference Number
              </label>
              <input
                type="text"
                name="referenceNumber"
                value={formData.referenceNumber}
                onChange={handleChange}
                placeholder="Payment reference (optional)"
                className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted touch-manipulation"
              />
            </div>
          </div>

          {/* Indirect Cost Options */}
          <div className="bg-blue-500/10 border border-blue-400/60 rounded-lg p-3 sm:p-4">
            <div className="flex items-start gap-3 mb-3">
              <input
                type="checkbox"
                id="isIndirectCost"
                name="isIndirectCost"
                checked={formData.isIndirectCost}
                onChange={handleChange}
                className="mt-1 w-5 h-5 text-blue-500 border-ds-border-subtle rounded focus:ring-blue-500 touch-manipulation flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <label htmlFor="isIndirectCost" className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1">
                  This is an Indirect Cost
                </label>
                <p className="text-xs sm:text-sm ds-text-secondary">
                  Indirect costs (utilities, transport, site overhead, safety) are charged to the project-level indirect costs budget, not the phase budget. They are still linked to a phase for timeline tracking.
                </p>
              </div>
            </div>
            
            {formData.isIndirectCost && (
              <div className="mt-3">
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Indirect Cost Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="indirectCostCategory"
                  value={formData.indirectCostCategory}
                  onChange={handleChange}
                  required={formData.isIndirectCost}
                  className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus touch-manipulation"
                >
                  <option value="">Select category</option>
                  <option value="utilities">Utilities</option>
                  <option value="siteOverhead">Site Overhead</option>
                  <option value="transportation">Transportation</option>
                  <option value="safetyCompliance">Safety & Compliance</option>
                </select>
              </div>
            )}
          </div>

          {/* Receipt Upload */}
          <div>
            <CloudinaryUploadWidget
              uploadPreset="Construction_Accountability_System"
              folder={formData.projectId ? `Kisheka_construction/expenses/${formData.projectId}` : 'Kisheka_construction/expenses'}
              label="Receipt Photo/Document"
              value={formData.receiptFileUrl}
              onChange={(url) => setFormData((prev) => ({ ...prev, receiptFileUrl: url }))}
              onDelete={() => setFormData((prev) => ({ ...prev, receiptFileUrl: null }))}
              maxSizeMB={5}
              acceptedTypes={['image/*', 'application/pdf']}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">
              Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted"
            />
          </div>

          {/* Submit Button */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 border-t">
            <Link
              href="/expenses"
              className="w-full sm:w-auto px-6 py-2.5 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted active:ds-bg-surface transition-colors touch-manipulation text-center"
            >
              Cancel
            </Link>
            <LoadingButton
              type="submit"
              isLoading={loading}
              loadingText="Creating..."
              className="w-full sm:w-auto px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              Create Expense
            </LoadingButton>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewExpensePage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 ds-text-secondary">Loading...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <NewExpensePageContent />
    </Suspense>
  );
}

