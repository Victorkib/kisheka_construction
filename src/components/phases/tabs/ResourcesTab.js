/**
 * Phase Resources Tab Component
 * Displays workers, equipment, subcontractors, and professional services
 */

'use client';

import Link from 'next/link';
import { EquipmentSection } from './EquipmentSection';
import { SubcontractorSection } from './SubcontractorSection';
import { WorkersSection } from './WorkersSection';

export function ResourcesTab({ phase, formatCurrency }) {
  return (
    <div className="space-y-6">
      {/* Professional Services Section */}
      <div className="ds-bg-surface rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold ds-text-primary">Professional Services</h3>
          <Link
            href={`/professional-services?projectId=${phase.projectId}&phaseId=${phase._id}`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View All →
          </Link>
        </div>
        {phase.professionalServices && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border ds-border-subtle rounded-lg p-4">
              <p className="text-sm ds-text-secondary">Total Fees</p>
              <p className="text-xl font-bold ds-text-primary mt-1">
                {formatCurrency(phase.professionalServices.totalFees || 0)}
              </p>
            </div>
            <div className="border ds-border-subtle rounded-lg p-4">
              <p className="text-sm ds-text-secondary">Architect Fees</p>
              <p className="text-lg font-semibold ds-text-primary mt-1">
                {formatCurrency(phase.professionalServices.architectFees || 0)}
              </p>
            </div>
            <div className="border ds-border-subtle rounded-lg p-4">
              <p className="text-sm ds-text-secondary">Engineer Fees</p>
              <p className="text-lg font-semibold ds-text-primary mt-1">
                {formatCurrency(phase.professionalServices.engineerFees || 0)}
              </p>
            </div>
          </div>
        )}
        <p className="text-sm ds-text-secondary mt-4">
          Professional services (Architects & Engineers) assigned to this phase.
        </p>
        <Link
          href={`/professional-services?projectId=${phase.projectId}&phaseId=${phase._id}`}
          className="mt-3 inline-block text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View all professional services →
        </Link>
      </div>

      {/* Workers Section */}
      <WorkersSection phase={phase} formatCurrency={formatCurrency} />

      {/* Equipment Section */}
      <EquipmentSection phase={phase} formatCurrency={formatCurrency} />

      {/* Subcontractors Section */}
      <SubcontractorSection phase={phase} formatCurrency={formatCurrency} />
    </div>
  );
}

export default ResourcesTab;

