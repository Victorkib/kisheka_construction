'use client';

/**
 * EvidenceComposer
 * Reusable composer for adding progress evidence (photo + optional note, or note-only).
 *
 * Props:
 *   - projectId (required)
 *   - floorId? (optional)
 *   - phaseId? (optional)
 *   - onCreated?(entry) (optional)
 */

import { useState } from 'react';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { useToast } from '@/components/toast';

export function EvidenceComposer({ projectId, floorId = null, phaseId = null, onCreated }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const hasPhoto = !!photoUrl;
  const hasText = !!text.trim();

  const handlePhotoChange = (url) => {
    setPhotoUrl(url);
    setError(null);
  };

  const handlePhotoDelete = () => {
    setPhotoUrl(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!hasPhoto && !hasText) {
      setError('Add a note, a photo, or both before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const body = {
        type: hasPhoto ? 'photo' : 'note',
        text: hasText ? text.trim() : null,
        media: hasPhoto
          ? {
              url: photoUrl,
            }
          : null,
        floorId: floorId || undefined,
        phaseId: phaseId || undefined,
      };

      const response = await fetch(`/api/projects/${projectId}/progress-entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create evidence entry');
      }

      const entry = data.data;
      setText('');
      setPhotoUrl(null);

      if (onCreated) {
        onCreated(entry);
      }

      toast.showSuccess('Evidence captured successfully');
    } catch (err) {
      const message = err.message || 'Failed to create evidence entry';
      setError(message);
      toast.showError(message);
      console.error('EvidenceComposer error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ds-bg-surface rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold ds-text-primary">Capture Evidence</h3>
        <p className="text-xs ds-text-muted">
          Link notes and photos to this project{floorId ? ' • floor' : ''}{phaseId ? ' • phase' : ''}
        </p>
      </div>

      {error && (
        <div className="ds-bg-danger/10 ds-border-danger/40 ds-text-danger border px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium ds-text-secondary mb-1">
            Note (optional if photo provided)
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Describe today's progress, context for the photo, or key decisions..."
            className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary placeholder:ds-text-muted text-sm"
          />
          <p className="text-xs ds-text-muted">
            This will be visible in the project-wide evidence feed and any filtered views (phase/floor).
          </p>
        </div>

        <div className="space-y-3">
          <CloudinaryUploadWidget
            uploadPreset="Construction_Accountability_System"
            folder={
              floorId
                ? `Kisheka_construction/projects/${projectId}/floors/${floorId}/evidence`
                : `Kisheka_construction/projects/${projectId}/evidence`
            }
            label="Attach Photo (optional)"
            value={photoUrl}
            onChange={handlePhotoChange}
            onDelete={handlePhotoDelete}
            maxSizeMB={10}
            acceptedTypes={['image/*']}
          />
          <p className="text-xs ds-text-muted">
            Photos will be stored securely in Cloudinary and linked back to this project.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || (!hasPhoto && !hasText)}
          className="inline-flex items-center px-4 py-2 ds-bg-accent-primary text-white text-sm font-medium rounded-lg shadow-sm hover:ds-bg-accent-hover disabled:ds-bg-surface-muted disabled:cursor-not-allowed transition"
        >
          {submitting ? 'Saving...' : 'Save Evidence'}
        </button>
      </div>
    </div>
  );
}

