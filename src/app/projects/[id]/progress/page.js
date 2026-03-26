/**
 * Project Progress Page
 * Displays and manages project progress: photos, milestones, daily updates
 * 
 * Route: /projects/[id]/progress
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { ProgressPhotoUpload } from '@/components/progress/photo-upload';
import { MilestoneTracker } from '@/components/progress/milestone-tracker';
import { EvidenceComposer } from '@/components/progress/evidence-composer';
import { EvidenceFeed } from '@/components/progress/evidence-feed';
import { LoadingButton, LoadingCard } from '@/components/loading';
import { ImagePreview } from '@/components/uploads/image-preview';
import { useToast } from '@/components/toast';

function ProjectProgressPageContent() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const projectId = params.id;

  const [project, setProject] = useState(null);
  const [progress, setProgress] = useState({
    photos: [],
    milestones: [],
    dailyUpdates: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('photos');
  const [dailyUpdateText, setDailyUpdateText] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  useEffect(() => {
    fetchProject();
    fetchProgress();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProject(data.data);
      }
    } catch (err) {
      console.error('Fetch project error:', err);
    }
  };

  const fetchProgress = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/progress`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProgress(data.data);
      } else {
        setError(data.error || 'Failed to fetch progress');
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch progress error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoAdded = (updatedProgress) => {
    setProgress(updatedProgress);
    fetchProgress(); // Refresh to get all data
  };

  const handleMilestoneUpdate = (updatedProgress) => {
    setProgress(updatedProgress);
    fetchProgress(); // Refresh to get all data
  };

  const handleAddDailyUpdate = async () => {
    if (!dailyUpdateText.trim()) {
      toast.showError('Please enter update notes');
      return;
    }

    setSubmittingUpdate(true);
    try {
      const updateResponse = await fetch(`/api/projects/${projectId}/progress`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          type: 'dailyUpdate',
          dailyUpdate: {
            notes: dailyUpdateText.trim(),
          },
        }),
      });

      const data = await updateResponse.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to add daily update');
      }

      setDailyUpdateText('');
      setProgress(data.data);
      toast.showSuccess('Daily update added successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Add daily update error:', err);
    } finally {
      setSubmittingUpdate(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-8 ds-bg-surface-muted rounded w-64 mb-2"></div>
              <div className="h-4 ds-bg-surface-muted rounded w-96"></div>
            </div>
            <LoadingCard count={3} showHeader={true} lines={4} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-400/60 text-red-700 p-4 rounded">
            <p className="font-semibold mb-2">Error Loading Progress</p>
            <p>{error}</p>
            <button
              onClick={() => {
                setError(null);
                fetchProgress();
              }}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}`}
            className="ds-text-accent-primary hover:ds-text-accent-hover text-sm font-medium mb-2 inline-block"
          >
            ← Back to Project
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">
            Progress Documentation
          </h1>
          {project && (
            <p className="ds-text-secondary mt-1">
              {project.projectName} ({project.projectCode})
            </p>
          )}
          <p className="text-sm ds-text-muted mt-3 max-w-2xl">
            <span className="font-semibold">Photos</span> are project-level images,&nbsp;
            <span className="font-semibold">Milestones</span> track key checkpoints,&nbsp;
            <span className="font-semibold">Daily Updates</span> are your text logbook, and&nbsp;
            <span className="font-semibold">Evidence</span> is the unified stream of notes and photos used across project, phases, and floors.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b ds-border-subtle">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('photos')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'photos'
                  ? 'border-ds-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Photos ({progress.photos?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('milestones')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'milestones'
                  ? 'border-ds-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Milestones ({progress.milestones?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('updates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'updates'
                  ? 'border-ds-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Daily Updates ({progress.dailyUpdates?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('evidence')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'evidence'
                  ? 'border-ds-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Evidence
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Photos Tab */}
          {activeTab === 'photos' && (
            <div className="space-y-6">
              <ProgressPhotoUpload
                projectId={projectId}
                onPhotoAdded={handlePhotoAdded}
                folder={`Kisheka_construction/progress/${projectId}`}
              />

              <div className="ds-bg-surface rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold ds-text-primary mb-4">
                  Photo Gallery ({progress.photos?.length || 0})
                </h3>
                {!progress.photos || progress.photos.length === 0 ? (
                  <p className="text-sm ds-text-muted text-center py-8">
                    No photos uploaded yet
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {progress.photos.map((photo, index) => (
                      <div key={index} className="border ds-border-subtle rounded-lg overflow-hidden">
                        <ImagePreview
                          url={photo.url}
                          title={photo.description || `Photo ${index + 1}`}
                          showDelete={false}
                        />
                        {photo.description && (
                          <div className="p-3 ds-bg-surface-muted">
                            <p className="text-sm ds-text-secondary">{photo.description}</p>
                            <p className="text-sm ds-text-secondary mt-1 leading-normal">
                              {new Date(photo.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Milestones Tab */}
          {activeTab === 'milestones' && (
            <MilestoneTracker
              projectId={projectId}
              milestones={progress.milestones || []}
              onMilestoneUpdate={handleMilestoneUpdate}
            />
          )}

          {/* Daily Updates Tab */}
          {activeTab === 'updates' && (
            <div className="space-y-6">
              <div className="ds-bg-surface rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold ds-text-primary mb-4">Add Daily Update</h3>
                <div className="space-y-4">
                  <textarea
                    value={dailyUpdateText}
                    onChange={(e) => setDailyUpdateText(e.target.value)}
                    placeholder="Enter today's progress update..."
                    rows={4}
                    className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <LoadingButton
                    onClick={handleAddDailyUpdate}
                    isLoading={submittingUpdate}
                    loadingText="Adding..."
                    disabled={!dailyUpdateText.trim()}
                    className="w-full ds-bg-accent-primary hover:bg-blue-700 disabled:bg-slate-500 text-white font-medium py-2 rounded-lg transition"
                  >
                    Add Update
                  </LoadingButton>
                </div>
              </div>

              <div className="ds-bg-surface rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold ds-text-primary mb-4">
                  Update History ({progress.dailyUpdates?.length || 0})
                </h3>
                {!progress.dailyUpdates || progress.dailyUpdates.length === 0 ? (
                  <p className="text-sm ds-text-muted text-center py-8">
                    No daily updates yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {progress.dailyUpdates
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map((update, index) => (
                        <div
                          key={index}
                          className="border-l-4 border-blue-500 pl-4 py-2 ds-bg-surface-muted rounded"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-sm font-medium ds-text-primary">
                              {new Date(update.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                          <p className="text-sm ds-text-secondary whitespace-pre-line">
                            {update.notes}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Evidence Tab */}
          {activeTab === 'evidence' && (
            <div className="space-y-6">
              <EvidenceComposer projectId={projectId} />
              <EvidenceFeed projectId={projectId} />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function ProjectProgressPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 ds-text-secondary">Loading project progress...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <ProjectProgressPageContent />
    </Suspense>
  );
}

