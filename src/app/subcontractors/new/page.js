/**
 * New Subcontractor Page
 * Form to create a new subcontractor assignment
 * 
 * Route: /subcontractors/new
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton, LoadingSpinner } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { SUBCONTRACTOR_TYPES, SUBCONTRACTOR_STATUSES, CONTRACT_TYPES, getSubcontractorTypeLabel, getContractTypeLabel } from '@/lib/constants/subcontractor-constants';

function NewSubcontractorPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { canAccess } = usePermissions();
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  
  const projectIdFromUrl = searchParams.get('projectId');
  const phaseIdFromUrl = searchParams.get('phaseId');
  const floorIdFromUrl = searchParams.get('floorId');
  
  const [formData, setFormData] = useState({
    projectId: projectIdFromUrl || '',
    phaseId: phaseIdFromUrl || '',
    floorId: floorIdFromUrl || '',
    subcontractorName: '',
    subcontractorType: '',
    contactPerson: '',
    phone: '',
    email: '',
    contractValue: '',
    contractType: 'fixed_price',
    startDate: '',
    endDate: '',
    paymentSchedule: [],
    status: 'pending',
    notes: ''
  });

  const [newPayment, setNewPayment] = useState({
    milestone: '',
    amount: '',
    dueDate: ''
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (formData.projectId) {
      fetchPhases(formData.projectId);
    } else {
      setPhases([]);
    }
  }, [formData.projectId]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      // Use /api/projects/accessible to respect project-based organization and user memberships
      const response = await fetch('/api/projects/accessible', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        // API returns projects array directly in data.data
        const projectsList = Array.isArray(data.data) ? data.data : [];
        setProjects(projectsList);
        // Auto-select first project if only one exists and no projectId from query params
        if (projectsList.length === 1 && !formData.projectId) {
          setFormData(prev => ({ ...prev, projectId: projectsList[0]._id }));
        }
      } else {
        console.error('Failed to fetch accessible projects:', data.error);
        setProjects([]);
        toast.showError('Failed to load projects. Please refresh the page.');
      }
    } catch (err) {
      console.error('Error fetching accessible projects:', err);
      setProjects([]);
      toast.showError('Error loading projects. Please try again.');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchPhases = async (projectId) => {
    try {
      setLoadingPhases(true);
      const response = await fetch(`/api/phases?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        // API returns phases array directly in data.data
        const phasesList = Array.isArray(data.data) ? data.data : [];
        setPhases(phasesList);
        // Auto-select first phase if only one exists and no phaseId from query params
        if (phasesList.length === 1 && !formData.phaseId) {
          setFormData(prev => ({ ...prev, phaseId: phasesList[0]._id }));
        }
      } else {
        console.error('Failed to fetch phases:', data.error);
        setPhases([]);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
      setPhases([]);
    } finally {
      setLoadingPhases(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setNewPayment((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const addPayment = () => {
    if (!newPayment.milestone || !newPayment.amount || !newPayment.dueDate) {
      toast.showError('Please fill in all payment fields');
      return;
    }

    const payment = {
      milestone: newPayment.milestone.trim(),
      amount: parseFloat(newPayment.amount),
      dueDate: newPayment.dueDate,
      paid: false,
      paidDate: null,
      paymentReference: ''
    };

    setFormData((prev) => ({
      ...prev,
      paymentSchedule: [...prev.paymentSchedule, payment]
    }));

    setNewPayment({ milestone: '', amount: '', dueDate: '' });
  };

  const removePayment = (index) => {
    setFormData((prev) => ({
      ...prev,
      paymentSchedule: prev.paymentSchedule.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Validate payment schedule doesn't exceed contract value
      if (formData.paymentSchedule.length > 0 && formData.contractValue) {
        const totalScheduled = formData.paymentSchedule.reduce((sum, p) => sum + (p.amount || 0), 0);
        if (totalScheduled > parseFloat(formData.contractValue) * 1.1) {
          throw new Error(`Total payment schedule (${totalScheduled}) exceeds contract value (${formData.contractValue}) by more than 10%`);
        }
      }

      const response = await fetch('/api/subcontractors', {
        method: 'POST',
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
        throw new Error(data.error || 'Failed to create subcontractor');
      }

      toast.showSuccess('Subcontractor created successfully');
      router.push(`/subcontractors/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to create subcontractor');
      console.error('Create subcontractor error:', err);
    } finally {
      setSaving(false);
    }
  };

  const totalScheduled = formData.paymentSchedule.reduce((sum, p) => sum + (p.amount || 0), 0);
  const contractValue = parseFloat(formData.contractValue) || 0;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/subcontractors" className="ds-text-accent-primary hover:ds-text-accent-hover mb-4 inline-block font-medium">
            ← Back to Subcontractors
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold ds-text-primary">New Subcontractor Assignment</h1>
          <p className="ds-text-secondary mt-1">Create a new subcontractor assignment for a phase</p>
        </div>

        {/* Information Card */}
        <div className="bg-gradient-to-br from-purple-50 via-violet-50 to-purple-100 rounded-xl border-2 border-purple-400/60 p-4 sm:p-6 mb-6 shadow-lg transition-all duration-300">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-base sm:text-lg font-bold ds-text-primary">Creating a Subcontractor Assignment</h3>
                <button
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 ds-bg-surface/80 hover:ds-bg-surface border border-purple-400/60 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  aria-label={isInfoExpanded ? 'Collapse information' : 'Expand information'}
                  aria-expanded={isInfoExpanded}
                >
                  <svg 
                    className={`w-5 h-5 sm:w-6 sm:h-6 text-purple-600 transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {isInfoExpanded ? (
                <div className="space-y-3 animate-fadeIn">
                  <p className="text-xs sm:text-sm ds-text-secondary leading-relaxed">
                    Subcontractors are external contractors and service providers hired for specific work. This includes construction labour (masons, electricians, plumbers), professional services (architects, engineers, surveyors), and specialized technicians (HVAC, lift technicians, fire safety).
                  </p>
                  <div className="ds-bg-surface/70 rounded-lg p-3 border border-purple-400/60">
                    <p className="text-xs ds-text-secondary">
                      <strong className="ds-text-primary">Tip:</strong> Specify the subcontractor type clearly, set up payment milestones based on work completion, and track performance ratings. Include contact information for easy communication and coordination.
                    </p>
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

        {/* Form */}
        <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-8">
          {error && (
            <div className="bg-red-50 border-2 border-red-400/60 text-red-800 px-4 py-3 rounded-lg mb-6 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Project & Phase Selection Section */}
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100">
              <h2 className="text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Project & Phase Selection
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Project Selection */}
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Project <span className="text-red-600">*</span>
                  </label>
                  {loadingProjects ? (
                    <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted">
                      Loading projects...
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="w-full px-4 py-2.5 bg-yellow-50 border-2 border-yellow-400/60 rounded-lg text-yellow-800">
                      No projects available
                    </div>
                  ) : (
                    <select
                      name="projectId"
                      value={formData.projectId}
                      onChange={handleChange}
                      required
                      disabled={loadingProjects}
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                    >
                      <option value="" className="ds-text-muted">Select Project</option>
                        {projects.map((project) => (
                        <option key={project._id} value={project._id} className="ds-text-primary">
                          {project.projectName || project.projectCode || 'Unnamed Project'}
                        </option>
                      ))}
                    </select>
                  )}
                  {projects.length > 0 && !formData.projectId && (
                    <p className="text-xs ds-text-muted mt-1.5">Please select a project to continue</p>
                  )}
                </div>

                {/* Phase Selection */}
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Phase <span className="text-red-600">*</span>
                  </label>
                  {loadingPhases ? (
                    <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted">
                      Loading phases...
                    </div>
                  ) : !formData.projectId ? (
                    <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted">
                      Select Project First
                    </div>
                  ) : phases.length === 0 ? (
                    <div className="w-full px-4 py-2.5 bg-yellow-50 border-2 border-yellow-400/60 rounded-lg text-yellow-800">
                      No phases available for this project
                    </div>
                  ) : (
                    <select
                      name="phaseId"
                      value={formData.phaseId}
                      onChange={handleChange}
                      required
                      disabled={loadingPhases || !formData.projectId}
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                    >
                      <option value="" className="ds-text-muted">Select Phase</option>
                        {phases.map((phase) => (
                        <option key={phase._id} value={phase._id} className="ds-text-primary">
                          {phase.phaseName || phase.name} {phase.phaseCode ? `(${phase.phaseCode})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {formData.projectId && phases.length > 0 && !formData.phaseId && (
                    <p className="text-xs ds-text-muted mt-1.5">Please select a phase</p>
                  )}
                </div>
                
                {/* Floor ID (optional, for finishing phases) */}
                {formData.floorId && (
                  <div className="md:col-span-2">
                    <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-3">
                      <p className="text-xs text-blue-800">
                        <strong>Note:</strong> This subcontractor will be linked to a specific floor (Floor ID: {formData.floorId}). 
                        This is useful for finishing-phase subcontractors that work on specific floors.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Subcontractor Details Section */}
            <div className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
              <h2 className="text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 ds-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Subcontractor Details
              </h2>
              
              {/* Subcontractor Name */}
              <div className="mb-6">
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Subcontractor Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="subcontractorName"
                  value={formData.subcontractorName}
                  onChange={handleChange}
                  required
                  minLength={2}
                  placeholder="e.g., ABC Electrical Services"
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:ds-text-muted transition-all duration-200 font-medium"
                />
              </div>

              {/* Subcontractor Type */}
              <div className="mb-6">
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Subcontractor Type <span className="text-red-600">*</span>
                </label>
                <select
                  name="subcontractorType"
                  value={formData.subcontractorType}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                >
                  <option value="" className="ds-text-muted">Select Type</option>
                  {SUBCONTRACTOR_TYPES.map((type) => (
                    <option key={type} value={type} className="ds-text-primary">
                      {getSubcontractorTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:ds-text-muted transition-all duration-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+254 700 000 000"
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:ds-text-muted transition-all duration-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="contact@example.com"
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:ds-text-muted transition-all duration-200 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Contract & Schedule Section */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-xl p-6 border border-indigo-400/60">
              <h2 className="text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Contract & Schedule
              </h2>
              
              {/* Contract Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Contract Value (KES) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    name="contractValue"
                    value={formData.contractValue}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:ds-text-muted transition-all duration-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Contract Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="contractType"
                    value={formData.contractType}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                  >
                    {CONTRACT_TYPES.map((type) => (
                      <option key={type} value={type} className="ds-text-primary">
                        {getContractTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Start Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    min={formData.startDate}
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Payment Schedule Section */}
            <div className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
              <h2 className="text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 ds-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Payment Schedule (Optional)
              </h2>
              
              {formData.paymentSchedule.length > 0 && (
                <div className="mb-6 space-y-3">
                  {formData.paymentSchedule.map((payment, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 ds-bg-surface rounded-lg border-2 ds-border-subtle shadow-sm">
                      <div className="flex-1">
                        <span className="font-bold ds-text-primary">{payment.milestone}</span>
                        <span className="ds-text-secondary ml-2 font-medium">
                          - KES {payment.amount.toLocaleString()} due {new Date(payment.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePayment(index)}
                        className="px-3 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg font-semibold transition-colors text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  
                  {contractValue > 0 && (
                    <div className="text-sm font-semibold ds-text-secondary mt-3 p-3 ds-bg-surface rounded-lg border ds-border-subtle">
                      Total Scheduled: <span className="ds-text-primary">KES {totalScheduled.toLocaleString()}</span> / <span className="ds-text-primary">KES {contractValue.toLocaleString()}</span>
                      {totalScheduled > contractValue * 1.1 && (
                        <span className="text-red-600 ml-2 font-bold">⚠ Exceeds contract value by more than 10%</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Milestone name"
                  value={newPayment.milestone}
                  onChange={(e) => handlePaymentChange({ target: { name: 'milestone', value: e.target.value } })}
                  className="px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:ds-text-muted transition-all duration-200 font-medium"
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={newPayment.amount}
                  onChange={(e) => handlePaymentChange({ target: { name: 'amount', value: e.target.value } })}
                  min="0"
                  step="0.01"
                  className="px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:ds-text-muted transition-all duration-200 font-medium"
                />
                <input
                  type="date"
                  placeholder="Due date"
                  value={newPayment.dueDate}
                  onChange={(e) => handlePaymentChange({ target: { name: 'dueDate', value: e.target.value } })}
                  className="px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                />
                <button
                  type="button"
                  onClick={addPayment}
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Add Payment
                </button>
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
              <h2 className="text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 ds-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Additional Information
              </h2>
              
              {/* Status */}
              <div className="mb-6">
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                >
                  {SUBCONTRACTOR_STATUSES.map((status) => (
                    <option key={status} value={status} className="ds-text-primary">
                      {status.replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Additional notes about this subcontractor assignment..."
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:ds-text-muted transition-all duration-200 font-medium resize-none"
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t-2 ds-border-subtle">
              <Link
                href="/subcontractors"
                className="px-6 py-2.5 border-2 ds-border-subtle rounded-lg ds-text-secondary font-semibold hover:ds-bg-surface-muted hover:ds-border-strong transition-all duration-200"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                isLoading={saving}
                className="px-8 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Create Subcontractor
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

export default function NewSubcontractorPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading form..." />
          </div>
        </AppLayout>
      }
    >
      <NewSubcontractorPageContent />
    </Suspense>
  );
}


