/**
 * New Site Report Page
 *
 * Route: /labour/site-reports/new
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton, LoadingSelect } from '@/components/loading';
import { useToast } from '@/components/toast/toast-container';
import { usePermissions } from '@/hooks/use-permissions';
import { Plus, Trash2, UploadCloud } from 'lucide-react';

export default function NewSiteReportPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = usePermissions();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);
  const [workItems, setWorkItems] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    projectId: '',
    phaseId: '',
    floorId: '',
    workItemIds: [],
    entryDate: new Date().toISOString().split('T')[0],
    reportedByName: '',
    summary: '',
    notes: '',
    submissionChannel: 'in_person',
    labourEntries: [],
  });

  useEffect(() => {
    fetchProjects();
    fetchWorkers();
  }, []);

  useEffect(() => {
    if (!formData.reportedByName) {
      const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
      if (fullName) {
        setFormData((prev) => ({ ...prev, reportedByName: fullName }));
      }
    }
  }, [user, formData.reportedByName]);

  useEffect(() => {
    if (formData.projectId) {
      fetchPhases(formData.projectId);
      fetchFloors(formData.projectId);
      fetchWorkItems(formData.projectId, formData.phaseId);
    } else {
      setPhases([]);
      setFloors([]);
      setWorkItems([]);
      setFormData((prev) => ({ ...prev, phaseId: '', floorId: '', workItemIds: [] }));
    }
  }, [formData.projectId]);

  useEffect(() => {
    if (formData.projectId && formData.phaseId) {
      fetchWorkItems(formData.projectId, formData.phaseId);
    }
  }, [formData.phaseId, formData.projectId]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchPhases = async (projectId) => {
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching phases:', error);
    }
  };

  const fetchFloors = async (projectId) => {
    try {
      const response = await fetch(`/api/floors?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setFloors(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching floors:', error);
    }
  };

  const fetchWorkItems = async (projectId, phaseId) => {
    try {
      const params = new URLSearchParams({ projectId });
      if (phaseId) {
        params.set('phaseId', phaseId);
      }
      const response = await fetch(`/api/work-items?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setWorkItems(data.data?.workItems || []);
      }
    } catch (error) {
      console.error('Error fetching work items:', error);
    }
  };

  const fetchWorkers = async () => {
    try {
      const response = await fetch('/api/labour/workers?status=active&limit=200', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setWorkers(data.data?.workers || []);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  const handleWorkItemToggle = (workItemId) => {
    setFormData((prev) => {
      const exists = prev.workItemIds.includes(workItemId);
      const nextWorkItemIds = exists
        ? prev.workItemIds.filter((id) => id !== workItemId)
        : [...prev.workItemIds, workItemId];
      const updatedEntries = prev.labourEntries.map((entry) => {
        if (entry.workItemId && !nextWorkItemIds.includes(entry.workItemId)) {
          return { ...entry, workItemId: '' };
        }
        return entry;
      });
      return {
        ...prev,
        workItemIds: nextWorkItemIds,
        labourEntries: updatedEntries,
      };
    });
  };

  const addLabourEntry = () => {
    setFormData((prev) => ({
      ...prev,
      labourEntries: [
        ...prev.labourEntries,
        {
          workerId: '',
          workerName: '',
          skillType: 'general_worker',
          hours: '',
          hourlyRate: '',
          taskDescription: '',
          workItemId: '',
        },
      ],
    }));
  };

  const selectedWorkItems = workItems.filter((item) =>
    formData.workItemIds.includes(item._id)
  );

  const updateLabourEntry = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.labourEntries];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'workerId') {
        const worker = workers.find(
          (w) => w._id === value || w.userId === value
        );
        if (worker) {
          updated[index].workerName = worker.workerName;
        }
      }
      return { ...prev, labourEntries: updated };
    });
  };

  const removeLabourEntry = (index) => {
    setFormData((prev) => ({
      ...prev,
      labourEntries: prev.labourEntries.filter((_, i) => i !== index),
    }));
  };

  const uploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploads = Array.from(files).map((file) => {
        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('uploadPreset', 'Construction_Accountability_System');
        uploadData.append(
          'folder',
          `Kisheka_construction/site-reports/${formData.projectId || 'general'}`
        );

        return fetch('/api/uploads/upload', {
          method: 'POST',
          body: uploadData,
        })
          .then((res) => res.json())
          .then((result) => {
            if (!result.success) {
              throw new Error(result.error || 'Upload failed');
            }
            return {
              url: result.data.url,
              publicId: result.data.publicId,
              fileName: result.data.fileName,
              fileType: result.data.fileType,
              fileSize: result.data.fileSize,
              category: result.data.fileType?.startsWith('image/') ? 'photo' : 'document',
              uploadedAt: new Date(),
            };
          });
      });

      const uploaded = await Promise.all(uploads);
      setAttachments((prev) => [...prev, ...uploaded]);
      toast.showSuccess(`Uploaded ${uploaded.length} file(s)`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.showError(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.projectId || !formData.phaseId) {
      toast.showError('Project and phase are required');
      return;
    }

    if (formData.workItemIds.length === 0) {
      toast.showError('Please select at least one work item');
      return;
    }

    if (!formData.reportedByName || formData.reportedByName.trim().length < 2) {
      toast.showError('Reported by name is required');
      return;
    }

    const hasInvalidEntry = formData.labourEntries.some(
      (entry) =>
        !entry.workerName ||
        !entry.workItemId ||
        !entry.hours ||
        !entry.hourlyRate
    );
    if (hasInvalidEntry) {
      toast.showError('Labour entries need worker, work item, hours, and rate');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/labour/site-reports', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          ...formData,
          attachments: attachments.map((att) => ({
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileType: att.fileType,
          })),
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create site report');
      }

      toast.showSuccess('Site report created successfully');
      router.push(`/labour/site-reports/${data.data._id}`);
    } catch (error) {
      console.error('Create site report error:', error);
      toast.showError(error.message || 'Failed to create site report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">New Site Report</h1>
          <p className="text-gray-600 mt-1">Log work completed, labour, and attachments</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Site Context</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project <span className="text-red-600">*</span>
                </label>
                <LoadingSelect
                  value={formData.projectId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, projectId: e.target.value }))}
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.projectName}
                    </option>
                  ))}
                </LoadingSelect>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phase <span className="text-red-600">*</span>
                </label>
                <LoadingSelect
                  value={formData.phaseId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phaseId: e.target.value }))}
                  disabled={!formData.projectId}
                >
                  <option value="">Select phase</option>
                  {phases.map((phase) => (
                    <option key={phase._id} value={phase._id}>
                      {phase.phaseName}
                    </option>
                  ))}
                </LoadingSelect>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                <LoadingSelect
                  value={formData.floorId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, floorId: e.target.value }))}
                  disabled={!formData.projectId}
                >
                  <option value="">Optional</option>
                  {floors.map((floor) => (
                    <option key={floor._id} value={floor._id}>
                      {floor.floorName || `Floor ${floor.floorNumber}`}
                    </option>
                  ))}
                </LoadingSelect>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, entryDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reported By <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.reportedByName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, reportedByName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                <LoadingSelect
                  value={formData.submissionChannel}
                  onChange={(e) => setFormData((prev) => ({ ...prev, submissionChannel: e.target.value }))}
                >
                  <option value="in_person">In-Person</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </LoadingSelect>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Items Completed <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {workItems.map((item) => (
                  <label key={item._id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.workItemIds.includes(item._id)}
                      onChange={() => handleWorkItemToggle(item._id)}
                    />
                    {item.name}
                  </label>
                ))}
              </div>
              {workItems.length === 0 && (
                <p className="text-sm text-gray-500">No work items available for this phase.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Summary</h2>
            <div className="space-y-4">
              <textarea
                rows={3}
                value={formData.summary}
                onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
                placeholder="Short summary of work completed"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <textarea
                rows={4}
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes, issues, or observations"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Labour Entries</h2>
              <button
                type="button"
                onClick={addLabourEntry}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Worker
              </button>
            </div>

            {formData.labourEntries.length === 0 ? (
              <p className="text-sm text-gray-500">No labour entries added yet.</p>
            ) : (
              <div className="space-y-3">
                {formData.labourEntries.map((entry, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                    <div>
                      <label className="text-xs text-gray-500">Worker</label>
                      <LoadingSelect
                        value={entry.workerId}
                        onChange={(e) => updateLabourEntry(index, 'workerId', e.target.value)}
                      >
                        <option value="">Select worker</option>
                        {workers.map((worker) => (
                          <option key={worker._id} value={worker.userId || worker._id}>
                            {worker.workerName}
                          </option>
                        ))}
                      </LoadingSelect>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Work Item</label>
                      <LoadingSelect
                        value={entry.workItemId}
                        onChange={(e) => updateLabourEntry(index, 'workItemId', e.target.value)}
                      >
                        <option value="">Select</option>
                        {selectedWorkItems.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name}
                          </option>
                        ))}
                      </LoadingSelect>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Skill</label>
                      <input
                        type="text"
                        value={entry.skillType}
                        onChange={(e) => updateLabourEntry(index, 'skillType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Hours</label>
                      <input
                        type="number"
                        value={entry.hours}
                        onChange={(e) => updateLabourEntry(index, 'hours', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0"
                        step="0.5"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Rate</label>
                      <input
                        type="number"
                        value={entry.hourlyRate}
                        onChange={(e) => updateLabourEntry(index, 'hourlyRate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLabourEntry(index)}
                      className="inline-flex items-center justify-center px-2 py-2 text-sm text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="md:col-span-6">
                      <input
                        type="text"
                        value={entry.taskDescription}
                        onChange={(e) => updateLabourEntry(index, 'taskDescription', e.target.value)}
                        placeholder="Task description"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Attachments</h2>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => uploadFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={uploading}
              >
                <UploadCloud className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Upload Files'}
              </button>
            </div>

            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-sm text-gray-600">
                    <span>{file.fileName}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/labour/site-reports')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              loading={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Submit Report
            </LoadingButton>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
