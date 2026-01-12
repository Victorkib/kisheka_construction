/**
 * Step 4: Review & Submit Component
 * Final review before submitting batch
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle, AlertTriangle, DollarSign, Clock, Users, UserPlus } from 'lucide-react';
import { LoadingButton } from '@/components/loading';

export function Step4Review({ wizardData, onUpdate, onSubmit, loading, onBudgetValidationChange }) {
  const [budgetValidation, setBudgetValidation] = useState(null);
  const [validatingBudget, setValidatingBudget] = useState(false);
  const [workItem, setWorkItem] = useState(null);
  const [loadingWorkItem, setLoadingWorkItem] = useState(false);
  const prevTotalCostRef = useRef(0);

  // Notify parent of budget validation changes
  useEffect(() => {
    if (onBudgetValidationChange) {
      onBudgetValidationChange(budgetValidation);
    }
  }, [budgetValidation, onBudgetValidationChange]);

  // Calculate totals using schema logic (matches backend calculation)
  const totals = useMemo(() => {
    return wizardData.labourEntries.reduce(
      (acc, entry) => {
        const totalHours = parseFloat(entry.totalHours) || 0;
        const hourlyRate = parseFloat(entry.hourlyRate) || 0;
        
        // Use schema calculation logic: finalRegularHours = totalHours - finalOvertimeHours
        const calculatedOvertimeHours = Math.max(0, totalHours - 8);
        const finalOvertimeHours = (parseFloat(entry.overtimeHours) || 0) > 0 
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
  }, [wizardData.labourEntries]);

  // Validate budget function
  const validateBudget = async (phaseId, totalCost) => {
    if (!phaseId || totalCost <= 0) {
      return;
    }

    setValidatingBudget(true);
    try {
      const response = await fetch(
        `/api/labour/financial/validate?phaseId=${phaseId}&labourCost=${totalCost}`
      );
      const data = await response.json();
      if (data.success) {
        setBudgetValidation(data.data);
      }
    } catch (err) {
      console.error('Error validating budget:', err);
    } finally {
      setValidatingBudget(false);
    }
  };

  // Validate budget (only when phaseId or totalCost actually changes)
  useEffect(() => {
    if (wizardData.defaultPhaseId && totals.totalCost > 0) {
      // Only validate if totalCost actually changed
      if (prevTotalCostRef.current !== totals.totalCost) {
        prevTotalCostRef.current = totals.totalCost;
        validateBudget(wizardData.defaultPhaseId, totals.totalCost);
      }
    }
  }, [wizardData.defaultPhaseId, totals.totalCost]);

  // Fetch work item details if workItemId is provided
  useEffect(() => {
    if (wizardData.workItemId) {
      setLoadingWorkItem(true);
      fetch(`/api/work-items/${wizardData.workItemId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setWorkItem(data.data);
          }
        })
        .catch(err => {
          console.error('Error fetching work item:', err);
          setWorkItem(null);
        })
        .finally(() => {
          setLoadingWorkItem(false);
        });
    } else {
      setWorkItem(null);
    }
  }, [wizardData.workItemId]);

  // Group entries by phase
  const entriesByPhase = {};
  wizardData.labourEntries.forEach((entry) => {
    const phaseId = entry.phaseId || wizardData.defaultPhaseId;
    if (!entriesByPhase[phaseId]) {
      entriesByPhase[phaseId] = [];
    }
    entriesByPhase[phaseId].push(entry);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Review & Submit</h2>
        <p className="text-sm text-gray-600">
          Review all details before submitting. This batch will be auto-approved and budget will be updated.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Workers</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{totals.totalWorkers}</div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Total Hours</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{totals.totalHours.toFixed(1)}</div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Total Cost</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {totals.totalCost.toLocaleString()} KES
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Status</span>
          </div>
          <div className="text-sm font-semibold text-gray-600">Auto-Approved</div>
        </div>
      </div>

      {/* Budget Validation */}
      {budgetValidation && (
        <div
          className={`p-4 rounded-lg border ${
            budgetValidation.isValid
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {budgetValidation.isValid ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  budgetValidation.isValid ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {budgetValidation.isValid ? '✅ Budget Valid' : '⚠️ Budget Warning'}
              </p>
              <p
                className={`text-xs mt-1 ${
                  budgetValidation.isValid ? 'text-green-700' : 'text-red-700'
                }`}
              >
                {budgetValidation.message}
              </p>
              {budgetValidation.budget && (
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  <p>
                    Budget: {budgetValidation.budget.toLocaleString()} KES | Available:{' '}
                    {budgetValidation.available.toLocaleString()} KES
                  </p>
                  <p>
                    Current Spending: {budgetValidation.currentSpending.toLocaleString()} KES
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Details */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Batch Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Project:</span>
            <span className="ml-2 font-medium text-gray-900">
              {wizardData.projectId ? 'Selected' : 'Not selected'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Phase:</span>
            <span className="ml-2 font-medium text-gray-900">
              {wizardData.defaultPhaseId ? 'Selected' : 'Not selected'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Entry Date:</span>
            <span className="ml-2 font-medium text-gray-900">
              {new Date(wizardData.defaultDate).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Entry Type:</span>
            <span className="ml-2 font-medium text-gray-900">
              {wizardData.entryType?.replace(/_/g, ' ')}
            </span>
          </div>
          {wizardData.batchName && (
            <div className="col-span-2">
              <span className="text-gray-600">Batch Name:</span>
              <span className="ml-2 font-medium text-gray-900">{wizardData.batchName}</span>
            </div>
          )}
          {wizardData.workItemId && (
            <div className="col-span-2">
              <span className="text-gray-600">Work Item:</span>
              {loadingWorkItem ? (
                <span className="ml-2 text-gray-500">Loading...</span>
              ) : workItem ? (
                <div className="ml-2">
                  <span className="font-medium text-gray-900">{workItem.name}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    ({workItem.category || 'Other'}) - {workItem.status?.replace('_', ' ') || 'Not Started'}
                  </span>
                  {workItem.estimatedHours > 0 && (
                    <div className="mt-1 text-xs text-gray-600">
                      Progress: {workItem.actualHours || 0}/{workItem.estimatedHours} hrs
                      {' '}
                      ({Math.min(100, Math.round(((workItem.actualHours || 0) / workItem.estimatedHours) * 100))}%)
                    </div>
                  )}
                </div>
              ) : (
                <span className="ml-2 text-gray-500">Work item not found</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Entries Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Workers ({wizardData.labourEntries.length})
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {wizardData.labourEntries.map((entry, index) => {
            // Use schema calculation logic to match what will be saved
            const totalHours = parseFloat(entry.totalHours) || 0;
            const hourlyRate = parseFloat(entry.hourlyRate) || 0;
            const calculatedOvertimeHours = Math.max(0, totalHours - 8);
            const finalOvertimeHours = (parseFloat(entry.overtimeHours) || 0) > 0 
              ? parseFloat(entry.overtimeHours) 
              : calculatedOvertimeHours;
            const finalRegularHours = totalHours - finalOvertimeHours;
            const overtimeRate = hourlyRate * 1.5;
            const regularCost = finalRegularHours * hourlyRate;
            const overtimeCost = finalOvertimeHours * overtimeRate;
            const totalCost = regularCost + overtimeCost;

            // Check if this is a new worker (no workerId)
            const isNewWorker = !entry.workerId && entry.workerName && entry.workerName.trim().length >= 2;

            return (
              <div
                key={index}
                className={`flex items-center justify-between py-2 border-b border-gray-100 last:border-0 ${
                  isNewWorker ? 'bg-blue-50 rounded px-2' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{entry.workerName}</p>
                    {isNewWorker ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        <UserPlus className="w-3 h-3" />
                        New Worker
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Existing
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {entry.skillType?.replace(/_/g, ' ')} • {entry.totalHours} hrs @{' '}
                    {hourlyRate.toLocaleString()} KES/hr
                  </p>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {totalCost.toLocaleString()} KES
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Note: Submit button is handled by WizardNavigation component */}
      {/* Budget validation status shown above for user feedback */}
    </div>
  );
}

