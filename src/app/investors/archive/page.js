/**
 * Archived Investors List Page
 * Displays all archived investors with restore and permanent delete options
 * 
 * Route: /investors/archive
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingSpinner } from '@/components/loading';
import { ArchiveBadge } from '@/components/badges';
import { ConfirmationModal, RestoreModal } from '@/components/modals';
import { useToast } from '@/components/toast';

function ArchivedInvestorsPageContent() {
  const router = useRouter();
  const toast = useToast();
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState(null);

  useEffect(() => {
    fetchUser();
    fetchInvestors();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        const role = data.data.role?.toLowerCase();
        setCanManage(role === 'owner');
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchInvestors = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/investors?archived=true');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch archived investors');
      }

      setInvestors(data.data?.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Fetch archived investors error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = (investor) => {
    setSelectedInvestor(investor);
    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedInvestor) return;

    setRestoring(true);
    try {
      const response = await fetch(`/api/investors/${selectedInvestor._id}/restore`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to restore investor');
      }

      toast.showSuccess(data.message || 'Investor restored successfully!');
      setShowRestoreModal(false);
      setSelectedInvestor(null);
      await fetchInvestors();
    } catch (err) {
      toast.showError(err.message || 'Failed to restore investor');
      console.error('Restore investor error:', err);
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteClick = (investor) => {
    setSelectedInvestor(investor);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedInvestor) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/investors/${selectedInvestor._id}?force=true`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete investor');
      }

      toast.showSuccess(data.message || 'Investor permanently deleted successfully!');
      setShowDeleteModal(false);
      setSelectedInvestor(null);
      await fetchInvestors();
    } catch (err) {
      toast.showError(err.message || 'Failed to delete investor');
      console.error('Delete investor error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable rows={5} columns={5} />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
          <Link href="/investors" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Investors
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/investors"
            className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block"
          >
            ← Back to Investors
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Archived Investors</h1>
              <p className="text-gray-600 mt-1">
                {investors.length} archived investor{investors.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {investors.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No archived investors</h3>
            <p className="mt-1 text-sm text-gray-600">There are no archived investors at this time.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Investor
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Total Invested
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Investment Type
                    </th>
                    {canManage && (
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {investors.map((investor) => (
                    <tr key={investor._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/investors/${investor._id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-900"
                        >
                          {investor.name}
                        </Link>
                        <p className="text-sm text-gray-600">{investor.email}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <ArchiveBadge />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(investor.totalInvested || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {investor.investmentType}
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleRestoreClick(investor)}
                              disabled={restoring}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handleDeleteClick(investor)}
                              disabled={deleting}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <RestoreModal
          isOpen={showRestoreModal}
          onClose={() => !restoring && setShowRestoreModal(false)}
          onRestore={handleRestoreConfirm}
          title="Restore Investor"
          message="Are you sure you want to restore this investor? Project finances will be recalculated for all affected projects."
          itemName={selectedInvestor?.name}
          isLoading={restoring}
        />

        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => !deleting && setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Investor Permanently"
          message={
            selectedInvestor ? (
              <>
                <p className="mb-3">
                  Are you sure you want to permanently delete <strong>"{selectedInvestor.name}"</strong>?
                </p>
                <p className="text-red-600 font-medium">This action cannot be undone.</p>
              </>
            ) : (
              'Are you sure you want to proceed?'
            )
          }
          confirmText="Delete Permanently"
          cancelText="Cancel"
          variant="danger"
          isLoading={deleting}
        />
      </div>
    </AppLayout>
  );
}

export default function ArchivedInvestorsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading archived investors...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <ArchivedInvestorsPageContent />
    </Suspense>
  );
}

