/**
 * Bulk Professional Activities Builder Page
 * Multi-step wizard for creating bulk professional activities
 * 
 * Route: /professional-activities/bulk
 */

'use client';

import { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { WizardProgress } from '@/components/bulk-request/wizard-progress';
import { WizardNavigation } from '@/components/bulk-request/wizard-navigation';
import { normalizeUserRole, isRole } from '@/lib/role-constants';

// Import step components (we'll create these)
import { Step1ProjectSettings } from '@/components/bulk-activity/step1-project-settings';
import { Step2ActivitySelection } from '@/components/bulk-activity/step2-activity-selection';
import { Step3EditDetails } from '@/components/bulk-activity/step3-edit-details';
import { Step4Review } from '@/components/bulk-activity/step4-review';

function BulkActivityPageContent() {
  const router = useRouter();
  const { canAccess, user } = usePermissions();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stepValidation, setStepValidation] = useState({ 1: false, 2: false, 3: false, 4: false });

  // Wizard data state
  const [wizardData, setWizardData] = useState({
    // Step 1: Project & Professional Service
    projectId: '',
    professionalServiceId: '',
    defaultPhaseId: '',
    defaultFloorId: '',

    // Step 2: Activities
    activities: [],
    selectedTemplates: [],

    // Step 3: Edit Details (uses activities array)
    // Step 4: Review (uses activities array)
  });

  // Check permissions
  useEffect(() => {
    if (user && !canAccess('create_professional_activity')) {
      toast.showError('You do not have permission to create professional activities');
      router.push('/professional-activities');
    }
  }, [user, canAccess, router, toast]);

  const validateStep = (step) => {
    switch (step) {
      case 1:
        return !!wizardData.projectId && !!wizardData.professionalServiceId;
      case 2:
        return wizardData.activities && wizardData.activities.length > 0;
      case 3:
        return wizardData.activities && wizardData.activities.length > 0;
      case 4:
        return wizardData.activities && wizardData.activities.length > 0;
      default:
        return false;
    }
  };

  const handleStepValidationChange = useCallback((step, isValid) => {
    setStepValidation((prev) => ({ ...prev, [step]: isValid }));
  }, []);

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      toast.showError('Please complete all required fields before proceeding');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
    setError(null);
  };

  const step1ValidationCallback = useCallback((isValid) => handleStepValidationChange(1, isValid), [handleStepValidationChange]);
  const step2ValidationCallback = useCallback((isValid) => handleStepValidationChange(2, isValid), [handleStepValidationChange]);
  const step3ValidationCallback = useCallback((isValid) => handleStepValidationChange(3, isValid), [handleStepValidationChange]);

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine if auto-approve (OWNER only)
      const userRole = normalizeUserRole(user?.role);
      const autoApprove = isRole(userRole, 'owner');

      const response = await fetch('/api/professional-activities/bulk', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          ...wizardData,
          autoApprove,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create bulk activities');
      }

      toast.showSuccess(
        `Bulk activities created successfully! ${autoApprove ? 'Auto-approved.' : 'Pending approval.'}`
      );

      // Redirect to activities page
      router.push('/professional-activities');
    } catch (err) {
      setError(err.message);
      console.error('Create bulk activities error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateWizardData = (updates) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1ProjectSettings
            wizardData={wizardData}
            onUpdate={updateWizardData}
            onValidationChange={step1ValidationCallback}
          />
        );
      case 2:
        return (
          <Step2ActivitySelection
            wizardData={wizardData}
            onUpdate={updateWizardData}
            onValidationChange={step2ValidationCallback}
          />
        );
      case 3:
        return (
          <Step3EditDetails
            wizardData={wizardData}
            onUpdate={updateWizardData}
            onValidationChange={step3ValidationCallback}
          />
        );
      case 4:
        return (
          <Step4Review
            wizardData={wizardData}
            user={user}
          />
        );
      default:
        return null;
    }
  };

  const getStepLabels = () => {
    return {
      1: 'Project & Professional',
      2: 'Select Activities',
      3: 'Edit Details',
      4: 'Review & Submit',
    };
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/professional-activities" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Professional Activities
          </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
            Bulk Activity Entry
          </h1>
          <p className="text-gray-600 mt-2">
            Create multiple professional activities at once using templates or manual entry
          </p>
        </div>

        {/* Progress */}
        <WizardProgress currentStep={currentStep} totalSteps={4} stepLabels={getStepLabels()} />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          {renderStep()}
        </div>

        {/* Navigation */}
        <WizardNavigation
          currentStep={currentStep}
          totalSteps={4}
          onBack={handleBack}
          onNext={handleNext}
          onSubmit={handleSubmit}
          isLoading={loading}
          canGoNext={validateStep(currentStep)}
          isLastStep={currentStep === 4}
        />
      </div>
    </AppLayout>
  );
}

export default function BulkActivityPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <LoadingTable rows={3} columns={1} />
          </div>
        </div>
      </AppLayout>
    }>
      <BulkActivityPageContent />
    </Suspense>
  );
}

