/**
 * Phase Filter Component
 * Reusable component for filtering by phase across all list views
 * 
 * @param {Object} props
 * @param {string} props.projectId - Project ID to fetch phases for (optional, will fetch all if not provided)
 * @param {string} props.value - Current selected phaseId value
 * @param {Function} props.onChange - Callback when phase selection changes (receives phaseId or null)
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.disabled - Whether the filter is disabled
 * @param {string} props.label - Label text (default: "Phase")
 * @param {boolean} props.showAllOption - Whether to show "All Phases" option (default: true)
 */

'use client';

import { useState, useEffect } from 'react';

export function PhaseFilter({
  projectId,
  value,
  onChange,
  className = '',
  disabled = false,
  label = 'Phase',
  showAllOption = true,
}) {
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPhases();
  }, [projectId]);

  const fetchPhases = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build API URL
      const url = projectId
        ? `/api/phases?projectId=${projectId}`
        : '/api/phases';

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        // Sort phases by sequence if available, otherwise by name
        const sortedPhases = (data.data || []).sort((a, b) => {
          if (a.sequence !== undefined && b.sequence !== undefined) {
            return a.sequence - b.sequence;
          }
          return (a.phaseName || a.name || '').localeCompare(b.phaseName || b.name || '');
        });
        setPhases(sortedPhases);
      } else {
        setError(data.error || 'Failed to fetch phases');
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
      setError('Failed to load phases');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const selectedValue = e.target.value || null;
    onChange(selectedValue);
  };

  const defaultClassName = 'w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className={className}>
      <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
        {label}
      </label>
      <select
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || loading}
        className={defaultClassName}
        aria-label={label}
      >
        {showAllOption && (
          <option value="">All Phases</option>
        )}
        {loading ? (
          <option disabled>Loading phases...</option>
        ) : error ? (
          <option disabled>Error loading phases</option>
        ) : phases.length === 0 ? (
          <option disabled>No phases available</option>
        ) : (
          phases.map((phase) => {
            const phaseId = phase._id?.toString() || phase.id;
            const phaseName = phase.phaseName || phase.name || 'Unnamed Phase';
            const phaseCode = phase.phaseCode || phase.code || '';
            const displayName = phaseCode ? `${phaseName} (${phaseCode})` : phaseName;

            return (
              <option key={phaseId} value={phaseId}>
                {displayName}
              </option>
            );
          })
        )}
      </select>
      {error && !loading && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

export default PhaseFilter;


