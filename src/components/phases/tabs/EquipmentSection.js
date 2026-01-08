/**
 * Equipment Section Component
 * Displays equipment assigned to a phase
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function EquipmentSection({ phase, formatCurrency }) {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (phase?._id) {
      fetchEquipment();
    }
  }, [phase?._id]);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/equipment?phaseId=${phase._id}`);
      const data = await response.json();
      if (data.success) {
        setEquipment(data.data?.equipment || data.data || []);
        
        // Calculate statistics
        const equipmentStats = {
          total: data.data?.equipment?.length || 0,
          totalCost: (data.data?.equipment || []).reduce((sum, eq) => sum + (eq.totalCost || 0), 0),
          byStatus: {},
          byType: {},
          averageUtilization: 0
        };
        
        (data.data?.equipment || []).forEach(eq => {
          const status = eq.status || 'unknown';
          equipmentStats.byStatus[status] = (equipmentStats.byStatus[status] || 0) + 1;
          
          const type = eq.equipmentType || 'other';
          equipmentStats.byType[type] = (equipmentStats.byType[type] || 0) + 1;
        });
        
        // Calculate average utilization
        const totalUtilization = (data.data?.equipment || []).reduce((sum, eq) => 
          sum + (eq.utilization?.utilizationPercentage || 0), 0);
        equipmentStats.averageUtilization = equipmentStats.total > 0 
          ? totalUtilization / equipmentStats.total 
          : 0;
        
        setStats(equipmentStats);
      }
    } catch (err) {
      console.error('Fetch equipment error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'assigned': 'bg-blue-100 text-blue-800',
      'in_use': 'bg-green-100 text-green-800',
      'returned': 'bg-gray-100 text-gray-800',
      'maintenance': 'bg-yellow-100 text-yellow-800'
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
        <h3 className="text-lg font-semibold text-gray-900">Equipment</h3>
        <Link
          href={`/equipment/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Equipment
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading equipment...</p>
        </div>
      ) : stats && stats.total === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No equipment assigned to this phase</p>
          <Link
            href={`/equipment/new?projectId=${phase.projectId}&phaseId=${phase._id}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add First Equipment
          </Link>
        </div>
      ) : (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Equipment</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.total || 0}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(stats?.totalCost || 0)}
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">In Use</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {stats?.byStatus?.in_use || 0}
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Avg Utilization</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats?.averageUtilization?.toFixed(1) || 0}%
              </p>
            </div>
          </div>

          {/* Equipment List */}
          <div className="space-y-3">
            {equipment.slice(0, 5).map((eq) => (
              <div
                key={eq._id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Link
                        href={`/equipment/${eq._id}`}
                        className="font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {eq.equipmentName}
                      </Link>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(eq.status)}`}>
                        {eq.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Type:</span> {eq.equipmentType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Other'}
                      </div>
                      <div>
                        <span className="font-medium">Acquisition:</span> {eq.acquisitionType?.replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Cost:</span> {formatCurrency(eq.totalCost || 0)}
                      </div>
                      <div>
                        <span className="font-medium">Utilization:</span> {eq.utilization?.utilizationPercentage?.toFixed(1) || 0}%
                      </div>
                    </div>
                    {eq.startDate && (
                      <div className="mt-2 text-xs text-gray-500">
                        Period: {formatDate(eq.startDate)} - {eq.endDate ? formatDate(eq.endDate) : 'Ongoing'}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/equipment/${eq._id}`}
                    className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {equipment.length > 5 && (
            <div className="mt-4 text-center">
              <Link
                href={`/equipment?phaseId=${phase._id}`}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View all {equipment.length} equipment →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default EquipmentSection;


