/**
 * Image Preview Component
 * 
 * A component for displaying and managing uploaded images/documents
 * - Full-size image viewer
 * - Download functionality
 * - Delete confirmation
 * - Support for images and PDFs
 * 
 * @component
 * @param {string} url - File URL to display
 * @param {string} title - Title/label for the file
 * @param {function} onDelete - Callback when file is deleted
 * @param {boolean} showDelete - Whether to show delete button (default: true)
 */

'use client';

import { useState } from 'react';

export function ImagePreview({ url, title = 'File', onDelete, showDelete = true }) {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!url) {
    return null;
  }

  // Check if file is an image
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.includes('image/upload');
  
  // Check if file is a PDF
  const isPDF = /\.pdf$/i.test(url) || url.includes('pdf');

  // Handle delete with confirmation
  const handleDelete = () => {
    if (showDeleteConfirm) {
      if (onDelete) {
        onDelete();
      }
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  // Handle download
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = title || 'file';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-2">
      {/* Preview Card */}
      <div className="border ds-border-subtle rounded-lg p-3 ds-bg-surface hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          {/* Thumbnail */}
          {isImage && (
            <div className="flex-shrink-0">
              <img
                src={url}
                alt={title || 'Image preview'}
                className="h-16 w-16 object-cover rounded border ds-border-subtle cursor-pointer transition-transform hover:scale-105"
                onClick={() => setShowFullscreen(true)}
                loading="lazy"
                decoding="async"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowFullscreen(true);
                  }
                }}
                aria-label={`View full size image: ${title}`}
              />
            </div>
          )}

          {isPDF && (
            <div className="flex-shrink-0">
              <div className="h-16 w-16 bg-red-100 rounded border border-red-400/60 flex items-center justify-center">
                <svg
                  className="h-8 w-8 text-red-600"
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
            <p className="text-sm font-medium ds-text-primary truncate">{title}</p>
            <p className="text-xs ds-text-muted truncate mt-1">{url}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.open(url, '_blank')}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-manipulation"
              title="View in new tab"
              aria-label={`Open ${title} in new tab`}
            >
              View
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 active:bg-green-800 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 touch-manipulation"
              title="Download file"
              aria-label={`Download ${title}`}
            >
              Download
            </button>
            {showDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 active:bg-red-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 touch-manipulation"
                title="Delete file"
                aria-label={showDeleteConfirm ? `Confirm deletion of ${title}` : `Delete ${title}`}
                aria-pressed={showDeleteConfirm}
              >
                {showDeleteConfirm ? 'Confirm?' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="bg-yellow-50 border border-yellow-400/60 rounded p-2 text-sm text-yellow-800">
          <p>Are you sure? This action cannot be undone.</p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleDelete}
              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
            >
              Yes, Delete
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-1 bg-slate-600 text-white rounded text-xs hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      {showFullscreen && isImage && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowFullscreen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Full screen image viewer"
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              type="button"
              onClick={() => setShowFullscreen(false)}
              className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2.5 hover:bg-black/75 active:bg-black/90 transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black touch-manipulation"
              aria-label="Close full screen view"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <img
              src={url}
              alt={title || 'Full screen image'}
              className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      )}
    </div>
  );
}

