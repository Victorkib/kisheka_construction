'use client';

/**
 * EvidenceFeed
 * Displays a feed of progress_entries for a project (optionally filtered by floor/phase/type/date).
 *
 * Props:
 *   - projectId (required)
 *   - floorId? (optional)
 *   - phaseId? (optional)
 *   - typeFilter? ('photo' | 'note' | null)
 */

import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import { ImagePreview } from '@/components/uploads/image-preview';

export function EvidenceFeed({ projectId, floorId = null, phaseId = null, typeFilter = null }) {
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (floorId) params.set('floorId', floorId);
      if (phaseId) params.set('phaseId', phaseId);
      if (typeFilter) params.set('type', typeFilter);

      const url = `/api/projects/${projectId}/progress-entries${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load evidence');
      }

      setEntries(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      const message = err.message || 'Failed to load evidence';
      setError(message);
      toast.showError(message);
      console.error('EvidenceFeed fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, floorId, phaseId, typeFilter]);

  const handleDelete = async (entryId) => {
    if (!entryId) return;

    setDeletingId(entryId);
    try {
      const response = await fetch(`/api/progress-entries/${entryId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete evidence entry');
      }

      setEntries((prev) => prev.filter((e) => e._id !== entryId));
      toast.showSuccess('Evidence entry deleted');
    } catch (err) {
      const message = err.message || 'Failed to delete evidence entry';
      toast.showError(message);
      console.error('EvidenceFeed delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6">
        <p className="text-sm ds-text-secondary">Loading evidence...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6">
        <p className="text-sm ds-text-danger mb-3">Failed to load evidence: {error}</p>
        <button
          type="button"
          onClick={fetchEntries}
          className="px-3 py-1.5 text-xs ds-bg-accent-primary text-white rounded hover:ds-bg-accent-hover"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="ds-bg-surface rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold ds-text-primary">
          Evidence Feed {typeFilter ? `(${typeFilter === 'photo' ? 'Photos' : 'Notes'})` : ''}
        </h3>
        <button
          type="button"
          onClick={fetchEntries}
          className="text-xs px-3 py-1 border ds-border-subtle rounded-lg ds-text-secondary hover:ds-bg-surface-muted transition-colors"
        >
          Refresh
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm ds-text-muted text-center py-6">
          No evidence captured yet for this context.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const id = entry._id?.toString?.() || entry._id;
            const isPhoto = entry.type === 'photo' && entry.media?.url;

            return (
              <div
                key={id}
                className="border ds-border-subtle rounded-lg p-4 ds-bg-surface hover:shadow-sm transition-shadow"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 text-xs ds-text-muted">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border ds-border-subtle ds-bg-surface-muted ds-text-secondary">
                        {isPhoto ? 'Photo' : 'Note'}
                      </span>
                      <span>{formatDateTime(entry.createdAt)}</span>
                    </div>

                    {entry.text && (
                      <p className="text-sm ds-text-secondary whitespace-pre-line">
                        {entry.text}
                      </p>
                    )}

                    {isPhoto && (
                      <div className="mt-2 max-w-md">
                        <ImagePreview
                          url={entry.media.url}
                          title={entry.text || 'Evidence photo'}
                          showDelete={false}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {deletingId === id ? (
                      <span className="text-xs ds-text-muted">Deleting...</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDelete(id)}
                        className="text-xs px-3 py-1 ds-bg-danger text-white rounded hover:ds-bg-danger/90 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

