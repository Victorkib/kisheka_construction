/**
 * Step 3: Edit Details Component
 * Edit individual entry details in a table
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import {
  VALID_WORKER_TYPES,
  VALID_WORKER_ROLES,
} from '@/lib/constants/labour-constants';

export function Step3EditDetails({ wizardData, onUpdate, onValidationChange }) {
  const [entries, setEntries] = useState(wizardData.labourEntries || []);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Track previous validation state to prevent unnecessary calls
  const prevValidationRef = useRef(null);
  const prevEntriesRef = useRef(null);
  const initializedRef = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  const onValidationChangeRef = useRef(onValidationChange);

  // Keep refs updated
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onValidationChangeRef.current = onValidationChange;
  }, [onUpdate, onValidationChange]);

  // Initialize entries from wizardData when component mounts
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (wizardData.labourEntries && wizardData.labourEntries.length > 0) {
        setEntries(wizardData.labourEntries);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Validate and notify parent
  useEffect(() => {
    const isValid =
      entries.length > 0 &&
      entries.every((entry) => {
        const isIndirect =
          entry.isIndirectLabour || wizardData.isIndirectLabour;
        const hasIndirectCategory = isIndirect
          ? entry.indirectCostCategory || wizardData.indirectCostCategory
          : true;
        return (
          entry.workerName &&
          entry.skillType &&
          entry.hourlyRate &&
          parseFloat(entry.hourlyRate) >= 0 &&
          entry.totalHours &&
          parseFloat(entry.totalHours) > 0 &&
          hasIndirectCategory
        );
      });

    // Only call onValidationChange if validation state changed
    if (prevValidationRef.current !== isValid) {
      prevValidationRef.current = isValid;
      onValidationChangeRef.current(isValid);
    }

    // Only call onUpdate if entries actually changed (deep comparison)
    const entriesChanged =
      JSON.stringify(prevEntriesRef.current) !== JSON.stringify(entries);
    if (entriesChanged) {
      prevEntriesRef.current = entries;
      onUpdateRef.current({ labourEntries: entries });
    }
  }, [entries]); // Only depend on entries, use refs for callbacks

  const toggleRow = (index) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const handleChange = (index, field, value) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'isIndirectLabour') {
      if (value) {
        updated[index].indirectCostCategory =
          updated[index].indirectCostCategory || 'siteOverhead';
        updated[index].workItemId = null;
      } else {
        updated[index].indirectCostCategory = null;
      }
    }

    // Recalculate costs using schema logic (matches backend calculation)
    if (
      field === 'totalHours' ||
      field === 'hourlyRate' ||
      field === 'overtimeHours'
    ) {
      const totalHours = parseFloat(updated[index].totalHours) || 0;
      const hourlyRate = parseFloat(updated[index].hourlyRate) || 0;

      // Use schema calculation logic: finalRegularHours = totalHours - finalOvertimeHours
      const calculatedOvertimeHours = Math.max(0, totalHours - 8);
      const finalOvertimeHours =
        (parseFloat(updated[index].overtimeHours) || 0) > 0
          ? parseFloat(updated[index].overtimeHours)
          : calculatedOvertimeHours;
      const finalRegularHours = totalHours - finalOvertimeHours;

      const overtimeRate = hourlyRate * 1.5;
      updated[index].regularCost = finalRegularHours * hourlyRate;
      updated[index].overtimeCost = finalOvertimeHours * overtimeRate;
      updated[index].totalCost =
        updated[index].regularCost + updated[index].overtimeCost;
    }

    setEntries(updated);
  };

  const calculateTotals = () => {
    return entries.reduce(
      (acc, entry) => {
        // Use schema calculation logic to match what will be saved
        const totalHours = parseFloat(entry.totalHours) || 0;
        const hourlyRate = parseFloat(entry.hourlyRate) || 0;

        const calculatedOvertimeHours = Math.max(0, totalHours - 8);
        const finalOvertimeHours =
          (parseFloat(entry.overtimeHours) || 0) > 0
            ? parseFloat(entry.overtimeHours)
            : calculatedOvertimeHours;
        const finalRegularHours = totalHours - finalOvertimeHours;

        const overtimeRate = hourlyRate * 1.5;
        const regularCost = finalRegularHours * hourlyRate;
        const overtimeCost = finalOvertimeHours * overtimeRate;
        const totalCost = regularCost + overtimeCost;

        return {
          totalHours: acc.totalHours + totalHours,
          totalCost: acc.totalCost + totalCost,
          totalWorkers: acc.totalWorkers + 1,
        };
      },
      { totalHours: 0, totalCost: 0, totalWorkers: 0 }
    );
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Edit Details
        </h2>
        <p className="text-sm text-gray-600">
          Review and edit details for each worker entry. Click on a row to
          expand and edit additional fields.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm font-medium text-blue-900">Total Workers</p>
            <p className="text-2xl font-bold text-blue-600">
              {totals.totalWorkers}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900">Total Hours</p>
            <p className="text-2xl font-bold text-blue-600">
              {totals.totalHours.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900">Total Cost</p>
            <p className="text-2xl font-bold text-blue-600">
              {totals.totalCost.toLocaleString()} KES
            </p>
          </div>
        </div>
      </div>

      {/* Entries Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12"></th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[200px]">
                Worker
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                Skill
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                Hours
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                Rate
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry, index) => {
              // Use schema calculation logic to match what will be saved
              const totalHours = parseFloat(entry.totalHours) || 0;
              const hourlyRate = parseFloat(entry.hourlyRate) || 0;
              const calculatedOvertimeHours = Math.max(0, totalHours - 8);
              const finalOvertimeHours =
                (parseFloat(entry.overtimeHours) || 0) > 0
                  ? parseFloat(entry.overtimeHours)
                  : calculatedOvertimeHours;
              const finalRegularHours = totalHours - finalOvertimeHours;
              const overtimeRate = hourlyRate * 1.5;
              const regularCost = finalRegularHours * hourlyRate;
              const overtimeCost = finalOvertimeHours * overtimeRate;
              const totalCost = regularCost + overtimeCost;
              const isExpanded = expandedRows.has(index);

              return (
                <>
                  <tr
                    key={index}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleRow(index)}
                  >
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {isExpanded ? '▼' : '▶'}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                      {entry.workerName}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {entry.skillType?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {entry.totalHours} hrs
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {hourlyRate.toLocaleString()} KES/hr
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                      {totalCost.toLocaleString()} KES
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan="6" className="px-4 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {/* Indirect Labour Toggle */}
                          <div className="col-span-2 md:col-span-3 bg-white border border-amber-200 rounded-lg p-3 mb-2">
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={entry.isIndirectLabour || false}
                                onChange={(e) =>
                                  handleChange(
                                    index,
                                    'isIndirectLabour',
                                    e.target.checked
                                  )
                                }
                                className="mt-1 w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                              />
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  This is Indirect Labour
                                </p>
                                <p className="text-xs text-gray-600">
                                  Mark if this entry is for site management,
                                  security, or office staff (will use indirect
                                  costs budget)
                                </p>
                              </div>
                            </label>
                          </div>

                          {/* Indirect Cost Category - show only when indirect labour is checked */}
                          {entry.isIndirectLabour && (
                            <div className="col-span-2 md:col-span-3">
                              <label className="block text-xs font-medium text-amber-900 mb-1">
                                Indirect Cost Category
                              </label>
                              <select
                                value={
                                  entry.indirectCostCategory || 'siteOverhead'
                                }
                                onChange={(e) =>
                                  handleChange(
                                    index,
                                    'indirectCostCategory',
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                              >
                                <option value="siteOverhead">
                                  Site Overhead
                                </option>
                                <option value="utilities">Utilities</option>
                                <option value="transportation">
                                  Transportation
                                </option>
                                <option value="safetyCompliance">
                                  Safety & Compliance
                                </option>
                              </select>
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Worker Type
                            </label>
                            <select
                              value={entry.workerType || 'internal'}
                              onChange={(e) =>
                                handleChange(
                                  index,
                                  'workerType',
                                  e.target.value
                                )
                              }
                              className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              {VALID_WORKER_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type.charAt(0).toUpperCase() + type.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Worker Role
                            </label>
                            <select
                              value={entry.workerRole || 'skilled'}
                              onChange={(e) =>
                                handleChange(
                                  index,
                                  'workerRole',
                                  e.target.value
                                )
                              }
                              className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                              {VALID_WORKER_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {role.charAt(0).toUpperCase() + role.slice(1)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Overtime Hours
                            </label>
                            <input
                              type="number"
                              value={entry.overtimeHours || 0}
                              onChange={(e) =>
                                handleChange(
                                  index,
                                  'overtimeHours',
                                  e.target.value
                                )
                              }
                              min="0"
                              step="0.5"
                              className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Break Duration (min)
                            </label>
                            <input
                              type="number"
                              value={entry.breakDuration || 0}
                              onChange={(e) =>
                                handleChange(
                                  index,
                                  'breakDuration',
                                  e.target.value
                                )
                              }
                              min="0"
                              className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Task Description
                            </label>
                            <textarea
                              value={entry.taskDescription || ''}
                              onChange={(e) =>
                                handleChange(
                                  index,
                                  'taskDescription',
                                  e.target.value
                                )
                              }
                              rows="2"
                              className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                              placeholder="Describe the work performed..."
                            />
                          </div>

                          {/* Professional Services Fields */}
                          {entry.workerType === 'professional' && (
                            <>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Service Type
                                </label>
                                <select
                                  value={entry.serviceType || ''}
                                  onChange={(e) =>
                                    handleChange(
                                      index,
                                      'serviceType',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value="">Select Service Type</option>
                                  <option value="consultation">
                                    Consultation
                                  </option>
                                  <option value="inspection">Inspection</option>
                                  <option value="design">Design</option>
                                  <option value="approval">Approval</option>
                                  <option value="testing">Testing</option>
                                  <option value="review">Review</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Visit Purpose
                                </label>
                                <input
                                  type="text"
                                  value={entry.visitPurpose || ''}
                                  onChange={(e) =>
                                    handleChange(
                                      index,
                                      'visitPurpose',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                                  placeholder="Purpose of visit"
                                />
                              </div>

                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Deliverables
                                </label>
                                <textarea
                                  value={
                                    Array.isArray(entry.deliverables)
                                      ? entry.deliverables.join(', ')
                                      : entry.deliverables || ''
                                  }
                                  onChange={(e) => {
                                    const deliverables = e.target.value
                                      .split(',')
                                      .map((d) => d.trim())
                                      .filter(Boolean);
                                    handleChange(
                                      index,
                                      'deliverables',
                                      deliverables
                                    );
                                  }}
                                  rows="2"
                                  className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                                  placeholder="Enter deliverables separated by commas"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td
                colSpan="3"
                className="px-3 py-2 text-sm font-semibold text-gray-900 text-right"
              >
                Totals:
              </td>
              <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                {totals.totalHours.toFixed(1)} hrs
              </td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                {totals.totalCost.toLocaleString()} KES
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
