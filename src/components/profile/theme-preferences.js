'use client';

/**
 * Theme Preferences Component
 * Shown on /profile in the "Appearance / Theme" section.
 *
 * Uses the ThemeContext to allow the user to choose between:
 * - System (follow OS)
 * - Light
 * - Dark
 */

import { useTheme } from '@/contexts/ThemeContext';

const OPTIONS = [
  {
    id: 'system',
    label: 'System',
    description: 'Match your operating system appearance.',
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Bright theme for well-lit environments.',
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Dimmed theme for low-light and long sessions.',
  },
];

export function ThemePreferences() {
  const { mode, setMode, theme } = useTheme();

  return (
    <section className="ds-bg-surface rounded-lg shadow-sm border ds-border-subtle">
      <div className="px-4 py-3 border-b ds-border-subtle">
        <h2 className="text-sm font-semibold ds-text-primary">
          Appearance
        </h2>
        <p className="mt-1 text-xs ds-text-muted">
          Choose how Doshaki looks on this device. Your preference is saved in your browser.
        </p>
      </div>
      <div className="px-4 py-3 space-y-2">
        {OPTIONS.map((option) => {
          const isActive = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className={`w-full flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                isActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'ds-border-subtle hover:border-blue-400/60 hover:ds-bg-surface-muted'
              }`}
            >
              <div className="mt-0.5">
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-semibold ${
                    isActive
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'ds-border-subtle ds-text-muted'
                  }`}
                >
                  {isActive ? '✓' : ''}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium ds-text-primary">
                  {option.label}
                  {option.id === theme && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      Active
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs ds-text-muted">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

