/**
 * Progress Photo Upload Component
 * Reusable component for uploading progress photos with description
 * 
 * @component
 */

'use client';

import { useState } from 'react';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { useToast } from '@/components/toast';

export function ProgressPhotoUpload({ 
  projectId, 
  floorId = null, 
  onPhotoAdded,
  folder = 'Kisheka_construction/progress'
}) {
  const toast = useToast();
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handlePhotoUpload = async (url) => {
    setPhotoUrl(url);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!photoUrl) {
      setError('Please upload a photo first');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const endpoint = floorId 
        ? `/api/floors/${floorId}/progress`
        : `/api/projects/${projectId}/progress`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'photo',
          photo: {
            url: photoUrl,
            description: description.trim(),
            ...(floorId ? {} : { floor: floorId }),
          },
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to add photo');
      }

      // Reset form
      setPhotoUrl(null);
      setDescription('');
      
      // Notify parent
      if (onPhotoAdded) {
        onPhotoAdded(data.data);
      }

      toast.showSuccess('Photo added successfully!');
    } catch (err) {
      setError(err.message);
      console.error('Add photo error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = () => {
    setPhotoUrl(null);
    setError(null);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Progress Photo</h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <CloudinaryUploadWidget
          uploadPreset="Construction_Accountability_System"
          folder={folder}
          label="Progress Photo"
          value={photoUrl}
          onChange={handlePhotoUpload}
          onDelete={handleDelete}
          maxSizeMB={10}
          acceptedTypes={['image/*']}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photo Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this photo shows..."
            rows={3}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!photoUrl || uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition"
        >
          {uploading ? 'Uploading...' : 'Add Photo'}
        </button>
      </div>
    </div>
  );
}

