/**
 * Material Library Table Component
 * Displays material library entries in a table format
 */

'use client';

import Link from 'next/link';

export function MaterialLibraryTable({
  materials = [],
  onEdit,
  onDelete,
  onDuplicate,
  onToggleCommon,
  onToggleActive,
  canManage = false,
  duplicatingId = null,
}) {
  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (materials.length === 0) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-12 text-center border ds-border-subtle">
        <div className="text-6xl mb-4">📚</div>
        <h3 className="text-xl font-semibold ds-text-primary mb-2">No materials found</h3>
        <p className="ds-text-secondary">
          {canManage
            ? 'Get started by adding your first material to the library'
            : 'No materials have been added to the library yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="ds-bg-surface rounded-lg shadow overflow-hidden border ds-border-subtle">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y ds-border-subtle">
          <thead className="ds-bg-surface-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                Unit
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                Default Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                Usage
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                Created
              </th>
              {canManage && (
                <th className="px-6 py-3 text-right text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="ds-bg-surface divide-y ds-border-subtle">
            {materials.map((material) => (
              <tr key={material._id} className="hover:bg-ds-bg-surface-muted/60">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium ds-text-primary">{material.name}</div>
                  {material.description && (
                    <div className="text-sm ds-text-muted truncate max-w-xs">
                      {material.description}
                    </div>
                  )}
                  {material.specifications && (
                    <div className="text-xs ds-text-muted mt-1">
                      {material.specifications}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm ds-text-primary">{material.category || 'Other'}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm ds-text-primary">{material.defaultUnit}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm ds-text-primary">
                    {formatCurrency(material.defaultUnitCost)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm ds-text-primary">{material.usageCount || 0}</span>
                    {material.isCommon && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-100 border border-amber-400/60">
                        Common
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      material.isActive
                        ? 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/60'
                        : 'bg-slate-500/15 text-slate-100 border border-slate-400/60'
                    }`}
                  >
                    {material.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                  {formatDate(material.createdAt)}
                </td>
                {canManage && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(material._id)}
                        className="text-blue-400 hover:text-blue-300"
                        title="Edit material"
                      >
                        Edit
                      </button>
                      {onDuplicate && (
                        <button
                          onClick={() => onDuplicate(material._id)}
                          disabled={duplicatingId === material._id}
                          className="text-purple-400 hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Duplicate material"
                        >
                          {duplicatingId === material._id ? '...' : '📋'}
                        </button>
                      )}
                      <button
                        onClick={() => onToggleCommon(material._id, material.isCommon)}
                        className={`${
                          material.isCommon
                            ? 'text-amber-300 hover:text-amber-200'
                            : 'ds-text-muted hover:ds-text-secondary'
                        }`}
                        title={material.isCommon ? 'Remove from common' : 'Mark as common'}
                      >
                        {material.isCommon ? '⭐' : '☆'}
                      </button>
                      <button
                        onClick={() => onToggleActive(material._id, material.isActive)}
                        className={`${
                          material.isActive
                            ? 'text-emerald-300 hover:text-emerald-200'
                            : 'ds-text-muted hover:ds-text-secondary'
                        }`}
                        title={material.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {material.isActive ? '✓' : '✗'}
                      </button>
                      <button
                        onClick={() => onDelete(material._id, material.name)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete material"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

