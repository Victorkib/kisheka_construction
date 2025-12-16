/**
 * Wizard Progress Component
 * Visual progress indicator for multi-step wizard
 */

'use client';

export function WizardProgress({ currentStep, totalSteps = 4 }) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center flex-1">
            {/* Step Circle */}
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                  step === currentStep
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                    : step < currentStep
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step < currentStep ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              {/* Step Label */}
              <div className="mt-2 text-xs text-center max-w-[100px]">
                <div
                  className={`font-medium ${
                    step === currentStep ? 'text-blue-600' : step < currentStep ? 'text-green-600' : 'text-gray-500'
                  }`}
                >
                  {getStepLabel(step)}
                </div>
              </div>
            </div>
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getStepLabel(step) {
  const labels = {
    1: 'Project & Settings',
    2: 'Select Materials',
    3: 'Edit Details',
    4: 'Review & Submit',
  };
  return labels[step] || `Step ${step}`;
}

