/**
 * Supervisor Submissions Page
 * List all supervisor submissions
 * 
 * Route: /labour/supervisor-submissions
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { MessageSquare, Mail, Phone, FileText, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';

// Force dynamic rendering for pages using useSearchParams
export const dynamic = 'force-dynamic';

function SupervisorSubmissionsPageContent() {
  const router = useRouter();
  // Use useSearchParams to ensure Suspense boundary is recognized
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    channel: 'all',
    search: '',
  });

  useEffect(() => {
    fetchSubmissions();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [submissions, filters]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/labour/supervisor-submissions?limit=100', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setSubmissions(data.data?.submissions || []);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
      toast.showError('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const filterSubmissions = () => {
    let filtered = [...submissions];

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter((sub) => sub.status === filters.status);
    }

    // Channel filter
    if (filters.channel !== 'all') {
      filtered = filtered.filter((sub) => sub.submissionChannel === filters.channel);
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (sub) =>
          sub.submissionNumber?.toLowerCase().includes(searchLower) ||
          sub.submittedBy?.toLowerCase().includes(searchLower) ||
          sub.submissionData?.senderInfo?.name?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredSubmissions(filtered);
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'sms':
        return <Phone className="w-4 h-4" />;
      case 'in_person':
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { bg: 'ds-bg-surface-muted', text: 'ds-text-primary', label: 'Draft' },
      pending_review: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending Review' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
      processed: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Processed' },
    };

    const badge = badges[status] || badges.draft;

    return (
      <span className={`px-2 py-1 text-xs rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading submissions..." />
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
          <h1 className="text-3xl font-bold ds-text-primary">Supervisor Submissions</h1>
          <p className="ds-text-secondary mt-1">Review and approve labour data from supervisors</p>
        </div>

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search by submission number or supervisor..."
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
              />
            </div>
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">Channel</label>
              <select
                value={filters.channel}
                onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Channels</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="in_person">In-Person</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submissions List */}
        {filteredSubmissions.length === 0 ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <p className="ds-text-secondary mb-4">No submissions found</p>
            <p className="text-sm ds-text-muted">
              Supervisor submissions will appear here when received via WhatsApp, Email, SMS, or in-person.
            </p>
          </div>
        ) : (
          <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-ds-border-subtle">
              <thead className="ds-bg-surface-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                    Submission
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                    Channel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                    Supervisor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                    Work Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                    Entries
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                {filteredSubmissions.map((submission) => {
                  const entryCount = submission.labourEntries?.length || 0;
                  const totalCost = submission.totals?.totalCost || 0;

                  return (
                    <tr key={submission._id} className="hover:ds-bg-surface-muted">
                      <td className="px-4 py-3 text-sm font-medium ds-text-primary">
                        {submission.submissionNumber}
                      </td>
                      <td className="px-4 py-3 text-sm ds-text-secondary">
                        <div className="flex items-center gap-2">
                          {getChannelIcon(submission.submissionChannel)}
                          <span className="capitalize">{submission.submissionChannel.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm ds-text-secondary">
                        {submission.submittedBy}
                      </td>
                      <td className="px-4 py-3 text-sm ds-text-secondary">
                        {submission.workItemName || 'Unlinked'}
                      </td>
                      <td className="px-4 py-3 text-sm ds-text-secondary">
                        {entryCount} worker{entryCount !== 1 ? 's' : ''}
                        {totalCost > 0 && (
                          <div className="text-xs ds-text-muted">
                            {totalCost.toLocaleString()} KES
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm ds-text-secondary">
                        {new Date(submission.entryDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getStatusBadge(submission.status)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          href={`/labour/supervisor-submissions/${submission._id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                        >
                          <Eye className="w-4 h-4" />
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function SupervisorSubmissionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center ds-bg-surface-muted">
        <div className="text-center">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      </div>
    }>
      <SupervisorSubmissionsPageContent />
    </Suspense>
  );
}

