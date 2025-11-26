/**
 * Floor Detail Page
 * Displays floor information and allows editing (PM/OWNER only)
 * 
 * Route: /floors/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { useToast } from '@/components/toast';

export default function FloorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const floorId = params.id;

  const [floor, setFloor] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    status: 'NOT_STARTED',
    totalBudget: 0,
    actualCost: 0,
    startDate: '',
    completionDate: '',
    description: '',
  });

  useEffect(() => {
    fetchUser();
    fetchFloor();
  }, [floorId]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        setCanEdit(['owner', 'pm', 'project_manager'].includes(role));
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchFloor = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/floors/${floorId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch floor');
      }

      const floorData = data.data;
      setFloor(floorData);

      // Fetch project if projectId exists
      if (floorData.projectId) {
        try {
          const projectResponse = await fetch(`/api/projects/${floorData.projectId}`);
          const projectData = await projectResponse.json();
          if (projectData.success) {
            setProject(projectData.data);
          }
        } catch (err) {
          console.error('Error fetching project:', err);
        }
      }

      // Populate form data
      setFormData({
        status: floorData.status || 'NOT_STARTED',
        totalBudget: floorData.totalBudget || 0,
        actualCost: floorData.actualCost || 0,
        startDate: floorData.startDate
          ? new Date(floorData.startDate).toISOString().split('T')[0]
          : '',
        completionDate: floorData.completionDate
          ? new Date(floorData.completionDate).toISOString().split('T')[0]
          : '',
        description: floorData.description || '',
      });
    } catch (err) {
      setError(err.message);
      console.error('Fetch floor error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'totalBudget' || name === 'actualCost' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/floors/${floorId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: formData.status,
          totalBudget: formData.totalBudget,
          actualCost: formData.actualCost,
          startDate: formData.startDate || null,
          completionDate: formData.completionDate || null,
          description: formData.description.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update floor');
      }

      setFloor(data.data);
      setEditMode(false);
      // Refresh to get updated data
      fetchFloor();
    } catch (err) {
      setError(err.message);
      console.error('Update floor error:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      NOT_STARTED: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading floor...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !floor) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
          <Link href="/floors" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Floors
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!floor) {
    return null;
  }

  const budgetVariance = (formData.totalBudget || 0) - (formData.actualCost || 0);
  const budgetPercentage = formData.totalBudget > 0
    ? ((formData.actualCost / formData.totalBudget) * 100).toFixed(1)
    : 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href={floor.projectId ? `/floors?projectId=${floor.projectId}` : '/floors'} 
            className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block"
          >
            ← Back to Floors
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                {floor.name || `Floor ${floor.floorNumber !== undefined ? floor.floorNumber : 'N/A'}`}
              </h1>
              <p className="text-gray-600 mt-1">
                Floor Number: {floor.floorNumber !== undefined ? floor.floorNumber : 'N/A'}
                {project && (
                  <span className="ml-4">
                    • Project: <Link href={`/projects/${floor.projectId}`} className="text-blue-600 hover:underline">
                      {project.projectCode} - {project.projectName}
                    </Link>
                  </span>
                )}
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                {editMode ? (
                  <>
                    <button
                      onClick={() => {
                        setEditMode(false);
                        fetchFloor(); // Reset form
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Edit Floor
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Status</p>
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-2 ${getStatusBadgeColor(
                editMode ? formData.status : floor.status
              )}`}
            >
              {editMode ? formData.status : floor.status || 'NOT_STARTED'}
            </span>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Budget</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(editMode ? formData.totalBudget : floor.totalBudget || 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Actual Cost</p>
            <p className="text-2xl font-bold text-orange-600 mt-2">
              {formatCurrency(editMode ? formData.actualCost : floor.actualCost || 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Budget Remaining</p>
            <p className={`text-2xl font-bold mt-2 ${
              budgetVariance >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(budgetVariance)}
            </p>
          </div>
        </div>

        {/* Floor Information */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Floor Information</h2>

          {editMode ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  >
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Total Budget (KES)</label>
                  <input
                    type="number"
                    name="totalBudget"
                    value={formData.totalBudget}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Actual Cost (KES)</label>
                  <input
                    type="number"
                    name="actualCost"
                    value={formData.actualCost}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Completion Date</label>
                  <input
                    type="date"
                    name="completionDate"
                    value={formData.completionDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${getStatusBadgeColor(
                    floor.status
                  )}`}
                >
                  {floor.status || 'NOT_STARTED'}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Budget</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {formatCurrency(floor.totalBudget || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Actual Cost</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {formatCurrency(floor.actualCost || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Budget Variance</p>
                <p className={`text-base font-medium mt-1 ${budgetVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(budgetVariance)} ({budgetVariance >= 0 ? '+' : ''}{budgetPercentage}%)
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Start Date</p>
                <p className="text-base font-medium text-gray-900 mt-1">{formatDate(floor.startDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Completion Date</p>
                <p className="text-base font-medium text-gray-900 mt-1">{formatDate(floor.completionDate)}</p>
              </div>
              {floor.description && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="text-base text-gray-900 mt-1">{floor.description}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Budget Progress */}
        {!editMode && floor.totalBudget > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Progress</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Budget Used</span>
                <span className="font-medium">{budgetPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    parseFloat(budgetPercentage) > 100 ? 'bg-red-600' : parseFloat(budgetPercentage) > 80 ? 'bg-yellow-600' : 'bg-green-600'
                  }`}
                  style={{
                    width: `${Math.min(100, parseFloat(budgetPercentage))}%`,
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-gray-600 mt-1 leading-normal">
                <span>{formatCurrency(floor.actualCost || 0)} spent</span>
                <span>{formatCurrency(floor.totalBudget || 0)} budgeted</span>
              </div>
            </div>
          </div>
        )}

        {/* Floor Progress Section */}
        <FloorProgressSection floorId={floorId} canEdit={canEdit} />

        {/* Project Link */}
        {floor.projectId && project && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Project</h2>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Project Code:</span> {project.projectCode}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Project Name:</span> {project.projectName}
              </p>
              {project.location && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Location:</span> {project.location}
                </p>
              )}
              <Link
                href={`/projects/${floor.projectId}`}
                className="inline-block mt-4 text-blue-600 hover:text-blue-900 underline"
              >
                View Full Project Details →
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// Floor Progress Section Component
function FloorProgressSection({ floorId, canEdit }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [milestoneNotes, setMilestoneNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    fetchProgress();
  }, [floorId]);

  const fetchProgress = async () => {
    try {
      const response = await fetch(`/api/floors/${floorId}/progress`);
      const data = await response.json();
      if (data.success) {
        setProgress(data.data);
        setCompletionPercentage(data.data.completionPercentage || 0);
        setMilestoneNotes(data.data.milestoneNotes || '');
      }
    } catch (err) {
      console.error('Fetch floor progress error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProgress = async () => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/floors/${floorId}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completionPercentage,
          milestoneNotes,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update progress');
      }

      setProgress(data.data);
      toast.showSuccess('Progress updated successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Update progress error:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handlePhotoUpload = async (url) => {
    setPhotoUrl(url);
  };

  const handleAddPhoto = async () => {
    if (!photoUrl) {
      toast.showError('Please upload a photo first');
      return;
    }

    setUploadingPhoto(true);
    try {
      const response = await fetch(`/api/floors/${floorId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo: {
            url: photoUrl,
            description: photoDescription.trim(),
          },
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to add photo');
      }

      setPhotoUrl(null);
      setPhotoDescription('');
      setProgress(data.data);
      toast.showSuccess('Photo added successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Add photo error:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const photos = progress?.photos || [];

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Floor Progress</h2>

      {loading ? (
        <p className="text-sm text-gray-500">Loading progress...</p>
      ) : (
        <div className="space-y-6">
          {/* Completion Percentage */}
          {canEdit ? (
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                Completion Percentage: {completionPercentage}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={completionPercentage}
                onChange={(e) => setCompletionPercentage(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-2">Completion Percentage</p>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${
                    completionPercentage >= 100
                      ? 'bg-green-500'
                      : completionPercentage >= 75
                      ? 'bg-blue-500'
                      : completionPercentage >= 50
                      ? 'bg-yellow-500'
                      : 'bg-gray-300'
                  }`}
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <p className="text-sm font-medium text-gray-900 mt-1">{completionPercentage}%</p>
            </div>
          )}

          {/* Milestone Notes */}
          {canEdit ? (
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                Milestone Notes
              </label>
              <textarea
                value={milestoneNotes}
                onChange={(e) => setMilestoneNotes(e.target.value)}
                placeholder="Enter milestone notes..."
                rows={3}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
          ) : (
            milestoneNotes && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Milestone Notes</p>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded whitespace-pre-line">
                  {milestoneNotes}
                </p>
              </div>
            )
          )}

          {canEdit && (
            <button
              onClick={handleUpdateProgress}
              disabled={updating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition"
            >
              {updating ? 'Updating...' : 'Update Progress'}
            </button>
          )}

          {/* Photo Upload */}
          <div className="border-t pt-6">
            <h3 className="text-md font-semibold text-gray-900 mb-4">Progress Photos ({photos.length})</h3>
            
            <div className="mb-4">
              <div className="mb-3">
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Upload Photo
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={photoUrl || ''}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    placeholder="Photo URL (from Cloudinary)"
                    className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleAddPhoto}
                    disabled={!photoUrl || uploadingPhoto}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition"
                  >
                    {uploadingPhoto ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
              <textarea
                value={photoDescription}
                onChange={(e) => setPhotoDescription(e.target.value)}
                placeholder="Photo description (optional)"
                rows={2}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>

            {photos.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No photos uploaded yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {photos.map((photo, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <img
                      src={photo.url}
                      alt={photo.description || `Photo ${index + 1}`}
                      className="w-full h-48 object-cover"
                    />
                    {photo.description && (
                      <div className="p-3 bg-gray-50">
                        <p className="text-sm text-gray-700">{photo.description}</p>
                        <p className="text-sm text-gray-600 mt-1 leading-normal">
                          {new Date(photo.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

