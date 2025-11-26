/**
 * Cloudinary Upload Widget Component
 * 
 * A reusable component for uploading files to Cloudinary with:
 * - Drag and drop support
 * - Progress indicator
 * - Image preview
 * - Delete functionality
 * - Replace functionality
 * 
 * @component
 * @param {string} uploadPreset - Type of upload preset ('receipts', 'photos', 'documents')
 * @param {string} folder - Cloudinary folder path
 * @param {string} label - Label for the upload field
 * @param {string} value - Current file URL (if editing)
 * @param {function} onChange - Callback when file is uploaded (receives fileUrl)
 * @param {function} onDelete - Callback when file is deleted
 * @param {number} maxSizeMB - Maximum file size in MB (default: 5)
 * @param {array} acceptedTypes - Accepted file types (default: ['image/*', 'application/pdf'])
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { LoadingProgress, LoadingSpinner } from '@/components/loading';
import { ConfirmationModal } from '@/components/modals';

export function CloudinaryUploadWidget({
  uploadPreset = 'Construction_Accountability_System',
  folder = 'Kisheka_construction',
  label = 'Upload File',
  value = null,
  onChange,
  onDelete,
  maxSizeMB = 5,
  acceptedTypes = ['image/*', 'application/pdf'],
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null); // 'uploading', 'processing', 'complete', null
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(value);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Validate file before upload
  const validateFile = (file) => {
    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
    }

    // Check file type
    const isValidType = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        const baseType = type.split('/')[0];
        return file.type.startsWith(baseType + '/');
      }
      return file.type === type;
    });

    if (!isValidType) {
      throw new Error(`File type not allowed. Accepted: ${acceptedTypes.join(', ')}`);
    }

    return true;
  };

  // Upload file to Cloudinary via our API
  const uploadFile = async (file) => {
    try {
      setUploading(true);
      setProgress(0);
      setError(null);

      // Validate file
      validateFile(file);

      // Create form data for our API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadPreset', uploadPreset);
      formData.append('folder', folder);

      // Upload via our API with progress tracking
      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        setUploadStatus('uploading');
        
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            const roundedProgress = Math.round(percentComplete);
            setProgress(roundedProgress);
            
            // Show processing status near completion
            if (roundedProgress >= 95) {
              setUploadStatus('processing');
            }
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (!response.success) {
                throw new Error(response.error || 'Upload failed');
              }

              const fileUrl = response.data.url;
              setProgress(100);
              setUploadStatus('complete');
              setShowSuccess(true);
              
              setPreview(fileUrl);
              
              // Call onChange callback
              if (onChange) {
                onChange(fileUrl);
              }
              
              // Keep overlay open for success animation, then close
              setTimeout(() => {
                setShowSuccess(false);
                setUploadStatus(null);
                setUploading(false);
                setProgress(0);
              }, 2000);
              
              resolve(fileUrl);
            } catch (error) {
              setUploadStatus(null);
              reject(new Error(error.message || 'Failed to parse upload response'));
            }
          } else {
            setUploadStatus(null);
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new Error(errorResponse.error || `Upload failed: ${xhr.statusText}`));
            } catch {
              reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          setUploadStatus(null);
          reject(new Error('Upload failed: Network error'));
        });

        xhr.open('POST', '/api/uploads/upload');
        xhr.send(formData);
      });
    } catch (error) {
      setError(error.message);
      setUploadStatus(null);
      setUploading(false);
      setProgress(0);
      throw error;
    }
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadFile(file);
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Upload failed');
    }
  };

  // Handle drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    try {
      await uploadFile(file);
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Upload failed');
    }
  };

  // Handle delete
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    setPreview(null);
    if (onDelete) {
      onDelete();
    }
    if (onChange) {
      onChange(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowDeleteModal(false);
  };

  // Handle replace
  const handleReplace = () => {
    fileInputRef.current?.click();
  };

  // Check if file is an image
  const isImage = (url) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.includes('image/upload');
  };

  // Check if file is a PDF
  const isPDF = (url) => {
    if (!url) return false;
    return /\.pdf$/i.test(url) || url.includes('pdf');
  };

  // Get status message
  const getStatusMessage = () => {
    switch (uploadStatus) {
      case 'uploading':
        return 'Uploading to Cloudinary...';
      case 'processing':
        return 'Processing file...';
      case 'complete':
        return 'Upload complete!';
      default:
        return 'Uploading file...';
    }
  };

  return (
    <div className="space-y-2 relative">
      {/* Upload Overlay - Shows during upload */}
      {uploading && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <div className="flex flex-col items-center space-y-4">
              {showSuccess ? (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
                    <svg
                      className="w-10 h-10 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">Upload Complete!</p>
                  <p className="text-sm text-gray-600">Your file has been successfully uploaded.</p>
                </>
              ) : (
                <>
                  <LoadingSpinner size="lg" color="blue-600" />
                  <div className="w-full">
                    <LoadingProgress
                      progress={progress}
                      label={getStatusMessage()}
                      color="blue-600"
                      showPercentage={true}
                    />
                  </div>
                  <p className="text-sm text-gray-600 text-center">
                    {progress < 95 ? 'Uploading your file...' : 'Processing and securing your file...'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Upload Area */}
      {!preview && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />

          {uploading && !showSuccess ? (
            <div className="space-y-3">
              <LoadingProgress 
                progress={progress} 
                label={getStatusMessage()}
                color="blue-600"
                showPercentage={true}
              />
              <p className="text-xs text-gray-500 text-center">
                Please wait while your file is being uploaded...
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {acceptedTypes.includes('image/*') && 'Images'}
                  {acceptedTypes.includes('application/pdf') && ' or PDFs'}
                  {` (Max ${maxSizeMB}MB)`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Area */}
      {preview && (
        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
          <div className="flex items-start gap-4">
            {/* Image Preview */}
            {isImage(preview) && (
              <div className="flex-shrink-0">
                <img
                  src={preview}
                  alt="Preview"
                  className="h-24 w-24 object-cover rounded border border-gray-300"
                />
              </div>
            )}

            {/* PDF Preview */}
            {isPDF(preview) && (
              <div className="flex-shrink-0">
                <div className="h-24 w-24 bg-red-100 rounded border border-red-300 flex items-center justify-center">
                  <svg
                    className="h-12 w-12 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {isImage(preview) ? 'Image' : isPDF(preview) ? 'PDF Document' : 'File'} uploaded
              </p>
              <p className="text-xs text-gray-500 truncate mt-1">{preview}</p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => window.open(preview, '_blank')}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={handleReplace}
                  disabled={uploading}
                  className="text-xs px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={uploading}
                  className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Hidden file input for replace */}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Remove File"
        message={
          <>
            <p className="mb-3">
              Are you sure you want to remove this file?
            </p>
            <p className="text-gray-600 text-sm">
              The file will be removed from this form. You can upload a new file if needed.
            </p>
          </>
        }
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

