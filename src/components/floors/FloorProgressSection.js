/**
 * Floor Progress Section Component
 * Manages and displays floor completion percentage, milestone notes, and progress photos
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';

export function FloorProgressSection({ floorId, canEdit }) {
  const toast = useToast();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [milestoneNotes, setMilestoneNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
        setCompletionPercentage(data.data.completionPercentage || 0);
        setMilestoneNotes(data.data.milestoneNotes || '');
      }
    } catch (err) {
      console.error('Fetch floor progress error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = async () => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/floors/${floorId}/progress`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          completionPercentage,
          milestoneNotes,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update progress');
      }

      setProgress(data.data);
      toast.showSuccess('Progress updated successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Update progress error:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddPhoto = async () => {
    if (!photoUrl) {
      toast.showError('Please upload a photo first');
      return;
    }

    setUploadingPhoto(true);
    try {
      const response = await fetch(`/api/floors/${floorId}/progress`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          photoUrl,
          description: photoDescription.trim(),
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to add photo');
      }

      setPhotoUrl(null);
      setPhotoDescription('');
      setProgress(data.data);
      toast.showSuccess('Photo added successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Add photo error:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const photos = progress?.photos || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Floor Progress</h2>

      {loading ? (
        <p className="text-sm text-gray-500">Loading progress...</p>
      ) : (
        <div className="space-y-6">
          {/* Completion Percentage */}
          {canEdit ? (
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                Completion Percentage: {completionPercentage}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={completionPercentage}
                onChange={(e) => setCompletionPercentage(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-2">Completion Percentage</p>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${
                    completionPercentage >= 100
                      ? 'bg-green-500'
                      : completionPercentage >= 75
                      ? 'bg-blue-500'
                      : completionPercentage >= 50
                      ? 'bg-yellow-500'
                      : 'bg-gray-300'
                  }`}
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <p className="text-sm font-medium text-gray-900 mt-1">{completionPercentage}%</p>
            </div>
          )}

          {/* Milestone Notes */}
          {canEdit ? (
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                Milestone Notes
              </label>
              <textarea
                value={milestoneNotes}
                onChange={(e) => setMilestoneNotes(e.target.value)}
                placeholder="Enter milestone notes..."
                rows={3}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
          ) : (
            milestoneNotes && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Milestone Notes</p>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded whitespace-pre-line">
                  {milestoneNotes}
                </p>
              </div>
            )
          )}

          {canEdit && (
            <button
              onClick={handleUpdateProgress}
              disabled={updating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition"
            >
              {updating ? 'Updating...' : 'Update Progress'}
            </button>
          )}

          {/* Photo Upload */}
          <div className="border-t pt-6">
            <h3 className="text-md font-semibold text-gray-900 mb-4">Progress Photos ({photos.length})</h3>
            
            {canEdit && (
              <div className="mb-4">
                <div className="mb-3">
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Upload Photo
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={photoUrl || ''}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="Photo URL (from Cloudinary)"
                      className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                    />
                    <button
                      onClick={handleAddPhoto}
                      disabled={!photoUrl || uploadingPhoto}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition"
                    >
                      {uploadingPhoto ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
                <textarea
                  value={photoDescription}
                  onChange={(e) => setPhotoDescription(e.target.value)}
                  placeholder="Photo description (optional)"
                  rows={2}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
            )}

            {photos.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No photos uploaded yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {photos.map((photo, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <img
                      src={photo.url}
                      alt={photo.description || `Photo ${index + 1}`}
                      className="w-full h-48 object-cover"
                    />
                    {photo.description && (
                      <div className="p-3 bg-gray-50">
                        <p className="text-sm text-gray-700">{photo.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
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
    </div>
  );
}

export default FloorProgressSection;
