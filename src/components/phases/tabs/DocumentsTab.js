/**
 * Phase Documents Tab Component
 * Enhanced document management with drag-and-drop, bulk upload, preview, and filtering
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/toast';
import { LoadingSpinner } from '@/components/loading';

export function DocumentsTab({ phase, canEdit }) {
  const toast = useToast();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [editingDocument, setEditingDocument] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const fileInputRef = useRef(null);

  const documentCategories = [
    { value: 'drawings', label: 'Drawings', icon: '📐' },
    { value: 'specifications', label: 'Specifications', icon: '📋' },
    { value: 'permits', label: 'Permits', icon: '📜' },
    { value: 'inspections', label: 'Inspections', icon: '✅' },
    { value: 'photos', label: 'Photos', icon: '📷' },
    { value: 'other', label: 'Other', icon: '📄' }
  ];

  const maxFiles = 50;
  const maxSizeMB = 10;
  const acceptedTypes = [
    'application/pdf',
    'image/*',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  useEffect(() => {
    fetchDocuments();
  }, [phase?._id]);

  const fetchDocuments = async () => {
    if (!phase?._id) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/phases/${phase._id}/documents`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setDocuments(data.data || []);
      } else {
        toast.showError(data.message || 'Failed to load documents');
      }
    } catch (error) {
      console.error('Fetch documents error:', error);
      toast.showError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (category) => {
    const cat = documentCategories.find(c => c.value === category);
    return cat ? cat.label : 'Other';
  };

  const getCategoryIcon = (category) => {
    const cat = documentCategories.find(c => c.value === category);
    return cat ? cat.icon : '📄';
  };

  const getFileIcon = (url, fileType) => {
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.includes('image/upload') || fileType?.startsWith('image/');
    const isPDF = /\.pdf$/i.test(url) || fileType === 'application/pdf';
    const isWord = /\.(doc|docx)$/i.test(url) || fileType?.includes('word');
    const isExcel = /\.(xls|xlsx)$/i.test(url) || fileType?.includes('excel') || fileType?.includes('spreadsheet');

    if (isImage) return '🖼️';
    if (isPDF) return '📕';
    if (isWord) return '📘';
    if (isExcel) return '📗';
    return '📄';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

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
      throw new Error(`${file.name}: File type not allowed. Accepted: PDF, Images, Word, Excel`);
    }

    return true;
  };

  const uploadFile = async (file, index, category = 'other', name = null) => {
    try {
      validateFile(file);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadPreset', 'Construction_Accountability_System');
      formData.append('folder', `Kisheka_construction/phases/${phase._id}/documents`);

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
              // Add document to phase via API
              addDocumentToPhase({
                name: name || file.name,
                category,
                url: response.data.url,
                publicId: response.data.publicId,
                fileType: response.data.fileType,
                fileSize: response.data.fileSize
              }).then(resolve).catch(reject);
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

  const addDocumentToPhase = async (documentData) => {
    const response = await fetch(`/api/phases/${phase._id}/documents`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      body: JSON.stringify(documentData)
    });

    const data = await response.json();
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.message || 'Failed to add document');
    }
  };

  const handleFiles = async (files, category = 'other') => {
    const fileArray = Array.from(files);
    
    if (documents.length + fileArray.length > maxFiles) {
      toast.showError(`Maximum ${maxFiles} files allowed. You can upload ${maxFiles - documents.length} more.`);
      return;
    }

    setUploading(true);
    setUploadProgress({});

    try {
      const uploadPromises = fileArray.map((file, index) => 
        uploadFile(file, index, category, file.name).catch(error => {
          console.error(`Error uploading ${file.name}:`, error);
          return { error: error.message, fileName: file.name };
        })
      );

      const results = await Promise.all(uploadPromises);
      const successful = results.filter(r => !r.error);
      const failed = results.filter(r => r.error);

      if (successful.length > 0) {
        toast.showSuccess(`Successfully uploaded ${successful.length} file(s)`);
        await fetchDocuments(); // Refresh documents list
      }

      if (failed.length > 0) {
        toast.showError(`Failed to upload ${failed.length} file(s): ${failed.map(f => f.fileName).join(', ')}`);
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
      toast.showError('Error uploading files');
    } finally {
      setUploading(false);
      setUploadProgress({});
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setShowUploadModal(false);
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

  const handleDelete = async (documentId) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/phases/${phase._id}/documents/${documentId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Document deleted successfully');
        await fetchDocuments();
      } else {
        toast.showError(data.message || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Delete document error:', error);
      toast.showError('Failed to delete document');
    }
  };

  const handleUpdate = async (documentId, updates) => {
    try {
      const response = await fetch(`/api/phases/${phase._id}/documents/${documentId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Document updated successfully');
        await fetchDocuments();
        setEditingDocument(null);
      } else {
        toast.showError(data.message || 'Failed to update document');
      }
    } catch (error) {
      console.error('Update document error:', error);
      toast.showError('Failed to update document');
    }
  };

  const openPreview = (document) => {
    setPreviewDocument(document);
    setShowPreviewModal(true);
  };

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="ds-bg-surface rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold ds-text-primary">
              Documents ({documents.length})
            </h3>
            <p className="text-sm ds-text-muted mt-1">
              Manage phase documents, drawings, permits, and photos
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Documents
            </button>
          )}
        </div>

        {/* Search and Filters */}
        {documents.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="absolute left-3 top-2.5 h-5 w-5 ds-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {documentCategories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 border rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'ds-border-subtle ds-text-secondary hover:ds-bg-surface-muted'
                }`}
                title="Grid view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 border rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'ds-border-subtle ds-text-secondary hover:ds-bg-surface-muted'
                }`}
                title="List view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Documents Display */}
      {documents.length === 0 ? (
        <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-16 w-16 ds-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="ds-text-muted mt-4 mb-4 text-lg">No documents uploaded for this phase</p>
          {canEdit && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload First Document
            </button>
          )}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="ds-bg-surface rounded-lg shadow p-8 text-center">
          <p className="ds-text-muted">No documents match your search criteria</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
          : 'space-y-3'
        }>
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.documentId || doc._id}
              document={doc}
              canEdit={canEdit}
              onPreview={() => openPreview(doc)}
              onDelete={() => handleDelete(doc.documentId)}
              onEdit={() => setEditingDocument(doc)}
              getCategoryLabel={getCategoryLabel}
              getCategoryIcon={getCategoryIcon}
              getFileIcon={getFileIcon}
              formatFileSize={formatFileSize}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && canEdit && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleFiles}
          uploading={uploading}
          uploadProgress={uploadProgress}
          dragActive={dragActive}
          onDrag={handleDrag}
          onDrop={handleDrop}
          fileInputRef={fileInputRef}
          onFileInput={handleFileInput}
          documentCategories={documentCategories}
          maxFiles={maxFiles}
          maxSizeMB={maxSizeMB}
          currentCount={documents.length}
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewDocument && (
        <PreviewModal
          document={previewDocument}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewDocument(null);
          }}
        />
      )}

      {/* Edit Modal */}
      {editingDocument && (
        <EditModal
          document={editingDocument}
          onClose={() => setEditingDocument(null)}
          onSave={(updates) => handleUpdate(editingDocument.documentId, updates)}
          documentCategories={documentCategories}
        />
      )}
    </div>
  );
}

// Document Card Component
function DocumentCard({ document, canEdit, onPreview, onDelete, onEdit, getCategoryLabel, getCategoryIcon, getFileIcon, formatFileSize, viewMode }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(document.url) || document.url?.includes('image/upload') || document.fileType?.startsWith('image/');
  
  if (viewMode === 'list') {
    return (
      <div className="ds-bg-surface border ds-border-subtle rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-4">
          {isImage ? (
            <img
              src={document.url}
              alt={document.name}
              className="h-16 w-16 object-cover rounded border ds-border-subtle cursor-pointer"
              onClick={onPreview}
            />
          ) : (
            <div className="h-16 w-16 ds-bg-surface-muted rounded border ds-border-subtle flex items-center justify-center text-2xl">
              {getFileIcon(document.url, document.fileType)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium ds-text-primary truncate">{document.name}</h4>
            {document.description && (
              <p className="text-sm ds-text-muted truncate mt-1">{document.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ds-text-secondary ds-bg-surface-muted rounded">
                {getCategoryIcon(document.category)} {getCategoryLabel(document.category)}
              </span>
              {document.fileSize && (
                <span className="text-xs ds-text-muted">{formatFileSize(document.fileSize)}</span>
              )}
              {document.uploadedAt && (
                <span className="text-xs ds-text-muted">
                  {new Date(document.uploadedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onPreview}
              className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-400/60 rounded hover:bg-blue-50 transition-colors"
            >
              View
            </button>
            <a
              href={document.url}
              download
              className="px-3 py-1.5 text-sm ds-text-secondary hover:ds-text-primary border ds-border-subtle rounded hover:ds-bg-surface-muted transition-colors"
            >
              Download
            </a>
            {canEdit && (
              <>
                <button
                  onClick={onEdit}
                  className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-400/60 rounded hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-bg-surface border ds-border-subtle rounded-lg p-4 hover:shadow-md transition-shadow">
      {isImage ? (
        <img
          src={document.url}
          alt={document.name}
          className="w-full h-48 object-cover rounded mb-3 cursor-pointer"
          onClick={onPreview}
        />
      ) : (
        <div className="w-full h-48 ds-bg-surface-muted rounded mb-3 flex items-center justify-center text-6xl">
          {getFileIcon(document.url, document.fileType)}
        </div>
      )}
      <div className="space-y-2">
        <h4 className="font-medium ds-text-primary truncate" title={document.name}>
          {document.name}
        </h4>
        {document.description && (
          <p className="text-sm ds-text-muted line-clamp-2">{document.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ds-text-secondary ds-bg-surface-muted rounded">
            {getCategoryIcon(document.category)} {getCategoryLabel(document.category)}
          </span>
          {document.fileSize && (
            <span className="text-xs ds-text-muted">{formatFileSize(document.fileSize)}</span>
          )}
        </div>
        {document.uploadedAt && (
          <p className="text-xs ds-text-muted">
            {new Date(document.uploadedAt).toLocaleDateString()}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onPreview}
            className="flex-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-400/60 rounded hover:bg-blue-50 transition-colors"
          >
            View
          </button>
          <a
            href={document.url}
            download
            className="flex-1 px-3 py-1.5 text-sm text-center ds-text-secondary hover:ds-text-primary border ds-border-subtle rounded hover:ds-bg-surface-muted transition-colors"
          >
            Download
          </a>
          {canEdit && (
            <>
              <button
                onClick={onEdit}
                className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded hover:bg-indigo-50 transition-colors"
                title="Edit"
              >
                ✏️
              </button>
              <button
                onClick={onDelete}
                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-400/60 rounded hover:bg-red-50 transition-colors"
                title="Delete"
              >
                🗑️
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Upload Modal Component
function UploadModal({ onClose, onUpload, uploading, uploadProgress, dragActive, onDrag, onDrop, fileInputRef, onFileInput, documentCategories, maxFiles, maxSizeMB, currentCount }) {
  const [selectedCategory, setSelectedCategory] = useState('other');

  const handleUpload = () => {
    if (fileInputRef.current?.files && fileInputRef.current.files.length > 0) {
      onUpload(fileInputRef.current.files, selectedCategory);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="ds-bg-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold ds-text-primary">Upload Documents</h3>
            <button
              onClick={onClose}
              className="ds-text-muted hover:ds-text-secondary text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {documentCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              onDragEnter={onDrag}
              onDragLeave={onDrag}
              onDragOver={onDrag}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'ds-border-subtle ds-bg-surface-muted hover:border-ds-border-strong'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                onChange={onFileInput}
                className="hidden"
                disabled={uploading || currentCount >= maxFiles}
              />
              
              {uploading ? (
                <div className="space-y-4">
                  <LoadingSpinner />
                  <p className="text-sm ds-text-secondary">Uploading files...</p>
                  {Object.keys(uploadProgress).length > 0 && (
                    <div className="space-y-2">
                      {Object.entries(uploadProgress).map(([index, progress]) => (
                        <div key={index} className="w-full ds-bg-surface-muted rounded-full h-2">
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
                  <svg className="mx-auto h-12 w-12 ds-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm ds-text-secondary mb-2">
                    Drag and drop files here, or click to select
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={currentCount >= maxFiles}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-500 disabled:cursor-not-allowed transition"
                  >
                    Select Files
                  </button>
                  <p className="text-xs ds-text-muted mt-2">
                    {currentCount} / {maxFiles} files uploaded
                  </p>
                  <p className="text-xs ds-text-muted">
                    Accepted: PDF, Images, Word, Excel (Max {maxSizeMB}MB each)
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 mt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 border ds-border-subtle rounded-lg ds-text-secondary hover:ds-bg-surface-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Preview Modal Component
function PreviewModal({ document, onClose }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(document.url) || document.url?.includes('image/upload') || document.fileType?.startsWith('image/');
  const isPDF = /\.pdf$/i.test(document.url) || document.fileType === 'application/pdf';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative ds-bg-surface rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold ds-text-primary">{document.name}</h3>
          <button
            onClick={onClose}
            className="ds-text-muted hover:ds-text-secondary text-2xl"
          >
            ×
          </button>
        </div>
        <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
          {isImage ? (
            <img
              src={document.url}
              alt={document.name}
              className="max-w-full max-h-full mx-auto"
            />
          ) : isPDF ? (
            <iframe
              src={document.url}
              className="w-full h-[calc(90vh-120px)] border-0"
              title={document.name}
            />
          ) : (
            <div className="text-center py-12">
              <p className="ds-text-muted mb-4">Preview not available for this file type</p>
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                Open in New Tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Edit Modal Component
function EditModal({ document, onClose, onSave, documentCategories }) {
  const [name, setName] = useState(document.name || '');
  const [description, setDescription] = useState(document.description || '');
  const [category, setCategory] = useState(document.category || 'other');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Document name is required');
      return;
    }

    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), category });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="ds-bg-surface rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold ds-text-primary">Edit Document</h3>
            <button
              onClick={onClose}
              className="ds-text-muted hover:ds-text-secondary text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-2">
                Document Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {documentCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 mt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border ds-border-subtle rounded-lg ds-text-secondary hover:ds-bg-surface-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentsTab;
