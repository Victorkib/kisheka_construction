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
  onSaveDraft,
  canGoBack = true,
  canGoNext = true,
  isLoading = false,
  backText = 'Back',
  nextText = 'Next',
  showSaveDraft = true,
}) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-200">
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        {canGoBack && currentStep > 1 && (
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {backText}
          </button>
        )}
        {showSaveDraft && currentStep > 1 && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            Save as Draft
          </button>
        )}
      </div>
      <div className="flex gap-3 w-full sm:w-auto">
        {currentStep < totalSteps ? (
          <LoadingButton
            type="button"
            onClick={onNext}
            disabled={!canGoNext || isLoading}
            isLoading={isLoading}
            loadingText="Loading..."
            className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {nextText}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </LoadingButton>
        ) : (
          <LoadingButton
            type="button"
            onClick={onNext}
            disabled={!canGoNext || isLoading}
            isLoading={isLoading}
            loadingText="Submitting..."
            className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {nextText || 'Submit Request'}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </LoadingButton>
        )}
      </div>
    </div>
  );
}

