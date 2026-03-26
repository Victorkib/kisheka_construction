/**
 * Equipment Section
 * Displays equipment details for equipment operator labour
 */

'use client';

export function EquipmentSection({
  formData,
  onChange,
  equipment,
}) {
  if (!equipment && !formData.equipmentId) {
    return null;
  }

  return (
    <div className="ds-bg-surface rounded-xl shadow-lg border-2 ds-border-accent-subtle p-6">
      <h2 className="text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Equipment Details
      </h2>

      {equipment ? (
        <div className="ds-bg-surface-muted rounded-lg p-4 border-2 ds-border-accent-subtle">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                Equipment Name
              </p>
              <p className="text-base font-bold ds-text-primary">{equipment.equipmentName}</p>
              <p className="text-sm ds-text-secondary">{equipment.equipmentType?.replace(/_/g, ' ')}</p>
            </div>

            {(equipment.serialNumber || equipment.assetTag) && (
              <div>
                <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                  Identification
                </p>
                {equipment.serialNumber && (
                  <p className="text-sm ds-text-primary">S/N: {equipment.serialNumber}</p>
                )}
                {equipment.assetTag && (
                  <p className="text-sm ds-text-primary">Asset: {equipment.assetTag}</p>
                )}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                Equipment Cost
              </p>
              <p className="text-base font-bold ds-text-accent-primary">
                KES {equipment.dailyRate?.toLocaleString()}/day
              </p>
            </div>

            {equipment.utilization && (
              <div>
                <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                  Utilization
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 ds-bg-surface rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        equipment.utilization.utilizationPercentage > 100
                          ? 'bg-red-600'
                          : equipment.utilization.utilizationPercentage > 80
                          ? 'bg-yellow-500'
                          : 'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(100, equipment.utilization.utilizationPercentage)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold ds-text-primary">
                    {equipment.utilization.utilizationPercentage?.toFixed(1) || 0}%
                  </span>
                </div>
                <p className="text-xs ds-text-secondary mt-1">
                  {equipment.utilization.actualHours?.toFixed(1) || 0} hrs logged of {equipment.utilization.estimatedHours || 0} estimated
                </p>
              </div>
            )}
          </div>

          {/* Operator Cost Info */}
          <div className="mt-4 pt-4 border-t ds-border-subtle">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs ds-text-secondary">
                <p className="font-semibold ds-text-primary mb-1">Cost Breakdown:</p>
                <ul className="space-y-1">
                  <li>
                    • Equipment rental: <strong>KES {equipment.dailyRate?.toLocaleString()}/day</strong> (Equipment Budget)
                  </li>
                  <li>
                    • Your wages: <strong>KES {formData.hourlyRate ? (parseFloat(formData.hourlyRate) * parseFloat(formData.totalHours || 8)).toLocaleString() : '0'}</strong> (Labour Budget)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
          <p className="text-sm ds-text-primary">Equipment ID: {formData.equipmentId}</p>
          <p className="text-xs ds-text-secondary mt-1">Equipment details loading...</p>
        </div>
      )}

      {/* Task Description */}
      <div className="mt-4">
        <label className="block text-sm font-semibold ds-text-primary mb-2">
          Task Description
        </label>
        <textarea
          name="taskDescription"
          value={formData.taskDescription}
          onChange={onChange}
          rows={3}
          placeholder="Describe the equipment operation work..."
          className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
        />
      </div>
    </div>
  );
}

export default EquipmentSection;
