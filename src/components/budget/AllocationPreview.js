/**
 * Allocation Preview Component
 * Shows preview of proposed phase and floor allocations before confirming
 */

'use client';

import { useState, useEffect } from 'react';

export function AllocationPreview({ 
  projectId, 
  proposedBudget, 
  phases, 
  onConfirm, 
  onCancel 
}) {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    if (proposedBudget && projectId) {
      calculatePreview();
    }
  }, [proposedBudget, projectId, phases]);

  const calculatePreview = async () => {
    try {
      setLoading(true);
      setErrors([]);
      setWarnings([]);

      // Calculate DCC from proposed budget
      const dcc = proposedBudget.directConstructionCosts || 0;
      
      if (dcc <= 0) {
        setPreviewData(null);
        setLoading(false);
        return;
      }

      // Calculate proposed phase allocations
      const phaseAllocations = {
        'PHASE-01': dcc * 0.15,  // Basement: 15%
        'PHASE-02': dcc * 0.65,  // Superstructure: 65%
        'PHASE-03': dcc * 0.15,  // Finishing: 15%
        'PHASE-04': dcc * 0.05   // Final Systems: 5%
      };

      // Get phase spending data
      const phaseData = await Promise.all(
        phases.map(async (phase) => {
          const proposedAllocation = phaseAllocations[phase.phaseCode] || 0;
          
          // Get actual spending for this phase
          const actualSpending = phase.actualSpending?.total || 0;
          const committedCost = phase.financialStates?.committed || 0;
          const minimumRequired = actualSpending + committedCost;
          
          const isInsufficient = proposedAllocation < minimumRequired;
          const adjustedAllocation = isInsufficient ? minimumRequired : proposedAllocation;
          
          if (isInsufficient) {
            setWarnings(prev => [...prev, {
              type: 'phase',
              phaseId: phase._id.toString(),
              phaseName: phase.phaseName || phase.phaseCode,
              message: `Proposed allocation (${proposedAllocation.toLocaleString()}) is less than required minimum (${minimumRequired.toLocaleString()}). Will be adjusted to ${adjustedAllocation.toLocaleString()}.`
            }]);
          }
          
          return {
            phaseId: phase._id.toString(),
            phaseName: phase.phaseName || phase.phaseCode,
            phaseCode: phase.phaseCode,
            proposedAllocation,
            actualSpending,
            committedCost,
            minimumRequired,
            adjustedAllocation,
            isInsufficient
          };
        })
      );

      // Calculate floor allocations for Superstructure phase
      const superstructurePhase = phases.find(p => p.phaseCode === 'PHASE-02');
      let floorData = [];
      
      if (superstructurePhase) {
        const superstructureAllocation = phaseData.find(p => p.phaseCode === 'PHASE-02')?.adjustedAllocation || 0;
        
          // Get floors
          try {
            const floorsResponse = await fetch(`/api/floors?projectId=${projectId}`, {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
              },
            });
            
            const floorsResult = await floorsResponse.json();
            // Handle API response structure
            let floors = [];
            if (floorsResult.success && Array.isArray(floorsResult.data)) {
              floors = floorsResult.data;
            } else if (Array.isArray(floorsResult)) {
              floors = floorsResult;
            } else if (Array.isArray(floorsResult.data)) {
              floors = floorsResult.data;
            }
          
          if (floors.length > 0) {
            // Calculate even distribution
            const evenPerFloor = superstructureAllocation / floors.length;
            
            // Calculate weighted distribution
            const weights = floors.map(f => {
              if (f.floorNumber < 0) return 1.2; // Basement
              if (f.floorNumber >= 10) return 1.3; // Penthouse
              return 1.0; // Typical
            });
            const totalWeight = weights.reduce((sum, w) => sum + w, 0);
            const weightedPerFloor = weights.map(w => (superstructureAllocation * w) / totalWeight);
            
            // Get floor spending from API (server-side only)
            floorData = await Promise.all(
              floors.map(async (floor, index) => {
                try {
                  // Fetch floor budget data from API (includes actual spending and committed costs)
                  const floorBudgetResponse = await fetch(`/api/floors/${floor._id}/budget`, {
                    cache: 'no-store',
                    headers: {
                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                      'Pragma': 'no-cache',
                    },
                  });
                  
                  let actual = { total: 0 };
                  let committed = { total: 0 };
                  
                  if (floorBudgetResponse.ok) {
                    const floorBudgetResult = await floorBudgetResponse.json();
                    if (floorBudgetResult.success && floorBudgetResult.data) {
                      actual = floorBudgetResult.data.actualSpending || { total: 0 };
                      committed = floorBudgetResult.data.committedCosts || { total: 0 };
                    }
                  }
                  
                  const minimumRequired = (actual.total || 0) + (committed.total || 0);
                  
                  const evenAllocation = evenPerFloor;
                  const weightedAllocation = weightedPerFloor[index] || 0;
                  
                  // Use weighted as default, but ensure minimum
                  const proposedFloorAllocation = Math.max(minimumRequired, weightedAllocation);
                  const isInsufficient = weightedAllocation < minimumRequired;
                  
                  if (isInsufficient) {
                    setWarnings(prev => [...prev, {
                      type: 'floor',
                      floorId: floor._id.toString(),
                      floorName: floor.name || `Floor ${floor.floorNumber}`,
                      message: `Proposed allocation (${weightedAllocation.toLocaleString()}) is less than required minimum (${minimumRequired.toLocaleString()}). Will be adjusted to ${proposedFloorAllocation.toLocaleString()}.`
                    }]);
                  }
                  
                  return {
                    floorId: floor._id.toString(),
                    floorNumber: floor.floorNumber,
                    floorName: floor.name || `Floor ${floor.floorNumber}`,
                    proposedAllocation: weightedAllocation,
                    evenAllocation,
                    actualSpending: actual.total || 0,
                    committedCosts: committed.total || 0,
                    minimumRequired,
                    adjustedAllocation: proposedFloorAllocation,
                    isInsufficient
                  };
                } catch (error) {
                  console.error(`Error calculating floor ${floor._id} spending:`, error);
                  return null;
                }
              })
            );
            
            floorData = floorData.filter(f => f !== null);
          }
        } catch (error) {
          console.error('Error fetching floors for preview:', error);
        }
      }

      setPreviewData({
        dcc,
        phaseData,
        floorData,
        totalPhaseAllocation: phaseData.reduce((sum, p) => sum + p.adjustedAllocation, 0),
        totalFloorAllocation: floorData.reduce((sum, f) => sum + f.adjustedAllocation, 0)
      });
    } catch (error) {
      console.error('Error calculating allocation preview:', error);
      setErrors([error.message || 'Failed to calculate allocation preview']);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (errors.length > 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm font-semibold mb-2">Errors:</p>
        <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (!previewData) {
    return null;
  }

  const { phaseData, floorData, totalPhaseAllocation, totalFloorAllocation } = previewData;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-bold text-gray-900">Allocation Preview</h3>
        <p className="text-sm text-gray-600 mt-1">
          Review proposed allocations before confirming. Adjustments will be made automatically if allocations are insufficient.
        </p>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-yellow-900 mb-2">
            {warnings.length} Warning(s):
          </p>
          <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
            {warnings.map((warning, index) => (
              <li key={index}>{warning.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Phase Allocations */}
      <div>
        <h4 className="text-md font-semibold text-gray-900 mb-3">Phase Allocations</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phase</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Proposed</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spent</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Minimum</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Final</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {phaseData.map((phase) => (
                <tr key={phase.phaseId} className={phase.isInsufficient ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {phase.phaseName}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    {formatCurrency(phase.proposedAllocation)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    {formatCurrency(phase.actualSpending)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                    {formatCurrency(phase.minimumRequired)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                    {formatCurrency(phase.adjustedAllocation)}
                    {phase.isInsufficient && (
                      <span className="ml-2 text-xs text-yellow-600">(adjusted)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                  {formatCurrency(phaseData.reduce((sum, p) => sum + p.proposedAllocation, 0))}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                  {formatCurrency(phaseData.reduce((sum, p) => sum + p.actualSpending, 0))}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                  {formatCurrency(phaseData.reduce((sum, p) => sum + p.minimumRequired, 0))}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                  {formatCurrency(totalPhaseAllocation)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Floor Allocations (if applicable) */}
      {floorData.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Floor Allocations (Superstructure)</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Floor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Proposed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spent</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Minimum</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Final</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {floorData.map((floor) => (
                  <tr key={floor.floorId} className={floor.isInsufficient ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {floor.floorName}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(floor.proposedAllocation)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(floor.actualSpending)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                      {formatCurrency(floor.minimumRequired)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                      {formatCurrency(floor.adjustedAllocation)}
                      {floor.isInsufficient && (
                        <span className="ml-2 text-xs text-yellow-600">(adjusted)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                    {formatCurrency(floorData.reduce((sum, f) => sum + f.proposedAllocation, 0))}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                    {formatCurrency(floorData.reduce((sum, f) => sum + f.actualSpending, 0))}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                    {formatCurrency(floorData.reduce((sum, f) => sum + f.minimumRequired, 0))}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                    {formatCurrency(totalFloorAllocation)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Confirm & Allocate
        </button>
      </div>
    </div>
  );
}
