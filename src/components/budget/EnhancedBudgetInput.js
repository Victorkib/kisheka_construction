/**
 * Enhanced Budget Input Component
 * Enhanced (hierarchical) budget structure only
 * All budgets are stored in enhanced format for consistency and better financial tracking
 */

"use client"

import { useState, useEffect } from "react"
import { convertLegacyToEnhanced } from "@/lib/schemas/budget-schema"

export function EnhancedBudgetInput({
  value = null,
  onChange,
  showAdvanced: showAdvancedProp = true, // CHANGED: Default to true - show advanced options by default
  disabled = false,
}) {
  const [showAdvanced, setShowAdvanced] = useState(showAdvancedProp)
  const [budgetData, setBudgetData] = useState(() => {
    // Always use enhanced structure - convert legacy if needed
    if (value && value.directCosts) {
      // Already enhanced structure
      return {
        total: value.total || 0,
        directConstructionCosts: value.directConstructionCosts || 0,
        preConstructionCosts: value.preConstructionCosts || 0,
        indirectCosts: value.indirectCosts || 0,
        contingencyReserve: value.contingencyReserve || value.contingency?.total || value.contingency || 0,
        directCosts: {
          materials: value.directCosts?.materials || {
            total: value.materials || 0,
            structural: 0,
            finishing: 0,
            mep: 0,
            specialty: 0,
          },
          labour: value.directCosts?.labour || {
            total: value.labour || 0,
            skilled: 0,
            unskilled: 0,
            supervisory: 0,
            specialized: 0,
          },
          equipment: value.directCosts?.equipment || { total: 0, rental: 0, purchase: 0, maintenance: 0 },
          subcontractors: value.directCosts?.subcontractors || {
            total: 0,
            specializedTrades: 0,
            professionalServices: 0,
          },
        },
        preConstruction: value.preConstruction || {
          total: value.preConstructionCosts || 0,
          landAcquisition: 0,
          legalRegulatory: 0,
          permitsApprovals: 0,
          sitePreparation: 0,
        },
        indirect: value.indirect || {
          total: value.indirectCosts || 0,
          siteOverhead: 0,
          transportation: 0,
          utilities: 0,
          safetyCompliance: 0,
        },
        contingency: value.contingency || {
          total: value.contingencyReserve || value.contingency || 0,
          designContingency: 0,
          constructionContingency: 0,
          ownersReserve: 0,
        },
      }
    } else if (
      value &&
      (value.materials !== undefined || value.labour !== undefined || value.contingency !== undefined)
    ) {
      // Legacy structure - convert to enhanced immediately
      const converted = convertLegacyToEnhanced(value)
      return {
        total: converted.total || 0,
        directConstructionCosts: converted.directConstructionCosts || 0,
        preConstructionCosts: converted.preConstructionCosts || 0,
        indirectCosts: converted.indirectCosts || 0,
        contingencyReserve: converted.contingencyReserve || converted.contingency?.total || 0,
        directCosts: converted.directCosts || {
          materials: { total: 0, structural: 0, finishing: 0, mep: 0, specialty: 0 },
          labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
          equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
          subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 },
        },
        preConstruction: converted.preConstruction || {
          total: converted.preConstructionCosts || 0,
          landAcquisition: 0,
          legalRegulatory: 0,
          permitsApprovals: 0,
          sitePreparation: 0,
        },
        indirect: converted.indirect || {
          total: converted.indirectCosts || 0,
          siteOverhead: 0,
          transportation: 0,
          utilities: 0,
          safetyCompliance: 0,
        },
        contingency: converted.contingency || {
          total: converted.contingencyReserve || 0,
          designContingency: 0,
          constructionContingency: 0,
          ownersReserve: 0,
        },
      }
    } else {
      // Empty - initialize with enhanced structure
      return {
        total: 0,
        directConstructionCosts: 0,
        preConstructionCosts: 0,
        indirectCosts: 0,
        contingencyReserve: 0,
        directCosts: {
          materials: { total: 0, structural: 0, finishing: 0, mep: 0, specialty: 0 },
          labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
          equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
          subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 },
        },
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
    }
  })
  console.log('budgetData ', budgetData)

  useEffect(() => {
    if (value) {
      if (value.directCosts) {
        // Already enhanced structure
        setBudgetData({
          total: value.total || 0,
          directConstructionCosts: value.directConstructionCosts || 0,
          preConstructionCosts: value.preConstructionCosts || 0,
          indirectCosts: value.indirectCosts || 0,
          contingencyReserve: value.contingencyReserve || value.contingency?.total || value.contingency || 0,
          directCosts: {
            materials: value.directCosts?.materials || {
              total: value.materials || 0,
              structural: 0,
              finishing: 0,
              mep: 0,
              specialty: 0,
            },
            labour: value.directCosts?.labour || {
              total: value.labour || 0,
              skilled: 0,
              unskilled: 0,
              supervisory: 0,
              specialized: 0,
            },
            equipment: value.directCosts?.equipment || { total: 0, rental: 0, purchase: 0, maintenance: 0 },
            subcontractors: value.directCosts?.subcontractors || {
              total: 0,
              specializedTrades: 0,
              professionalServices: 0,
            },
          },
          preConstruction: value.preConstruction || {
            total: value.preConstructionCosts || 0,
            landAcquisition: 0,
            legalRegulatory: 0,
            permitsApprovals: 0,
            sitePreparation: 0,
          },
          indirect: value.indirect || {
            total: value.indirectCosts || 0,
            siteOverhead: 0,
            transportation: 0,
            utilities: 0,
            safetyCompliance: 0,
          },
          contingency: value.contingency || {
            total: value.contingencyReserve || value.contingency || 0,
            designContingency: 0,
            constructionContingency: 0,
            ownersReserve: 0,
          },
        })
      } else if (value.materials !== undefined || value.labour !== undefined || value.contingency !== undefined) {
        // Legacy structure - convert to enhanced
        const converted = convertLegacyToEnhanced(value)
        setBudgetData({
          total: converted.total || 0,
          directConstructionCosts: converted.directConstructionCosts || 0,
          preConstructionCosts: converted.preConstructionCosts || 0,
          indirectCosts: converted.indirectCosts || 0,
          contingencyReserve: converted.contingencyReserve || converted.contingency?.total || 0,
          directCosts: converted.directCosts || {
            materials: { total: 0, structural: 0, finishing: 0, mep: 0, specialty: 0 },
            labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
            equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
            subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 },
          },
          preConstruction: converted.preConstruction || {
            total: converted.preConstructionCosts || 0,
            landAcquisition: 0,
            legalRegulatory: 0,
            permitsApprovals: 0,
            sitePreparation: 0,
          },
          indirect: converted.indirect || {
            total: converted.indirectCosts || 0,
            siteOverhead: 0,
            transportation: 0,
            utilities: 0,
            safetyCompliance: 0,
          },
          contingency: converted.contingency || {
            total: converted.contingencyReserve || 0,
            designContingency: 0,
            constructionContingency: 0,
            ownersReserve: 0,
          },
        })
        // Notify parent of conversion
        if (onChange) {
          onChange(converted)
        }
      }
    }
  }, [value, onChange])

  const handleEnhancedChange = (path, val) => {
    const newData = { ...budgetData }
    const keys = path.split(".")
    let current = newData

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}
      }
      current = current[keys[i]]
    }

    current[keys[keys.length - 1]] = Number.parseFloat(val) || 0

    // Auto-calculate totals
    if (path.includes("directCosts.materials")) {
      const materials = newData.directCosts.materials
      if (!path.includes(".total")) {
        materials.total =
          (materials.structural || 0) + (materials.finishing || 0) + (materials.mep || 0) + (materials.specialty || 0)
      }
    }

    if (path.includes("directCosts.labour")) {
      const labour = newData.directCosts.labour
      if (!path.includes(".total")) {
        labour.total =
          (labour.skilled || 0) + (labour.unskilled || 0) + (labour.supervisory || 0) + (labour.specialized || 0)
      }
    }

    if (path.includes("directCosts.equipment")) {
      const equipment = newData.directCosts.equipment
      if (!path.includes(".total")) {
        equipment.total = (equipment.rental || 0) + (equipment.purchase || 0) + (equipment.maintenance || 0)
      }
    }

    if (path.includes("directCosts.subcontractors")) {
      const subcontractors = newData.directCosts.subcontractors
      if (!path.includes(".total")) {
        subcontractors.total = (subcontractors.specializedTrades || 0) + (subcontractors.professionalServices || 0)
      }
    }

    // Auto-calculate Pre-Construction total from breakdown (if advanced options used)
    if (path.includes("preConstruction.") && !path.includes("preConstruction.total")) {
      const preConstruction = newData.preConstruction || {}
      const preConstructionTotal =
        (preConstruction.landAcquisition || 0) +
        (preConstruction.legalRegulatory || 0) +
        (preConstruction.permitsApprovals || 0) +
        (preConstruction.sitePreparation || 0)
      newData.preConstructionCosts = preConstructionTotal
      newData.preConstruction = {
        ...preConstruction,
        total: preConstructionTotal,
      }
    }

    // Auto-calculate Indirect Costs total from breakdown (if advanced options used)
    if (path.includes("indirect.") && !path.includes("indirect.total")) {
      const indirect = newData.indirect || {}
      const indirectTotal =
        (indirect.siteOverhead || 0) +
        (indirect.transportation || 0) +
        (indirect.utilities || 0) +
        (indirect.safetyCompliance || 0)
      newData.indirectCosts = indirectTotal
      newData.indirect = {
        ...indirect,
        total: indirectTotal,
      }
    }

    // Auto-calculate Contingency total from breakdown (if advanced options used)
    if (path.includes("contingency.") && !path.includes("contingency.total")) {
      const contingency = newData.contingency || {}
      const contingencyTotal =
        (contingency.designContingency || 0) +
        (contingency.constructionContingency || 0) +
        (contingency.ownersReserve || 0)
      newData.contingencyReserve = contingencyTotal
      newData.contingency = {
        ...contingency,
        total: contingencyTotal,
      }
    }

    // Calculate DCC
    newData.directConstructionCosts =
      (newData.directCosts?.materials?.total || 0) +
      (newData.directCosts?.labour?.total || 0) +
      (newData.directCosts?.equipment?.total || 0) +
      (newData.directCosts?.subcontractors?.total || 0)

    // Calculate total - CRITICAL: Ensure all components sum correctly
    newData.total =
      (newData.directConstructionCosts || 0) +
      (newData.preConstructionCosts || 0) +
      (newData.indirectCosts || 0) +
      (newData.contingencyReserve || 0)

    setBudgetData(newData)
    if (onChange) {
      onChange(newData)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0)
  }

  // Always render enhanced structure
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
            <h3 className="text-lg font-bold text-gray-900">Budget Structure</h3>
            <p className="text-xs text-gray-600 mt-1">Comprehensive budget breakdown with detailed categories</p>
          </div>
        </div>
      </div>

      {/* Top Level Summary */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border-2 border-gray-200 shadow-sm">
        <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Budget Summary
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Total Project Budget
            </label>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(budgetData.total || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-200 shadow-sm">
            <label className="block text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
              Direct Construction
            </label>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(budgetData.directConstructionCosts || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
            <label className="block text-xs font-semibold text-purple-700 mb-2 uppercase tracking-wide">
              Pre-Construction
            </label>
            <p className="text-xl font-bold text-purple-600">{formatCurrency(budgetData.preConstructionCosts || 0)}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-orange-200 shadow-sm">
            <label className="block text-xs font-semibold text-orange-700 mb-2 uppercase tracking-wide">
              Contingency Reserve
            </label>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(budgetData.contingencyReserve || 0)}</p>
          </div>
        </div>
      </div>

      {/* Direct Construction Costs */}
      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
        <h4 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          Direct Construction Costs
        </h4>

        {/* Materials */}
        <div className="mb-6 bg-blue-50 rounded-lg p-5 border-l-4 border-blue-500">
          <label className="block text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Total</label>
              <input
                type="number"
                value={budgetData.directCosts?.materials?.total || 0}
                onChange={(e) => handleEnhancedChange("directCosts.materials.total", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Structural
              </label>
              <input
                type="number"
                value={budgetData.directCosts?.materials?.structural || 0}
                onChange={(e) => handleEnhancedChange("directCosts.materials.structural", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Finishing
              </label>
              <input
                type="number"
                value={budgetData.directCosts?.materials?.finishing || 0}
                onChange={(e) => handleEnhancedChange("directCosts.materials.finishing", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide flex items-center gap-1">
                MEP
                <span className="relative group cursor-help" title="Mechanical, Electrical, Plumbing">
                  <svg
                    className="w-4 h-4 text-gray-500 hover:text-blue-600 transition-colors"
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
                  {/* Subtle tooltip on hover */}
                  <span className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
                    Mechanical, Electrical, Plumbing
                  </span>
                </span>
              </label>
              <input
                type="number"
                value={budgetData.directCosts?.materials?.mep || 0}
                onChange={(e) => handleEnhancedChange("directCosts.materials.mep", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Specialty
              </label>
              <input
                type="number"
                value={budgetData.directCosts?.materials?.specialty || 0}
                onChange={(e) => handleEnhancedChange("directCosts.materials.specialty", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Labour */}
        <div className="mb-6 bg-green-50 rounded-lg p-5 border-l-4 border-green-500">
          <label className="block text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Labour & Workforce
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Total</label>
              <input
                type="number"
                value={budgetData.directCosts?.labour?.total || 0}
                onChange={(e) => handleEnhancedChange("directCosts.labour.total", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Skilled</label>
              <input
                type="number"
                value={budgetData.directCosts?.labour?.skilled || 0}
                onChange={(e) => handleEnhancedChange("directCosts.labour.skilled", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Unskilled
              </label>
              <input
                type="number"
                value={budgetData.directCosts?.labour?.unskilled || 0}
                onChange={(e) => handleEnhancedChange("directCosts.labour.unskilled", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Supervisory
              </label>
              <input
                type="number"
                value={budgetData.directCosts?.labour?.supervisory || 0}
                onChange={(e) => handleEnhancedChange("directCosts.labour.supervisory", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Specialized
              </label>
              <input
                type="number"
                value={budgetData.directCosts?.labour?.specialized || 0}
                onChange={(e) => handleEnhancedChange("directCosts.labour.specialized", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Equipment */}
        <div className="mb-6 bg-yellow-50 rounded-lg p-5 border-l-4 border-yellow-500">
          <label className="block text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Equipment & Machinery
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Total</label>
              <input
                type="number"
                value={budgetData.directCosts?.equipment?.total || 0}
                onChange={(e) => handleEnhancedChange("directCosts.equipment.total", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Rental</label>
              <input
                type="number"
                value={budgetData.directCosts?.equipment?.rental || 0}
                onChange={(e) => handleEnhancedChange("directCosts.equipment.rental", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Purchase</label>
              <input
                type="number"
                value={budgetData.directCosts?.equipment?.purchase || 0}
                onChange={(e) => handleEnhancedChange("directCosts.equipment.purchase", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Maintenance
              </label>
              <input
                type="number"
                value={budgetData.directCosts?.equipment?.maintenance || 0}
                onChange={(e) => handleEnhancedChange("directCosts.equipment.maintenance", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Subcontractors */}
        <div className="mb-6 bg-indigo-50 rounded-lg p-5 border-l-4 border-indigo-500">
          <label className="block text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Subcontractor Services
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Total</label>
              <input
                type="number"
                value={budgetData.directCosts?.subcontractors?.total || 0}
                onChange={(e) => handleEnhancedChange("directCosts.subcontractors.total", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Specialized Trades
              </label>
              <input
                type="number"
                value={budgetData.directCosts?.subcontractors?.specializedTrades || 0}
                onChange={(e) => handleEnhancedChange("directCosts.subcontractors.specializedTrades", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Professional Services
              </label>
              <input
                type="number"
                value={budgetData.directCosts?.subcontractors?.professionalServices || 0}
                onChange={(e) =>
                  handleEnhancedChange("directCosts.subcontractors.professionalServices", e.target.value)
                }
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pre-Construction Costs */}
      {showAdvanced && (
        <div className="bg-white border-2 border-purple-200 rounded-xl p-6 shadow-sm">
          <h4 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Pre-Construction Costs
          </h4>
          <div className="bg-purple-50 rounded-lg p-5 border-l-4 border-purple-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Total</label>
                <input
                  type="number"
                  value={budgetData.preConstructionCosts || 0}
                  onChange={(e) => handleEnhancedChange("preConstructionCosts", e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base font-medium transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Land Acquisition
                </label>
                <input
                  type="number"
                  value={budgetData.preConstruction?.landAcquisition || 0}
                  onChange={(e) => handleEnhancedChange("preConstruction.landAcquisition", e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base font-medium transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Legal & Regulatory
                </label>
                <input
                  type="number"
                  value={budgetData.preConstruction?.legalRegulatory || 0}
                  onChange={(e) => handleEnhancedChange("preConstruction.legalRegulatory", e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base font-medium transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Permits & Approvals
                </label>
                <input
                  type="number"
                  value={budgetData.preConstruction?.permitsApprovals || 0}
                  onChange={(e) => handleEnhancedChange("preConstruction.permitsApprovals", e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base font-medium transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Site Preparation
                </label>
                <input
                  type="number"
                  value={budgetData.preConstruction?.sitePreparation || 0}
                  onChange={(e) => handleEnhancedChange("preConstruction.sitePreparation", e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base font-medium transition-all"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Indirect Costs */}
      {showAdvanced && (
        <div className="bg-white border-2 border-teal-200 rounded-xl p-6 shadow-sm">
          <h4 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Indirect Costs (Overhead)
          </h4>
          <div className="bg-teal-50 rounded-lg p-5 border-l-4 border-teal-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Total</label>
                <input
                  type="number"
                  value={budgetData.indirectCosts || 0}
                  onChange={(e) => handleEnhancedChange("indirectCosts", e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base font-medium transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Site Overhead
                </label>
                <input
                  type="number"
                  value={budgetData.indirect?.siteOverhead || 0}
                  onChange={(e) => handleEnhancedChange("indirect.siteOverhead", e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base font-medium transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Transportation
                </label>
                <input
                  type="number"
                  value={budgetData.indirect?.transportation || 0}
                  onChange={(e) => handleEnhancedChange("indirect.transportation", e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base font-medium transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Utilities
                </label>
                <input
                  type="number"
                  value={budgetData.indirect?.utilities || 0}
                  onChange={(e) => handleEnhancedChange("indirect.utilities", e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base font-medium transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Safety & Compliance
                </label>
                <input
                  type="number"
                  value={budgetData.indirect?.safetyCompliance || 0}
                  onChange={(e) => handleEnhancedChange("indirect.safetyCompliance", e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={disabled}
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base font-medium transition-all"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contingency Breakdown */}
      <div className="bg-white border-2 border-orange-200 rounded-xl p-6 shadow-sm">
        <h4 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          Contingency & Risk Reserve
        </h4>
        <div className="bg-orange-50 rounded-lg p-5 border-l-4 border-orange-500">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Total Reserve
              </label>
              <input
                type="number"
                value={budgetData.contingencyReserve || budgetData.contingency?.total || 0}
                onChange={(e) => handleEnhancedChange("contingencyReserve", e.target.value)}
                min="0"
                step="0.01"
                disabled={disabled}
                className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base font-medium transition-all"
                placeholder="0.00"
              />
            </div>
            {showAdvanced && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Design Contingency
                  </label>
                  <input
                    type="number"
                    value={budgetData.contingency?.designContingency || 0}
                    onChange={(e) => handleEnhancedChange("contingency.designContingency", e.target.value)}
                    min="0"
                    step="0.01"
                    disabled={disabled}
                    className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base font-medium transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Construction Contingency
                  </label>
                  <input
                    type="number"
                    value={budgetData.contingency?.constructionContingency || 0}
                    onChange={(e) => handleEnhancedChange("contingency.constructionContingency", e.target.value)}
                    min="0"
                    step="0.01"
                    disabled={disabled}
                    className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base font-medium transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Owner's Reserve
                  </label>
                  <input
                    type="number"
                    value={budgetData.contingency?.ownersReserve || 0}
                    onChange={(e) => handleEnhancedChange("contingency.ownersReserve", e.target.value)}
                    min="0"
                    step="0.01"
                    disabled={disabled}
                    className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base font-medium transition-all"
                    placeholder="0.00"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Show Advanced Toggle */}
      {!showAdvanced && (
        <button
          type="button"
          onClick={() => {
            setShowAdvanced(true)
          }}
          className="w-full py-4 px-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all flex items-center justify-center gap-3 font-semibold text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          disabled={disabled}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span>Show Advanced Options</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <div className="ml-2 text-xs font-normal text-blue-600">
            (Pre-Construction, Indirect Costs, Contingency Breakdown)
          </div>
        </button>
      )}

      {/* Hide Advanced Toggle */}
      {showAdvanced && (
        <button
          type="button"
          onClick={() => {
            setShowAdvanced(false)
          }}
          className="w-full py-4 px-6 bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl hover:from-gray-100 hover:to-gray-200 hover:border-gray-400 transition-all flex items-center justify-center gap-3 font-semibold text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          disabled={disabled}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <span>Hide Advanced Options</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
