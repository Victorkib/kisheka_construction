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
      <div className="border border-gray-300 rounded-lg p-3 bg-white hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          {/* Thumbnail */}
          {isImage && (
            <div className="flex-shrink-0">
              <img
                src={url}
                alt={title}
                className="h-16 w-16 object-cover rounded border border-gray-300 cursor-pointer"
                onClick={() => setShowFullscreen(true)}
              />
            </div>
          )}

          {isPDF && (
            <div className="flex-shrink-0">
              <div className="h-16 w-16 bg-red-100 rounded border border-red-300 flex items-center justify-center">
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
            <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
            <p className="text-xs text-gray-500 truncate mt-1">{url}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.open(url, '_blank')}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              title="View in new tab"
            >
              View
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition"
              title="Download file"
            >
              Download
            </button>
            {showDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition"
                title="Delete file"
              >
                {showDeleteConfirm ? 'Confirm?' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm text-yellow-800">
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
              className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      {showFullscreen && isImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={() => setShowFullscreen(false)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              type="button"
              onClick={() => setShowFullscreen(false)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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
              alt={title}
              className="max-w-full max-h-[90vh] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

