/**
 * Professional Services Section
 * Service type, visit purpose, deliverables
 */

'use client';

export function ProfessionalServicesSection({
  formData,
  onChange,
}) {
  const SERVICE_TYPES = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'inspection', label: 'Inspection' },
    { value: 'design', label: 'Design' },
    { value: 'approval', label: 'Approval' },
    { value: 'testing', label: 'Testing' },
    { value: 'review', label: 'Review' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6">
      <h2 className="text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Professional Services Details
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Service Type */}
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Service Type <span className="text-red-500">*</span>
          </label>
          <select
            name="serviceType"
            value={formData.serviceType}
            onChange={onChange}
            required
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          >
            <option value="">Select Service Type</option>
            {SERVICE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Visit Purpose */}
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Visit Purpose
          </label>
          <input
            type="text"
            name="visitPurpose"
            value={formData.visitPurpose}
            onChange={onChange}
            placeholder="e.g., Site inspection, Design review"
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>
      </div>

      {/* Deliverables */}
      <div className="mt-4">
        <label className="block text-sm font-semibold ds-text-primary mb-2">
          Deliverables (Optional)
        </label>
        <textarea
          name="deliverables"
          value={Array.isArray(formData.deliverables) ? formData.deliverables.join(', ') : formData.deliverables}
          onChange={(e) => {
            const deliverables = e.target.value.split(',').map(d => d.trim()).filter(Boolean);
            onChange({ target: { name: 'deliverables', value: deliverables } });
          }}
          rows={3}
          placeholder="Enter deliverables separated by commas (e.g., Site plan, Structural drawings, Inspection report)"
          className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
        />
        <p className="text-xs ds-text-secondary mt-1">
          Separate multiple deliverables with commas
        </p>
      </div>
    </div>
  );
}

export default ProfessionalServicesSection;
