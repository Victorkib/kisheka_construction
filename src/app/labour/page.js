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
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import { useLabourPrerequisites } from '@/hooks/use-labour-prerequisites';
import {
  Plus,
  Clock,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle,
  FileText,
} from 'lucide-react';

export default function LabourDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [recentEntries, setRecentEntries] = useState([]);
  const [budgetAlerts, setBudgetAlerts] = useState([]);
  
  // Check prerequisites
  const {
    prerequisiteDetails,
    loading: prerequisitesLoading,
    canProceed,
  } = useLabourPrerequisites('dashboard');

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
        `/api/labour/entries?dateFrom=${todayStart.toISOString()}&dateTo=${todayEnd.toISOString()}&limit=50`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }
      );

      if (!entriesResponse.ok) {
        throw new Error(`HTTP error! status: ${entriesResponse.status}`);
      }

      const entriesData = await entriesResponse.json();

      if (!entriesData.success) {
        throw new Error(entriesData.error || 'Failed to fetch entries');
      }

      const entries = entriesData.data?.entries || [];
      
      // Process entries to ensure data consistency
      const processedEntries = entries.map((entry) => ({
        ...entry,
        totalHours: typeof entry.totalHours === 'number' ? entry.totalHours : parseFloat(entry.totalHours) || 0,
        totalCost: typeof entry.totalCost === 'number' ? entry.totalCost : parseFloat(entry.totalCost) || 0,
        workerName: entry.workerName || 'Unknown Worker',
        skillType: entry.skillType || 'general_worker',
        status: entry.status || 'draft',
        entryDate: entry.entryDate ? new Date(entry.entryDate) : new Date(),
      }));

      setRecentEntries(processedEntries.slice(0, 10)); // Show last 10

      // Calculate summary - ensure numbers are properly handled
      const todaySummary = entriesData.data?.summary || {
        totalHours: 0,
        totalCost: 0,
        entryCount: 0,
      };

      // Ensure summary values are numbers
      const processedSummary = {
        totalHours: typeof todaySummary.totalHours === 'number' 
          ? todaySummary.totalHours 
          : parseFloat(todaySummary.totalHours) || 0,
        totalCost: typeof todaySummary.totalCost === 'number' 
          ? todaySummary.totalCost 
          : parseFloat(todaySummary.totalCost) || 0,
        entryCount: typeof todaySummary.entryCount === 'number' 
          ? todaySummary.entryCount 
          : parseInt(todaySummary.entryCount) || 0,
      };

      // Count unique workers - handle both workerId (ObjectId or string) and workerName
      // Use workerName as primary identifier since workerId can be null for external workers
      const uniqueWorkers = new Set();
      processedEntries.forEach((entry) => {
        // Prefer workerName, fallback to workerId if workerName is missing
        const workerIdentifier = entry.workerName || 
          (entry.workerId ? (typeof entry.workerId === 'string' ? entry.workerId : entry.workerId.toString()) : null);
        if (workerIdentifier) {
          uniqueWorkers.add(workerIdentifier);
        }
      });

      setSummary({
        today: processedSummary,
        workersActive: uniqueWorkers.size,
      });

      // TODO: Fetch budget alerts (will be implemented in Phase 5)
      setBudgetAlerts([]);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      toast.showError(err.message || 'Failed to load dashboard data');
      // Set empty state on error
      setSummary({
        today: { totalHours: 0, totalCost: 0, entryCount: 0 },
        workersActive: 0,
      });
      setRecentEntries([]);
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
          <h1 className="text-3xl font-bold ds-text-primary">Labour Dashboard</h1>
          <p className="ds-text-secondary mt-1">
            Track and manage all labour activities
          </p>
        </div>

        {/* Prerequisites Guide */}
        {!prerequisitesLoading && (
          <PrerequisiteGuide
            title="Before you start tracking labour"
            description="Labour tracking links workers to projects, phases, and work items. Set up the foundation first."
            prerequisiteDetails={prerequisiteDetails}
            canProceed={canProceed}
            tip="Start by creating a project and adding phases. Then add workers and work items for complete labour tracking."
          />
        )}

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
              <div className="text-sm text-green-100">
                Create multiple entries
              </div>
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

          <Link
            href="/labour/site-reports/new"
            className="flex items-center gap-3 p-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <FileText className="w-6 h-6" />
            <div>
              <div className="font-semibold">Site Report</div>
              <div className="text-sm text-indigo-100">Log site updates</div>
            </div>
          </Link>
        </div>

        {/* Today's Summary */}
        {summary && (
          <div className="ds-bg-surface rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold ds-text-primary mb-4">
              Today's Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium ds-text-secondary">
                    Total Hours
                  </span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {(summary.today.totalHours || 0).toFixed(1)} hrs
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium ds-text-secondary">
                    Total Cost
                  </span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {(summary.today.totalCost || 0).toLocaleString()} KES
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium ds-text-secondary">
                    Active Workers
                  </span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {summary.workersActive}
                </div>
              </div>

              <div className="p-4 ds-bg-surface-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 ds-text-secondary" />
                  <span className="text-sm font-medium ds-text-secondary">
                    Entries
                  </span>
                </div>
                <div className="text-2xl font-bold ds-text-secondary">
                  {summary.today.entryCount || 0}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Budget Alerts */}
        {budgetAlerts.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-400/60 rounded-lg p-4 mb-6">
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
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold ds-text-primary">
              Recent Entries
            </h2>
            <Link
              href="/labour/entries"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View All →
            </Link>
          </div>

          {recentEntries.length === 0 ? (
            <div className="text-center py-8 ds-text-muted">
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
              <table className="min-w-full divide-y divide-ds-border-subtle">
                <thead className="ds-bg-surface-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                      Worker
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                      Skill
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                      Hours
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                  {recentEntries.map((entry) => (
                    <tr key={entry._id} className="hover:ds-bg-surface-muted">
                      <td className="px-4 py-3 text-sm ds-text-primary">
                        {entry.workerName}
                      </td>
                      <td className="px-4 py-3 text-sm ds-text-secondary">
                        {entry.skillType ? entry.skillType.replace(/_/g, ' ') : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm ds-text-secondary">
                        {(entry.totalHours || 0).toFixed(1)} hrs
                      </td>
                      <td className="px-4 py-3 text-sm font-medium ds-text-primary">
                        {(entry.totalCost || 0).toLocaleString()} KES
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            entry.status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : entry.status === 'paid'
                                ? 'bg-blue-100 text-blue-800'
                                : entry.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {entry.status || 'draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm ds-text-secondary">
                        {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString() : 'N/A'}
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
