/**
 * Equipment Image Gallery Component
 * Displays and manages equipment images with upload functionality
 *
 * @component
 * @param {string} equipmentId - Equipment ID
 * @param {string} projectId - Project ID for folder organization
 * @param {array} images - Array of image URLs
 * @param {function} onImagesChange - Callback when images are updated
 */

'use client';

import { useState } from 'react';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { ConfirmationModal } from '@/components/modals';

export function EquipmentImageGallery({
  equipmentId,
  projectId,
  images = [],
  onImagesChange,
}) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  const handleImageUpload = (imageUrl) => {
    const updatedImages = [...images, imageUrl];
    onImagesChange?.(updatedImages);
  };

  const handleDeleteClick = (imageUrl, index) => {
    setImageToDelete({ url: imageUrl, index });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (imageToDelete) {
      const updatedImages = images.filter((_, idx) => idx !== imageToDelete.index);
      onImagesChange?.(updatedImages);
      setImageToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const isImage = (url) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.includes('image/upload');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold ds-text-primary">Equipment Images</h3>
        <button
          type="button"
          onClick={() => setIsInfoExpanded(!isInfoExpanded)}
          className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium"
        >
          {isInfoExpanded ? 'Hide Info' : 'Info'}
        </button>
      </div>

      {/* Info Card */}
      {isInfoExpanded && (
        <div className="ds-bg-accent-subtle rounded-lg border ds-border-accent-subtle p-4">
          <p className="text-sm ds-text-secondary">
            Upload clear photos of the equipment for easy identification. Include photos from multiple angles,
            showing any existing damage or special features. Maximum 10 images per equipment.
          </p>
        </div>
      )}

      {/* Upload Widget */}
      {images.length < 10 && (
        <CloudinaryUploadWidget
          uploadPreset="photos"
          folder={`Kisheka_construction/equipment/${projectId || 'general'}`}
          label="Upload Equipment Photo"
          maxSizeMB={5}
          acceptedTypes={['image/*']}
          onChange={handleImageUpload}
        />
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((imageUrl, index) => (
            <div
              key={index}
              className="group relative aspect-square rounded-lg overflow-hidden border ds-border-subtle shadow-sm hover:shadow-md transition-shadow"
            >
              {isImage(imageUrl) ? (
                <>
                  <img
                    src={imageUrl}
                    alt={`Equipment image ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => window.open(imageUrl, '_blank')}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                      title="View full size"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(imageUrl, index)}
                      className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                      title="Delete image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {/* Image counter */}
              <div className="absolute top-2 left-2 px-2 py-1 bg-black bg-opacity-60 text-white text-xs rounded">
                {index + 1} / {images.length}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Images */}
      {images.length === 0 && (
        <div className="ds-bg-surface-muted border ds-border-subtle rounded-lg p-8 text-center">
          <svg className="w-12 h-12 ds-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="ds-text-secondary mb-2">No images uploaded yet</p>
          <p className="text-sm ds-text-muted">Upload photos to help identify this equipment</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setImageToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Image"
        message={
          <>
            <p className="mb-3">
              Are you sure you want to delete this image?
            </p>
            <p className="ds-text-secondary text-sm">
              This action cannot be undone. The image will be permanently removed from this equipment.
            </p>
          </>
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

export default EquipmentImageGallery;
