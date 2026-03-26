/**
 * Equipment Operator Info Component
 * Displays equipment details when logging operator labour
 *
 * @component
 * @param {string} equipmentId - Selected equipment ID
 * @param {function} onEquipmentSelect - Callback when equipment is selected
 * @param {string} projectId - Project ID for filtering equipment
 */

'use client';

import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/loading';

export function EquipmentOperatorInfo({
  equipmentId,
  onEquipmentSelect,
  projectId,
}) {
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [equipmentList, setEquipmentList] = useState([]);

  // Fetch equipment when projectId changes or when searching
  useEffect(() => {
    if (projectId && searchTerm.length >= 2) {
      fetchEquipmentList();
    } else if (projectId) {
      // Fetch all equipment for the project
      fetchEquipmentList();
    }
  }, [projectId, searchTerm]);

  // Fetch selected equipment details
  useEffect(() => {
    if (equipmentId && equipmentId !== equipment?._id) {
      fetchEquipmentDetails();
    }
  }, [equipmentId]);

  const fetchEquipmentList = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        projectId,
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
      });

      const response = await fetch(`/api/equipment?${params}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (data.success) {
        setEquipmentList(data.data.equipment || []);
        setShowDropdown(true);
      }
    } catch (err) {
      console.error('Error fetching equipment:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEquipmentDetails = async () => {
    try {
      const response = await fetch(`/api/equipment/${equipmentId}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (data.success) {
        setEquipment(data.data);
      }
    } catch (err) {
      console.error('Error fetching equipment details:', err);
    }
  };

  const handleSelectEquipment = (eq) => {
    onEquipmentSelect?.(eq._id);
    setEquipment(eq);
    setShowDropdown(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    setEquipment(null);
    onEquipmentSelect?.(null);
    setSearchTerm('');
  };

  const getOperatorTypeLabel = (type) => {
    if (!type) return 'Not specified';
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getStatusColor = (status) => {
    const colors = {
      assigned: 'bg-blue-100 text-blue-800',
      in_use: 'bg-green-100 text-green-800',
      returned: 'bg-gray-100 text-gray-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-3">
      {/* Label */}
      <label className="block text-sm font-semibold ds-text-primary">
        Equipment (Optional)
      </label>

      {/* Search/Input */}
      {!equipment ? (
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search equipment by name, serial #, or asset tag"
              className="w-full pl-10 pr-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ds-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Dropdown */}
          {showDropdown && (searchTerm || equipmentList.length > 0) && (
            <div className="absolute z-50 w-full mt-1 ds-bg-surface border-2 ds-border-accent-subtle rounded-lg shadow-xl max-h-64 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center">
                  <LoadingSpinner size="sm" />
                  <p className="text-xs ds-text-secondary mt-2">
                    Searching equipment...
                  </p>
                </div>
              ) : equipmentList.length === 0 ? (
                <div className="p-4 text-center">
                  <svg
                    className="w-8 h-8 ds-text-muted mx-auto mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <p className="text-sm ds-text-secondary">
                    {searchTerm
                      ? 'No equipment found'
                      : 'Start typing to search equipment'}
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {equipmentList.map((eq) => (
                    <button
                      key={eq._id}
                      type="button"
                      onClick={() => handleSelectEquipment(eq)}
                      className="w-full px-4 py-3 text-left hover:ds-bg-surface-muted transition-colors border-b ds-border-subtle last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold ds-text-primary truncate">
                            {eq.equipmentName}
                          </p>
                          <p className="text-xs ds-text-secondary">
                            {eq.equipmentType?.replace(/_/g, ' ')}
                            {eq.serialNumber && ` • ${eq.serialNumber}`}
                          </p>
                        </div>
                        <span
                          className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusColor(
                            eq.status,
                          )}`}
                        >
                          {eq.status?.replace('_', ' ')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Selected Equipment Display */
        <div className="ds-bg-surface-muted rounded-lg border-2 ds-border-accent-subtle p-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-bold ds-text-primary text-lg truncate">
                {equipment.equipmentName}
              </h4>
              <p className="text-sm ds-text-secondary">
                {equipment.equipmentType?.replace(/_/g, ' ')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="flex-shrink-0 p-2 ds-bg-surface rounded-lg border ds-border-subtle hover:ds-bg-surface-muted transition-colors"
              title="Remove equipment"
            >
              <svg
                className="w-4 h-4 ds-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Equipment Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Status */}
            <div>
              <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                Status
              </p>
              <span
                className={`inline-block px-2 py-1 text-xs font-bold rounded-full ${getStatusColor(
                  equipment.status,
                )}`}
              >
                {equipment.status?.replace('_', ' ')}
              </span>
            </div>

            {/* Serial/Asset Tag */}
            {(equipment.serialNumber || equipment.assetTag) && (
              <div>
                <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                  ID
                </p>
                <p className="text-xs ds-text-primary">
                  {equipment.serialNumber && (
                    <span className="block">S/N: {equipment.serialNumber}</span>
                  )}
                  {equipment.assetTag && (
                    <span className="block">Asset: {equipment.assetTag}</span>
                  )}
                </p>
              </div>
            )}

            {/* Daily Rate */}
            {equipment.dailyRate && (
              <div>
                <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                  Equipment Cost
                </p>
                <p className="text-sm font-bold ds-text-primary">
                  KES {equipment.dailyRate.toLocaleString()}/day
                </p>
              </div>
            )}

            {/* Operator Requirements */}
            {equipment.operatorRequired !== null && (
              <div>
                <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                  Operator
                </p>
                <p className="text-xs ds-text-primary">
                  {equipment.operatorRequired ? (
                    <span className="flex items-center gap-1">
                      <span className="text-green-600">✓</span> Required (
                      {getOperatorTypeLabel(equipment.operatorType)})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-600">
                      <span>✗</span> Not Required
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Utilization */}
            {equipment.utilization && (
              <div className="col-span-2">
                <p className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-1">
                  Utilization
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="ds-text-secondary">
                        {equipment.utilization.actualHours?.toFixed(1) || 0} hrs
                        logged
                      </span>
                      <span className="ds-text-secondary">
                        of {equipment.utilization.estimatedHours || 0} estimated
                      </span>
                    </div>
                    <div className="w-full ds-bg-surface rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          equipment.utilization.utilizationPercentage > 100
                            ? 'bg-red-600'
                            : equipment.utilization.utilizationPercentage > 80
                              ? 'bg-yellow-500'
                              : 'bg-green-600'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            equipment.utilization.utilizationPercentage || 0,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold ds-text-primary whitespace-nowrap">
                    {equipment.utilization.utilizationPercentage?.toFixed(1) || 0}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Operator Cost Info */}
          <div className="mt-3 pt-3 border-t ds-border-subtle">
            <div className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5"
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
              <div className="text-xs ds-text-secondary">
                <p className="font-semibold ds-text-primary mb-1">
                  Cost Breakdown:
                </p>
                <ul className="space-y-1">
                  <li>
                    • Equipment rental: <strong>KES {equipment.dailyRate?.toLocaleString()}/day</strong> (Equipment Budget)
                  </li>
                  <li>
                    • Operator wages: Calculated from hours logged (Labour Budget)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Helper Text */}
      <p className="text-xs ds-text-secondary">
        {equipment
          ? 'Logging hours for operating this equipment. Costs will be tracked separately.'
          : 'Link this labour entry to equipment if you operated machinery.'}
      </p>

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}

export default EquipmentOperatorInfo;
