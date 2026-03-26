/**
 * Equipment Documents Manager Component
 * Manages equipment documents (manuals, certificates, insurance, etc.)
 *
 * @component
 * @param {string} equipmentId - Equipment ID
 * @param {string} projectId - Project ID for folder organization
 * @param {array} documents - Array of document objects
 * @param {function} onDocumentsChange - Callback when documents are updated
 */

'use client';

import { useState } from 'react';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { ConfirmationModal } from '@/components/modals';

const DOCUMENT_TYPES = [
  { value: 'manual', label: 'Manual', icon: '📖' },
  { value: 'certificate', label: 'Certificate', icon: '📜' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️' },
  { value: 'inspection', label: 'Inspection Report', icon: '📋' },
  { value: 'maintenance_log', label: 'Maintenance Log', icon: '🔧' },
  { value: 'other', label: 'Other', icon: '📄' },
];

export function EquipmentDocumentsManager({
  equipmentId,
  projectId,
  documents = [],
  onDocumentsChange,
}) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState('other');

  const handleDocumentUpload = (documentUrl) => {
    const newDocument = {
      type: selectedType,
      name: documentUrl.split('/').pop()?.split('.')[0] || 'Document',
      url: documentUrl,
      uploadedAt: new Date(),
      uploadedBy: null, // Will be set by backend
    };

    const updatedDocuments = [...documents, newDocument];
    onDocumentsChange?.(updatedDocuments);
    setSelectedType('other'); // Reset to default
  };

  const handleDeleteClick = (document, index) => {
    setDocToDelete({ document, index });
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (docToDelete) {
      const updatedDocuments = documents.filter((_, idx) => idx !== docToDelete.index);
      onDocumentsChange?.(updatedDocuments);
      setDocToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const getDocumentTypeLabel = (type) => {
    const docType = DOCUMENT_TYPES.find((dt) => dt.value === type);
    return docType ? docType.label : 'Other';
  };

  const getDocumentTypeIcon = (type) => {
    const docType = DOCUMENT_TYPES.find((dt) => dt.value === type);
    return docType ? docType.icon : '📄';
  };

  const isPDF = (url) => {
    if (!url) return false;
    return /\.pdf$/i.test(url) || url.includes('pdf');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold ds-text-primary">Equipment Documents</h3>
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
            Upload important equipment documents such as operation manuals, safety certificates,
            insurance policies, and inspection reports. These documents help ensure compliance
            and proper equipment maintenance.
          </p>
        </div>
      )}

      {/* Upload Section */}
      <div className="ds-bg-surface-muted rounded-lg border ds-border-subtle p-4 space-y-4">
        {/* Document Type Selector */}
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Document Type
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {DOCUMENT_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setSelectedType(type.value)}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  selectedType === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-ds-border-subtle ds-bg-surface hover:border-ds-border-strong'
                }`}
              >
                <div className="text-2xl mb-1">{type.icon}</div>
                <div className="text-xs font-medium ds-text-primary">{type.label}</div>
                {selectedType === type.value && (
                  <div className="text-xs text-blue-600 mt-1">✓ Selected</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Widget */}
        <CloudinaryUploadWidget
          uploadPreset="documents"
          folder={`Kisheka_construction/equipment/${projectId || 'general'}/documents`}
          label={`Upload ${getDocumentTypeLabel(selectedType)} Document`}
          maxSizeMB={10}
          acceptedTypes={['application/pdf', 'image/*']}
          onChange={handleDocumentUpload}
        />
      </div>

      {/* Documents List */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold ds-text-secondary uppercase tracking-wide">
            Uploaded Documents ({documents.length})
          </h4>

          {documents.map((doc, index) => (
            <div
              key={index}
              className="ds-bg-surface rounded-lg border ds-border-subtle p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Document Icon */}
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">{getDocumentTypeIcon(doc.type)}</span>
                  </div>

                  {/* Document Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-semibold ds-text-primary truncate">{doc.name || 'Document'}</h5>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full whitespace-nowrap">
                        {getDocumentTypeLabel(doc.type)}
                      </span>
                    </div>
                    <p className="text-xs ds-text-muted truncate">{doc.url}</p>
                    {doc.uploadedAt && (
                      <p className="text-xs ds-text-secondary mt-1">
                        Uploaded: {new Date(doc.uploadedAt).toLocaleDateString('en-KE', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => window.open(doc.url, '_blank')}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(doc, index)}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Documents */}
      {documents.length === 0 && (
        <div className="ds-bg-surface-muted border ds-border-subtle rounded-lg p-8 text-center">
          <svg className="w-12 h-12 ds-text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="ds-text-secondary mb-2">No documents uploaded yet</p>
          <p className="text-sm ds-text-muted">Upload manuals, certificates, and other important documents</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setDocToDelete(null);
          setShowDeleteModal(false);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Document"
        message={
          <>
            <p className="mb-3">
              Are you sure you want to delete this document?
            </p>
            <p className="ds-text-secondary text-sm">
              This action cannot be undone. The document will be permanently removed from this equipment.
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

export default EquipmentDocumentsManager;
