/**
 * Supervisor Submission Review Page
 * Review and approve/reject supervisor submission
 * 
 * Route: /labour/supervisor-submissions/[id]
 */

'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { CheckCircle, XCircle, MessageSquare, Mail, Phone, FileText, DollarSign, Clock, AlertTriangle, Edit2 } from 'lucide-react';

function SupervisorSubmissionReviewPageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedEntries, setEditedEntries] = useState([]);
  const [budgetInfo, setBudgetInfo] = useState(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (params.id) {
      fetchSubmission();
    }
  }, [params.id]);

  // Track previous values to prevent unnecessary validations
  const prevSubmissionRef = useRef(null);
  const prevEditedEntriesRef = useRef(null);

  // Memoize validateBudget first (before using it)
  const validateBudget = useCallback(async () => {
    if (!submission || !submission.phaseId) return;

    const entries = editing ? editedEntries : (submission.labourEntries || []);
    const totalCost = entries.reduce((sum, entry) => {
      const hours = parseFloat(entry.hours || entry.totalHours) || 0;
      const rate = parseFloat(entry.hourlyRate) || 0;
      return sum + hours * rate;
    }, 0);

    try {
      const response = await fetch(
        `/api/labour/financial/validate?phaseId=${submission.phaseId}&labourCost=${totalCost}`
      );
      const data = await response.json();
      if (data.success) {
        setBudgetInfo(data.data);
      }
    } catch (err) {
      console.error('Error validating budget:', err);
    }
  }, [submission, editing, editedEntries]);

  useEffect(() => {
    if (submission && submission !== prevSubmissionRef.current) {
      prevSubmissionRef.current = submission;
      setEditedEntries(submission.labourEntries || []);
      // Validate budget after setting entries (will be called after editedEntries updates)
    }
  }, [submission]);

  // Validate budget when submission changes and has phaseId (only when not editing)
  const prevPhaseIdRef = useRef(null);
  useEffect(() => {
    if (submission && submission.phaseId && !editing) {
      // Only validate if phaseId actually changed
      if (prevPhaseIdRef.current !== submission.phaseId) {
        prevPhaseIdRef.current = submission.phaseId;
        validateBudget();
      }
    }
  }, [submission?.phaseId, editing, validateBudget]);

  const fetchSubmission = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/labour/supervisor-submissions/${params.id}`);
      const data = await response.json();
      if (data.success) {
        setSubmission(data.data);
      } else {
        throw new Error(data.error || 'Failed to load submission');
      }
    } catch (err) {
      console.error('Error fetching submission:', err);
      toast.showError(err.message || 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  // Validate budget when editing and entries change
  useEffect(() => {
    if (editing && submission && submission.phaseId) {
      // Only validate if editedEntries actually changed
      const entriesChanged = JSON.stringify(prevEditedEntriesRef.current) !== JSON.stringify(editedEntries);
      if (entriesChanged) {
        prevEditedEntriesRef.current = editedEntries;
        validateBudget();
      }
    }
  }, [editedEntries, editing, submission, validateBudget]);

  const handleEditEntry = (index, field, value) => {
    const updated = [...editedEntries];
    updated[index] = { ...updated[index], [field]: value };
    setEditedEntries(updated);
  };

  const handleSaveEdits = async () => {
    try {
      const response = await fetch(`/api/labour/supervisor-submissions/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labourEntries: editedEntries,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save edits');
      }

      toast.showSuccess('Edits saved successfully');
      setEditing(false);
      fetchSubmission();
    } catch (err) {
      toast.showError(err.message);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this submission? A labour batch will be created and budget will be updated.')) {
      return;
    }

    setApproving(true);
    try {
      const response = await fetch(`/api/labour/supervisor-submissions/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: 'Approved from supervisor submission',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve submission');
      }

      toast.showSuccess(`Submission approved! Batch ${data.data.batch.batchNumber} created.`);
      router.push(`/labour/batches/${data.data.batch._id}`);
    } catch (err) {
      toast.showError(err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      toast.showError('Please provide a rejection reason (at least 5 characters)');
      return;
    }

    if (!confirm('Are you sure you want to reject this submission?')) {
      return;
    }

    setRejecting(true);
    try {
      const response = await fetch(`/api/labour/supervisor-submissions/${params.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject submission');
      }

      toast.showSuccess('Submission rejected');
      router.push('/labour/supervisor-submissions');
    } catch (err) {
      toast.showError(err.message);
    } finally {
      setRejecting(false);
    }
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="w-5 h-5" />;
      case 'email':
        return <Mail className="w-5 h-5" />;
      case 'sms':
        return <Phone className="w-5 h-5" />;
      case 'in_person':
        return <FileText className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading submission..." />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!submission) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Submission not found
          </div>
        </div>
      </AppLayout>
    );
  }

  const entries = editing ? editedEntries : (submission.labourEntries || []);
  const totals = entries.reduce(
    (acc, entry) => {
      const hours = parseFloat(entry.hours || entry.totalHours) || 0;
      const rate = parseFloat(entry.hourlyRate) || 0;
      const cost = hours * rate;

      return {
        totalHours: acc.totalHours + hours,
        totalCost: acc.totalCost + cost,
        entryCount: acc.entryCount + 1,
      };
    },
    { totalHours: 0, totalCost: 0, entryCount: 0 }
  );

  const canEdit = submission.status === 'pending_review' || submission.status === 'draft';
  const canApprove = submission.status === 'pending_review';
  const canReject = submission.status === 'pending_review';

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/labour/supervisor-submissions"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Submissions
          </Link>
          <div className="flex items-center justify-between mt-2">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Review Submission {submission.submissionNumber}
              </h1>
              <p className="text-gray-600 mt-1">
                Submitted via {submission.submissionChannel.replace('_', ' ')} by {submission.submittedBy}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getChannelIcon(submission.submissionChannel)}
              <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm capitalize">
                {submission.submissionChannel.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Submission Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Submission Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Submitted By:</span>
              <p className="font-medium text-gray-900">{submission.submittedBy}</p>
            </div>
            <div>
              <span className="text-gray-600">Entry Date:</span>
              <p className="font-medium text-gray-900">
                {new Date(submission.entryDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Submitted At:</span>
              <p className="font-medium text-gray-900">
                {new Date(submission.submittedAt).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <p className="font-medium">
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    submission.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : submission.status === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {submission.status.replace('_', ' ')}
                </span>
              </p>
            </div>
          </div>

          {/* Original Raw Text */}
          {submission.submissionData?.rawText && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Original Submission</h3>
              <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 whitespace-pre-wrap">
                {submission.submissionData.rawText}
              </div>
            </div>
          )}
        </div>

        {/* Budget Validation */}
        {budgetInfo && (
          <div
            className={`p-4 rounded-lg border mb-6 ${
              budgetInfo.isValid
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {budgetInfo.isValid ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    budgetInfo.isValid ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {budgetInfo.isValid ? '✅ Budget Valid' : '⚠️ Budget Warning'}
                </p>
                <p
                  className={`text-xs mt-1 ${
                    budgetInfo.isValid ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {budgetInfo.message}
                </p>
                {budgetInfo.budget && (
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    <p>
                      Budget: {budgetInfo.budget.toLocaleString()} KES | Available:{' '}
                      {budgetInfo.available.toLocaleString()} KES
                    </p>
                    <p>Current Spending: {budgetInfo.currentSpending.toLocaleString()} KES</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Labour Entries</h2>
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Edit Entries
              </button>
            )}
            {editing && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditedEntries(submission.labourEntries || []);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdits}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Total Hours</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{totals.totalHours.toFixed(1)}</div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Total Cost</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {totals.totalCost.toLocaleString()} KES
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Workers</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">{totals.entryCount}</div>
            </div>
          </div>

          {/* Entries Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Worker Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Skill
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Hours
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Rate (KES)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Cost (KES)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.map((entry, index) => {
                  const hours = parseFloat(entry.hours || entry.totalHours) || 0;
                  const rate = parseFloat(entry.hourlyRate) || 0;
                  const cost = hours * rate;

                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm">
                        {editing ? (
                          <input
                            type="text"
                            value={entry.workerName || ''}
                            onChange={(e) => handleEditEntry(index, 'workerName', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          <span className="font-medium text-gray-900">{entry.workerName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {entry.skillType?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {editing ? (
                          <input
                            type="number"
                            value={hours}
                            onChange={(e) => handleEditEntry(index, 'hours', e.target.value)}
                            min="0"
                            step="0.5"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          <span className="text-gray-600">{hours} hrs</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {editing ? (
                          <input
                            type="number"
                            value={rate}
                            onChange={(e) => handleEditEntry(index, 'hourlyRate', e.target.value)}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          <span className="text-gray-600">{rate.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">
                        {cost.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="2" className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">
                    Totals:
                  </td>
                  <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                    {totals.totalHours.toFixed(1)} hrs
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-sm font-semibold text-gray-900">
                    {totals.totalCost.toLocaleString()} KES
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Corrections */}
        {submission.corrections && submission.corrections.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-yellow-900 mb-2">Corrections Made</h3>
            <ul className="space-y-1 text-xs text-yellow-800">
              {submission.corrections.map((correction, index) => (
                <li key={index}>
                  {correction.field}: "{correction.originalValue}" → "{correction.correctedValue}"
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        {canApprove && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="flex items-center gap-4">
              <LoadingButton
                onClick={handleApprove}
                loading={approving}
                disabled={!budgetInfo?.isValid || editing}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Approve & Create Batch
              </LoadingButton>

              <div className="flex-1">
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Rejection reason (required)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                />
                <LoadingButton
                  onClick={handleReject}
                  loading={rejecting}
                  disabled={!rejectionReason || rejectionReason.trim().length < 5}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Reject Submission
                </LoadingButton>
              </div>
            </div>
          </div>
        )}

        {/* Already Processed */}
        {submission.status === 'approved' && submission.labourBatchId && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">Submission Approved</p>
                <p className="text-xs text-green-700 mt-1">
                  Batch created: {submission.labourBatchNumber}
                </p>
                <Link
                  href={`/labour/batches/${submission.labourBatchId}`}
                  className="text-xs text-green-600 hover:text-green-800 mt-1 inline-block"
                >
                  View Batch →
                </Link>
              </div>
            </div>
          </div>
        )}

        {submission.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-900">Submission Rejected</p>
                {submission.reviewNotes && (
                  <p className="text-xs text-red-700 mt-1">{submission.reviewNotes}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function SupervisorSubmissionReviewPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SupervisorSubmissionReviewPageContent />
    </Suspense>
  );
}

