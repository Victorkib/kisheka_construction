/**
 * Post-Creation Setup Wizard Component
 * Guides users through essential setup steps after project creation
 * 
 * Shows a wizard/modal that guides users through:
 * 1. Set budget (if not set)
 * 2. Allocate capital
 * 3. Review/configure floors (including basements)
 * 4. Add suppliers
 * 5. Create categories
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/toast';

export function PostCreationWizard({ projectId, projectData, onComplete, onDismiss }) {
  const router = useRouter();
  const toast = useToast();
  const [prerequisites, setPrerequisites] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchPrerequisites();
    }
  }, [projectId]);

  const fetchPrerequisites = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/prerequisites`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setPrerequisites(data.data);
      }
    } catch (err) {
      console.error('Error fetching prerequisites:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleComplete = () => {
    setDismissed(true);
    if (onComplete) {
      onComplete();
    }
  };

  if (dismissed || loading || !prerequisites) {
    return null;
  }

  // Check if phases exist
  const phasesExist = prerequisites.prerequisites.phases?.completed || false;
  
  // Determine which steps need attention
  const steps = [];
  
  // Phase initialization check (if not completed)
  if (!phasesExist) {
    steps.push({
      id: 'phases',
      title: 'Initialize Phases',
      description: 'Initialize default construction phases for phase-based budget tracking and financial management',
      href: `/api/projects/${projectId}/phases/initialize`,
      actionType: 'api_call', // Special handling for API call
      icon: '🏗️',
      color: 'indigo',
      completed: false,
      priority: 'high',
    });
  }
  
  if (!prerequisites.prerequisites.budget.completed) {
    steps.push({
      id: 'budget',
      title: 'Set Project Budget',
      description: 'Define the total budget and allocate amounts for materials, labour, and contingency',
      href: `/projects/${projectId}/edit`,
      icon: '💰',
      color: 'blue',
      completed: false,
      priority: phasesExist ? 'high' : 'medium', // Lower priority if phases not initialized
    });
  }

  if (!prerequisites.prerequisites.capital.completed) {
    steps.push({
      id: 'capital',
      title: 'Allocate Capital',
      description: 'Add investors and allocate capital to this project',
      href: `/financing?projectId=${projectId}`,
      icon: '💵',
      color: 'green',
      completed: false,
      priority: 'high',
    });
  }

  if (!prerequisites.prerequisites.floors.completed) {
    steps.push({
      id: 'floors',
      title: 'Review Floors',
      description: 'Review and configure project floors (including basements)',
      href: `/floors?projectId=${projectId}`,
      icon: '🏢',
      color: 'purple',
      completed: false,
      priority: 'medium',
    });
  }

  if (!prerequisites.prerequisites.suppliers.completed) {
    steps.push({
      id: 'suppliers',
      title: 'Add Suppliers',
      description: 'Create supplier profiles for material procurement',
      href: '/suppliers/new',
      icon: '🏪',
      color: 'orange',
      completed: false,
    });
  }

  if (!prerequisites.prerequisites.categories.completed) {
    steps.push({
      id: 'categories',
      title: 'Create Categories',
      description: 'Set up material categories for better organization',
      href: '/categories',
      icon: '📁',
      color: 'indigo',
      completed: false,
    });
  }

  // If all steps are complete, don't show wizard
  if (steps.length === 0) {
    return null;
  }

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const overallProgress = prerequisites.readiness.completionPercentage;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 mb-6 shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-3xl">🎯</div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Project Setup Wizard</h2>
              <p className="text-sm text-gray-600">Complete these steps to get your project ready</p>
            </div>
          </div>
          
          {/* Overall Progress */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">Overall Setup Progress</span>
              <span className="text-sm font-semibold text-blue-600">{overallProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 transition"
          title="Dismiss wizard"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Current Step */}
      {currentStepData && (
        <div className="bg-white rounded-lg p-5 mb-4 border border-blue-100">
          <div className="flex items-start gap-4">
            <div className={`text-4xl flex-shrink-0`}>
              {currentStepData.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  Step {currentStep + 1} of {steps.length}
                </span>
                <h3 className="text-lg font-bold text-gray-900">{currentStepData.title}</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">{currentStepData.description}</p>
              
              <div className="flex gap-2">
                {currentStepData.actionType === 'api_call' ? (
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(currentStepData.href, { method: 'POST' });
                        const data = await response.json();
                        if (data.success) {
                          toast.showSuccess('Phases initialized successfully!');
                          // Refresh prerequisites to update status
                          await fetchPrerequisites();
                          // Move to next step or complete
                          if (currentStep < steps.length - 1) {
                            setCurrentStep(currentStep + 1);
                          } else {
                            handleComplete();
                          }
                        } else {
                          toast.showError(data.error || 'Failed to initialize phases');
                        }
                      } catch (err) {
                        toast.showError('Failed to initialize phases. Please try again.');
                        console.error('Phase initialization error:', err);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    Initialize Phases
                  </button>
                ) : (
                  <Link
                    href={currentStepData.href}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    {currentStepData.id === 'phases' && 'Initialize Phases'}
                    {currentStepData.id === 'budget' && 'Set Budget'}
                    {currentStepData.id === 'capital' && 'Allocate Capital'}
                    {currentStepData.id === 'floors' && 'Review Floors'}
                    {currentStepData.id === 'suppliers' && 'Add Supplier'}
                    {currentStepData.id === 'categories' && 'Manage Categories'}
                  </Link>
                )}
                <button
                  onClick={() => {
                    fetchPrerequisites();
                    if (currentStep < steps.length - 1) {
                      setCurrentStep(currentStep + 1);
                    } else {
                      handleComplete();
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700"
                >
                  {currentStep < steps.length - 1 ? 'Skip for Now' : 'Complete Setup'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Steps Overview */}
      <div className="bg-white rounded-lg p-4 border border-blue-100">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Setup Checklist</h4>
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-2 rounded ${
                index === currentStep ? 'bg-blue-50 border border-blue-200' : ''
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                index < currentStep
                  ? 'bg-green-100 text-green-700'
                  : index === currentStep
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {index < currentStep ? '✓' : index + 1}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  index === currentStep ? 'text-blue-900' : 'text-gray-700'
                }`}>
                  {step.title}
                </p>
              </div>
              {index < currentStep && (
                <span className="text-xs text-green-600 font-semibold">Done</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 flex gap-2 flex-wrap">
        <button
          onClick={fetchPrerequisites}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Refresh Status
        </button>
        <span className="text-gray-300">|</span>
        <Link
          href={`/projects/${projectId}`}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          View Project Details
        </Link>
      </div>
    </div>
  );
}




