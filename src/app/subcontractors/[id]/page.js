/**
 * Subcontractor Detail Page
 * Displays subcontractor details, payment schedule, performance, and allows editing
 * 
 * Route: /subcontractors/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import { SUBCONTRACTOR_TYPES, SUBCONTRACTOR_STATUSES, CONTRACT_TYPES, getSubcontractorTypeLabel, getContractTypeLabel, getStatusColor, calculateTotalPaid, calculateTotalUnpaid } from '@/lib/constants/subcontractor-constants';

export default function SubcontractorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const { canAccess, user } = usePermissions();
  const [subcontractor, setSubcontractor] = useState(null);
  const [phase, setPhase] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    subcontractorName: '',
    subcontractorType: '',
    contactPerson: '',
    phone: '',
    email: '',
    contractValue: '',
    contractType: 'fixed_price',
    startDate: '',
    endDate: '',
    paymentSchedule: [],
    status: 'pending',
    performance: {
      quality: 0,
      timeliness: 0,
      communication: 0
    },
    notes: ''
  });

  const [newPayment, setNewPayment] = useState({
    milestone: '',
    amount: '',
    dueDate: ''
  });

  useEffect(() => {
    fetchSubcontractor();
  }, [params.id]);

  useEffect(() => {
    if (user) {
      const role = user.role?.toLowerCase();
      setCanEdit(['owner', 'pm', 'project_manager'].includes(role));
      setCanDelete(role === 'owner');
    }
  }, [user]);

  const fetchSubcontractor = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/subcontractors/${params.id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch subcontractor');
      }

      setSubcontractor(data.data);
      
      // Populate form data
      setFormData({
        subcontractorName: data.data.subcontractorName || '',
        subcontractorType: data.data.subcontractorType || '',
        contactPerson: data.data.contactPerson || '',
        phone: data.data.phone || '',
        email: data.data.email || '',
        contractValue: data.data.contractValue || '',
        contractType: data.data.contractType || 'fixed_price',
        startDate: data.data.startDate ? new Date(data.data.startDate).toISOString().split('T')[0] : '',
        endDate: data.data.endDate ? new Date(data.data.endDate).toISOString().split('T')[0] : '',
        paymentSchedule: data.data.paymentSchedule || [],
        status: data.data.status || 'pending',
        performance: data.data.performance || { quality: 0, timeliness: 0, communication: 0 },
        notes: data.data.notes || ''
      });
      
      // Fetch phase
      if (data.data.phaseId) {
        const phaseResponse = await fetch(`/api/phases/${data.data.phaseId}`);
        const phaseData = await phaseResponse.json();
        if (phaseData.success) {
          setPhase(phaseData.data);
          
          // Fetch project
          if (phaseData.data.projectId) {
            const projectResponse = await fetch(`/api/projects/${phaseData.data.projectId}`);
            const projectData = await projectResponse.json();
            if (projectData.success) {
              setProject(projectData.data);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch subcontractor error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/subcontractors/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update subcontractor');
      }

      toast.showSuccess('Subcontractor updated successfully');
      setShowEditModal(false);
      fetchSubcontractor();
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to update subcontractor');
      console.error('Update subcontractor error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/subcontractors/${params.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete subcontractor');
      }

      toast.showSuccess('Subcontractor deleted successfully');
      router.push('/subcontractors');
    } catch (err) {
      toast.showError(err.message || 'Failed to delete subcontractor');
      console.error('Delete subcontractor error:', err);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setNewPayment((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const addPayment = () => {
    if (!newPayment.milestone || !newPayment.amount || !newPayment.dueDate) {
      toast.showError('Please fill in all payment fields');
      return;
    }

    const payment = {
      milestone: newPayment.milestone.trim(),
      amount: parseFloat(newPayment.amount),
      dueDate: newPayment.dueDate,
      paid: false,
      paidDate: null,
      paymentReference: ''
    };

    setFormData((prev) => ({
      ...prev,
      paymentSchedule: [...prev.paymentSchedule, payment]
    }));

    setNewPayment({ milestone: '', amount: '', dueDate: '' });
  };

  const removePayment = (index) => {
    setFormData((prev) => ({
      ...prev,
      paymentSchedule: prev.paymentSchedule.filter((_, i) => i !== index)
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  if (error || !subcontractor) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Subcontractor not found'}
          </div>
          <Link href="/subcontractors" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Subcontractors
          </Link>
        </div>
      </AppLayout>
    );
  }

  const totalPaid = calculateTotalPaid(subcontractor.paymentSchedule || []);
  const totalUnpaid = calculateTotalUnpaid(subcontractor.paymentSchedule || []);
  const avgPerformance = subcontractor.performance 
    ? ((subcontractor.performance.quality || 0) + (subcontractor.performance.timeliness || 0) + (subcontractor.performance.communication || 0)) / 3
    : 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/subcontractors" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Subcontractors
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{subcontractor.subcontractorName}</h1>
              <p className="text-gray-600 mt-1">
                {getSubcontractorTypeLabel(subcontractor.subcontractorType || 'other')}
              </p>
              {project && phase && (
                <div className="mt-2 space-x-4 text-sm">
                  <Link 
                    href={`/projects/${project._id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Project: {project.projectName}
                  </Link>
                  <span className="text-gray-400">•</span>
                  <Link 
                    href={`/phases/${phase._id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Phase: {phase.phaseName}
                  </Link>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Status</p>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(subcontractor.status)}`}>
              {subcontractor.status?.replace(/\b\w/g, l => l.toUpperCase()) || 'UNKNOWN'}
            </span>
            <p className="text-sm text-gray-600 mt-4">Contract Type</p>
            <p className="text-lg font-semibold text-gray-900">
              {getContractTypeLabel(subcontractor.contractType || 'fixed_price')}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Contract Value</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(subcontractor.contractValue || 0)}
            </p>
            <p className="text-sm text-gray-600 mt-4">Total Paid</p>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(totalPaid)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Total Unpaid</p>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(totalUnpaid)}
            </p>
            <p className="text-sm text-gray-600 mt-4">Remaining</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency((subcontractor.contractValue || 0) - totalPaid)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Performance</p>
            <p className="text-2xl font-bold text-gray-900">
              {avgPerformance.toFixed(1)}/5.0
            </p>
            <p className="text-sm text-gray-600 mt-4">Period</p>
            <p className="text-sm text-gray-900">
              Start: {formatDate(subcontractor.startDate)}<br />
              {subcontractor.endDate ? (
                <>End: {formatDate(subcontractor.endDate)}</>
              ) : (
                <span className="text-blue-600">Ongoing</span>
              )}
            </p>
          </div>
        </div>

        {/* Contact Information */}
        {(subcontractor.contactPerson || subcontractor.phone || subcontractor.email) && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {subcontractor.contactPerson && (
                <div>
                  <p className="text-sm text-gray-600">Contact Person</p>
                  <p className="text-lg font-semibold text-gray-900">{subcontractor.contactPerson}</p>
                </div>
              )}
              {subcontractor.phone && (
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="text-lg font-semibold text-gray-900">{subcontractor.phone}</p>
                </div>
              )}
              {subcontractor.email && (
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <a href={`mailto:${subcontractor.email}`} className="text-lg font-semibold text-blue-600 hover:text-blue-800">
                    {subcontractor.email}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Schedule */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Schedule</h2>
          {subcontractor.paymentSchedule && subcontractor.paymentSchedule.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Milestone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subcontractor.paymentSchedule.map((payment, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {payment.milestone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(payment.amount || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payment.dueDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${payment.paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {payment.paid ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.paidDate ? formatDate(payment.paidDate) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.paymentReference || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">No payment schedule defined</p>
          )}
        </div>

        {/* Performance Ratings */}
        {subcontractor.performance && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Ratings</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Quality</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${((subcontractor.performance.quality || 0) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{subcontractor.performance.quality || 0}/5</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Timeliness</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${((subcontractor.performance.timeliness || 0) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{subcontractor.performance.timeliness || 0}/5</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-2">Communication</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${((subcontractor.performance.communication || 0) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{subcontractor.performance.communication || 0}/5</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {subcontractor.notes && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{subcontractor.notes}</p>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && canEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Edit Subcontractor</h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subcontractor Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="subcontractorName"
                        value={formData.subcontractorName}
                        onChange={(e) => setFormData({ ...formData, subcontractorName: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subcontractor Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="subcontractorType"
                        value={formData.subcontractorType}
                        onChange={(e) => setFormData({ ...formData, subcontractorType: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Type</option>
                        {SUBCONTRACTOR_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {getSubcontractorTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
                      <input
                        type="text"
                        name="contactPerson"
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contract Value (KES) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="contractValue"
                        value={formData.contractValue}
                        onChange={(e) => setFormData({ ...formData, contractValue: e.target.value })}
                        required
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contract Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="contractType"
                        value={formData.contractType}
                        onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {CONTRACT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {getContractTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        min={formData.startDate}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Payment Schedule */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Schedule</label>
                    
                    {formData.paymentSchedule.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {formData.paymentSchedule.map((payment, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <div className="flex-1">
                              <span className="font-medium">{payment.milestone}</span>
                              <span className="text-gray-600 ml-2">
                                - KES {payment.amount.toLocaleString()} due {new Date(payment.dueDate).toLocaleDateString()}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePayment(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input
                        type="text"
                        placeholder="Milestone name"
                        value={newPayment.milestone}
                        onChange={(e) => handlePaymentChange({ target: { name: 'milestone', value: e.target.value } })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Amount"
                        value={newPayment.amount}
                        onChange={(e) => handlePaymentChange({ target: { name: 'amount', value: e.target.value } })}
                        min="0"
                        step="0.01"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="date"
                        placeholder="Due date"
                        value={newPayment.dueDate}
                        onChange={(e) => handlePaymentChange({ target: { name: 'dueDate', value: e.target.value } })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={addPayment}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Add Payment
                      </button>
                    </div>
                  </div>

                  {/* Performance Ratings */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Performance Ratings (1-5)</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Quality</label>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          value={formData.performance.quality}
                          onChange={(e) => setFormData({
                            ...formData,
                            performance: { ...formData.performance, quality: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Timeliness</label>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          value={formData.performance.timeliness}
                          onChange={(e) => setFormData({
                            ...formData,
                            performance: { ...formData.performance, timeliness: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Communication</label>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.1"
                          value={formData.performance.communication}
                          onChange={(e) => setFormData({
                            ...formData,
                            performance: { ...formData.performance, communication: parseFloat(e.target.value) || 0 }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {SUBCONTRACTOR_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex justify-end gap-4 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      type="submit"
                      isLoading={saving}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save Changes
                    </LoadingButton>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Subcontractor"
          message={`Are you sure you want to delete "${subcontractor.subcontractorName}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmColor="red"
          isLoading={deleting}
        />
      </div>
    </AppLayout>
  );
}


