/**
 * Subcontractor Section Component
 * Displays subcontractors assigned to a phase
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { calculateTotalPaid, calculateTotalUnpaid } from '@/lib/constants/subcontractor-constants';

export function SubcontractorSection({ phase, formatCurrency }) {
  const [subcontractors, setSubcontractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (phase?._id) {
      fetchSubcontractors();
    }
  }, [phase?._id]);

  const fetchSubcontractors = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/subcontractors?phaseId=${phase._id}`);
      const data = await response.json();
      if (data.success) {
        setSubcontractors(data.data?.subcontractors || data.data || []);
        
        // Calculate statistics
        const subcontractorStats = {
          total: data.data?.subcontractors?.length || 0,
          totalContractValue: (data.data?.subcontractors || []).reduce((sum, sub) => sum + (sub.contractValue || 0), 0),
          totalPaid: 0,
          totalUnpaid: 0,
          byStatus: {},
          byType: {},
          averagePerformance: 0
        };
        
        (data.data?.subcontractors || []).forEach(sub => {
          const status = sub.status || 'unknown';
          subcontractorStats.byStatus[status] = (subcontractorStats.byStatus[status] || 0) + 1;
          
          const type = sub.subcontractorType || 'other';
          subcontractorStats.byType[type] = (subcontractorStats.byType[type] || 0) + 1;
          
          // Payments
          subcontractorStats.totalPaid += calculateTotalPaid(sub.paymentSchedule || []);
          subcontractorStats.totalUnpaid += calculateTotalUnpaid(sub.paymentSchedule || []);
        });
        
        setStats(subcontractorStats);
      }
    } catch (err) {
      console.error('Fetch subcontractors error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'active': 'bg-green-100 text-green-800',
      'completed': 'bg-blue-100 text-blue-800',
      'terminated': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Subcontractors</h3>
        <Link
          href={`/subcontractors/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Subcontractor
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading subcontractors...</p>
        </div>
      ) : stats && stats.total === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No subcontractors assigned to this phase</p>
          <Link
            href={`/subcontractors/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add First Subcontractor
          </Link>
        </div>
      ) : (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Subcontractors</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.total || 0}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Contract Value</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(stats?.totalContractValue || 0)}
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Paid</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(stats?.totalPaid || 0)}
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Unpaid</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {formatCurrency(stats?.totalUnpaid || 0)}
              </p>
            </div>
          </div>

          {/* Subcontractors List */}
          <div className="space-y-3">
            {subcontractors.slice(0, 5).map((sub) => {
              const totalPaid = calculateTotalPaid(sub.paymentSchedule || []);
              const totalUnpaid = calculateTotalUnpaid(sub.paymentSchedule || []);
              return (
                <div
                  key={sub._id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link
                          href={`/subcontractors/${sub._id}`}
                          className="font-semibold text-gray-900 hover:text-blue-600"
                        >
                          {sub.subcontractorName}
                        </Link>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(sub.status)}`}>
                          {sub.status?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Type:</span> {sub.subcontractorType?.replace(/\b\w/g, l => l.toUpperCase()) || 'Other'}
                        </div>
                        <div>
                          <span className="font-medium">Contract:</span> {formatCurrency(sub.contractValue || 0)}
                        </div>
                        <div>
                          <span className="font-medium">Paid:</span> {formatCurrency(totalPaid)}
                        </div>
                        <div>
                          <span className="font-medium">Unpaid:</span> {formatCurrency(totalUnpaid)}
                        </div>
                      </div>
                      {sub.startDate && (
                        <div className="mt-2 text-xs text-gray-500">
                          Period: {formatDate(sub.startDate)} - {sub.endDate ? formatDate(sub.endDate) : 'Ongoing'}
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/subcontractors/${sub._id}`}
                      className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {subcontractors.length > 5 && (
            <div className="mt-4 text-center">
              <Link
                href={`/subcontractors?phaseId=${phase._id}`}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View all {subcontractors.length} subcontractors →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SubcontractorSection;

