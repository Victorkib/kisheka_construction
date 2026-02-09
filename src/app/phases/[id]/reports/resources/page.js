/**
 * Phase Resources Report Page
 * Detailed resource report with equipment, subcontractors, and professional services
 * 
 * Route: /phases/[id]/reports/resources
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { useToast } from '@/components/toast';

export default function ResourcesReportPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (params.id) {
      fetchReportData();
    }
  }, [params.id]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/phases/${params.id}/reports/resources`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch resource report');
      }

      setReportData(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch resource report error:', err);
      toast.showError(err.message || 'Failed to load resource report');
    } finally {
      setLoading(false);
    }
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
      month: 'short',
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

  if (error || !reportData) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Failed to load resource report'}
          </div>
          <Link href={`/phases/${params.id}`} className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Phase
          </Link>
        </div>
      </AppLayout>
    );
  }

  const { phase, summary, equipment, subcontractors, professionalServices, costBreakdown } = reportData;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/phases/${params.id}/dashboard`} className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Resource Report: {phase.phaseName}
              </h1>
              <p className="text-gray-600 mt-1">{phase.phaseCode}</p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Print Report
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resource Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Equipment</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalEquipment}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Subcontractors</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalSubcontractors}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Professional Services</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalProfessionalServices}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Resource Cost</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.totalResourceCost)}</p>
            </div>
          </div>
        </div>

        {/* Equipment */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Equipment</h2>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Cost</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(equipment.totalCost)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Utilization</p>
              <p className="text-xl font-bold text-blue-600">{equipment.averageUtilization}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-xl font-bold text-gray-900">{equipment.items.length}</p>
            </div>
          </div>
          {equipment.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilization</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {equipment.items.map((item) => (
                    <tr key={item._id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.equipmentName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{item.equipmentType}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{item.status?.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {item.utilization?.utilizationPercentage?.toFixed(1) || 0}%
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(item.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No equipment data</p>
          )}
        </div>

        {/* Subcontractors */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subcontractors</h2>
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Paid</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(subcontractors.totalCost)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Performance</p>
              <p className="text-xl font-bold text-blue-600">{subcontractors.averagePerformance}/5</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Contracts</p>
              <p className="text-xl font-bold text-gray-900">{subcontractors.items.length}</p>
            </div>
          </div>
          {subcontractors.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subcontractor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contract Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subcontractors.items.map((item) => (
                    <tr key={item._id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.subcontractorName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{item.subcontractorType}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(item.contractValue)}</td>
                      <td className="px-4 py-3 text-sm text-blue-600">{formatCurrency(item.totalPaid)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.performance.average}/5</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No subcontractor data</p>
          )}
        </div>

        {/* Professional Services */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Professional Services</h2>
          <div className="mb-4">
            <p className="text-sm text-gray-600">Total Cost</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(professionalServices.totalCost)}</p>
          </div>
          {professionalServices.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Fees</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {professionalServices.items.map((item) => (
                    <tr key={item._id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.serviceName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{item.serviceType}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.providerName}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(item.totalFees)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No professional services data</p>
          )}
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resource Cost Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Equipment</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(costBreakdown.equipment.total)}</p>
              <p className="text-xs text-gray-500 mt-1">{costBreakdown.equipment.percentage}% of total</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Subcontractors</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(costBreakdown.subcontractors.total)}</p>
              <p className="text-xs text-gray-500 mt-1">{costBreakdown.subcontractors.percentage}% of total</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Professional Services</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(costBreakdown.professionalServices.total)}</p>
              <p className="text-xs text-gray-500 mt-1">{costBreakdown.professionalServices.percentage}% of total</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}


