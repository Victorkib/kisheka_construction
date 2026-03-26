/**
 * Floor Progress Section Component
 * Premium UI for managing and displaying floor completion percentage, milestone notes, and progress photos
 * Features:
 * - Beautiful image gallery with lightbox
 * - Modern, responsive design
 * - Smooth animations
 * - Enhanced UX with better feedback
 * - Real-time progress updates
 */

'use client';

import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { useToast } from '@/components/toast';
import { LoadingSpinner } from '@/components/loading';

export const FloorProgressSection = forwardRef(function FloorProgressSection({ floorId, canEdit, projectId, onProgressChange }, ref) {
  const toast = useToast();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [milestoneNotes, setMilestoneNotes] = useState('');
  const [originalCompletionPercentage, setOriginalCompletionPercentage] = useState(0);
  const [originalMilestoneNotes, setOriginalMilestoneNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef({ completionPercentage: null, milestoneNotes: null });
  
  useEffect(() => {
    if (floorId) {
      fetchProgress();
    }
  }, [floorId]);

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/floors/${floorId}/progress`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProgress(data.data);
        const completion = data.data.completionPercentage || 0;
        const notes = data.data.milestoneNotes || '';
        setCompletionPercentage(completion);
        setMilestoneNotes(notes);
        setOriginalCompletionPercentage(completion);
        setOriginalMilestoneNotes(notes);
      } else {
        const errorMessage = data.error || 'Failed to load progress';
        toast.showError(errorMessage);
        console.error('Fetch progress error:', errorMessage);
      }
    } catch (err) {
      const errorMessage = err.message || 'An unexpected error occurred while loading progress. Please refresh the page.';
      toast.showError(errorMessage);
      console.error('Fetch floor progress error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Expose method to reset original values (called by parent after save)
  useImperativeHandle(ref, () => ({
    resetOriginals: () => {
      setOriginalCompletionPercentage(completionPercentage);
      setOriginalMilestoneNotes(milestoneNotes);
    }
  }));

  // Track changes and notify parent
  useEffect(() => {
    // Progress saves are handled locally; keep callback only for legacy usage.
    if (onProgressChange) onProgressChange(null);
  }, [completionPercentage, milestoneNotes, originalCompletionPercentage, originalMilestoneNotes, onProgressChange, loading]);

  const saveProgress = async (partial) => {
    if (!canEdit) return;
    if (!floorId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/floors/${floorId}/progress`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        body: JSON.stringify(partial),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update progress');
      }

      // Update originals + last saved markers
      if (partial.completionPercentage !== undefined) {
        setOriginalCompletionPercentage(partial.completionPercentage);
        lastSavedRef.current.completionPercentage = partial.completionPercentage;
      }
      if (partial.milestoneNotes !== undefined) {
        setOriginalMilestoneNotes(partial.milestoneNotes);
        lastSavedRef.current.milestoneNotes = partial.milestoneNotes;
      }

      toast.showSuccess('Progress saved');
    } catch (err) {
      toast.showError(err.message || 'Failed to save progress');
      console.error('Save floor progress error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="ds-bg-surface rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
          <span className="ml-3 ds-text-secondary text-lg">Loading progress...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="ds-bg-surface rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="ds-bg-accent-primary px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Floor Progress</h2>
              <p className="text-white/80 text-sm mt-1">Track completion and milestones</p>
            </div>
            {canEdit && (
              <button
                onClick={fetchProgress}
                className="text-white hover:text-white/90 font-medium text-sm ds-bg-surface/20 hover:ds-bg-surface/30 rounded-lg px-4 py-2 transition-all duration-200"
                title="Refresh progress data"
              >
                <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Completion Percentage */}
          <div className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-lg font-bold ds-text-primary">
                Completion Percentage
              </label>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold ds-text-accent-primary">
                  {completionPercentage}%
                </div>
                {completionPercentage >= 100 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ds-bg-success/10 ds-text-success">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Complete
                  </span>
                )}
              </div>
            </div>
            {canEdit ? (
              <div className="space-y-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={completionPercentage}
                  onChange={(e) => setCompletionPercentage(parseInt(e.target.value))}
                  onMouseUp={() => {
                    if (lastSavedRef.current.completionPercentage !== completionPercentage) {
                      saveProgress({ completionPercentage });
                    }
                  }}
                  onTouchEnd={() => {
                    if (lastSavedRef.current.completionPercentage !== completionPercentage) {
                      saveProgress({ completionPercentage });
                    }
                  }}
                  className="w-full h-3 ds-bg-surface-muted rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${completionPercentage}%, rgb(229, 231, 235) ${completionPercentage}%, rgb(229, 231, 235) 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs ds-text-muted font-medium">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            ) : (
              <div className="w-full ds-bg-surface-muted rounded-full h-6 overflow-hidden shadow-inner">
                <div
                  className={`h-6 rounded-full transition-all duration-500 ease-out ${
                    completionPercentage >= 100
                      ? 'ds-bg-success'
                      : completionPercentage >= 75
                      ? 'ds-bg-accent-primary'
                      : completionPercentage >= 50
                      ? 'ds-bg-warning'
                      : 'ds-bg-surface-muted'
                  }`}
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            )}
          </div>

          {/* Milestone Notes */}
          <div className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
            <label className="block text-lg font-bold ds-text-primary mb-3">
              Milestone Notes
            </label>
            {canEdit ? (
              <>
                <textarea
                  value={milestoneNotes}
                  onChange={(e) => setMilestoneNotes(e.target.value)}
                  onBlur={() => {
                    const trimmed = milestoneNotes;
                    if (trimmed !== originalMilestoneNotes) {
                      saveProgress({ milestoneNotes: trimmed });
                    }
                  }}
                  placeholder="Enter milestone notes, achievements, or important updates..."
                  rows={5}
                  className="w-full px-4 py-3 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary placeholder:ds-text-muted resize-none transition-all duration-200"
                />
                <p className="mt-2 text-xs ds-text-muted">
                  Make your changes and click "Save Changes" to update the progress.
                </p>
              </>
            ) : (
              milestoneNotes ? (
                <div className="px-4 py-4 ds-bg-surface border-2 ds-border-subtle rounded-lg">
                  <p className="ds-text-primary whitespace-pre-line leading-relaxed">{milestoneNotes}</p>
                </div>
              ) : (
                <div className="px-4 py-4 ds-bg-surface-muted border-2 border-dashed ds-border-subtle rounded-lg text-center">
                  <p className="text-sm ds-text-muted italic">No milestone notes yet</p>
                </div>
              )
            )}
          </div>

          {/* Change Indicator */}
          {canEdit && (completionPercentage !== originalCompletionPercentage || milestoneNotes !== originalMilestoneNotes) && (
            <div className="ds-bg-accent-subtle border-2 ds-border-accent-subtle rounded-xl p-4 flex items-center gap-3 animate-pulse">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium ds-text-primary">
                  You have unsaved changes
                </p>
                <p className="text-xs ds-text-secondary mt-1">
                  Changes are saved per-field (slider saves on release; notes save on blur).
                </p>
              </div>
            </div>
          )}

          {canEdit && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => saveProgress({ completionPercentage, milestoneNotes })}
                disabled={saving || (completionPercentage === originalCompletionPercentage && milestoneNotes === originalMilestoneNotes)}
                className="px-4 py-2 text-sm font-medium rounded-lg ds-bg-accent-primary text-white hover:ds-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {saving ? 'Saving...' : 'Save Progress'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
});

export default FloorProgressSection;
