/**
 * Modal Loading Overlay Component
 * Displays a loading overlay on modals during async operations
 * 
 * Features:
 * - Glassmorphism design matching modal style
 * - Animated spinner
 * - Contextual loading message
 * - Optional progress bar
 * - Prevents interactions
 */

'use client';

import { LoadingSpinner } from '@/components/loading';

/**
 * Modal Loading Overlay Component
 * @param {Object} props
 * @param {boolean} props.isLoading - Is loading
 * @param {string} props.message - Loading message
 * @param {number} props.progress - Progress percentage (0-100, optional)
 * @param {string} props.variant - Color variant (blue, red, yellow, green, indigo)
 */
export function ModalLoadingOverlay({
  isLoading = false,
  message = 'Processing...',
  progress = null,
  variant = 'blue',
}) {
  if (!isLoading) return null;

  // Variant color mappings for spinner
  const variantColors = {
    blue: 'blue-600',
    red: 'red-600',
    yellow: 'yellow-600',
    green: 'green-600',
    indigo: 'indigo-600',
  };

  const spinnerColor = variantColors[variant] || 'blue-600';

  // Variant gradient backgrounds
  const variantGradients = {
    blue: 'from-blue-50/90 to-blue-100/90',
    red: 'from-red-50/90 to-red-100/90',
    yellow: 'from-yellow-50/90 to-orange-50/90',
    green: 'from-green-50/90 to-emerald-50/90',
    indigo: 'from-indigo-50/90 to-purple-50/90',
  };

  const gradientBg = variantGradients[variant] || 'from-blue-50/90 to-blue-100/90';

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br bg-white/85 backdrop-blur-md transition-opacity duration-300"
      role="status"
      aria-label="Loading"
      aria-live="polite"
    >
      <div className={`relative bg-gradient-to-br ${gradientBg} backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/30 max-w-sm w-full mx-4`}>
        {/* Animated Background Glow */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientBg} rounded-2xl blur-xl opacity-50 animate-pulse`} />
        
        {/* Content */}
        <div className="relative flex flex-col items-center space-y-4">
          {/* Spinner */}
          <div className="relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${gradientBg} rounded-full blur-lg opacity-50 animate-pulse`} />
            <LoadingSpinner size="lg" color={spinnerColor} />
          </div>
          
          {/* Message */}
          {message && (
            <div className="text-center">
              <p className="text-base font-semibold text-gray-900 mb-1">
                {message}
              </p>
              {progress !== null && (
                <p className="text-xs text-gray-600 mt-1">
                  {Math.round(progress)}% complete
                </p>
              )}
            </div>
          )}

          {/* Progress Bar */}
          {progress !== null && (
            <div className="w-full mt-2">
              <div className="w-full bg-white/60 backdrop-blur-sm rounded-full h-2.5 overflow-hidden border border-white/30">
                <div
                  className={`h-full bg-gradient-to-r ${
                    variant === 'blue' ? 'from-blue-500 to-blue-600' :
                    variant === 'red' ? 'from-red-500 to-red-600' :
                    variant === 'yellow' ? 'from-yellow-500 to-orange-500' :
                    variant === 'green' ? 'from-green-500 to-emerald-600' :
                    'from-indigo-500 to-purple-600'
                  } rounded-full transition-all duration-300 ease-out shadow-lg`}
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </div>
          )}

          {/* Pulsing Indicator */}
          <div className="flex items-center gap-1 mt-2">
            {variant === 'blue' && (
              <>
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" style={{ animationDelay: '300ms' }} />
              </>
            )}
            {variant === 'red' && (
              <>
                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" style={{ animationDelay: '300ms' }} />
              </>
            )}
            {variant === 'yellow' && (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-600 animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-yellow-600 animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-yellow-600 animate-pulse" style={{ animationDelay: '300ms' }} />
              </>
            )}
            {variant === 'green' && (
              <>
                <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" style={{ animationDelay: '300ms' }} />
              </>
            )}
            {variant === 'indigo' && (
              <>
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" style={{ animationDelay: '300ms' }} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

