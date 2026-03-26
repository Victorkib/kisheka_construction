/**
 * Basic Information Section
 * Worker, Project, Phase, Floor selection
 */

'use client';

import { LoadingSelect } from '@/components/loading';
import { getFieldValidationRules } from '@/lib/labour-entry-validation';
import { LABOUR_ENTRY_MODES } from '@/lib/constants/labour-entry-modes';

export function BasicInfoSection({
  formData,
  onChange,
  onSectionChange,
  entryMode,
  contextData,
  projects = [],
  phases = [],
  floors = [],
  workers = [],
  loadingProjects = false,
  loadingPhases = false,
  loadingFloors = false,
  loadingWorkers = false,
}) {
  const rules = getFieldValidationRules('workerId', entryMode);

  return (
    <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6">
      <h2 className="text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
        <svg
          className="w-5 h-5 ds-text-accent-primary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        Basic Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Worker Selection */}
        <div className={rules.hidden ? 'hidden' : ''}>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Worker {rules.required && <span className="text-red-500">*</span>}
          </label>
          {loadingWorkers ? (
            <LoadingSelect />
          ) : contextData.worker ? (
            // Pre-selected worker from context
            <div className="ds-bg-surface-muted rounded-lg p-4 border-2 ds-border-accent-subtle">
              <p className="font-bold ds-text-primary">
                {contextData.worker.workerName}
              </p>
              <p className="text-sm ds-text-secondary">
                {contextData.worker.employmentType} •{' '}
                {contextData.worker.workerType}
              </p>
              {contextData.worker.defaultHourlyRate && (
                <p className="text-sm ds-text-accent-primary mt-1">
                  Default Rate: KES {contextData.worker.defaultHourlyRate}/hour
                </p>
              )}
              <input
                type="hidden"
                name="workerId"
                value={contextData.worker._id}
              />
            </div>
          ) : (
            <select
              name="workerId"
              value={formData.workerId}
              onChange={onChange}
              required={rules.required}
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            >
              <option value="">Select Worker</option>
              {workers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.workerName} - {worker.employmentType} (
                  {worker.workerType})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Worker Name (for external workers or auto-populated) */}
        <div className={rules.hidden ? 'hidden' : ''}>
          {/* Hidden input ALWAYS present to ensure workerName is submitted */}
          <input
            type="hidden"
            name="workerName"
            value={formData.workerName || (contextData.worker?.workerName) || ''}
          />
          {/* Visible input only when no worker selected (for manual entry) */}
          {!formData.workerId && !contextData.worker && (
            <>
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Worker Name{' '}
                {rules.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                name="workerName"
                value={formData.workerName}
                onChange={onChange}
                placeholder="Enter worker name (for external workers)"
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
              />
            </>
          )}
          {/* Display worker name when worker is selected */}
          {(formData.workerId || contextData.worker) && (
            <div className="ds-bg-surface-muted rounded-lg p-3 border ds-border-subtle">
              <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                Worker Name
              </p>
              <p className="text-base font-bold ds-text-primary">
                {formData.workerName || contextData.worker?.workerName || 'Selected from dropdown'}
              </p>
            </div>
          )}
        </div>

        {/* Project Selection */}
        <div className={rules.hidden ? 'hidden' : ''}>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Project {rules.required && <span className="text-red-500">*</span>}
          </label>
          {loadingProjects ? (
            <LoadingSelect />
          ) : contextData.project ? (
            <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
              <p className="font-bold ds-text-primary">
                {contextData.project.projectName}
              </p>
              <p className="text-sm ds-text-secondary">
                {contextData.project.projectCode}
              </p>
              <input
                type="hidden"
                name="projectId"
                value={contextData.project._id}
              />
            </div>
          ) : (
            <select
              name="projectId"
              value={formData.projectId}
              onChange={(e) => {
                onChange(e);
                onSectionChange?.('project', { projectId: e.target.value });
              }}
              required={rules.required}
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            >
              <option value="">Select Project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectName || project.projectCode}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Phase Selection */}
        <div className={rules.hidden ? 'hidden' : ''}>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Phase {rules.required && <span className="text-red-500">*</span>}
          </label>
          {loadingPhases ? (
            <LoadingSelect />
          ) : contextData.phase ? (
            <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
              <p className="font-bold ds-text-primary">
                {contextData.phase.phaseName}
              </p>
              <p className="text-sm ds-text-secondary">
                {contextData.phase.phaseCode}
              </p>
              <input
                type="hidden"
                name="phaseId"
                value={contextData.phase._id}
              />
            </div>
          ) : (
            <select
              name="phaseId"
              value={formData.phaseId}
              onChange={(e) => {
                onChange(e);
                onSectionChange?.('phase', { phaseId: e.target.value });
              }}
              required={rules.required}
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            >
              <option value="">Select Phase</option>
              {phases.map((phase) => (
                <option key={phase._id} value={phase._id}>
                  {phase.phaseName || phase.phaseCode}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Floor Selection (Optional) */}
        <div className={rules.hidden ? 'hidden' : ''}>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Floor (Optional)
          </label>
          {loadingFloors ? (
            <LoadingSelect />
          ) : (
            <select
              name="floorId"
              value={formData.floorId}
              onChange={onChange}
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            >
              <option value="">Select Floor (Optional)</option>
              {floors.map((floor) => (
                <option key={floor._id} value={floor._id}>
                  {floor.name || `Floor ${floor.floorNumber}`}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Entry Mode Info */}
      {entryMode === LABOUR_ENTRY_MODES.EQUIPMENT_OPERATOR && (
        <div className="mt-4 ds-bg-blue-50 border border-blue-400/60 rounded-lg p-4">
          <p className="text-sm text-blue-800 flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <strong>Equipment Operator Labour:</strong> Work item is optional.
            Equipment details will be shown in the next section.
          </p>
        </div>
      )}

      {entryMode === LABOUR_ENTRY_MODES.INDIRECT && (
        <div className="mt-4 ds-bg-purple-50 border border-purple-400/60 rounded-lg p-4">
          <p className="text-sm text-purple-800 flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <strong>Indirect Labour:</strong> Work item not required. You'll
            select an indirect cost category in the next section.
          </p>
        </div>
      )}
    </div>
  );
}

export default BasicInfoSection;
