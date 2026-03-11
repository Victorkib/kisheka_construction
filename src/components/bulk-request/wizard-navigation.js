/**
 * Wizard Navigation Component
 * Back/Next/Save buttons with validation
 */

'use client';

import { LoadingButton } from '@/components/loading';

export function WizardNavigation({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSubmit,
  onSaveDraft,
  canGoBack = true,
  canGoNext = true,
  isLoading = false,
  backText = 'Back',
  nextText = 'Next',
  showSaveDraft = true,
  isLastStep = false,
}) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-4 sm:pt-6 border-t ds-border-subtle">
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        {canGoBack && currentStep > 1 && (
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted ds-text-secondary font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {backText}
          </button>
        )}
        {showSaveDraft && currentStep > 1 && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted ds-text-secondary font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            Save as Draft
          </button>
        )}
      </div>
      <div className="flex gap-3 w-full sm:w-auto">
        {currentStep < totalSteps && !isLastStep ? (
          <LoadingButton
            type="button"
            onClick={onNext}
            disabled={!canGoNext || isLoading}
            isLoading={isLoading}
            loadingText="Loading..."
            className="w-full sm:w-auto px-4 sm:px-6 py-2 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {nextText}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </LoadingButton>
        ) : (
          <LoadingButton
            type="button"
            onClick={onSubmit || onNext}
            disabled={!canGoNext || isLoading}
            isLoading={isLoading}
            loadingText="Submitting..."
            className="w-full sm:w-auto px-4 sm:px-6 py-2 ds-bg-success text-white rounded-lg hover:ds-bg-success cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {nextText || 'Submit'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </LoadingButton>
        )}
      </div>
    </div>
  );
}

