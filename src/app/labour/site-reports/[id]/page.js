/**
 * Site Report Detail Page
 *
 * Route: /labour/site-reports/[id]
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast/toast-container';
import { usePermissions } from '@/hooks/use-permissions';
import { CheckCircle, Edit2, FileText, XCircle } from 'lucide-react';

export default function SiteReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { canAccess } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedReport, setEditedReport] = useState(null);
  const [approving, setApproving] = useState(false);

  const canEdit = canAccess('edit_site_report');
  const canApprove = canAccess('approve_site_report');

  useEffect(() => {
    if (params.id) {
      fetchReport();
    }
  }, [params.id]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/labour/site-reports/${params.id}`);
      const data = await response.json();
      if (data.success) {
        setReport(data.data);
        setEditedReport({
          summary: data.data.summary || '',
          notes: data.data.notes || '',
          labourEntries: data.data.labourEntries || [],
        });
      } else {
        throw new Error(data.error || 'Failed to load report');
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.showError(error.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/labour/site-reports/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: editedReport.summary,
          notes: editedReport.notes,
          labourEntries: editedReport.labourEntries,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update report');
      }
      toast.showSuccess('Report updated');
      setEditing(false);
      fetchReport();
    } catch (error) {
      console.error('Error updating report:', error);
      toast.showError(error.message || 'Failed to update report');
    }
  };

  const handleApprove = async () => {
    if (!confirm('Approve this report and create labour batch?')) return;
    setApproving(true);
    try {
      const response = await fetch(`/api/labour/site-reports/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to approve report');
      }
      toast.showSuccess('Report approved');
      if (data.data?.batch?._id) {
        router.push(`/labour/batches/${data.data.batch._id}`);
      } else {
        fetchReport();
      }
    } catch (error) {
      console.error('Approve error:', error);
      toast.showError(error.message || 'Failed to approve report');
    } finally {
      setApproving(false);
    }
  };

  const updateEntry = (index, field, value) => {
    setEditedReport((prev) => {
      const updated = [...prev.labourEntries];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, labourEntries: updated };
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading report..." />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Site report not found
          </div>
        </div>
      </AppLayout>
    );
  }

  const entries = editing ? editedReport.labourEntries : report.labourEntries;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link href="/labour/site-reports" className="text-sm text-blue-600 hover:text-blue-800">
              ← Back to Site Reports
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">
              {report.reportNumber}
            </h1>
            <p className="text-gray-600">
              {report.projectName || 'Project'} · {report.phaseName || 'Phase'}
            </p>
          </div>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Reported By</p>
              <p className="font-medium text-gray-900">{report.reportedByName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Work Date</p>
              <p className="font-medium text-gray-900">
                {new Date(report.entryDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium text-gray-900 capitalize">
                {report.status?.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
          {editing ? (
            <textarea
              rows={3}
              value={editedReport.summary}
              onChange={(e) => setEditedReport((prev) => ({ ...prev, summary: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          ) : (
            <p className="text-gray-700">{report.summary || 'No summary provided.'}</p>
          )}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Notes</h3>
            {editing ? (
              <textarea
                rows={4}
                value={editedReport.notes}
                onChange={(e) => setEditedReport((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            ) : (
              <p className="text-gray-700">{report.notes || 'No additional notes.'}</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Labour Entries</h2>
          {entries.length === 0 ? (
            <p className="text-sm text-gray-500">No labour entries recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Worker</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Work Item</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Skill</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {entries.map((entry, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {entry.workerName}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {editing ? (
                          <select
                            value={entry.workItemId || ''}
                            onChange={(e) => updateEntry(index, 'workItemId', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          >
                            <option value="">Select work item</option>
                            {(report.workItems || []).map((item) => (
                              <option key={item.workItemId} value={item.workItemId}>
                                {item.workItemName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          entry.workItemName || 'Unlinked'
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {editing ? (
                          <input
                            type="text"
                            value={entry.skillType || ''}
                            onChange={(e) => updateEntry(index, 'skillType', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                          />
                        ) : (
                          entry.skillType
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {editing ? (
                          <input
                            type="number"
                            value={entry.hours}
                            onChange={(e) => updateEntry(index, 'hours', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                            min="0"
                            step="0.5"
                          />
                        ) : (
                          entry.hours
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {editing ? (
                          <input
                            type="number"
                            value={entry.hourlyRate}
                            onChange={(e) => updateEntry(index, 'hourlyRate', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                            min="0"
                            step="0.01"
                          />
                        ) : (
                          entry.hourlyRate
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Attachments</h2>
          {report.attachments?.length ? (
            <ul className="space-y-2 text-sm">
              {report.attachments.map((file, index) => (
                <li key={index} className="flex items-center gap-2 text-blue-600">
                  <FileText className="w-4 h-4" />
                  <a href={file.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {file.fileName || file.url}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No attachments uploaded.</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {editing && (
            <>
              <button
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4" />
                Save Changes
              </button>
            </>
          )}

          {!editing && canApprove && ['submitted', 'draft'].includes(report.status) && (
            <LoadingButton
              onClick={handleApprove}
              loading={approving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Approve & Create Labour Batch
            </LoadingButton>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
