/**
 * Smart Budget Input Component
 * Simplified budget structure focusing on 4 essential fields
 * Optional detailed breakdowns for advanced users
 * 
 * Usage:
 * <SmartBudgetInput
 *   value={budgetData}
 *   onChange={setBudgetData}
 *   projectType="residential"
 *   showAdvanced={false}
 * />
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';

export function SmartBudgetInput({
  value = null,
  onChange,
  projectType = 'residential',
  showAdvanced: showAdvancedProp = false,
  disabled = false,
  onProjectTypeChange, // Add callback for project type changes
}) {
  const toast = useToast();
  const [showAdvanced, setShowAdvanced] = useState(showAdvancedProp);
  const [budgetData, setBudgetData] = useState(() => {
    // Initialize with simplified structure
    if (value && (value.total !== undefined || value.directConstructionCosts !== undefined)) {
      return {
        total: value.total || 0,
        directConstructionCosts: value.directConstructionCosts || 0,
        preConstructionCosts: value.preConstructionCosts || 0,
        indirectCosts: value.indirectCosts || 0,
        contingencyReserve: value.contingencyReserve || 0,
        // Optional detailed breakdowns
        _detailedBreakdown: value._detailedBreakdown || {
          materials: { total: 0, structural: 0, finishing: 0, mep: 0, specialty: 0 },
          labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
          equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
          subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 },
          preConstruction: {
            total: 0,
            landAcquisition: 0,
            legalRegulatory: 0,
            permitsApprovals: 0,
            sitePreparation: 0,
          },
          indirect: {
            total: 0,
            siteOverhead: 0,
            transportation: 0,
            utilities: 0,
            safetyCompliance: 0,
          },
          contingency: {
            total: 0,
            designContingency: 0,
            constructionContingency: 0,
            ownersReserve: 0,
          },
        }
      };
    }
    
    // Default structure
    return {
      total: 0,
      directConstructionCosts: 0,
      preConstructionCosts: 0,
      indirectCosts: 0,
      contingencyReserve: 0,
      _detailedBreakdown: {
        materials: { total: 0, structural: 0, finishing: 0, mep: 0, specialty: 0 },
        labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
        equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
        subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 },
        preConstruction: {
          total: 0,
          landAcquisition: 0,
          legalRegulatory: 0,
          permitsApprovals: 0,
          sitePreparation: 0,
        },
        indirect: {
          total: 0,
          siteOverhead: 0,
          transportation: 0,
          utilities: 0,
          safetyCompliance: 0,
        },
        contingency: {
          total: 0,
          designContingency: 0,
          constructionContingency: 0,
          ownersReserve: 0,
        },
      }
    };
  });

  // Update when external value changes
  useEffect(() => {
    if (value) {
      setBudgetData({
        total: value.total || 0,
        directConstructionCosts: value.directConstructionCosts || 0,
        preConstructionCosts: value.preConstructionCosts || 0,
        indirectCosts: value.indirectCosts || 0,
        contingencyReserve: value.contingencyReserve || 0,
        _detailedBreakdown: value._detailedBreakdown || budgetData._detailedBreakdown
      });
    }
  }, [value]);

  // Update suggestions when project type changes
  const [currentProjectType, setCurrentProjectType] = useState(projectType);
  
  useEffect(() => {
    setCurrentProjectType(projectType);
  }, [projectType]);

  // Smart suggestions based on project type
  const getSmartSuggestions = () => {
    const suggestions = {
      residential: {
        directConstructionCosts: 0.70,  // 70% of total
        preConstructionCosts: 0.10,    // 10% of total
        indirectCosts: 0.10,           // 10% of total
        contingencyReserve: 0.10          // 10% of total
      },
      commercial: {
        directConstructionCosts: 0.65,  // 65% of total
        preConstructionCosts: 0.15,    // 15% of total
        indirectCosts: 0.12,           // 12% of total
        contingencyReserve: 0.08          // 8% of total
      },
      infrastructure: {
        directConstructionCosts: 0.60,  // 60% of total
        preConstructionCosts: 0.20,    // 20% of total
        indirectCosts: 0.15,           // 15% of total
        contingencyReserve: 0.05          // 5% of total
      }
    };
    
    return suggestions[currentProjectType] || suggestions.residential;
  };

  const handleMainFieldChange = (field, newValue) => {
    const newData = { ...budgetData };
    newData[field] = Number.parseFloat(newValue) || 0;
    
    // Auto-calculate total if any main field changes
    if (field !== 'total') {
      newData.total = newData.directConstructionCosts + 
                     newData.preConstructionCosts + 
                     newData.indirectCosts + 
                     newData.contingencyReserve;
    } else {
      // If total changes, distribute based on smart suggestions
      const suggestions = getSmartSuggestions();
      newData.directConstructionCosts = Math.round(newValue * suggestions.directConstructionCosts);
      newData.preConstructionCosts = Math.round(newValue * suggestions.preConstructionCosts);
      newData.indirectCosts = Math.round(newValue * suggestions.indirectCosts);
      newData.contingencyReserve = Math.round(newValue * suggestions.contingencyReserve);
    }
    
    setBudgetData(newData);
    if (onChange) {
      onChange(newData);
    }
  };

  const handleDetailedChange = (path, val) => {
    const newData = { ...budgetData };
    const keys = path.split('.');
    let current = newData._detailedBreakdown;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = Number.parseFloat(val) || 0;

    // Update main field totals when detailed breakdowns change
    if (path.includes('materials') && !path.includes('.total')) {
      const materials = newData._detailedBreakdown.materials;
      materials.total = materials.structural + materials.finishing + materials.mep + materials.specialty;
      newData.directConstructionCosts = materials.total + 
                                   newData._detailedBreakdown.labour.total + 
                                   newData._detailedBreakdown.equipment.total + 
                                   newData._detailedBreakdown.subcontractors.total;
    }

    if (path.includes('labour') && !path.includes('.total')) {
      const labour = newData._detailedBreakdown.labour;
      labour.total = labour.skilled + labour.unskilled + labour.supervisory + labour.specialized;
      newData.directConstructionCosts = newData._detailedBreakdown.materials.total + 
                                   labour.total + 
                                   newData._detailedBreakdown.equipment.total + 
                                   newData._detailedBreakdown.subcontractors.total;
    }

    setBudgetData(newData);
    if (onChange) {
      onChange(newData);
    }
  };

  const applySmartSuggestions = () => {
    const suggestions = getSmartSuggestions();
    const currentTotal = budgetData.total || 10000000; // Default to 10M if no total
    
    const newData = {
      ...budgetData,
      directConstructionCosts: Math.round(currentTotal * suggestions.directConstructionCosts),
      preConstructionCosts: Math.round(currentTotal * suggestions.preConstructionCosts),
      indirectCosts: Math.round(currentTotal * suggestions.indirectCosts),
      contingencyReserve: Math.round(currentTotal * suggestions.contingencyReserve),
      total: currentTotal
    };
    
    setBudgetData(newData);
    if (onChange) {
      onChange(newData);
    }
    
    toast.showSuccess(`Applied ${currentProjectType} project budget allocation`);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getPercentage = (amount, total) => {
    if (total === 0) return 0;
    return Math.round((amount / total) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-green-600 rounded-lg p-2">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold ds-text-primary">Smart Budget Setup</h3>
            <p className="text-xs ds-text-secondary mt-1">Essential budget fields with intelligent suggestions</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={currentProjectType}
            onChange={(e) => {
              const newType = e.target.value;
              setCurrentProjectType(newType);
              onProjectTypeChange?.(newType);
              console.log('Project type changed:', newType);
            }}
            className="px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all"
            disabled={disabled}
          >
            <option value="residential">🏠 Residential</option>
            <option value="commercial">🏢 Commercial</option>
            <option value="infrastructure">🏗️ Infrastructure</option>
          </select>
          
          <button
            type="button"
            onClick={applySmartSuggestions}
            disabled={disabled}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-blue-300 text-sm font-medium transition-all shadow-sm"
          >
            ✨ Apply Smart Allocation
          </button>
        </div>
      </div>

      {/* Main Budget Fields */}
      <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-xl p-4 sm:p-6 border-2 ds-border-subtle dark:border-gray-700 shadow-sm">
        <h4 className="text-sm font-bold ds-text-primary mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Essential Budget Allocation
        </h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Budget */}
          <div className="lg:col-span-2 ds-bg-surface dark:bg-gray-800 rounded-lg p-3 sm:p-4 border-2 border-blue-400/60 dark:border-blue-500/50 shadow-sm">
            <label className="block text-xs font-semibold ds-text-secondary dark:text-gray-400 mb-2 uppercase tracking-wide">
              Total Project Budget
            </label>
            <input
              type="number"
              value={budgetData.total || 0}
              onChange={(e) => handleMainFieldChange('total', e.target.value)}
              disabled={disabled}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 ds-bg-surface dark:bg-gray-700 ds-text-primary dark:text-white border-2 ds-border-subtle dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 text-lg sm:text-xl font-bold transition-all"
              placeholder="0.00"
            />
            <div className="mt-2 text-xs ds-text-secondary dark:text-gray-400">
              {getPercentage(budgetData.directConstructionCosts + budgetData.preConstructionCosts + budgetData.indirectCosts + budgetData.contingencyReserve, budgetData.total)}% allocated
            </div>
          </div>
          
          {/* Direct Construction Costs */}
          <div className="ds-bg-surface dark:bg-gray-800 rounded-lg p-3 sm:p-4 border-2 border-blue-400/60 dark:border-blue-500/50 shadow-sm">
            <label className="block text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 uppercase tracking-wide">
              Direct Construction
            </label>
            <input
              type="number"
              value={budgetData.directConstructionCosts || 0}
              onChange={(e) => handleMainFieldChange('directConstructionCosts', e.target.value)}
              disabled={disabled}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 ds-bg-surface dark:bg-gray-700 ds-text-primary dark:text-white border-2 ds-border-subtle dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 text-base sm:text-lg font-semibold transition-all"
              placeholder="0.00"
            />
            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
              {getPercentage(budgetData.directConstructionCosts, budgetData.total)}% of total
            </div>
          </div>
          
          {/* Pre-Construction Costs */}
          <div className="ds-bg-surface dark:bg-gray-800 rounded-lg p-3 sm:p-4 border-2 border-purple-400/60 dark:border-purple-500/50 shadow-sm">
            <label className="block text-xs font-semibold text-purple-700 dark:text-purple-400 mb-2 uppercase tracking-wide">
              Pre-Construction
            </label>
            <input
              type="number"
              value={budgetData.preConstructionCosts || 0}
              onChange={(e) => handleMainFieldChange('preConstructionCosts', e.target.value)}
              disabled={disabled}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 ds-bg-surface dark:bg-gray-700 ds-text-primary dark:text-white border-2 ds-border-subtle dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:focus:ring-purple-400 dark:focus:border-purple-400 text-base sm:text-lg font-semibold transition-all"
              placeholder="0.00"
            />
            <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">
              {getPercentage(budgetData.preConstructionCosts, budgetData.total)}% of total
            </div>
          </div>
          
          {/* Indirect Costs */}
          <div className="ds-bg-surface dark:bg-gray-800 rounded-lg p-3 sm:p-4 border-2 border-teal-400/60 dark:border-teal-500/50 shadow-sm">
            <label className="block text-xs font-semibold text-teal-700 dark:text-teal-400 mb-2 uppercase tracking-wide">
              Indirect Costs
            </label>
            <input
              type="number"
              value={budgetData.indirectCosts || 0}
              onChange={(e) => handleMainFieldChange('indirectCosts', e.target.value)}
              disabled={disabled}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 ds-bg-surface dark:bg-gray-700 ds-text-primary dark:text-white border-2 ds-border-subtle dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:focus:ring-teal-400 dark:focus:border-teal-400 text-base sm:text-lg font-semibold transition-all"
              placeholder="0.00"
            />
            <div className="mt-2 text-xs text-teal-600 dark:text-teal-400">
              {getPercentage(budgetData.indirectCosts, budgetData.total)}% of total
            </div>
          </div>
          
          {/* Contingency Reserve */}
          <div className="ds-bg-surface dark:bg-gray-800 rounded-lg p-3 sm:p-4 border-2 border-orange-400/60 dark:border-orange-500/50 shadow-sm">
            <label className="block text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2 uppercase tracking-wide">
              Contingency Reserve
            </label>
            <input
              type="number"
              value={budgetData.contingencyReserve || 0}
              onChange={(e) => handleMainFieldChange('contingencyReserve', e.target.value)}
              disabled={disabled}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 ds-bg-surface dark:bg-gray-700 ds-text-primary dark:text-white border-2 ds-border-subtle dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:focus:ring-orange-400 dark:focus:border-orange-400 text-base sm:text-lg font-semibold transition-all"
              placeholder="0.00"
            />
            <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
              {getPercentage(budgetData.contingencyReserve, budgetData.total)}% of total
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Breakdown Toggle */}
      {!showAdvanced && (
        <button
          type="button"
          onClick={() => setShowAdvanced(true)}
          disabled={disabled}
          className="w-full py-3 sm:py-4 px-4 sm:px-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-400/60 dark:border-blue-500/50 rounded-xl hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-800/30 dark:hover:to-indigo-800/30 hover:border-blue-400/60 dark:hover:border-blue-400/60 transition-all flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 font-semibold text-blue-700 dark:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span>Show Advanced Breakdowns</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <div className="ml-2 text-xs font-normal text-blue-600">
            (Optional detailed category breakdowns)
          </div>
        </button>
      )}

      {/* Hide Advanced Toggle */}
      {showAdvanced && (
        <button
          type="button"
          onClick={() => setShowAdvanced(false)}
          disabled={disabled}
          className="w-full py-3 sm:py-4 px-4 sm:px-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-2 ds-border-subtle dark:border-gray-600 rounded-xl hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-600 hover:border-ds-border-strong dark:hover:border-gray-500 transition-all flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 font-semibold ds-text-secondary dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <span>Hide Advanced Breakdowns</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}

      {/* Advanced Breakdown Section */}
      {showAdvanced && (
        <div className="space-y-6">
          {/* Direct Construction Breakdown */}
          <div className="ds-bg-surface dark:bg-gray-800 border-2 ds-border-subtle dark:border-gray-700 rounded-xl p-4 sm:p-6 shadow-sm">
            <h4 className="text-base font-bold ds-text-primary mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 00-2-2H7a2 2 0 00-2 2v10m0 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Direct Construction Breakdown
            </h4>

            {/* Materials */}
            <div className="mb-4 sm:mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 sm:p-5 border-l-4 border-blue-500 dark:border-blue-400">
              <label className="block text-sm font-bold ds-text-primary dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                Materials & Supplies
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold ds-text-secondary dark:text-gray-400 mb-2 uppercase tracking-wide">Total</label>
                  <input
                    type="number"
                    value={budgetData._detailedBreakdown.materials.total || 0}
                    onChange={(e) => handleDetailedChange("materials.total", e.target.value)}
                    disabled={disabled}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 ds-bg-surface dark:bg-gray-700 ds-text-primary dark:text-white border-2 ds-border-subtle dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 text-sm sm:text-base font-medium transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold ds-text-secondary dark:text-gray-400 mb-2 uppercase tracking-wide">Structural</label>
                  <input
                    type="number"
                    value={budgetData._detailedBreakdown.materials.structural || 0}
                    onChange={(e) => handleDetailedChange("materials.structural", e.target.value)}
                    disabled={disabled}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 ds-bg-surface dark:bg-gray-700 ds-text-primary dark:text-white border-2 ds-border-subtle dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 text-sm sm:text-base font-medium transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold ds-text-secondary dark:text-gray-400 mb-2 uppercase tracking-wide">Finishing</label>
                  <input
                    type="number"
                    value={budgetData._detailedBreakdown.materials.finishing || 0}
                    onChange={(e) => handleDetailedChange("materials.finishing", e.target.value)}
                    disabled={disabled}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 ds-bg-surface dark:bg-gray-700 ds-text-primary dark:text-white border-2 ds-border-subtle dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 text-sm sm:text-base font-medium transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold ds-text-secondary dark:text-gray-400 mb-2 uppercase tracking-wide">MEP</label>
                  <input
                    type="number"
                    value={budgetData._detailedBreakdown.materials.mep || 0}
                    onChange={(e) => handleDetailedChange("materials.mep", e.target.value)}
                    disabled={disabled}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 ds-bg-surface dark:bg-gray-700 ds-text-primary dark:text-white border-2 ds-border-subtle dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 text-sm sm:text-base font-medium transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold ds-text-secondary dark:text-gray-400 mb-2 uppercase tracking-wide">Specialty</label>
                  <input
                    type="number"
                    value={budgetData._detailedBreakdown.materials.specialty || 0}
                    onChange={(e) => handleDetailedChange("materials.specialty", e.target.value)}
                    disabled={disabled}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 ds-bg-surface dark:bg-gray-700 ds-text-primary dark:text-white border-2 ds-border-subtle dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 text-sm sm:text-base font-medium transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmartBudgetInput;
