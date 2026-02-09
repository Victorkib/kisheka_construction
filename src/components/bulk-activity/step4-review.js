/**
 * Step 4: Review & Submit Component
 * Final review before submission
 */

'use client';

import { useState, useEffect } from 'react';
import { normalizeUserRole, isRole } from '@/lib/role-constants';

const normalizeId = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return normalizeId(value[0]);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return value.$oid;
  if (typeof value === 'object' && value._id) return normalizeId(value._id);
  return value.toString?.() || '';
};

export function Step4Review({ wizardData, user }) {
  const [project, setProject] = useState(null);
  const [professionalService, setProfessionalService] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const projectId = normalizeId(wizardData.projectId);
    if (projectId) {
      fetchProject(projectId);
    }
    const professionalServiceId = normalizeId(wizardData.professionalServiceId);
    if (professionalServiceId) {
      fetchProfessionalService(professionalServiceId);
    }
  }, [wizardData.projectId, wizardData.professionalServiceId]);

  const fetchProject = async (projectId) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProject(data.data);
      }
    } catch (err) {
      console.error('Error fetching project:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfessionalService = async (professionalServiceId) => {
    try {
      const response = await fetch(`/api/professional-services/${professionalServiceId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProfessionalService(data.data);
      }
    } catch (err) {
      console.error('Error fetching professional service:', err);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTotals = () => {
    const activities = wizardData.activities || [];
    const totalActivities = activities.length;
    const totalFees = activities.reduce((sum, a) => {
      const fee = a.feesCharged ? parseFloat(a.feesCharged) : 0;
      return sum + fee;
    }, 0);
    const totalExpenses = activities.reduce((sum, a) => {
      const expense = a.expensesIncurred ? parseFloat(a.expensesIncurred) : 0;
      return sum + expense;
    }, 0);
    return { totalActivities, totalFees, totalExpenses };
  };

  const totals = calculateTotals();
  const activities = wizardData.activities || [];
  const userRole = normalizeUserRole(user?.role);
  const willAutoApprove = isRole(userRole, 'owner');

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading review...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Review & Submit</h2>
        <p className="text-sm text-gray-600 mb-6">
          Review all details before submitting. {willAutoApprove && 'As OWNER, these activities will be auto-approved.'}
        </p>
      </div>

      {/* Project & Professional Service Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project & Professional Service</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Project</p>
            <p className="font-medium text-gray-900">
              {project ? `${project.projectCode} - ${project.projectName}` : 'Loading...'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Professional Service</p>
            <p className="font-medium text-gray-900">
              {professionalService 
                ? `${professionalService.library?.name || 'N/A'} (${professionalService.type === 'architect' ? 'Architect' : 'Engineer'})`
                : 'Loading...'}
            </p>
          </div>
          {wizardData.defaultPhaseId && (
            <div>
              <p className="text-sm text-gray-600">Default Phase</p>
              <p className="font-medium text-gray-900">Applied to all activities</p>
            </div>
          )}
          {wizardData.defaultFloorId && (
            <div>
              <p className="text-sm text-gray-600">Default Floor</p>
              <p className="font-medium text-gray-900">Applied to all activities</p>
            </div>
          )}
        </div>
      </div>

      {/* Activities Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activities Summary</h3>
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-900">{totals.totalActivities}</p>
              <p className="text-sm text-blue-700">Total Activities</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(totals.totalFees)}</p>
              <p className="text-sm text-blue-700">Total Fees</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(totals.totalExpenses)}</p>
              <p className="text-sm text-blue-700">Total Expenses</p>
            </div>
          </div>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {activities.map((activity, index) => {
            const fee = activity.feesCharged ? parseFloat(activity.feesCharged) : 0;
            const expense = activity.expensesIncurred ? parseFloat(activity.expensesIncurred) : 0;
            return (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {activity.activityType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                    </p>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Date: </span>
                        <span className="font-medium">
                          {activity.activityDate ? new Date(activity.activityDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      {activity.visitPurpose && (
                        <div>
                          <span className="text-gray-600">Purpose: </span>
                          <span className="font-medium">{activity.visitPurpose}</span>
                        </div>
                      )}
                      {activity.inspectionType && (
                        <div>
                          <span className="text-gray-600">Type: </span>
                          <span className="font-medium">{activity.inspectionType}</span>
                        </div>
                      )}
                      {fee > 0 && (
                        <div>
                          <span className="text-gray-600">Fee: </span>
                          <span className="font-medium">{formatCurrency(fee)}</span>
                        </div>
                      )}
                    </div>
                    {activity.notes && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Notes: </span>
                        {activity.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Approval Notice */}
      {willAutoApprove && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-green-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-900">Auto-Approval Enabled</p>
              <p className="text-xs text-green-700 mt-1">
                As OWNER, all activities will be automatically approved upon submission.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





