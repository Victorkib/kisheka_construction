/**
 * Phase Resources Tab Component
 * Displays workers, equipment, subcontractors, and professional services
 */

'use client';

import Link from 'next/link';
import { EquipmentSection } from './EquipmentSection';
import { SubcontractorSection } from './SubcontractorSection';

export function ResourcesTab({ phase, formatCurrency }) {
  return (
    <div className="space-y-6">
      {/* Professional Services Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Professional Services</h3>
          <Link
            href={`/professional-services?projectId=${phase.projectId}&phaseId=${phase._id}`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View All →
          </Link>
        </div>
        {phase.professionalServices && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Fees</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(phase.professionalServices.totalFees || 0)}
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Architect Fees</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {formatCurrency(phase.professionalServices.architectFees || 0)}
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Engineer Fees</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {formatCurrency(phase.professionalServices.engineerFees || 0)}
              </p>
            </div>
          </div>
        )}
        <p className="text-sm text-gray-600 mt-4">
          Professional services (Architects & Engineers) assigned to this phase.
        </p>
        <Link
          href={`/professional-services?projectId=${phase.projectId}&phaseId=${phase._id}`}
          className="mt-3 inline-block text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View all professional services →
        </Link>
      </div>

      {/* Workers Section - Placeholder */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Workers</h3>
          <button
            disabled
            className="px-4 py-2 bg-gray-300 text-gray-500 text-sm font-medium rounded-lg cursor-not-allowed"
            title="Labor system coming soon"
          >
            + Add Worker
          </button>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Coming Soon:</strong> The labor management system will allow you to assign workers to phases, track labor costs, and monitor worker utilization.
          </p>
        </div>
      </div>

      {/* Equipment Section */}
      <EquipmentSection phase={phase} formatCurrency={formatCurrency} />

      {/* Subcontractors Section */}
      <SubcontractorSection phase={phase} formatCurrency={formatCurrency} />
    </div>
  );
}

export default ResourcesTab;

