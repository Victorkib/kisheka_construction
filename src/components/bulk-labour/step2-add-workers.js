/**
 * Step 2: Add Workers Component
 * Table-based input for adding multiple workers at once
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, X, CheckCircle, UserPlus } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading';
import { VALID_WORKER_TYPES, VALID_WORKER_ROLES, VALID_SKILL_TYPES } from '@/lib/constants/labour-constants';
import { TemplateSelector } from './template-selector';
import { EnhancedWorkerSelector } from './enhanced-worker-selector';

export function Step2AddWorkers({ wizardData, onUpdate, onValidationChange, preSelectedWorkerId = null }) {
  const [workers, setWorkers] = useState([]);
  const [availableWorkers, setAvailableWorkers] = useState([]);
  const [suggestedWorkers, setSuggestedWorkers] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Initialize workers from wizardData (only on mount)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (wizardData.labourEntries && wizardData.labourEntries.length > 0) {
        setWorkers(wizardData.labourEntries);
      } else {
        // Start with one empty row
        const initialWorker = createEmptyWorker();
        // If preSelectedWorkerId is provided, pre-select that worker
        if (preSelectedWorkerId) {
          initialWorker.workerId = preSelectedWorkerId;
          // Find worker in availableWorkers and auto-fill
          const selectedWorker = availableWorkers.find(
            (w) => (w.userId || w._id).toString() === preSelectedWorkerId.toString()
          );
          if (selectedWorker) {
            initialWorker.workerName = selectedWorker.workerName;
            initialWorker.hourlyRate = selectedWorker.defaultHourlyRate?.toString() || '';
            initialWorker.workerType = selectedWorker.workerType || 'internal';
            initialWorker.skillType = selectedWorker.skillTypes?.[0] || 'general_worker';
          }
        }
        setWorkers([initialWorker]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Handle pre-selected worker after availableWorkers are loaded
  useEffect(() => {
    if (preSelectedWorkerId && availableWorkers.length > 0 && workers.length > 0 && !workers[0].workerId) {
      const selectedWorker = availableWorkers.find(
        (w) => (w.userId || w._id).toString() === preSelectedWorkerId.toString()
      );
      if (selectedWorker) {
        const updatedWorkers = [...workers];
        updatedWorkers[0] = {
          ...updatedWorkers[0],
          workerId: preSelectedWorkerId,
          workerName: selectedWorker.workerName,
          hourlyRate: selectedWorker.defaultHourlyRate?.toString() || updatedWorkers[0].hourlyRate,
          workerType: selectedWorker.workerType || updatedWorkers[0].workerType,
          skillType: selectedWorker.skillTypes?.[0] || updatedWorkers[0].skillType,
        };
        setWorkers(updatedWorkers);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSelectedWorkerId, availableWorkers]);

  // Fetch available workers and suggestions
  useEffect(() => {
    fetchWorkers();
    fetchSuggestedWorkers();
  }, [wizardData.defaultPhaseId, wizardData.projectId]);

  const fetchSuggestedWorkers = async () => {
    if (!wizardData.defaultPhaseId && !wizardData.projectId) {
      setSuggestedWorkers([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const params = new URLSearchParams();
      if (wizardData.defaultPhaseId) {
        params.append('phaseId', wizardData.defaultPhaseId);
      }
      if (wizardData.projectId) {
        params.append('projectId', wizardData.projectId);
      }
      params.append('limit', '10');

      const response = await fetch(`/api/labour/workers/suggestions?${params}`);
      const data = await response.json();
      if (data.success) {
        setSuggestedWorkers(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching suggested workers:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Track previous validation state to prevent unnecessary calls
  const prevValidationRef = useRef(null);
  const prevWorkersRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);
  const onValidationChangeRef = useRef(onValidationChange);

  // Keep refs updated
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onValidationChangeRef.current = onValidationChange;
  }, [onUpdate, onValidationChange]);

  // Validate and notify parent
  useEffect(() => {
    const isValid = workers.length > 0 &&
      workers.every((worker) => {
        const isIndirect = worker.isIndirectLabour || wizardData.isIndirectLabour;
        const hasIndirectCategory = isIndirect
          ? worker.indirectCostCategory || wizardData.indirectCostCategory
          : true;
        return worker.workerName &&
          worker.workerName.trim().length >= 2 &&
          worker.skillType &&
          worker.hourlyRate &&
          parseFloat(worker.hourlyRate) >= 0 &&
          worker.totalHours &&
          parseFloat(worker.totalHours) > 0 &&
          hasIndirectCategory;
      });

    // Only call onValidationChange if validation state changed
    if (prevValidationRef.current !== isValid) {
      prevValidationRef.current = isValid;
      onValidationChangeRef.current(isValid);
    }

    // Only call onUpdate if workers actually changed (deep comparison)
    const workersChanged = JSON.stringify(prevWorkersRef.current) !== JSON.stringify(workers);
    if (workersChanged) {
      prevWorkersRef.current = workers;
      onUpdateRef.current({ labourEntries: workers });
    }
  }, [workers]); // Only depend on workers, use refs for callbacks

  const fetchWorkers = async () => {
    setLoadingWorkers(true);
    try {
      const response = await fetch('/api/labour/workers?status=active');
      const data = await response.json();
      if (data.success) {
        setAvailableWorkers(data.data?.workers || []);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    } finally {
      setLoadingWorkers(false);
    }
  };

  function createEmptyWorker() {
    return {
      workerId: '',
      workerName: '',
      workerType: 'internal',
      workerRole: wizardData.defaultWorkerRole || 'skilled',
      skillType: 'general_worker',
      totalHours: 8,
      overtimeHours: 0,
      hourlyRate: '',
      dailyRate: '',
      taskDescription: '',
      breakDuration: 0,
      clockInTime: '',
      clockOutTime: '',
      phaseId: wizardData.defaultPhaseId || '',
      floorId: wizardData.defaultFloorId || '',
      categoryId: wizardData.defaultCategoryId || '',
      entryDate: wizardData.defaultDate || new Date().toISOString().split('T')[0],
    };
  }

  const handleAddRow = () => {
    setWorkers([...workers, createEmptyWorker()]);
  };

  const handleRemoveRow = (index) => {
    if (workers.length > 1) {
      setWorkers(workers.filter((_, i) => i !== index));
    }
  };

  const handleWorkerChange = (index, field, value) => {
    const updated = [...workers];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill from worker profile if workerId selected
    if (field === 'workerId' && value) {
      const worker = availableWorkers.find((w) => (w.userId || w._id) === value);
      if (worker) {
        updated[index] = {
          ...updated[index],
          workerName: worker.workerName || updated[index].workerName,
          hourlyRate: worker.defaultHourlyRate?.toString() || updated[index].hourlyRate,
          workerType: worker.workerType || updated[index].workerType,
          skillType: worker.skillTypes?.[0] || updated[index].skillType,
        };
      }
    }

    // If workerId is cleared, also clear workerName if it matches an existing worker
    if (field === 'workerId' && !value) {
      const currentWorkerName = updated[index].workerName;
      const isExistingWorker = availableWorkers.some(
        (w) => (w.userId || w._id) === currentWorkerName || w.workerName === currentWorkerName
      );
      if (isExistingWorker) {
        updated[index].workerName = '';
      }
    }

    // Calculate costs using schema logic (matches backend calculation)
    if (field === 'totalHours' || field === 'hourlyRate' || field === 'overtimeHours') {
      const totalHours = parseFloat(updated[index].totalHours) || 0;
      const hourlyRate = parseFloat(updated[index].hourlyRate) || 0;
      
      // Use schema calculation logic: finalRegularHours = totalHours - finalOvertimeHours
      const calculatedOvertimeHours = Math.max(0, totalHours - 8);
      const finalOvertimeHours = (parseFloat(updated[index].overtimeHours) || 0) > 0 
        ? parseFloat(updated[index].overtimeHours) 
        : calculatedOvertimeHours;
      const finalRegularHours = totalHours - finalOvertimeHours;
      
      const overtimeRate = hourlyRate * 1.5;
      updated[index].regularCost = finalRegularHours * hourlyRate;
      updated[index].overtimeCost = finalOvertimeHours * overtimeRate;
      updated[index].totalCost = updated[index].regularCost + updated[index].overtimeCost;
    }

    setWorkers(updated);
  };

  const calculateTotals = () => {
    return workers.reduce(
      (acc, worker) => {
        // Use schema calculation logic to match what will be saved
        const totalHours = parseFloat(worker.totalHours) || 0;
        const hourlyRate = parseFloat(worker.hourlyRate) || 0;
        
        const calculatedOvertimeHours = Math.max(0, totalHours - 8);
        const finalOvertimeHours = (parseFloat(worker.overtimeHours) || 0) > 0 
          ? parseFloat(worker.overtimeHours) 
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

  const handleTemplateSelected = (entries) => {
    setWorkers(entries);
    setShowTemplates(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Add Workers</h2>
        <p className="text-sm text-gray-600">
          Add workers to this batch. You can add multiple workers at once. Default values from Step 1 will be applied.
        </p>
      </div>

      {/* Template Selector Toggle */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setShowTemplates(!showTemplates)}
          className={`px-4 py-2 rounded-lg border-2 transition-colors ${
            showTemplates
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
          }`}
        >
          {showTemplates ? 'Hide Templates' : 'Use Template'}
        </button>
        {!showTemplates && workers.length === 0 && (
          <p className="text-sm text-gray-600">
            Or start with a template to quickly add common worker patterns
          </p>
        )}
      </div>

      {/* Template Selector */}
      {showTemplates && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <TemplateSelector
            onTemplateSelected={handleTemplateSelected}
            currentProjectId={wizardData.projectId}
            currentPhaseId={wizardData.defaultPhaseId}
          />
        </div>
      )}

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">
              {workers.length} worker{workers.length !== 1 ? 's' : ''} added
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Total Hours: {totals.totalHours.toFixed(1)} hrs | Total Cost: {totals.totalCost.toLocaleString()} KES
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Worker
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-12">
                #
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[200px]">
                Worker Name <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                Skill Type <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                Hours <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                Rate (KES) <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                Cost (KES)
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-16">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {workers.map((worker, index) => {
              // Use schema calculation logic to match what will be saved
              const totalHours = parseFloat(worker.totalHours) || 0;
              const hourlyRate = parseFloat(worker.hourlyRate) || 0;
              const calculatedOvertimeHours = Math.max(0, totalHours - 8);
              const finalOvertimeHours = (parseFloat(worker.overtimeHours) || 0) > 0 
                ? parseFloat(worker.overtimeHours) 
                : calculatedOvertimeHours;
              const finalRegularHours = totalHours - finalOvertimeHours;
              const overtimeRate = hourlyRate * 1.5;
              const regularCost = finalRegularHours * hourlyRate;
              const overtimeCost = finalOvertimeHours * overtimeRate;
              const totalCost = regularCost + overtimeCost;

              return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-600">{index + 1}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-2">
                      {/* Loading Indicator */}
                      {(loadingWorkers || loadingSuggestions) && (
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                          <LoadingSpinner size="sm" color="gray-600" />
                          <span>Loading workers...</span>
                        </div>
                      )}
                      {/* Enhanced Selector (Primary - Searchable) */}
                      <EnhancedWorkerSelector
                        value={worker.workerId || ''}
                        onChange={(workerId) => {
                          handleWorkerChange(index, 'workerId', workerId);
                        }}
                        availableWorkers={availableWorkers}
                        suggestedWorkers={suggestedWorkers}
                        workerName={!worker.workerId ? worker.workerName || '' : ''}
                        placeholder="Search or type worker name..."
                        onWorkerSelected={(selectedWorker) => {
                          // Auto-fill worker details
                          const updated = [...workers];
                          updated[index] = {
                            ...updated[index],
                            workerName: selectedWorker.workerName || updated[index].workerName,
                            hourlyRate: selectedWorker.defaultHourlyRate?.toString() || updated[index].hourlyRate,
                            workerType: selectedWorker.workerType || updated[index].workerType,
                            skillType: selectedWorker.skillTypes?.[0] || updated[index].skillType,
                          };
                          setWorkers(updated);
                        }}
                        onNewWorker={(workerName) => {
                          // User typed a new worker name
                          if (workerName && workerName.trim().length >= 2) {
                            const updated = [...workers];
                            updated[index] = {
                              ...updated[index],
                              workerId: '', // Clear workerId for new worker
                              workerName: workerName.trim(),
                            };
                            setWorkers(updated);
                          }
                        }}
                        className="w-full"
                      />
                      
                      {/* Traditional Dropdown (Alternative) */}
                      <div className="border-t border-gray-200 pt-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Or select from dropdown:
                        </label>
                        <select
                          value={worker.workerId || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            handleWorkerChange(index, 'workerId', selectedId);
                            // Also update workerName if a worker is selected
                            if (selectedId) {
                              const selectedWorker = availableWorkers.find((w) => (w.userId || w._id) === selectedId);
                              if (selectedWorker) {
                                const updated = [...workers];
                                updated[index] = {
                                  ...updated[index],
                                  workerName: selectedWorker.workerName || updated[index].workerName,
                                  hourlyRate: selectedWorker.defaultHourlyRate?.toString() || updated[index].hourlyRate,
                                  workerType: selectedWorker.workerType || updated[index].workerType,
                                  skillType: selectedWorker.skillTypes?.[0] || updated[index].skillType,
                                };
                                setWorkers(updated);
                              }
                            }
                          }}
                          className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select from list...</option>
                          {suggestedWorkers.length > 0 && (
                            <optgroup label="✨ Suggested Workers">
                              {suggestedWorkers.map((w) => (
                                <option key={w._id} value={w.userId || w._id}>
                                  {w.workerName} ({w.employeeId}) - {w.defaultHourlyRate?.toLocaleString()} KES/hr
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {availableWorkers.filter(w => !suggestedWorkers.some(s => (s.userId || s._id) === (w.userId || w._id))).length > 0 && (
                            <optgroup label="All Workers">
                              {availableWorkers
                                .filter(w => !suggestedWorkers.some(s => (s.userId || s._id) === (w.userId || w._id)))
                                .map((w) => (
                                  <option key={w._id} value={w.userId || w._id}>
                                    {w.workerName} ({w.employeeId})
                                  </option>
                                ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Visual Indicator */}
                      {worker.workerId ? (
                        <div className="flex items-center gap-1 text-xs">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span className="text-green-700 font-medium">Existing Worker</span>
                        </div>
                      ) : worker.workerName && worker.workerName.trim().length >= 2 ? (
                        <div className="flex items-center gap-1 text-xs">
                          <UserPlus className="w-3 h-3 text-blue-600" />
                          <span className="text-blue-700 font-medium">New Worker (will be created)</span>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={worker.skillType || ''}
                      onChange={(e) => handleWorkerChange(index, 'skillType', e.target.value)}
                      required
                      className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Skill</option>
                      {VALID_SKILL_TYPES.map((skill) => (
                        <option key={skill} value={skill}>
                          {skill.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={worker.totalHours || ''}
                      onChange={(e) => handleWorkerChange(index, 'totalHours', e.target.value)}
                      min="0"
                      max="24"
                      step="0.5"
                      required
                      className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={worker.hourlyRate || ''}
                      onChange={(e) => handleWorkerChange(index, 'hourlyRate', e.target.value)}
                      min="0"
                      step="0.01"
                      required
                      className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">
                    {totalCost.toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {workers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        className="text-red-600 hover:text-red-800"
                        title="Remove worker"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan="3" className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">
                Totals:
              </td>
              <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                {totals.totalHours.toFixed(1)} hrs
              </td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                {totals.totalCost.toLocaleString()} KES
              </td>
              <td className="px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Quick Add Button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleAddRow}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Another Worker
        </button>
      </div>
    </div>
  );
}

