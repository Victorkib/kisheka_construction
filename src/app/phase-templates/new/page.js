/**
 * Create Phase Template Page
 * Form to create a new phase template
 * 
 * Route: /phase-templates/new
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { TEMPLATE_TYPES } from '@/lib/schemas/phase-template-schema';
import { PHASE_TYPES as PHASE_TYPE_CONSTANTS } from '@/lib/schemas/phase-schema';

function NewPhaseTemplatePageContent() {
  const router = useRouter();
  const { canAccess, user } = usePermissions();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    templateName: '',
    templateType: 'custom',
    description: '',
    phases: [],
    defaultBudgetAllocation: {
      materials: 40,
      labour: 30,
      equipment: 10,
      subcontractors: 15,
      contingency: 5
    }
  });

  const [newPhase, setNewPhase] = useState({
    phaseName: '',
    phaseCode: '',
    phaseType: PHASE_TYPE_CONSTANTS.CONSTRUCTION,
    sequence: 0,
    description: '',
    defaultBudgetPercentage: 0,
    defaultWorkItems: [],
    defaultMilestones: [],
    newWorkItem: '',
    newMilestone: ''
  });

  useEffect(() => {
    // Wait for user to load before checking
    if (user === undefined) return; // Still loading
    
    const role = user?.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager'];
    
    if (!user || !role || !allowedRoles.includes(role)) {
      toast.showError('You do not have permission to create phase templates');
      router.push('/phase-templates');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('budget.')) {
      const budgetKey = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        defaultBudgetAllocation: {
          ...prev.defaultBudgetAllocation,
          [budgetKey]: parseFloat(value) || 0
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePhaseChange = (e) => {
    const { name, value } = e.target;
    setNewPhase(prev => ({ ...prev, [name]: value }));
  };

  const addWorkItem = () => {
    if (newPhase.newWorkItem.trim()) {
      setNewPhase(prev => ({
        ...prev,
        defaultWorkItems: [...prev.defaultWorkItems, prev.newWorkItem.trim()],
        newWorkItem: ''
      }));
    }
  };

  const removeWorkItem = (index) => {
    setNewPhase(prev => ({
      ...prev,
      defaultWorkItems: prev.defaultWorkItems.filter((_, i) => i !== index)
    }));
  };

  const addMilestone = () => {
    if (newPhase.newMilestone.trim()) {
      setNewPhase(prev => ({
        ...prev,
        defaultMilestones: [...prev.defaultMilestones, prev.newMilestone.trim()],
        newMilestone: ''
      }));
    }
  };

  const removeMilestone = (index) => {
    setNewPhase(prev => ({
      ...prev,
      defaultMilestones: prev.defaultMilestones.filter((_, i) => i !== index)
    }));
  };

  const addPhase = () => {
    if (!newPhase.phaseName.trim()) {
      toast.showError('Phase name is required');
      return;
    }

    const phaseCode = newPhase.phaseCode || `PHASE-${String(formData.phases.length + 1).padStart(2, '0')}`;
    
    setFormData(prev => ({
      ...prev,
      phases: [...prev.phases, {
        phaseName: newPhase.phaseName.trim(),
        phaseCode: phaseCode,
        phaseType: newPhase.phaseType,
        sequence: formData.phases.length,
        description: newPhase.description.trim(),
        defaultBudgetPercentage: parseFloat(newPhase.defaultBudgetPercentage) || 0,
        defaultWorkItems: [...newPhase.defaultWorkItems],
        defaultMilestones: [...newPhase.defaultMilestones]
      }]
    }));

    // Reset new phase form
    setNewPhase({
      phaseName: '',
      phaseCode: '',
      phaseType: PHASE_TYPE_CONSTANTS.CONSTRUCTION,
      sequence: formData.phases.length + 1,
      description: '',
      defaultBudgetPercentage: 0,
      defaultWorkItems: [],
      defaultMilestones: [],
      newWorkItem: '',
      newMilestone: ''
    });
  };

  const removePhase = (index) => {
    setFormData(prev => ({
      ...prev,
      phases: prev.phases.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate budget allocation sums to 100
      const budgetTotal = Object.values(formData.defaultBudgetAllocation).reduce((sum, val) => sum + (val || 0), 0);
      if (Math.abs(budgetTotal - 100) > 0.01) {
        throw new Error('Budget allocation percentages must sum to 100');
      }

      // Validate at least one phase
      if (formData.phases.length === 0) {
        throw new Error('Template must have at least one phase');
      }

      const response = await fetch('/api/phase-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create template');
      }

      toast.showSuccess('Phase template created successfully!');
      router.push(`/phase-templates/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to create template');
      console.error('Create template error:', err);
    } finally {
      setLoading(false);
    }
  };

  const budgetTotal = Object.values(formData.defaultBudgetAllocation).reduce((sum, val) => sum + (val || 0), 0);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/phase-templates" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Templates
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Create Phase Template</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Template Basic Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Template Information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="templateName"
                  name="templateName"
                  value={formData.templateName}
                  onChange={handleChange}
                  required
                  minLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="templateType" className="block text-sm font-medium text-gray-700 mb-2">
                  Template Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="templateType"
                  name="templateType"
                  value={formData.templateType}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TEMPLATE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Budget Allocation */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Default Budget Allocation</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(formData.defaultBudgetAllocation).map(([key, value]) => (
                <div key={key}>
                  <label htmlFor={`budget.${key}`} className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                    {key}
                  </label>
                  <input
                    type="number"
                    id={`budget.${key}`}
                    name={`budget.${key}`}
                    value={value}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <p className={`text-sm font-medium ${Math.abs(budgetTotal - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                Total: {budgetTotal.toFixed(1)}% {Math.abs(budgetTotal - 100) < 0.01 ? '✓' : '(Must equal 100%)'}
              </p>
            </div>
          </div>

          {/* Phases */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Phase Definitions</h2>
            
            {/* Existing Phases */}
            {formData.phases.length > 0 && (
              <div className="space-y-3 mb-6">
                {formData.phases.map((phase, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{phase.phaseCode}: {phase.phaseName}</h3>
                        <p className="text-sm text-gray-600">Budget: {phase.defaultBudgetPercentage}%</p>
                        <p className="text-sm text-gray-600">
                          {phase.defaultWorkItems.length} work items, {phase.defaultMilestones.length} milestones
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePhase(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Phase Form */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Add Phase</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phaseName" className="block text-sm font-medium text-gray-700 mb-2">
                      Phase Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="phaseName"
                      name="phaseName"
                      value={newPhase.phaseName}
                      onChange={handlePhaseChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="phaseCode" className="block text-sm font-medium text-gray-700 mb-2">
                      Phase Code
                    </label>
                    <input
                      type="text"
                      id="phaseCode"
                      name="phaseCode"
                      value={newPhase.phaseCode}
                      onChange={handlePhaseChange}
                      placeholder="Auto-generated if empty"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phaseType" className="block text-sm font-medium text-gray-700 mb-2">
                      Phase Type
                    </label>
                    <select
                      id="phaseType"
                      name="phaseType"
                      value={newPhase.phaseType}
                      onChange={handlePhaseChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.values(PHASE_TYPE_CONSTANTS).map((type) => (
                        <option key={type} value={type}>
                          {type.replace('_', ' ').charAt(0).toUpperCase() + type.replace('_', ' ').slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="defaultBudgetPercentage" className="block text-sm font-medium text-gray-700 mb-2">
                      Budget Percentage <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="defaultBudgetPercentage"
                      name="defaultBudgetPercentage"
                      value={newPhase.defaultBudgetPercentage}
                      onChange={handlePhaseChange}
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phaseDescription" className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="phaseDescription"
                    name="description"
                    value={newPhase.description}
                    onChange={handlePhaseChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Work Items */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Work Items
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newPhase.newWorkItem}
                      onChange={(e) => setNewPhase(prev => ({ ...prev, newWorkItem: e.target.value }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addWorkItem();
                        }
                      }}
                      placeholder="Enter work item name..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addWorkItem}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {newPhase.defaultWorkItems.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newPhase.defaultWorkItems.map((item, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() => removeWorkItem(index)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Milestones */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Milestones
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newPhase.newMilestone}
                      onChange={(e) => setNewPhase(prev => ({ ...prev, newMilestone: e.target.value }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addMilestone();
                        }
                      }}
                      placeholder="Enter milestone name..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addMilestone}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {newPhase.defaultMilestones.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newPhase.defaultMilestones.map((milestone, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                        >
                          {milestone}
                          <button
                            type="button"
                            onClick={() => removeMilestone(index)}
                            className="ml-2 text-green-600 hover:text-green-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={addPhase}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Phase to Template
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Link
              href="/phase-templates"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <LoadingButton
              type="submit"
              isLoading={loading}
              disabled={formData.phases.length === 0 || Math.abs(budgetTotal - 100) > 0.01}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Create Template
            </LoadingButton>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewPhaseTemplatePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <NewPhaseTemplatePageContent />
    </Suspense>
  );
}

