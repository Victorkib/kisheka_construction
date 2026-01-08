/**
 * Bulk Document Upload Component for Professional Activities
 * Allows uploading multiple documents at once with progress tracking
 */

'use client';

import { useState, useRef } from 'react';
import { LoadingSpinner } from '@/components/loading';

export function BulkDocumentUpload({
  documents = [],
  onDocumentsChange,
  projectId = '',
  activityId = '',
  maxFiles = 10,
  maxSizeMB = 10,
  acceptedTypes = ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new Error(`${file.name}: File size exceeds ${maxSizeMB}MB limit`);
    }

    const isValidType = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        const baseType = type.split('/')[0];
        return file.type.startsWith(baseType + '/');
      }
      return file.type === type;
    });

    if (!isValidType) {
      throw new Error(`${file.name}: File type not allowed`);
    }

    return true;
  };

  const uploadFile = async (file, index) => {
    try {
      validateFile(file);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadPreset', 'Construction_Accountability_System');
      formData.append('folder', `Kisheka_construction/professional-activities/documents/${projectId || 'general'}/${activityId || 'new'}`);

      const xhr = new XMLHttpRequest();

      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(prev => ({ ...prev, [index]: percentComplete }));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              resolve({
                documentType: 'other', // Default, user can change
                documentName: file.name,
                documentUrl: response.data.url,
                documentVersion: '1.0',
                uploadedAt: new Date().toISOString(),
                description: '',
              });
            } else {
              reject(new Error(response.message || 'Upload failed'));
            }
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });

        xhr.open('POST', '/api/uploads/upload');
        xhr.send(formData);
      });
    } catch (error) {
      throw error;
    }
  };

  const handleFiles = async (files) => {
    const fileArray = Array.from(files);
    
    if (documents.length + fileArray.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed. You can upload ${maxFiles - documents.length} more.`);
      return;
    }

    setUploading(true);
    setUploadProgress({});

    try {
      const uploadPromises = fileArray.map((file, index) => 
        uploadFile(file, index).catch(error => {
          console.error(`Error uploading ${file.name}:`, error);
          return { error: error.message, fileName: file.name };
        })
      );

      const results = await Promise.all(uploadPromises);
      const successful = results.filter(r => !r.error);
      const failed = results.filter(r => r.error);

      if (successful.length > 0) {
        onDocumentsChange([...documents, ...successful]);
      }

      if (failed.length > 0) {
        alert(`Failed to upload ${failed.length} file(s):\n${failed.map(f => `${f.fileName}: ${f.error}`).join('\n')}`);
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
      alert('Error uploading files');
    } finally {
      setUploading(false);
      setUploadProgress({});
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const removeDocument = (index) => {
    const newDocuments = documents.filter((_, i) => i !== index);
    onDocumentsChange(newDocuments);
  };

  const updateDocument = (index, field, value) => {
    const newDocuments = [...documents];
    newDocuments[index] = { ...newDocuments[index], [field]: value };
    onDocumentsChange(newDocuments);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
          disabled={uploading || documents.length >= maxFiles}
        />
        
        {uploading ? (
          <div className="space-y-2">
            <LoadingSpinner />
            <p className="text-sm text-gray-600">Uploading files...</p>
            {Object.keys(uploadProgress).length > 0 && (
              <div className="space-y-1">
                {Object.entries(uploadProgress).map(([index, progress]) => (
                  <div key={index} className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop files here, or click to select
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={documents.length >= maxFiles}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              Select Files
            </button>
            <p className="text-xs text-gray-500 mt-2">
              {documents.length} / {maxFiles} files uploaded
            </p>
            <p className="text-xs text-gray-500">
              Accepted: PDF, Images, Word Documents (Max {maxSizeMB}MB each)
            </p>
          </div>
        )}
      </div>

      {/* Documents List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Uploaded Documents</h4>
          {documents.map((doc, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <a
                    href={doc.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {doc.documentName}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => removeDocument(index)}
                  className="ml-2 text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Document Type</label>
                  <input
                    type="text"
                    value={doc.documentType || ''}
                    onChange={(e) => updateDocument(index, 'documentType', e.target.value)}
                    placeholder="e.g., inspection_report, design_drawing"
                    className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Version</label>
                  <input
                    type="text"
                    value={doc.documentVersion || ''}
                    onChange={(e) => updateDocument(index, 'documentVersion', e.target.value)}
                    placeholder="e.g., 1.0"
                    className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Description (Optional)</label>
                <textarea
                  value={doc.description || ''}
                  onChange={(e) => updateDocument(index, 'description', e.target.value)}
                  placeholder="Document description..."
                  rows={2}
                  className="w-full px-2 py-1 text-sm bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}





