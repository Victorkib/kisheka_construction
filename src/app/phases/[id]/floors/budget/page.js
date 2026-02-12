/**
 * Phase Floor Budget Allocation Page
 * Allows allocating phase budget to floors using different strategies
 * 
 * Route: /phases/[id]/floors/budget
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { useToast } from '@/components/toast';

function FloorBudgetAllocationContent() {
  const params = useParams();
  const router = useRouter();
  const phaseId = params.id;
  const toast = useToast();

  const [phase, setPhase] = useState(null);
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [strategy, setStrategy] = useState('even'); // 'even', 'weighted', 'manual'
  const [allocations, setAllocations] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (phaseId) {
      fetchData();
    }
  }, [phaseId]);

  useEffect(() => {
    if (strategy !== 'manual' && phase && floors.length > 0) {
      fetchSuggestions();
    }
  }, [strategy, phase, floors]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch phase
      const phaseResponse = await fetch(`/api/phases/${phaseId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const phaseResult = await phaseResponse.json();
      if (!phaseResult.success) {
        throw new Error(phaseResult.error || 'Failed to fetch phase');
      }
      setPhase(phaseResult.data);

      // Fetch floors for the project
      const projectId = phaseResult.data.projectId.toString();
      const floorsResponse = await fetch(`/api/floors?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const floorsResult = await floorsResponse.json();
      if (floorsResult.success) {
        setFloors(floorsResult.data || []);
        
        // Initialize allocations with current floor budgets
        const initialAllocations = (floorsResult.data || []).map((floor) => ({
          floorId: floor._id.toString(),
          floorNumber: floor.floorNumber,
          floorName: floor.name,
          total: floor.budgetAllocation?.total || floor.totalBudget || 0,
          materials: floor.budgetAllocation?.materials || 0,
          labour: floor.budgetAllocation?.labour || 0,
          equipment: floor.budgetAllocation?.equipment || 0,
          subcontractors: floor.budgetAllocation?.subcontractors || 0,
        }));
        setAllocations(initialAllocations);
      }
    } catch (err) {
      console.error('Fetch data error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`/api/phases/${phaseId}/floors/budget?strategy=${strategy}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const result = await response.json();
      if (result.success) {
        setSuggestions(result.data.suggestions || []);
        
        // If strategy is not manual, update allocations with suggestions
        if (strategy !== 'manual') {
          const updatedAllocations = allocations.map((alloc) => {
            const suggestion = result.data.suggestions.find(
              (s) => s.floorId === alloc.floorId
            );
            if (suggestion) {
              return {
                ...alloc,
                total: suggestion.suggestedBudget,
              };
            }
            return alloc;
          });
          setAllocations(updatedAllocations);
        }
      }
    } catch (err) {
      console.error('Fetch suggestions error:', err);
    }
  };

  const handleAllocationChange = (floorId, field, value) => {
    setAllocations((prev) =>
      prev.map((alloc) =>
        alloc.floorId === floorId
          ? { ...alloc, [field]: parseFloat(value) || 0 }
          : alloc
      )
    );
  };

  const handleApplySuggestions = () => {
    const updatedAllocations = allocations.map((alloc) => {
      const suggestion = suggestions.find((s) => s.floorId === alloc.floorId);
      if (suggestion) {
        return {
          ...alloc,
          total: suggestion.suggestedBudget,
        };
      }
      return alloc;
    });
    setAllocations(updatedAllocations);
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    if (!phase) {
      toast.showError('Phase data not loaded');
      return;
    }

    const phaseBudget = phase.budgetAllocation?.total || 0;
    const totalAllocated = allocations.reduce((sum, alloc) => sum + (alloc.total || 0), 0);

    if (totalAllocated > phaseBudget) {
      toast.showError(
        `Total allocations (${totalAllocated.toLocaleString()}) exceed phase budget (${phaseBudget.toLocaleString()})`
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/phases/${phaseId}/floors/budget`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          allocations: allocations.map((alloc) => ({
            floorId: alloc.floorId,
            total: alloc.total,
            materials: alloc.materials,
            labour: alloc.labour,
            equipment: alloc.equipment,
            subcontractors: alloc.subcontractors,
          })),
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to save floor budgets');
      }

      toast.showSuccess(`Budget allocated to ${result.data.floors.length} floors successfully!`);
      await fetchData(); // Refresh data
    } catch (err) {
      toast.showError(err.message || 'Failed to save floor budgets');
      console.error('Save floor budgets error:', err);
    } finally {
      setIsSaving(false);
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
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading floor budget allocation...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!phase) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">Phase not found.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const [floorBudgets, setFloorBudgets] = useState({});

  useEffect(() => {
    // Fetch actual spending for each floor
    const fetchFloorBudgets = async () => {
      const budgets = {};
      await Promise.all(
        allocations.map(async (alloc) => {
          try {
            const response = await fetch(`/api/floors/${alloc.floorId}/budget`, {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
              },
            });
            const result = await response.json();
            if (result.success) {
              budgets[alloc.floorId] = {
                actualSpending: result.data.actualSpending?.total || 0,
                remaining: result.data.remaining || 0,
              };
            }
          } catch (err) {
            console.error(`Error fetching floor ${alloc.floorId} budget:`, err);
            budgets[alloc.floorId] = {
              actualSpending: 0,
              remaining: alloc.total || 0,
            };
          }
        })
      );
      setFloorBudgets(budgets);
    };

    if (allocations.length > 0) {
      fetchFloorBudgets();
    }
  }, [allocations]);

  const phaseBudget = phase.budgetAllocation?.total || 0;
  const totalAllocated = allocations.reduce((sum, alloc) => sum + (alloc.total || 0), 0);
  const remainingUnallocated = phaseBudget - totalAllocated;
  const isOverAllocated = totalAllocated > phaseBudget;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-4">
              <li>
                <Link href="/projects" className="text-gray-400 hover:text-gray-500">
                  Projects
                </Link>
              </li>
              <li>
                <span className="text-gray-500">/</span>
              </li>
              <li>
                <Link href={`/phases/${phaseId}`} className="text-gray-400 hover:text-gray-500">
                  {phase.phaseName || phase.phaseCode}
                </Link>
              </li>
              <li>
                <span className="text-gray-500">/</span>
              </li>
              <li>
                <span className="text-gray-900 font-medium">Floor Budget Allocation</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Floor Budget Allocation</h1>
              <p className="mt-2 text-gray-600">
                {phase.phaseName || phase.phaseCode} - Allocate budget to floors
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/phases/${phaseId}`}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
              >
                Back to Phase
              </Link>
            </div>
          </div>
        </div>

        {/* Phase Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Phase Budget Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Phase Budget</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(phaseBudget)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Allocated</p>
              <p className={`text-2xl font-bold ${isOverAllocated ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(totalAllocated)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Remaining</p>
              <p className={`text-2xl font-bold ${remainingUnallocated < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {formatCurrency(remainingUnallocated)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Floors</p>
              <p className="text-2xl font-bold text-gray-900">{floors.length}</p>
            </div>
          </div>
          {isOverAllocated && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              <strong>Warning:</strong> Total allocations exceed phase budget by {formatCurrency(Math.abs(remainingUnallocated))}
            </div>
          )}
        </div>

        {/* Distribution Strategy */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribution Strategy</h2>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="even"
                checked={strategy === 'even'}
                onChange={(e) => setStrategy(e.target.value)}
                className="mr-2"
              />
              <span>Even Distribution</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="weighted"
                checked={strategy === 'weighted'}
                onChange={(e) => setStrategy(e.target.value)}
                className="mr-2"
              />
              <span>Weighted by Floor Type</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="manual"
                checked={strategy === 'manual'}
                onChange={(e) => setStrategy(e.target.value)}
                className="mr-2"
              />
              <span>Manual Entry</span>
            </label>
          </div>
          {strategy !== 'manual' && suggestions.length > 0 && (
            <div className="mt-4">
              <button
                onClick={handleApplySuggestions}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
              >
                Apply Suggestions
              </button>
            </div>
          )}
        </div>

        {/* Floor Budget Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Floor Budget Allocation</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Floor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Suggested Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Allocated Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actual Spent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remaining
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allocations.map((alloc) => {
                  const suggestion = suggestions.find((s) => s.floorId === alloc.floorId);
                  const floorBudget = floorBudgets[alloc.floorId] || { actualSpending: 0, remaining: alloc.total || 0 };
                  const variance = (floorBudget.actualSpending || 0) - (alloc.total || 0);
                  const isOverBudget = variance > 0;

                  return (
                    <tr key={alloc.floorId} className={isOverBudget ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {alloc.floorName}
                        </div>
                        <div className="text-sm text-gray-500">Floor {alloc.floorNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {suggestion ? formatCurrency(suggestion.suggestedBudget) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={alloc.total || 0}
                          onChange={(e) => handleAllocationChange(alloc.floorId, 'total', e.target.value)}
                          className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="1000"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(floorBudget.actualSpending || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-medium ${
                            (floorBudget.remaining || 0) < (alloc.total || 0) * 0.2
                              ? 'text-red-600'
                              : (floorBudget.remaining || 0) < (alloc.total || 0) * 0.5
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}
                        >
                          {formatCurrency(floorBudget.remaining || alloc.total || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-medium ${
                            isOverBudget ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {formatCurrency(variance)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href={`/phases/${phaseId}`}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={isSaving || isOverAllocated}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            {isSaving ? 'Saving...' : 'Save Allocations'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

export default function FloorBudgetAllocationPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <FloorBudgetAllocationContent />
    </Suspense>
  );
}
