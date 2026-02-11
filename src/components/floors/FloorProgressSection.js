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

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useToast } from '@/components/toast';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { ConfirmationModal } from '@/components/modals';
import { LoadingSpinner } from '@/components/loading';
import { ImageLightbox } from '@/components/common/ImageLightbox';

export const FloorProgressSection = forwardRef(function FloorProgressSection({ floorId, canEdit, projectId, onProgressChange }, ref) {
  const toast = useToast();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [milestoneNotes, setMilestoneNotes] = useState('');
  const [originalCompletionPercentage, setOriginalCompletionPercentage] = useState(0);
  const [originalMilestoneNotes, setOriginalMilestoneNotes] = useState('');
  
  // Photo upload state
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Photo deletion state
  const [deletingPhotoIndex, setDeletingPhotoIndex] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

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
    if (onProgressChange && !loading && originalCompletionPercentage !== undefined) {
      const hasChanges = 
        completionPercentage !== originalCompletionPercentage ||
        milestoneNotes !== originalMilestoneNotes;
      
      if (hasChanges) {
        onProgressChange({
          completionPercentage,
          milestoneNotes,
        });
      } else {
        // Clear changes if user reverts to original values
        onProgressChange(null);
      }
    }
  }, [completionPercentage, milestoneNotes, originalCompletionPercentage, originalMilestoneNotes, onProgressChange, loading]);

  const handlePhotoUpload = (url) => {
    setPhotoUrl(url);
  };

  const handlePhotoDelete = () => {
    setPhotoUrl(null);
    setPhotoDescription('');
  };

  const handleAddPhoto = async () => {
    if (!photoUrl) {
      toast.showError('Please upload a photo first');
      return;
    }

    setUploadingPhoto(true);
    try {
      const response = await fetch(`/api/floors/${floorId}/progress`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          photo: {
            url: photoUrl,
            description: photoDescription.trim(),
          },
        }),
      });

      const data = await response.json();
      if (!data.success) {
        const errorMessage = data.error || 'Failed to add photo';
        toast.showError(errorMessage);
        console.error('Add photo error:', errorMessage);
        return;
      }

      setPhotoUrl(null);
      setPhotoDescription('');
      setProgress(data.data);
      toast.showSuccess('Photo added successfully!');
    } catch (err) {
      const errorMessage = err.message || 'An unexpected error occurred. Please try again.';
      toast.showError(errorMessage);
      console.error('Add photo error:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhotoClick = (index, photo) => {
    setPhotoToDelete({ index, photo });
    setShowDeleteModal(true);
  };

  const handleDeletePhotoConfirm = async () => {
    if (photoToDelete === null) return;

    setDeletingPhotoIndex(photoToDelete.index);
    try {
      const response = await fetch(
        `/api/floors/${floorId}/progress?photoIndex=${photoToDelete.index}`,
        {
          method: 'DELETE',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }
      );

      const data = await response.json();
      if (!data.success) {
        const errorMessage = data.error || 'Failed to delete photo';
        toast.showError(errorMessage);
        console.error('Delete photo error:', errorMessage);
        setShowDeleteModal(false);
        setPhotoToDelete(null);
        return;
      }

      setProgress(data.data);
      toast.showSuccess('Photo deleted successfully!');
      setShowDeleteModal(false);
      setPhotoToDelete(null);
    } catch (err) {
      const errorMessage = err.message || 'An unexpected error occurred. Please try again.';
      toast.showError(errorMessage);
      console.error('Delete photo error:', err);
      setShowDeleteModal(false);
      setPhotoToDelete(null);
    } finally {
      setDeletingPhotoIndex(null);
    }
  };

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleLightboxDelete = async (index) => {
    setDeletingPhotoIndex(index);
    try {
      const response = await fetch(
        `/api/floors/${floorId}/progress?photoIndex=${index}`,
        {
          method: 'DELETE',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }
      );

      const data = await response.json();
      if (!data.success) {
        toast.showError(data.error || 'Failed to delete photo');
        return;
      }

      setProgress(data.data);
      toast.showSuccess('Photo deleted successfully!');
      
      // Close lightbox if no more photos
      if (data.data.photos.length === 0) {
        setLightboxOpen(false);
      } else if (index >= data.data.photos.length) {
        setLightboxIndex(data.data.photos.length - 1);
      }
    } catch (err) {
      toast.showError('Failed to delete photo');
    } finally {
      setDeletingPhotoIndex(null);
    }
  };

  // Filter out null/undefined entries to prevent errors
  const photos = (progress?.photos || []).filter(photo => photo !== null && photo !== undefined && photo.url);

  // Determine folder path for Cloudinary
  const cloudinaryFolder = projectId
    ? `Kisheka_construction/floors/${projectId}/${floorId}`
    : `Kisheka_construction/floors/${floorId}`;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" color="blue-600" />
          <span className="ml-3 text-gray-600 text-lg">Loading progress...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Floor Progress</h2>
              <p className="text-blue-100 text-sm mt-1">Track completion and milestones</p>
            </div>
            {canEdit && (
              <button
                onClick={fetchProgress}
                className="text-white hover:text-blue-100 font-medium text-sm bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg px-4 py-2 transition-all duration-200"
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
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-lg font-bold text-gray-800">
                Completion Percentage
              </label>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                  {completionPercentage}%
                </div>
                {completionPercentage >= 100 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
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
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  style={{
                    background: `linear-gradient(to right, #2563eb 0%, #2563eb ${completionPercentage}%, #e5e7eb ${completionPercentage}%, #e5e7eb 100%)`,
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500 font-medium">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            ) : (
              <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
                <div
                  className={`h-6 rounded-full transition-all duration-500 ease-out ${
                    completionPercentage >= 100
                      ? 'bg-gradient-to-r from-green-500 to-green-600'
                      : completionPercentage >= 75
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                      : completionPercentage >= 50
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                      : 'bg-gradient-to-r from-gray-400 to-gray-500'
                  }`}
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            )}
          </div>

          {/* Milestone Notes */}
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-100">
            <label className="block text-lg font-bold text-gray-800 mb-3">
              Milestone Notes
            </label>
            {canEdit ? (
              <>
                <textarea
                  value={milestoneNotes}
                  onChange={(e) => setMilestoneNotes(e.target.value)}
                  placeholder="Enter milestone notes, achievements, or important updates..."
                  rows={5}
                  className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 resize-none transition-all duration-200"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Make your changes and click "Save Changes" to update the progress.
                </p>
              </>
            ) : (
              milestoneNotes ? (
                <div className="px-4 py-4 bg-white border-2 border-gray-200 rounded-lg">
                  <p className="text-gray-900 whitespace-pre-line leading-relaxed">{milestoneNotes}</p>
                </div>
              ) : (
                <div className="px-4 py-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center">
                  <p className="text-sm text-gray-500 italic">No milestone notes yet</p>
                </div>
              )
            )}
          </div>

          {/* Change Indicator */}
          {canEdit && (completionPercentage !== originalCompletionPercentage || milestoneNotes !== originalMilestoneNotes) && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center gap-3 animate-pulse">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  You have unsaved changes
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Use the "Save Changes" button at the top or the floating button to save your progress updates.
                </p>
              </div>
            </div>
          )}

          {/* Photo Upload Section */}
          <div className="border-t border-gray-200 pt-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Progress Photos
                </h3>
                {photos.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {photos.length} {photos.length === 1 ? 'photo' : 'photos'} uploaded
                  </p>
                )}
              </div>
            </div>

            {/* Upload Form */}
            {canEdit && (
              <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-100">
                <div className="space-y-4">
                  <CloudinaryUploadWidget
                    uploadPreset="Construction_Accountability_System"
                    folder={cloudinaryFolder}
                    label="Upload Progress Photo"
                    value={photoUrl}
                    onChange={handlePhotoUpload}
                    onDelete={handlePhotoDelete}
                    maxSizeMB={10}
                    acceptedTypes={['image/*']}
                  />

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Photo Description (Optional)
                    </label>
                    <textarea
                      value={photoDescription}
                      onChange={(e) => setPhotoDescription(e.target.value)}
                      placeholder="Describe what this photo shows..."
                      rows={3}
                      className="w-full px-4 py-3 bg-white text-gray-900 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 resize-none transition-all duration-200"
                    />
                  </div>

                  <button
                    onClick={handleAddPhoto}
                    disabled={!photoUrl || uploadingPhoto}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    {uploadingPhoto ? (
                      <>
                        <LoadingSpinner size="sm" color="white" />
                        <span>Adding Photo...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add Photo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Photo Gallery */}
            {photos.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-dashed border-gray-300">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium text-lg">No photos uploaded yet</p>
                {canEdit && (
                  <p className="mt-2 text-sm text-gray-500">Upload a photo to get started</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {photos.map((photo, index) => (
                  <div
                    key={index}
                    className="group relative bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-blue-400 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-gray-100 overflow-hidden">
                      <img
                        src={photo.url}
                        alt={photo.description || `Progress photo ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-110"
                        onClick={() => openLightbox(index)}
                        loading="lazy"
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                        <button
                          onClick={() => openLightbox(index)}
                          className="text-white bg-black/50 rounded-full p-2.5 hover:bg-black/70 transition-all transform hover:scale-110"
                          title="View full size"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </button>
                      </div>
                      {/* Delete button */}
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhotoClick(index, photo);
                          }}
                          disabled={deletingPhotoIndex === index}
                          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-white rounded-full p-2 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transform hover:scale-110"
                          title="Delete photo"
                        >
                          {deletingPhotoIndex === index ? (
                            <LoadingSpinner size="sm" color="white" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Photo Info */}
                    {(photo.description || photo.uploadedAt) && (
                      <div className="p-4 bg-gray-50">
                        {photo.description && (
                          <p className="text-sm text-gray-700 mb-2 line-clamp-2 font-medium">
                            {photo.description}
                          </p>
                        )}
                        {photo.uploadedAt && (
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(photo.uploadedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      <ImageLightbox
        images={photos}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onDelete={canEdit ? handleLightboxDelete : null}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setPhotoToDelete(null);
        }}
        onConfirm={handleDeletePhotoConfirm}
        title="Delete Photo"
        message={
          <>
            <p className="mb-3 text-gray-700">Are you sure you want to delete this photo?</p>
            {photoToDelete?.photo?.description && (
              <p className="text-sm text-gray-600 mb-2 bg-gray-50 p-3 rounded-lg">
                <strong>Description:</strong> {photoToDelete.photo.description}
              </p>
            )}
            <p className="text-sm text-gray-600">
              This action cannot be undone. The photo will be removed from the progress gallery.
            </p>
          </>
        }
        confirmText="Delete Photo"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
});

export default FloorProgressSection;
