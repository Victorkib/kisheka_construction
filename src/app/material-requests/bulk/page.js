/**
 * Bulk Material Request Builder Page
 * Multi-step wizard for creating bulk material requests
 * 
 * Route: /material-requests/bulk
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
import { Step1ProjectSettings } from '@/components/bulk-request/step1-project-settings';
import { Step2MaterialSelection } from '@/components/bulk-request/step2-material-selection';
import { Step3EditDetails } from '@/components/bulk-request/step3-edit-details';
import { Step4Review } from '@/components/bulk-request/step4-review';
import { normalizeUserRole, isRole } from '@/lib/role-constants';

function BulkRequestPageContent() {
  const router = useRouter();
  const { canAccess, user } = usePermissions();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stepValidation, setStepValidation] = useState({ 1: false, 2: false, 3: false, 4: false });

  // Wizard data state
  const [wizardData, setWizardData] = useState({
    // Step 1: Project & Settings
    projectId: '',
    defaultFloorId: '',
    defaultPhaseId: '',
    defaultCategoryId: '',
    defaultUrgency: 'medium',
    defaultReason: '',
    batchName: '',

    // Step 2: Materials
    materials: [],
    selectedLibraryMaterials: [],

    // Step 3: Edit Details (uses materials array)
    // Step 4: Review (uses materials array)
  });

  // Check permissions
  useEffect(() => {
    if (user && !canAccess('create_bulk_material_request')) {
      toast.showError('You do not have permission to create bulk material requests');
      router.push('/material-requests');
    }
  }, [user, canAccess, router, toast]);

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!wizardData.projectId) {
          setError('Please select a project');
          return false;
        }
        // Phase Enforcement: Require defaultPhaseId OR all materials have phaseId
        // For Step 1, we require defaultPhaseId (users can override in Step 3)
        if (!wizardData.defaultPhaseId) {
          setError('Please select a default construction phase. This is required for phase tracking and budget management.');
          return false;
        }
        break;
      case 2:
        if (!wizardData.materials || wizardData.materials.length === 0) {
          setError('Please add at least one material');
          return false;
        }
        break;
      case 3:
        // Validate all materials have required fields
        // Support both 'name'/'materialName' and 'quantityNeeded'/'quantity' for backward compatibility
        if (!wizardData.materials || wizardData.materials.length === 0) {
          setError('Please add at least one material');
          return false;
        }
        const invalidMaterials = wizardData.materials.filter((m) => {
          const materialName = m.name || m.materialName || '';
          const hasName = materialName && typeof materialName === 'string' && materialName.trim().length >= 2;
          const quantity = parseFloat(m.quantityNeeded || m.quantity || 0);
          const hasQuantity = !isNaN(quantity) && quantity > 0;
          const hasUnit = m.unit && m.unit.trim().length > 0;
          return !hasName || !hasQuantity || !hasUnit;
        });
        if (invalidMaterials.length > 0) {
          setError(`Please fill in all required fields for all materials. ${invalidMaterials.length} material(s) are incomplete.`);
          return false;
        }
        break;
      case 4:
        // Final validation - check that step 3 is valid
        if (!wizardData.materials || wizardData.materials.length === 0) {
          setError('Please add at least one material');
          return false;
        }
        const invalidMaterialsFinal = wizardData.materials.filter((m) => {
          const materialName = m.name || m.materialName || '';
          const hasName = materialName && typeof materialName === 'string' && materialName.trim().length >= 2;
          const quantity = parseFloat(m.quantityNeeded || m.quantity || 0);
          const hasQuantity = !isNaN(quantity) && quantity > 0;
          const hasUnit = m.unit && m.unit.trim().length > 0;
          // Phase Enforcement: Material must have phaseId (from default or per-material)
          const hasPhaseId = !!(m.phaseId || wizardData.defaultPhaseId);
          return !hasName || !hasQuantity || !hasUnit || !hasPhaseId;
        });
        if (invalidMaterialsFinal.length > 0) {
          setError(`Please fill in all required fields for all materials. ${invalidMaterialsFinal.length} material(s) are incomplete.`);
          return false;
        }
        break;
      default:
        return true;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
      setError(null);
    }
  };

  const handleWizardDataUpdate = useCallback((updates) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Memoize validation change handlers to prevent infinite loops
  const handleStepValidationChange = useCallback((step, isValid) => {
    setStepValidation((prev) => {
      // Only update if the value actually changed
      if (prev[step] === isValid) {
        return prev;
      }
      return { ...prev, [step]: isValid };
    });
  }, []);

  // Memoize step validation callbacks to prevent infinite loops
  const step1ValidationCallback = useCallback((isValid) => handleStepValidationChange(1, isValid), [handleStepValidationChange]);
  const step2ValidationCallback = useCallback((isValid) => handleStepValidationChange(2, isValid), [handleStepValidationChange]);
  const step3ValidationCallback = useCallback((isValid) => handleStepValidationChange(3, isValid), [handleStepValidationChange]);

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError(null);
  };

  const handleSaveDraft = async () => {
    // TODO: Implement save as draft
    toast.showInfo('Save as draft feature coming soon');
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

      const response = await fetch('/api/material-requests/bulk', {
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
        throw new Error(data.error || 'Failed to create bulk request');
      }

      toast.showSuccess(
        `Bulk request created successfully! ${autoApprove ? 'Auto-approved and ready for supplier assignment.' : 'Pending approval.'}`
      );

      // Redirect based on approval status
      if (autoApprove) {
        // If auto-approved, redirect to supplier assignment
        router.push(`/material-requests/bulk/${data.data.batchId}/assign-suppliers`);
      } else {
        // If pending approval, redirect to approval page
        router.push(`/material-requests/bulk/${data.data.batchId}/approve`);
      }
    } catch (err) {
      setError(err.message);
      toast.showError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1ProjectSettings
            wizardData={wizardData}
            onUpdate={handleWizardDataUpdate}
            onValidationChange={step1ValidationCallback}
          />
        );
      case 2:
        return (
          <Step2MaterialSelection
            wizardData={wizardData}
            onUpdate={handleWizardDataUpdate}
            onValidationChange={step2ValidationCallback}
          />
        );
      case 3:
        return (
          <Step3EditDetails
            wizardData={wizardData}
            onUpdate={handleWizardDataUpdate}
            onValidationChange={step3ValidationCallback}
          />
        );
      case 4:
        return (
          <Step4Review
            wizardData={wizardData}
            user={user}
            onValidationChange={step3ValidationCallback}
          />
        );
      default:
        return null;
    }
  };

  if (!canAccess('create_bulk_material_request')) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to create bulk material requests.</p>
            <Link href="/material-requests" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
              ← Back to Material Requests
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/material-requests" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Material Requests
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Material Request</h1>
          <p className="text-gray-600 mt-2">Create multiple material requests at once</p>
        </div>

        {/* Progress Indicator */}
        <WizardProgress currentStep={currentStep} totalSteps={4} />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
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
          onNext={currentStep === 4 ? handleSubmit : handleNext}
          onSaveDraft={handleSaveDraft}
          canGoNext={currentStep === 4 ? stepValidation[3] === true : stepValidation[currentStep] !== false}
          isLoading={loading}
          showSaveDraft={currentStep > 1}
          nextText={currentStep === 4 ? 'Submit Request' : 'Next'}
        />
      </div>
    </AppLayout>
  );
}

export default function BulkRequestPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={5} columns={1} />
          </div>
        </AppLayout>
      }
    >
      <BulkRequestPageContent />
    </Suspense>
  );
}

