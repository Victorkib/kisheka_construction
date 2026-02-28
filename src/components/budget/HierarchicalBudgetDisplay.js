/**
 * Hierarchical Budget Display Component
 * Displays budget in expandable/collapsible hierarchical structure
 * Shows both legacy and enhanced budget structures
 */

'use client';

import { useState } from 'react';
import { isEnhancedBudget, getBudgetTotal, getMaterialsBudget, getLabourBudget, getContingencyBudget } from '@/lib/schemas/budget-schema';

export function HierarchicalBudgetDisplay({ budget, showActuals = false, actualSpending = null }) {
  const [expandedSections, setExpandedSections] = useState({
    directCosts: false,
    materials: false,
    labour: false,
    equipment: false,
    subcontractors: false,
    preConstruction: false,
    indirect: false,
    contingency: false
  });

  if (!budget) {
    return (
      <div className="ds-bg-surface-muted rounded-lg p-4 text-center ds-text-muted border ds-border-subtle">
        No budget defined
      </div>
    );
  }

  const isEnhanced = isEnhancedBudget(budget);
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getVarianceColor = (budgeted, actual) => {
    if (!actual) return 'ds-text-muted';
    const variance = actual - budgeted;
    const percentage = budgeted > 0 ? (variance / budgeted) * 100 : 0;
    if (percentage > 10) return 'text-red-500';
    if (percentage > 5) return 'text-amber-500';
    if (percentage < -5) return 'text-emerald-500';
    return 'ds-text-muted';
  };

  if (!isEnhanced) {
    // Legacy structure - simple display
    return (
      <div className="ds-bg-surface rounded-lg border ds-border-subtle p-6">
        <h3 className="text-lg font-semibold ds-text-primary mb-4">Budget Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm ds-text-secondary">Total Budget</p>
            <p className="text-xl font-bold ds-text-primary mt-1">
              {formatCurrency(getBudgetTotal(budget))}
            </p>
            {showActuals && actualSpending?.total && (
              <p className={`text-sm mt-1 ${getVarianceColor(getBudgetTotal(budget), actualSpending.total)}`}>
                Actual: {formatCurrency(actualSpending.total)}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm ds-text-secondary">Materials</p>
            <p className="text-xl font-bold text-blue-500 mt-1">
              {formatCurrency(getMaterialsBudget(budget))}
            </p>
            {showActuals && actualSpending?.materials && (
              <p className={`text-sm mt-1 ${getVarianceColor(getMaterialsBudget(budget), actualSpending.materials)}`}>
                Actual: {formatCurrency(actualSpending.materials)}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm ds-text-secondary">Labour</p>
            <p className="text-xl font-bold text-emerald-500 mt-1">
              {formatCurrency(getLabourBudget(budget))}
            </p>
            {showActuals && actualSpending?.labour && (
              <p className={`text-sm mt-1 ${getVarianceColor(getLabourBudget(budget), actualSpending.labour)}`}>
                Actual: {formatCurrency(actualSpending.labour)}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm ds-text-secondary">Contingency</p>
            <p className="text-xl font-bold text-purple-500 mt-1">
              {formatCurrency(getContingencyBudget(budget))}
            </p>
            {showActuals && actualSpending?.contingency && (
              <p className={`text-sm mt-1 ${getVarianceColor(getContingencyBudget(budget), actualSpending.contingency)}`}>
                Actual: {formatCurrency(actualSpending.contingency)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Enhanced structure - hierarchical display
  return (
    <div className="ds-bg-surface rounded-lg border ds-border-subtle p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold ds-text-primary">Enhanced Budget Structure</h3>
        <button
          onClick={() => {
            setExpandedSections({
              directCosts: !expandedSections.directCosts,
              materials: false,
              labour: false,
              equipment: false,
              subcontractors: false,
              preConstruction: false,
              indirect: false,
              contingency: false
            });
          }}
          className="text-sm text-blue-500 hover:text-blue-400"
        >
          {expandedSections.directCosts ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Top Level Summary */}
      <div className="ds-bg-surface-muted rounded-lg p-4 mb-4 border ds-border-subtle">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs ds-text-secondary mb-1">Total Project Budget</p>
            <p className="text-2xl font-bold ds-text-primary">
              {formatCurrency(budget.total || 0)}
            </p>
            {showActuals && actualSpending?.total && (
              <p className={`text-sm mt-1 ${getVarianceColor(budget.total, actualSpending.total)}`}>
                Actual: {formatCurrency(actualSpending.total)}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs ds-text-secondary mb-1">Direct Construction</p>
            <p className="text-xl font-semibold text-blue-500">
              {formatCurrency(budget.directConstructionCosts || 0)}
            </p>
          </div>
          <div>
            <p className="text-xs ds-text-secondary mb-1">Pre-Construction</p>
            <p className="text-xl font-semibold text-purple-500">
              {formatCurrency(budget.preConstructionCosts || 0)}
            </p>
          </div>
          <div>
            <p className="text-xs ds-text-secondary mb-1">Contingency Reserve</p>
            <p className="text-xl font-semibold text-orange-500">
              {formatCurrency(budget.contingencyReserve || budget.contingency?.total || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Direct Construction Costs */}
      <div className="border ds-border-subtle rounded-lg p-4 mb-4">
        <button
          onClick={() => toggleSection('directCosts')}
          className="w-full flex justify-between items-center text-left"
        >
          <h4 className="text-base font-semibold ds-text-primary">
            Direct Construction Costs
          </h4>
          <span className="text-sm ds-text-secondary">
            {formatCurrency(budget.directConstructionCosts || 0)}
            <span className="ml-2">{expandedSections.directCosts ? '−' : '+'}</span>
          </span>
        </button>

        {expandedSections.directCosts && (
          <div className="mt-4 space-y-4 pl-4 border-l-2 border-blue-400/60">
            {/* Materials */}
            <div>
              <button
                onClick={() => toggleSection('materials')}
                className="w-full flex justify-between items-center text-left"
              >
                <h5 className="text-sm font-medium ds-text-secondary">Materials & Supplies</h5>
                <span className="text-sm ds-text-secondary">
                  {formatCurrency(budget.directCosts?.materials?.total || 0)}
                  <span className="ml-2">{expandedSections.materials ? '−' : '+'}</span>
                </span>
              </button>
              {expandedSections.materials && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 pl-4">
                  <div>
                    <p className="text-xs ds-text-secondary">Structural</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.materials?.structural || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs ds-text-secondary">Finishing</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.materials?.finishing || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs ds-text-secondary">MEP</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.materials?.mep || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs ds-text-secondary">Specialty</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.materials?.specialty || 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Labour */}
            <div>
              <button
                onClick={() => toggleSection('labour')}
                className="w-full flex justify-between items-center text-left"
              >
                <h5 className="text-sm font-medium ds-text-secondary">Labour & Workforce</h5>
                <span className="text-sm ds-text-secondary">
                  {formatCurrency(budget.directCosts?.labour?.total || 0)}
                  <span className="ml-2">{expandedSections.labour ? '−' : '+'}</span>
                </span>
              </button>
              {expandedSections.labour && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 pl-4">
                  <div>
                    <p className="text-xs ds-text-secondary">Skilled</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.labour?.skilled || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs ds-text-secondary">Unskilled</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.labour?.unskilled || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs ds-text-secondary">Supervisory</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.labour?.supervisory || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs ds-text-secondary">Specialized</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.labour?.specialized || 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Equipment */}
            <div>
              <button
                onClick={() => toggleSection('equipment')}
                className="w-full flex justify-between items-center text-left"
              >
                <h5 className="text-sm font-medium ds-text-secondary">Equipment & Machinery</h5>
                <span className="text-sm ds-text-secondary">
                  {formatCurrency(budget.directCosts?.equipment?.total || 0)}
                  <span className="ml-2">{expandedSections.equipment ? '−' : '+'}</span>
                </span>
              </button>
              {expandedSections.equipment && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-3 pl-4">
                  <div>
                    <p className="text-xs ds-text-secondary">Rental</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.equipment?.rental || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs ds-text-secondary">Purchase</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.equipment?.purchase || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs ds-text-secondary">Maintenance</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.equipment?.maintenance || 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Subcontractors */}
            <div>
              <button
                onClick={() => toggleSection('subcontractors')}
                className="w-full flex justify-between items-center text-left"
              >
                <h5 className="text-sm font-medium ds-text-secondary">Subcontractor Services</h5>
                <span className="text-sm ds-text-secondary">
                  {formatCurrency(budget.directCosts?.subcontractors?.total || 0)}
                  <span className="ml-2">{expandedSections.subcontractors ? '−' : '+'}</span>
                </span>
              </button>
              {expandedSections.subcontractors && (
                <div className="mt-2 grid grid-cols-2 gap-3 pl-4">
                  <div>
                    <p className="text-xs ds-text-secondary">Specialized Trades</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.subcontractors?.specializedTrades || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs ds-text-secondary">Professional Services</p>
                    <p className="text-sm font-semibold ds-text-primary">
                      {formatCurrency(budget.directCosts?.subcontractors?.professionalServices || 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pre-Construction Costs */}
      {budget.preConstructionCosts > 0 && (
        <div className="border ds-border-subtle rounded-lg p-4 mb-4">
          <button
            onClick={() => toggleSection('preConstruction')}
            className="w-full flex justify-between items-center text-left"
          >
            <h4 className="text-base font-semibold ds-text-primary">Pre-Construction Costs</h4>
            <span className="text-sm ds-text-secondary">
              {formatCurrency(budget.preConstructionCosts || 0)}
              <span className="ml-2">{expandedSections.preConstruction ? '−' : '+'}</span>
            </span>
          </button>
          {expandedSections.preConstruction && budget.preConstruction && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 pl-4 border-l-2 border-purple-400/60">
              <div>
                <p className="text-xs ds-text-secondary">Land Acquisition</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {formatCurrency(budget.preConstruction.landAcquisition || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary">Legal & Regulatory</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {formatCurrency(budget.preConstruction.legalRegulatory || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary">Permits & Approvals</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {formatCurrency(budget.preConstruction.permitsApprovals || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary">Site Preparation</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {formatCurrency(budget.preConstruction.sitePreparation || 0)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Indirect Costs */}
      {budget.indirectCosts > 0 && (
        <div className="border ds-border-subtle rounded-lg p-4 mb-4">
          <button
            onClick={() => toggleSection('indirect')}
            className="w-full flex justify-between items-center text-left"
          >
            <h4 className="text-base font-semibold ds-text-primary">Indirect Costs (Overhead)</h4>
            <span className="text-sm ds-text-secondary">
              {formatCurrency(budget.indirectCosts || 0)}
              <span className="ml-2">{expandedSections.indirect ? '−' : '+'}</span>
            </span>
          </button>
          {expandedSections.indirect && budget.indirect && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 pl-4 border-l-2 border-amber-400/60">
              <div>
                <p className="text-xs ds-text-secondary">Site Overhead</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {formatCurrency(budget.indirect.siteOverhead || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary">Transportation</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {formatCurrency(budget.indirect.transportation || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary">Utilities</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {formatCurrency(budget.indirect.utilities || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary">Safety & Compliance</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {formatCurrency(budget.indirect.safetyCompliance || 0)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contingency Breakdown */}
      {(budget.contingencyReserve > 0 || budget.contingency?.total > 0) && (
        <div className="border ds-border-subtle rounded-lg p-4">
          <button
            onClick={() => toggleSection('contingency')}
            className="w-full flex justify-between items-center text-left"
          >
            <h4 className="text-base font-semibold ds-text-primary">Contingency & Risk Reserve</h4>
            <span className="text-sm ds-text-secondary">
              {formatCurrency(budget.contingencyReserve || budget.contingency?.total || 0)}
              <span className="ml-2">{expandedSections.contingency ? '−' : '+'}</span>
            </span>
          </button>
          {expandedSections.contingency && budget.contingency && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 pl-4 border-l-2 border-orange-400/60">
              <div>
                <p className="text-xs ds-text-secondary">Design Contingency</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {formatCurrency(budget.contingency.designContingency || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary">Construction Contingency</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {formatCurrency(budget.contingency.constructionContingency || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary">Owner's Reserve</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {formatCurrency(budget.contingency.ownersReserve || 0)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}



