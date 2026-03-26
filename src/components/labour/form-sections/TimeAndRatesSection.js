/**
 * Time and Rates Section
 * Date, hours, rates, and overtime
 */

'use client';

import { getFieldValidationRules } from '@/lib/labour-entry-validation';

export function TimeAndRatesSection({
  formData,
  onChange,
  entryMode,
}) {
  const rules = {
    entryDate: getFieldValidationRules('entryDate', entryMode),
    totalHours: getFieldValidationRules('totalHours', entryMode),
    hourlyRate: getFieldValidationRules('hourlyRate', entryMode),
  };

  // Calculate total cost
  const totalCost = formData.hourlyRate && formData.totalHours
    ? (parseFloat(formData.hourlyRate) * parseFloat(formData.totalHours)).toFixed(2)
    : 0;

  const overtimeCost = formData.overtimeHours && formData.overtimeRate
    ? (parseFloat(formData.overtimeHours) * parseFloat(formData.overtimeRate)).toFixed(2)
    : 0;

  const grandTotal = (parseFloat(totalCost) + parseFloat(overtimeCost)).toFixed(2);

  return (
    <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6">
      <h2 className="text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Time & Rates
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Entry Date */}
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Date {rules.entryDate.required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="date"
            name="entryDate"
            value={formData.entryDate}
            onChange={onChange}
            required={rules.entryDate.required}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>

        {/* Total Hours */}
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Total Hours {rules.totalHours.required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="number"
            name="totalHours"
            value={formData.totalHours}
            onChange={onChange}
            required={rules.totalHours.required}
            min="0"
            max="24"
            step="0.5"
            placeholder="8"
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>

        {/* Hourly Rate */}
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Hourly Rate (KES) {rules.hourlyRate.required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="number"
            name="hourlyRate"
            value={formData.hourlyRate}
            onChange={onChange}
            required={rules.hourlyRate.required}
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>

        {/* Daily Rate (Optional) */}
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Daily Rate (KES) (Optional)
          </label>
          <input
            type="number"
            name="dailyRate"
            value={formData.dailyRate}
            onChange={onChange}
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>

        {/* Overtime Hours */}
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Overtime Hours (Optional)
          </label>
          <input
            type="number"
            name="overtimeHours"
            value={formData.overtimeHours}
            onChange={onChange}
            min="0"
            max="24"
            step="0.5"
            placeholder="0"
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>

        {/* Overtime Rate */}
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Overtime Rate (KES/hour) (Optional)
          </label>
          <input
            type="number"
            name="overtimeRate"
            value={formData.overtimeRate}
            onChange={onChange}
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>
      </div>

      {/* Clock In/Out Times (Optional) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Clock In (Optional)
          </label>
          <input
            type="time"
            name="clockInTime"
            value={formData.clockInTime}
            onChange={onChange}
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Clock Out (Optional)
          </label>
          <input
            type="time"
            name="clockOutTime"
            value={formData.clockOutTime}
            onChange={onChange}
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Break Duration (minutes)
          </label>
          <input
            type="number"
            name="breakDuration"
            value={formData.breakDuration}
            onChange={onChange}
            min="0"
            step="15"
            placeholder="0"
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>
      </div>

      {/* Cost Summary */}
      <div className="mt-6 ds-bg-accent-subtle rounded-lg p-4 border ds-border-accent-subtle">
        <h3 className="text-sm font-bold ds-text-primary mb-3">Cost Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
              Regular Cost
            </p>
            <p className="text-lg font-bold ds-text-primary">
              KES {parseFloat(totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs ds-text-secondary">
              {formData.totalHours || 0} hrs × KES {formData.hourlyRate || 0}/hr
            </p>
          </div>

          {parseFloat(overtimeCost) > 0 && (
            <div>
              <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                Overtime Cost
              </p>
              <p className="text-lg font-bold ds-text-primary">
                KES {parseFloat(overtimeCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs ds-text-secondary">
                {formData.overtimeHours || 0} OT hrs × KES {formData.overtimeRate || 0}/hr
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
              Total Cost
            </p>
            <p className="text-xl font-bold ds-text-accent-primary">
              KES {parseFloat(grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs ds-text-secondary">
              Labour Budget
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimeAndRatesSection;
