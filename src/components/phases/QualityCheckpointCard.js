/**
 * Quality Checkpoint Card Component
 * Displays quality checkpoint information with status, inspection details, and photos
 */

'use client';

import { useState } from 'react';

export function QualityCheckpointCard({ checkpoint, canEdit, onEdit, onDelete, formatDate }) {
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [inspectionData, setInspectionData] = useState({
    status: checkpoint.status || 'pending',
    notes: checkpoint.notes || '',
    photos: checkpoint.photos || []
  });

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-slate-500/10 text-slate-200 border border-slate-400/60',
      'passed': 'bg-emerald-500/10 text-emerald-200 border border-emerald-400/60',
      'failed': 'bg-red-500/10 text-red-200 border border-red-400/60',
      'waived': 'bg-amber-500/10 text-amber-200 border border-amber-400/60'
    };
    return colors[status] || 'bg-slate-500/10 text-slate-200 border border-slate-400/60';
  };

  const handleInspection = async () => {
    try {
      const response = await fetch(`/api/phases/${checkpoint.phaseId}/quality-checkpoints/${checkpoint.checkpointId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          inspectedAt: new Date().toISOString()
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update inspection');
      }

      setShowInspectionForm(false);
      // Refresh checkpoint data
      if (onEdit) {
        onEdit();
      }
    } catch (err) {
      console.error('Inspection update error:', err);
      alert(err.message || 'Failed to update inspection');
    }
  };

  return (
    <div className={`border rounded-lg p-4 hover:ds-bg-surface-muted transition-colors ds-bg-surface ${
      checkpoint.status === 'failed' ? 'border-red-400/60 bg-red-500/5' : 
      checkpoint.status === 'passed' ? 'border-emerald-400/60 bg-emerald-500/5' : 
      'ds-border-subtle'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-lg font-semibold ds-text-primary">
              {checkpoint.name}
            </h4>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(checkpoint.status)}`}>
              {checkpoint.status?.toUpperCase() || 'PENDING'}
            </span>
            {checkpoint.required && (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-500/10 text-orange-200 border border-orange-400/60">
                REQUIRED
              </span>
            )}
            {!checkpoint.required && (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-slate-500/10 text-slate-200 border border-slate-400/60">
                OPTIONAL
              </span>
            )}
          </div>
          {checkpoint.description && (
            <p className="text-sm ds-text-secondary mb-3">{checkpoint.description}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit && onEdit(checkpoint)}
              className="px-3 py-1 text-sm text-blue-500 hover:text-blue-400"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete && onDelete(checkpoint)}
              className="px-3 py-1 text-sm text-red-500 hover:text-red-400"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Inspection Details */}
      {checkpoint.inspectedAt && (
        <div className="mb-3 p-3 bg-blue-500/10 border border-blue-400/60 rounded-lg">
          <p className="text-sm font-medium text-blue-200 mb-1">
            Inspected on {formatDate(checkpoint.inspectedAt)}
          </p>
          {checkpoint.inspectedBy && (
            <p className="text-xs text-blue-300">
              Inspector ID: {checkpoint.inspectedBy}
            </p>
          )}
          {checkpoint.notes && (
            <p className="text-xs text-blue-200 mt-2">{checkpoint.notes}</p>
          )}
        </div>
      )}

      {/* Photos */}
      {checkpoint.photos && checkpoint.photos.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium ds-text-secondary mb-2">Photos:</p>
          <div className="grid grid-cols-3 gap-2">
            {checkpoint.photos.map((photo, index) => (
              <img
                key={index}
                src={photo}
                alt={`Checkpoint photo ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border ds-border-subtle"
              />
            ))}
          </div>
        </div>
      )}

      {/* Inspection Form */}
      {!checkpoint.inspectedAt && (
        <div className="border-t pt-3 mt-3">
          {!showInspectionForm ? (
            <button
              onClick={() => setShowInspectionForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Record Inspection
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Inspection Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={inspectionData.status}
                  onChange={(e) => setInspectionData({ ...inspectionData, status: e.target.value })}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus"
                >
                  <option value="pending">Pending</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Inspection Notes
                </label>
                <textarea
                  value={inspectionData.notes}
                  onChange={(e) => setInspectionData({ ...inspectionData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus"
                  placeholder="Enter inspection notes..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleInspection}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 transition-colors"
                >
                  Save Inspection
                </button>
                <button
                  onClick={() => {
                    setShowInspectionForm(false);
                    setInspectionData({
                      status: checkpoint.status || 'pending',
                      notes: checkpoint.notes || '',
                      photos: checkpoint.photos || []
                    });
                  }}
                  className="px-4 py-2 border ds-border-subtle ds-text-secondary text-sm font-medium rounded-lg hover:ds-bg-surface-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default QualityCheckpointCard;


