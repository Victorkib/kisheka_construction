/**
 * Labour Dashboard Page
 * Main dashboard for labour tracking
 * 
 * Route: /labour
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { useToast } from '@/components/toast/toast-container';
import { Plus, Clock, DollarSign, Users, AlertTriangle, CheckCircle, FileText } from 'lucide-react';

export default function LabourDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [recentEntries, setRecentEntries] = useState([]);
  const [budgetAlerts, setBudgetAlerts] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0];
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      // Fetch today's entries
      const entriesResponse = await fetch(
        `/api/labour/entries?dateFrom=${todayStart.toISOString()}&dateTo=${todayEnd.toISOString()}&limit=50`
      );
      const entriesData = await entriesResponse.json();

      if (entriesData.success) {
        const entries = entriesData.data?.entries || [];
        setRecentEntries(entries.slice(0, 10)); // Show last 10

        // Calculate summary
        const todaySummary = entriesData.data?.summary || {
          totalHours: 0,
          totalCost: 0,
          entryCount: 0,
        };

        setSummary({
          today: todaySummary,
          workersActive: new Set(entries.map((e) => e.workerId || e.workerName)).size,
        });
      }

      // TODO: Fetch budget alerts (will be implemented in Phase 5)
      setBudgetAlerts([]);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      toast.showError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading labour dashboard..." />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Labour Dashboard</h1>
          <p className="text-gray-600 mt-1">Track and manage all labour activities</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Link
            href="/labour/entries/new"
            className="flex items-center gap-3 p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-6 h-6" />
            <div>
              <div className="font-semibold">Quick Entry</div>
              <div className="text-sm text-blue-100">Create single entry</div>
            </div>
          </Link>

          <Link
            href="/labour/batches/new"
            className="flex items-center gap-3 p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Users className="w-6 h-6" />
            <div>
              <div className="font-semibold">Bulk Entry</div>
              <div className="text-sm text-green-100">Create multiple entries</div>
            </div>
          </Link>

          <Link
            href="/labour/batches"
            className="flex items-center gap-3 p-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <FileText className="w-6 h-6" />
            <div>
              <div className="font-semibold">View Batches</div>
              <div className="text-sm text-orange-100">Browse all batches</div>
            </div>
          </Link>

          <Link
            href="/labour/templates"
            className="flex items-center gap-3 p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Clock className="w-6 h-6" />
            <div>
              <div className="font-semibold">Templates</div>
              <div className="text-sm text-purple-100">Use saved templates</div>
            </div>
          </Link>
        </div>

        {/* Today's Summary */}
        {summary && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Total Hours</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {summary.today.totalHours.toFixed(1)} hrs
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Total Cost</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {summary.today.totalCost.toLocaleString()} KES
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Active Workers</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {summary.workersActive}
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Entries</span>
                </div>
                <div className="text-2xl font-bold text-gray-600">
                  {summary.today.entryCount}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Budget Alerts */}
        {budgetAlerts.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-yellow-900">Budget Alerts</h3>
            </div>
            <ul className="space-y-2">
              {budgetAlerts.map((alert, index) => (
                <li key={index} className="text-sm text-yellow-800">
                  {alert.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recent Entries */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Entries</h2>
            <Link
              href="/labour/entries"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View All →
            </Link>
          </div>

          {recentEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No labour entries for today</p>
              <Link
                href="/labour/entries/new"
                className="text-blue-600 hover:text-blue-800 mt-2 inline-block"
              >
                Create your first entry
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Worker
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Skill
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Hours
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentEntries.map((entry) => (
                    <tr key={entry._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {entry.workerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.skillType?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.totalHours?.toFixed(1)} hrs
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {entry.totalCost?.toLocaleString()} KES
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            entry.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : entry.status === 'paid'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(entry.entryDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

