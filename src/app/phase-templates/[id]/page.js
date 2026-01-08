/**
 * Phase Template Detail Page
 * Displays template details and allows applying to projects
 * 
 * Route: /phase-templates/[id]
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingCard, LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState } from '@/components/empty-states';
import { TEMPLATE_TYPES } from '@/lib/schemas/phase-template-schema';

function PhaseTemplateDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess, user } = usePermissions();
  const { currentProject, accessibleProjects, isEmpty } = useProjectContext();
  const toast = useToast();

  const [template, setTemplate] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchTemplate();
      fetchProjects();
    }
  }, [fetchTemplate, params.id]);

  useEffect(() => {
    if (currentProject && !selectedProjectId) {
      setSelectedProjectId(normalizeProjectId(currentProject._id));
    }
  }, [currentProject, selectedProjectId]);

  const fetchTemplate = useCallback(async () => {
    if (!params.id) return;
    
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/phase-templates/${params.id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch template');
      }

      setTemplate(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch template error:', err);
      // Only show toast for actual errors, not permission errors
      if (!err.message.includes('permission')) {
        toast.showError(err.message || 'Failed to load template');
      }
    } finally {
      setLoading(false);
    }
  }, [params.id, toast]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedProjectId) {
      toast.showError('Please select a project');
      return;
    }

    setApplying(true);
    try {
      const response = await fetch(`/api/phase-templates/${params.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to apply template');
      }

      toast.showSuccess(`Template applied successfully! Created ${data.data.phasesCount} phase(s).`);
      setShowApplyModal(false);
      router.push(`/projects/${selectedProjectId}`);
    } catch (err) {
      toast.showError(err.message || 'Failed to apply template');
      console.error('Apply template error:', err);
    } finally {
      setApplying(false);
    }
  };

  const getTemplateTypeColor = (type) => {
    const colors = {
      'residential': 'bg-blue-100 text-blue-800',
      'commercial': 'bg-green-100 text-green-800',
      'infrastructure': 'bg-purple-100 text-purple-800',
      'custom': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingCard />
        </div>
      </AppLayout>
    );
  }

  if (error || !template) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Template not found'}
          </div>
          <Link href="/phase-templates" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Templates
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/phase-templates" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Templates
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{template.templateName}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getTemplateTypeColor(template.templateType)}`}>
                  {template.templateType.charAt(0).toUpperCase() + template.templateType.slice(1)}
                </span>
                <span className="text-sm text-gray-600">
                  Used {template.usageCount || 0} time{template.usageCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            {user && ['owner', 'pm', 'project_manager'].includes(user.role?.toLowerCase()) && (
              <button
                onClick={() => setShowApplyModal(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply to Project
              </button>
            )}
          </div>
        </div>

        {template.description && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
            <p className="text-gray-700">{template.description}</p>
          </div>
        )}

        {/* Budget Allocation */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Default Budget Allocation</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-gray-600">Materials</p>
              <p className="text-xl font-bold text-gray-900">{template.defaultBudgetAllocation?.materials || 0}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Labour</p>
              <p className="text-xl font-bold text-gray-900">{template.defaultBudgetAllocation?.labour || 0}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Equipment</p>
              <p className="text-xl font-bold text-gray-900">{template.defaultBudgetAllocation?.equipment || 0}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Subcontractors</p>
              <p className="text-xl font-bold text-gray-900">{template.defaultBudgetAllocation?.subcontractors || 0}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Contingency</p>
              <p className="text-xl font-bold text-gray-900">{template.defaultBudgetAllocation?.contingency || 0}%</p>
            </div>
          </div>
        </div>

        {/* Phases */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Phase Definitions ({template.phases?.length || 0})</h2>
          <div className="space-y-4">
            {template.phases && template.phases.length > 0 ? (
              template.phases.map((phase, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-md font-semibold text-gray-900">
                        {phase.phaseCode}: {phase.phaseName}
                      </h3>
                      <p className="text-sm text-gray-600 capitalize mt-1">{phase.phaseType?.replace('_', ' ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Budget</p>
                      <p className="text-lg font-bold text-gray-900">{phase.defaultBudgetPercentage}%</p>
                    </div>
                  </div>
                  {phase.description && (
                    <p className="text-sm text-gray-600 mb-3">{phase.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {phase.defaultWorkItems && phase.defaultWorkItems.length > 0 && (
                      <div>
                        <p className="text-gray-600 font-medium mb-1">Default Work Items:</p>
                        <ul className="list-disc list-inside text-gray-700">
                          {phase.defaultWorkItems.slice(0, 5).map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                          {phase.defaultWorkItems.length > 5 && (
                            <li className="text-gray-500">+{phase.defaultWorkItems.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                    {phase.defaultMilestones && phase.defaultMilestones.length > 0 && (
                      <div>
                        <p className="text-gray-600 font-medium mb-1">Default Milestones:</p>
                        <ul className="list-disc list-inside text-gray-700">
                          {phase.defaultMilestones.slice(0, 5).map((milestone, idx) => (
                            <li key={idx}>{milestone}</li>
                          ))}
                          {phase.defaultMilestones.length > 5 && (
                            <li className="text-gray-500">+{phase.defaultMilestones.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No phases defined in this template</p>
            )}
          </div>
        </div>

        {/* Apply Modal */}
        {showApplyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Apply Template to Project</h3>
                  <button
                    onClick={() => setShowApplyModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {isEmpty ? (
                  <NoProjectsEmptyState />
                ) : (
                  <>
                    <div className="mb-4">
                      <label htmlFor="project-select" className="block text-sm font-medium text-gray-700 mb-2">
                        Select Project <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="project-select"
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a project...</option>
                        {projects.map((project) => (
                          <option key={project._id} value={project._id}>
                            {project.projectName}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        This will create {template.phases?.length || 0} phase(s) in the selected project.
                      </p>
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t">
                      <button
                        onClick={() => setShowApplyModal(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <LoadingButton
                        onClick={handleApplyTemplate}
                        loading={applying}
                        disabled={!selectedProjectId}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        Apply Template
                      </LoadingButton>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function PhaseTemplateDetailPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PhaseTemplateDetailPageContent />
    </Suspense>
  );
}

