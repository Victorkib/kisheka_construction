/**
 * Enhanced Investment Allocation Manager Component
 * 
 * Modern, feature-rich allocation manager with project cards, financial context,
 * visual indicators, and smart suggestions
 * 
 * @component
 * @param {string} investorId - Investor ID
 * @param {number} totalInvested - Total invested amount
 * @param {function} onUpdate - Callback when allocations are updated
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { LoadingButton, LoadingOverlay, LoadingSpinner } from '@/components/loading';
import Link from 'next/link';

const normalizeId = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return normalizeId(value[0]);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return value.$oid;
  if (typeof value === 'object' && value._id) return normalizeId(value._id);
  return value.toString?.() || '';
};

export function EnhancedAllocationManager({ investorId, totalInvested, onUpdate }) {
  const [allocations, setAllocations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectsFinancialData, setProjectsFinancialData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, allocated, unallocated, needs_capital

  useEffect(() => {
    fetchData();
  }, [investorId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch allocations and projects in parallel
      const [allocationsRes, projectsRes] = await Promise.all([
        fetch(`/api/investors/${investorId}/allocations`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch('/api/projects', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
      ]);

      const allocationsData = await allocationsRes.json();
      const projectsData = await projectsRes.json();

      if (!allocationsData.success) {
        throw new Error(allocationsData.error || 'Failed to fetch allocations');
      }

      if (!projectsData.success) {
        throw new Error(projectsData.error || 'Failed to fetch projects');
      }

      const normalizedAllocations = (allocationsData.data.allocations || []).map((alloc) => ({
        ...alloc,
        projectId: normalizeId(alloc.projectId),
      }));
      const normalizedProjects = (projectsData.data || []).map((project) => ({
        ...project,
        _id: normalizeId(project._id),
      }));

      setAllocations(normalizedAllocations);
      setProjects(normalizedProjects);

      // Fetch financial data for each project
      await fetchProjectsFinancialData(normalizedProjects, normalizedAllocations);
    } catch (err) {
      setError(err.message || 'Failed to load data');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectsFinancialData = async (projectsList, currentAllocations) => {
    const financialDataMap = {};
    const allocationMap = new Map();
    
    currentAllocations.forEach(alloc => {
      if (alloc.projectId) {
        allocationMap.set(alloc.projectId, alloc.amount || 0);
      }
    });

    // Fetch financial overview for each project
    const financialPromises = projectsList.map(async (project) => {
      try {
        const response = await fetch(`/api/projects/${project._id}/financial-overview`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const overview = data.data;
            const currentAllocation = allocationMap.get(project._id) || 0;
            
            financialDataMap[project._id] = {
              budget: overview.budget?.total || 0,
              currentCapital: overview.financing?.totalInvested || 0,
              spending: overview.financing?.totalUsed || 0,
              committed: overview.financing?.committedCost || 0,
              available: overview.financing?.availableCapital || 0,
              budgetGap: Math.max(0, (overview.budget?.total || 0) - (overview.financing?.totalInvested || 0)),
              thisInvestorAllocation: currentAllocation,
              status: overview.status,
            };
          }
        }
      } catch (err) {
        console.error(`Error fetching financial data for project ${project._id}:`, err);
        // Set default values if fetch fails
        financialDataMap[project._id] = {
          budget: 0,
          currentCapital: 0,
          spending: 0,
          committed: 0,
          available: 0,
          budgetGap: 0,
          thisInvestorAllocation: allocationMap.get(project._id) || 0,
          status: null,
        };
      }
    });

    await Promise.all(financialPromises);
    setProjectsFinancialData(financialDataMap);
  };

  const handleAllocationChange = (projectId, amount) => {
    const existingIndex = allocations.findIndex(alloc => alloc.projectId === projectId);
    const newAmount = parseFloat(amount) || 0;

    if (existingIndex >= 0) {
      if (newAmount > 0) {
        // Update existing allocation
        const updated = [...allocations];
        updated[existingIndex] = {
          ...updated[existingIndex],
          amount: newAmount,
        };
        setAllocations(updated);
      } else {
        // Remove allocation if amount is 0
        setAllocations(allocations.filter((_, i) => i !== existingIndex));
      }
    } else if (newAmount > 0) {
      // Add new allocation
      setAllocations([
        ...allocations,
        {
          projectId,
          amount: newAmount,
          notes: '',
        },
      ]);
    }
  };

  const handleQuickAction = (action) => {
    const unallocated = getUnallocated();
    
    switch (action) {
      case 'allocate_all':
        // Distribute all unallocated evenly among projects with budget gaps
        const projectsWithGaps = filteredProjects.filter(p => {
          const financial = projectsFinancialData[p._id];
          return financial && financial.budgetGap > 0;
        });
        
        if (projectsWithGaps.length > 0) {
          const amountPerProject = unallocated / projectsWithGaps.length;
          projectsWithGaps.forEach(project => {
            const currentAlloc = getAllocationForProject(project._id);
            handleAllocationChange(project._id, currentAlloc + amountPerProject);
          });
        }
        break;
        
      case 'distribute_evenly':
        // Distribute evenly among all projects
        if (filteredProjects.length > 0) {
          const amountPerProject = unallocated / filteredProjects.length;
          filteredProjects.forEach(project => {
            const currentAlloc = getAllocationForProject(project._id);
            handleAllocationChange(project._id, currentAlloc + amountPerProject);
          });
        }
        break;
        
      case 'fill_gaps':
        // Fill budget gaps for projects with gaps
        const projectsNeedingCapital = filteredProjects.filter(p => {
          const financial = projectsFinancialData[p._id];
          return financial && financial.budgetGap > 0;
        });
        
        let remainingUnallocated = unallocated;
        projectsNeedingCapital.forEach(project => {
          const financial = projectsFinancialData[project._id];
          const gap = financial.budgetGap;
          const currentAlloc = getAllocationForProject(project._id);
          const toAllocate = Math.min(gap, remainingUnallocated);
          
          if (toAllocate > 0) {
            handleAllocationChange(project._id, currentAlloc + toAllocate);
            remainingUnallocated -= toAllocate;
          }
        });
        break;
        
      case 'clear_all':
        setAllocations([]);
        break;
    }
  };

  const getAllocationForProject = (projectId) => {
    const allocation = allocations.find(alloc => alloc.projectId === projectId);
    return allocation?.amount || 0;
  };

  const calculateTotalAllocated = () => {
    return allocations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
  };

  const getUnallocated = () => {
    return Math.max(0, totalInvested - calculateTotalAllocated());
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getCapitalHealthStatus = (financial) => {
    if (!financial || financial.budget === 0) return { status: 'neutral', label: 'No Budget', color: 'gray' };
    
    const capitalRatio = financial.currentCapital / financial.budget;
    const availableRatio = financial.available / financial.currentCapital;
    
    if (capitalRatio >= 1 && availableRatio > 0.2) {
      return { status: 'healthy', label: 'Sufficient', color: 'green' };
    } else if (capitalRatio >= 0.8 && availableRatio > 0.1) {
      return { status: 'at_risk', label: 'Adequate', color: 'yellow' };
    } else if (capitalRatio < 0.8 || availableRatio <= 0.1) {
      return { status: 'critical', label: 'Insufficient', color: 'red' };
    }
    return { status: 'neutral', label: 'Unknown', color: 'gray' };
  };

  const getSuggestedAllocation = (project) => {
    const financial = projectsFinancialData[project._id];
    if (!financial) return 0;
    
    // Suggest filling budget gap if there is one
    if (financial.budgetGap > 0) {
      return Math.min(financial.budgetGap, getUnallocated());
    }
    
    // Otherwise suggest based on budget percentage
    const totalBudget = projects.reduce((sum, p) => {
      const fin = projectsFinancialData[p._id];
      return sum + (fin?.budget || 0);
    }, 0);
    
    if (totalBudget > 0 && financial.budget > 0) {
      const budgetRatio = financial.budget / totalBudget;
      return Math.min(financial.budget * budgetRatio, getUnallocated());
    }
    
    return 0;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const validAllocations = allocations
        .filter((alloc) => alloc.projectId && alloc.amount > 0)
        .map((alloc) => ({
          projectId: normalizeId(alloc.projectId),
          amount: parseFloat(alloc.amount) || 0,
          notes: alloc.notes || null,
        }));

      const saveResponse = await fetch(`/api/investors/${investorId}/allocations`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({ allocations: validAllocations }),
      });

      if (!saveResponse.ok) {
        let errorMessage = 'Failed to save allocations';
        try {
          const errorData = await saveResponse.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          errorMessage = saveResponse.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        const responseText = await saveResponse.text();
        if (!responseText) {
          throw new Error('Empty response from server');
        }
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid response from server. Please try again.');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to save allocations');
      }

      setSuccess(true);
      setError(null);
      
      if (data.data?.warnings && data.data.warnings.length > 0) {
        const warningsText = data.data.warnings.join('\n');
        setError(warningsText);
        setTimeout(() => setError(null), 10000);
      }
      
      const updatedAllocations = (data.data.allocations || []).map((alloc) => ({
        ...alloc,
        projectId: normalizeId(alloc.projectId),
      }));
      setAllocations(updatedAllocations);
      
      // Refresh financial data
      await fetchProjectsFinancialData(projects, updatedAllocations);
      
      if (onUpdate) {
        onUpdate(data.data);
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save allocations');
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Filter projects based on search and filter
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.projectName?.toLowerCase().includes(query) ||
        p.projectCode?.toLowerCase().includes(query) ||
        p.location?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus === 'allocated') {
      filtered = filtered.filter(p => getAllocationForProject(p._id) > 0);
    } else if (filterStatus === 'unallocated') {
      filtered = filtered.filter(p => getAllocationForProject(p._id) === 0);
    } else if (filterStatus === 'needs_capital') {
      filtered = filtered.filter(p => {
        const financial = projectsFinancialData[p._id];
        return financial && financial.budgetGap > 0;
      });
    }

    return filtered;
  }, [projects, searchQuery, filterStatus, allocations, projectsFinancialData]);

  const totalAllocated = calculateTotalAllocated();
  const unallocated = getUnallocated();
  const isValid = unallocated >= 0;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6 relative">
      <LoadingOverlay 
        isLoading={saving} 
        message="Saving allocations and recalculating finances..." 
        fullScreen={false} 
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Investment Allocations</h3>
          <p className="text-sm text-gray-600 mt-1">
            Allocate investments to specific projects with financial context
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleQuickAction('fill_gaps')}
            disabled={unallocated <= 0 || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            Fill Budget Gaps
          </button>
          <button
            onClick={() => handleQuickAction('distribute_evenly')}
            disabled={unallocated <= 0 || saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            Distribute Evenly
          </button>
          <button
            onClick={() => handleQuickAction('clear_all')}
            disabled={allocations.length === 0 || saving}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="text-sm font-medium text-blue-700">Total Invested</div>
          <div className="text-2xl font-bold text-blue-900 mt-1">{formatCurrency(totalInvested)}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="text-sm font-medium text-green-700">Total Allocated</div>
          <div className="text-2xl font-bold text-green-900 mt-1">{formatCurrency(totalAllocated)}</div>
        </div>
        <div className={`rounded-lg p-4 border ${
          unallocated > 0 
            ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200' 
            : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'
        }`}>
          <div className={`text-sm font-medium ${unallocated > 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
            Unallocated
          </div>
          <div className={`text-2xl font-bold mt-1 ${unallocated > 0 ? 'text-orange-900' : 'text-emerald-900'}`}>
            {formatCurrency(unallocated)}
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="text-sm font-medium text-purple-700">Projects Allocated</div>
          <div className="text-2xl font-bold text-purple-900 mt-1">
            {allocations.filter(a => a.amount > 0).length}
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search projects by name, code, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
          />
        </div>
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 text-gray-900 bg-white"
          >
            <option value="all">All Projects</option>
            <option value="allocated">With Allocations</option>
            <option value="unallocated">No Allocations</option>
            <option value="needs_capital">Needs Capital</option>
          </select>
        </div>
      </div>

      {/* Error/Warning Message */}
      {error && (
        <div className={`border px-4 py-3 rounded-lg ${
          error.includes('Warning:') || error.includes('warning')
            ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <p className="font-medium">{error.includes('Warning:') || error.includes('warning') ? 'Warning' : 'Error'}</p>
          <div className="text-sm mt-1 whitespace-pre-line">{error}</div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Success</p>
          <p className="text-sm mt-1">Allocations saved successfully!</p>
        </div>
      )}

      {/* Validation Warning */}
      {unallocated < 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Warning</p>
          <p className="text-sm mt-1">
            Total allocated amount exceeds total invested. Please adjust allocations.
          </p>
        </div>
      )}

      {/* Project Cards */}
      {filteredProjects.length === 0 ? (
        <div className="text-center text-gray-600 py-12">
          <p className="text-lg font-medium">No projects found</p>
          <p className="text-sm mt-2">Try adjusting your search or filter criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const financial = projectsFinancialData[project._id] || {};
            const currentAllocation = getAllocationForProject(project._id);
            const healthStatus = getCapitalHealthStatus(financial);
            const suggestedAllocation = getSuggestedAllocation(project);
            const newCapitalAfterAllocation = financial.currentCapital - financial.thisInvestorAllocation + currentAllocation;
            const availableAfterAllocation = Math.max(0, newCapitalAfterAllocation - financial.spending - financial.committed);

            return (
              <div
                key={project._id}
                className="border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow bg-white"
              >
                {/* Project Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Link
                      href={`/projects/${project._id}`}
                      className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition"
                    >
                      {project.projectName}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1">{project.projectCode}</p>
                    {project.location && (
                      <p className="text-xs text-gray-500 mt-1">📍 {project.location}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    healthStatus.color === 'green' ? 'bg-green-100 text-green-800' :
                    healthStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    healthStatus.color === 'red' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {healthStatus.label}
                  </span>
                </div>

                {/* Financial Summary */}
                <div className="space-y-3 mb-4">
                  {financial.budget > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Budget</span>
                        <span>{formatCurrency(financial.budget)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            newCapitalAfterAllocation >= financial.budget ? 'bg-green-600' :
                            newCapitalAfterAllocation >= financial.budget * 0.8 ? 'bg-yellow-600' :
                            'bg-red-600'
                          }`}
                          style={{
                            width: `${Math.min(100, (newCapitalAfterAllocation / financial.budget) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-gray-600">Current Capital</div>
                      <div className="font-semibold text-gray-900">{formatCurrency(financial.currentCapital)}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Spending</div>
                      <div className="font-semibold text-gray-900">{formatCurrency(financial.spending)}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Committed</div>
                      <div className="font-semibold text-gray-900">{formatCurrency(financial.committed)}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Available</div>
                      <div className={`font-semibold ${
                        availableAfterAllocation > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(availableAfterAllocation)}
                      </div>
                    </div>
                  </div>

                  {financial.budgetGap > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                      <div className="text-xs text-yellow-800">
                        <span className="font-medium">Budget Gap:</span> {formatCurrency(financial.budgetGap)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Allocation Input */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Allocation Amount
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={currentAllocation || ''}
                      onChange={(e) => handleAllocationChange(project._id, e.target.value)}
                      min="0"
                      step="1000"
                      placeholder="0"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 text-gray-900 bg-white"
                    />
                    {suggestedAllocation > 0 && currentAllocation === 0 && (
                      <button
                        onClick={() => handleAllocationChange(project._id, suggestedAllocation)}
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-xs font-medium"
                        title={`Suggested: ${formatCurrency(suggestedAllocation)}`}
                      >
                        Use Suggested
                      </button>
                    )}
                  </div>
                  {currentAllocation > 0 && (
                    <div className="text-xs text-gray-600">
                      New capital: {formatCurrency(newCapitalAfterAllocation)} • Available: {formatCurrency(availableAfterAllocation)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <LoadingButton
          onClick={handleSave}
          isLoading={saving}
          loadingText="Saving..."
          disabled={!isValid || saving || allocations.length === 0}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
        >
          Save Allocations
        </LoadingButton>
      </div>
    </div>
  );
}
