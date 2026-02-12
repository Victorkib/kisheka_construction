/**
 * LoadingOverlay Component
 * Full-page or container overlay for loading states with premium construction-themed UI
 * 
 * @component
 * @param {boolean} isLoading - Whether to show the overlay
 * @param {string} message - Optional loading message
 * @param {number} progress - Optional progress percentage (0-100)
 * @param {function} onCancel - Optional cancel callback
 * @param {string} className - Additional CSS classes
 * @param {boolean} fullScreen - Whether overlay should be full screen
 * @param {('center'|'top')} position - Vertical alignment when not full screen
 */

'use client';

import { LoadingSpinner } from './loading-spinner';

export function LoadingOverlay({ 
  isLoading, 
  message = 'Loading...', 
  progress = null,
  onCancel = null,
  className = '',
  fullScreen = false,
  position = 'center',
}) {
  if (!isLoading) return null;

  const overlayClasses = fullScreen
    ? 'fixed inset-0 z-50'
    : 'absolute inset-0 z-10';

  const alignmentClasses =
    fullScreen || position === 'center'
      ? 'items-center justify-center'
      : 'items-start justify-center pt-10 sm:pt-16';

  return (
    <div
      className={`${overlayClasses} bg-white bg-opacity-90 backdrop-blur-sm flex ${alignmentClasses} ${className}`}
      role="status"
      aria-label="Loading overlay"
    >
      <div className="relative max-w-md w-full mx-4">
        {/* Glassmorphic card with construction accent */}
        <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-xl shadow-blue-500/10 backdrop-blur-xl">
          {/* Subtle animated gradient beams */}
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="absolute -inset-x-10 -top-24 h-40 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-amber-500/20 blur-3xl animate-pulse" />
            <div className="absolute inset-x-0 -bottom-24 h-40 bg-gradient-to-r from-sky-400/15 via-emerald-400/15 to-yellow-400/15 blur-3xl" />
          </div>

          <div className="relative px-6 py-6 sm:px-8 sm:py-7 space-y-4">
            {/* Icon + title row */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/40">
                <span className="text-2xl" aria-hidden="true">🏗️</span>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-blue-900 uppercase">
                  Doshaki Construction
                </p>
                <p className="text-xs text-gray-600">
                  Aligning your project data and finances
                </p>
              </div>
            </div>

            {/* Main loader */}
            <div className="flex flex-col items-center gap-3 pt-1">
              <div className="relative">
                {/* Soft halo behind spinner */}
                <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-xl" />
                <LoadingSpinner size="lg" color="blue-600" />
              </div>

              {message && (
                <p className="text-sm font-medium text-gray-800 text-center leading-snug">
                  {message}
                </p>
              )}

              {/* Optional progress bar */}
              {progress !== null && (
                <div className="w-full pt-1">
                  <div className="w-full rounded-full bg-gray-200/80 h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-400 transition-all duration-300 ease-out"
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 text-center">
                    {Math.round(progress)}% complete
                  </p>
                </div>
              )}
            </div>

            {/* Construction microcopy */}
            <div className="border-t border-white/70 pt-3 mt-1">
              <p className="text-[11px] leading-relaxed text-gray-500 text-center">
                We’re loading structural details for this project — materials, floors, finances and more —
                so everything lines up before you start building.
              </p>
            </div>

            {/* Optional cancel */}
            {onCancel && (
              <div className="flex justify-center pt-1.5">
                <button
                  onClick={onCancel}
                  className="px-4 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-300/80 rounded-full bg-white/70 hover:bg-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

