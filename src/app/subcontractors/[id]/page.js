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
import { SubcontractorLabourTracking } from '@/components/subcontractors/labour-tracking';

export default function SubcontractorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const { canAccess, user } = usePermissions();
  const [subcontractor, setSubcontractor] = useState(null);
  const [phase, setPhase] = useState(null);
  const [project, setProject] = useState(null);
  const [floors, setFloors] = useState([]);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
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
    notes: '',
    floorId: ''
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

      const response = await fetch(`/api/subcontractors/${params.id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
        notes: data.data.notes || '',
        floorId: data.data.floorId ? data.data.floorId.toString() : ''
      });
      
      // Fetch phase
      if (data.data.phaseId) {
        const phaseResponse = await fetch(`/api/phases/${data.data.phaseId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const phaseData = await phaseResponse.json();
        if (phaseData.success) {
          setPhase(phaseData.data);
          
          // Fetch project
          if (phaseData.data.projectId) {
            const projectResponse = await fetch(`/api/projects/${phaseData.data.projectId}`, {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
              },
            });
            const projectData = await projectResponse.json();
            if (projectData.success) {
              setProject(projectData.data);
              
              // Load floors for this project
              setLoadingFloors(true);
              try {
                const floorsResponse = await fetch(`/api/floors?projectId=${phaseData.data.projectId}`, {
                  cache: 'no-store',
                  headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' },
                });
                const floorsData = await floorsResponse.json();
                if (floorsData.success) {
                  setFloors(floorsData.data?.floors || floorsData.data || []);
                }
              } catch (err) {
                console.error('Error loading floors:', err);
              } finally {
                setLoadingFloors(false);
              }
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
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
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
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
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
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Subcontractor not found'}
          </div>
          <Link href="/subcontractors" className="mt-4 inline-block ds-text-accent-primary hover:ds-text-accent-hover">
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
          <Link href="/subcontractors" className="ds-text-accent-primary hover:ds-text-accent-hover mb-4 inline-block font-medium">
            ← Back to Subcontractors
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold ds-text-primary">{subcontractor.subcontractorName}</h1>
              <p className="ds-text-secondary mt-1">
                {getSubcontractorTypeLabel(subcontractor.subcontractorType || 'other')}
              </p>
              {project && phase && (
                <div className="mt-2 space-x-4 text-sm">
                  <Link 
                    href={`/projects/${project._id}`}
                    className="ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    Project: {project.projectName}
                  </Link>
                  <span className="ds-text-muted">•</span>
                  <Link 
                    href={`/phases/${phase._id}`}
                    className="ds-text-accent-primary hover:ds-text-accent-hover"
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
                  className="ds-bg-accent-primary text-white px-6 py-2.5 rounded-lg hover:ds-bg-accent-hover font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="ds-bg-danger text-white px-6 py-2.5 rounded-lg hover:bg-red-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Information Card */}
        <div className="ds-bg-accent-subtle rounded-xl border-2 ds-border-accent-subtle p-4 sm:p-5 mb-6 shadow-lg transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 ds-bg-accent-primary rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm sm:text-base font-bold ds-text-primary">Subcontractor Assignment Details</h3>
                <button
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 ds-bg-surface/80 hover:ds-bg-surface border ds-border-accent-subtle rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  aria-label={isInfoExpanded ? 'Collapse information' : 'Expand information'}
                  aria-expanded={isInfoExpanded}
                >
                  <svg 
                    className={`w-4 h-4 sm:w-5 sm:h-5 ds-text-accent-primary transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {isInfoExpanded ? (
                <p className="text-xs sm:text-sm ds-text-secondary leading-relaxed mt-1 animate-fadeIn">
                  This subcontractor assignment tracks an external contractor or service provider working on your construction phase. Monitor contracts, payment schedules, performance ratings, and ensure proper coordination.
                </p>
              ) : (
                <p className="text-xs ds-text-muted italic mt-1 animate-fadeIn">
                  Click to expand
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 hover:shadow-xl transition-shadow duration-200">
            <p className="text-sm font-semibold ds-text-secondary mb-3 uppercase tracking-wide">Status</p>
            <span className={`inline-block px-4 py-2 text-sm font-bold rounded-full mb-6 ${getStatusColor(subcontractor.status)}`}>
              {subcontractor.status?.replace(/\b\w/g, l => l.toUpperCase()) || 'UNKNOWN'}
            </span>
            <p className="text-sm font-semibold ds-text-secondary mt-6 mb-2 uppercase tracking-wide">Contract Type</p>
            <p className="text-lg font-bold ds-text-primary">
              {getContractTypeLabel(subcontractor.contractType || 'fixed_price')}
            </p>
          </div>
          <div className="ds-bg-accent-subtle rounded-xl shadow-lg border ds-border-accent-subtle p-6 hover:shadow-xl transition-shadow duration-200">
            <p className="text-sm font-semibold ds-text-secondary mb-3 uppercase tracking-wide">Contract Value</p>
            <p className="text-3xl font-bold text-purple-700 mb-4">
              {formatCurrency(subcontractor.contractValue || 0)}
            </p>
            <p className="text-sm font-semibold ds-text-secondary mb-2 uppercase tracking-wide">Total Paid</p>
            <p className="text-xl font-bold ds-text-success">
              {formatCurrency(totalPaid)}
            </p>
          </div>
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 hover:shadow-xl transition-shadow duration-200">
            <p className="text-sm font-semibold ds-text-secondary mb-3 uppercase tracking-wide">Total Unpaid</p>
            <p className="text-3xl font-bold ds-text-warning mb-4">
              {formatCurrency(totalUnpaid)}
            </p>
            <p className="text-sm font-semibold ds-text-secondary mb-2 uppercase tracking-wide">Remaining</p>
            <p className="text-xl font-bold ds-text-primary">
              {formatCurrency((subcontractor.contractValue || 0) - totalPaid)}
            </p>
          </div>
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 hover:shadow-xl transition-shadow duration-200">
            <p className="text-sm font-semibold ds-text-secondary mb-3 uppercase tracking-wide">Performance</p>
            <p className="text-3xl font-bold ds-text-primary mb-4">
              {avgPerformance.toFixed(1)}<span className="text-lg font-normal ds-text-secondary">/5.0</span>
            </p>
            <p className="text-sm font-semibold ds-text-secondary mt-6 mb-2 uppercase tracking-wide">Period</p>
            <div className="space-y-2">
              <p className="text-sm font-medium ds-text-primary">
                <span className="font-semibold">Start:</span> {formatDate(subcontractor.startDate)}
              </p>
              {subcontractor.endDate ? (
                <p className="text-sm font-medium ds-text-primary">
                  <span className="font-semibold">End:</span> {formatDate(subcontractor.endDate)}
                </p>
              ) : (
                <p className="text-sm font-semibold ds-text-accent-primary">Ongoing</p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        {(subcontractor.contactPerson || subcontractor.phone || subcontractor.email) && (
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 mb-6">
            <h2 className="text-xl font-bold ds-text-primary mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subcontractor.contactPerson && (
                <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
                  <p className="text-sm font-semibold ds-text-secondary mb-2 uppercase tracking-wide">Contact Person</p>
                  <p className="text-lg font-bold ds-text-primary">{subcontractor.contactPerson}</p>
                </div>
              )}
              {subcontractor.phone && (
                <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
                  <p className="text-sm font-semibold ds-text-secondary mb-2 uppercase tracking-wide">Phone</p>
                  <p className="text-lg font-bold ds-text-primary">{subcontractor.phone}</p>
                </div>
              )}
              {subcontractor.email && (
                <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
                  <p className="text-sm font-semibold ds-text-secondary mb-2 uppercase tracking-wide">Email</p>
                  <a href={`mailto:${subcontractor.email}`} className="text-lg font-bold ds-text-accent-primary hover:ds-text-accent-hover transition-colors">
                    {subcontractor.email}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Schedule */}
        <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 mb-6">
          <h2 className="text-xl font-bold ds-text-primary mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Payment Schedule
          </h2>
          {subcontractor.paymentSchedule && subcontractor.paymentSchedule.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-ds-border-subtle">
                <thead className="ds-bg-accent-primary">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Milestone</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Due Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Paid Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Reference</th>
                  </tr>
                </thead>
                <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                  {subcontractor.paymentSchedule.map((payment, index) => (
                    <tr key={index} className="hover:bg-purple-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold ds-text-primary">
                        {payment.milestone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold ds-text-primary">
                        {formatCurrency(payment.amount || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-secondary">
                        {formatDate(payment.dueDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1.5 text-xs font-bold rounded-full ${payment.paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {payment.paid ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-secondary">
                        {payment.paidDate ? formatDate(payment.paidDate) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-secondary">
                        {payment.paymentReference || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ds-text-secondary font-medium text-center py-8">No payment schedule defined</p>
          )}
        </div>

        {/* Performance Ratings */}
        {subcontractor.performance && (
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 mb-6">
            <h2 className="text-xl font-bold ds-text-primary mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Performance Ratings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
                <p className="text-sm font-semibold ds-text-secondary mb-3 uppercase tracking-wide">Quality</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 ds-bg-surface-muted rounded-full h-3">
                    <div
                      className="ds-bg-accent-primary h-3 rounded-full transition-all duration-300"
                      style={{ width: `${((subcontractor.performance.quality || 0) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold ds-text-primary min-w-[3rem] text-right">{subcontractor.performance.quality || 0}/5</span>
                </div>
              </div>
              <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
                <p className="text-sm font-semibold ds-text-secondary mb-3 uppercase tracking-wide">Timeliness</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 ds-bg-surface-muted rounded-full h-3">
                    <div
                      className="ds-bg-accent-primary h-3 rounded-full transition-all duration-300"
                      style={{ width: `${((subcontractor.performance.timeliness || 0) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold ds-text-primary min-w-[3rem] text-right">{subcontractor.performance.timeliness || 0}/5</span>
                </div>
              </div>
              <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
                <p className="text-sm font-semibold ds-text-secondary mb-3 uppercase tracking-wide">Communication</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 ds-bg-surface-muted rounded-full h-3">
                    <div
                      className="ds-bg-accent-primary h-3 rounded-full transition-all duration-300"
                      style={{ width: `${((subcontractor.performance.communication || 0) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold ds-text-primary min-w-[3rem] text-right">{subcontractor.performance.communication || 0}/5</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {subcontractor.notes && (
          <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 mb-6">
            <h2 className="text-xl font-bold ds-text-primary mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Notes
            </h2>
            <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
              <p className="ds-text-secondary whitespace-pre-wrap font-medium leading-relaxed">{subcontractor.notes}</p>
            </div>
          </div>
        )}

        {/* Labour Tracking */}
        <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 mb-6">
          <h2 className="text-xl font-bold ds-text-primary mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Labour Tracking
          </h2>
          <SubcontractorLabourTracking subcontractorId={params.id} />
        </div>

        {/* Edit Modal */}
        {showEditModal && canEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="ds-bg-surface rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-8">
                <div className="flex justify-between items-center mb-6 border-b-2 ds-border-subtle pb-4">
                  <h2 className="text-2xl font-bold ds-text-primary flex items-center gap-2">
                    <svg className="w-7 h-7 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Subcontractor
                  </h2>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="ds-text-muted hover:ds-text-secondary hover:ds-bg-surface-muted rounded-full p-2 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border-2 border-red-400/60 text-red-800 px-4 py-3 rounded-lg mb-6 font-medium">
                    {error}
                  </div>
                )}

                <form onSubmit={handleEditSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">
                        Subcontractor Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        name="subcontractorName"
                        value={formData.subcontractorName}
                        onChange={(e) => setFormData({ ...formData, subcontractorName: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">
                        Subcontractor Type <span className="text-red-600">*</span>
                      </label>
                      <select
                        name="subcontractorType"
                        value={formData.subcontractorType}
                        onChange={(e) => setFormData({ ...formData, subcontractorType: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                      >
                        <option value="" className="ds-text-muted">Select Type</option>
                        {SUBCONTRACTOR_TYPES.map((type) => (
                          <option key={type} value={type} className="ds-text-primary">
                            {getSubcontractorTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">Contact Person</label>
                      <input
                        type="text"
                        name="contactPerson"
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">
                        Contract Value (KES) <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        name="contractValue"
                        value={formData.contractValue}
                        onChange={(e) => setFormData({ ...formData, contractValue: e.target.value })}
                        required
                        min="0"
                        step="0.01"
                        className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">
                        Contract Type <span className="text-red-600">*</span>
                      </label>
                      <select
                        name="contractType"
                        value={formData.contractType}
                        onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                      >
                        {CONTRACT_TYPES.map((type) => (
                          <option key={type} value={type} className="ds-text-primary">
                            {getContractTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">
                        Start Date <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        required
                        className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">End Date</label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        min={formData.startDate}
                        className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                      />
                    </div>
                  </div>

                  {/* Floor Assignment - Optional, for finishing works */}
                  {phase?.phaseType === 'finishing' && (
                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">
                        Floor Assignment <span className="ds-text-muted text-xs font-normal">(Optional - for floor-specific contracts)</span>
                      </label>
                      {loadingFloors ? (
                        <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted">
                          Loading floors...
                        </div>
                      ) : (
                        <select
                          name="floorId"
                          value={formData.floorId}
                          onChange={(e) => setFormData({ ...formData, floorId: e.target.value })}
                          className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                        >
                          <option value="">No specific floor (phase-level contract)</option>
                          {floors.map((floor) => (
                            <option key={floor._id} value={floor._id.toString()} className="ds-text-primary">
                              {floor.name || (floor.floorNumber < 0 
                                ? `Basement ${Math.abs(floor.floorNumber)}` 
                                : floor.floorNumber === 0 
                                ? 'Ground Floor' 
                                : `Floor ${floor.floorNumber}`)}
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="text-xs ds-text-muted mt-1.5">
                        Leave empty for phase-level contracts. Set a floor for floor-specific finishing work contracts.
                      </p>
                    </div>
                  )}

                  {/* Payment Schedule */}
                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">Payment Schedule</label>
                    
                    {formData.paymentSchedule.length > 0 && (
                      <div className="mb-4 space-y-3">
                        {formData.paymentSchedule.map((payment, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 ds-bg-surface-muted rounded-lg border-2 ds-border-subtle">
                            <div className="flex-1">
                              <span className="font-bold ds-text-primary">{payment.milestone}</span>
                              <span className="ds-text-secondary ml-2 font-medium">
                                - KES {payment.amount.toLocaleString()} due {new Date(payment.dueDate).toLocaleDateString()}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePayment(index)}
                              className="px-3 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg font-semibold transition-colors text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input
                        type="text"
                        placeholder="Milestone name"
                        value={newPayment.milestone}
                        onChange={(e) => handlePaymentChange({ target: { name: 'milestone', value: e.target.value } })}
                        className="px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:ds-text-muted transition-all duration-200 font-medium"
                      />
                      <input
                        type="number"
                        placeholder="Amount"
                        value={newPayment.amount}
                        onChange={(e) => handlePaymentChange({ target: { name: 'amount', value: e.target.value } })}
                        min="0"
                        step="0.01"
                        className="px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:ds-text-muted transition-all duration-200 font-medium"
                      />
                      <input
                        type="date"
                        placeholder="Due date"
                        value={newPayment.dueDate}
                        onChange={(e) => handlePaymentChange({ target: { name: 'dueDate', value: e.target.value } })}
                        className="px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                      />
                      <button
                        type="button"
                        onClick={addPayment}
                        className="px-4 py-2.5 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        Add Payment
                      </button>
                    </div>
                  </div>

                  {/* Performance Ratings */}
                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">Performance Ratings (1-5)</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-semibold ds-text-secondary mb-2">Quality</label>
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
                          className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold ds-text-secondary mb-2">Timeliness</label>
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
                          className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold ds-text-secondary mb-2">Communication</label>
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
                          className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                    >
                      {SUBCONTRACTOR_STATUSES.map((status) => (
                        <option key={status} value={status} className="ds-text-primary">
                          {status.replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold ds-text-primary mb-2">Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={4}
                      placeholder="Additional notes about this subcontractor assignment..."
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:ds-text-muted transition-all duration-200 font-medium resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-4 pt-6 border-t-2 ds-border-subtle">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-6 py-2.5 border-2 ds-border-subtle rounded-lg ds-text-secondary font-semibold hover:ds-bg-surface-muted hover:border-ds-border-strong transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <LoadingButton
                      type="submit"
                      isLoading={saving}
                      className="px-8 py-2.5 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
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


