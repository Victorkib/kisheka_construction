/**
 * Investor Detail Page
 * Displays full investor details with contributions and statements
 * 
 * Route: /investors/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { ImagePreview } from '@/components/uploads/image-preview';
import { LoadingButton, LoadingCard, LoadingSpinner, LoadingOverlay } from '@/components/loading';
import { StatementGenerator } from '@/components/investors/statement-generator';
import { AllocationManager } from '@/components/investors/allocation-manager';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal, RestoreModal } from '@/components/modals';
import { ArchiveBadge } from '@/components/badges';
import { useToast } from '@/components/toast';

export default function InvestorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const investorId = params?.id;
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [investor, setInvestor] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchingContributions, setFetchingContributions] = useState(false);
  const [showStatementGenerator, setShowStatementGenerator] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [newContribution, setNewContribution] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    type: 'EQUITY',
    notes: '',
    receiptUrl: '',
  });

  useEffect(() => {
    if (investorId) {
      fetchInvestor();
      fetchContributions();
    } else {
      setError('Invalid investor ID');
      setLoading(false);
    }
  }, [investorId]);

  const fetchInvestor = async () => {
    if (!investorId) {
      setError('Invalid investor ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/investors/${investorId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch investor');
      }

      setInvestor(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch investor error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContributions = async () => {
    if (!investorId) return;

    try {
      setFetchingContributions(true);
      const response = await fetch(`/api/investors/${investorId}/contributions`);
      const data = await response.json();

      if (data.success) {
        setContributions(data.data.contributions || []);
      }
    } catch (err) {
      console.error('Fetch contributions error:', err);
    } finally {
      setFetchingContributions(false);
    }
  };

  const handleAddContribution = async (e) => {
    e.preventDefault();
    
    if (!investorId) {
      toast.showError('Invalid investor ID');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/investors/${investorId}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContribution),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to add contribution');
      }

      await fetchInvestor();
      await fetchContributions();
      setNewContribution({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        type: 'EQUITY',
        notes: '',
        receiptUrl: '',
      });
      setShowAddForm(false);
      toast.showSuccess('Contribution added successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to add contribution');
      console.error('Add contribution error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenStatementGenerator = () => {
    setShowStatementGenerator(true);
  };

  const handleArchiveClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleArchiveConfirm = async () => {
    if (!investorId) {
      toast.showError('Invalid investor ID');
      return;
    }

    setArchiving(true);
    try {
      const response = await fetch(`/api/investors/${investorId}/archive`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to archive investor');
      }

      toast.showSuccess(data.message || 'Investor archived successfully!');
      setShowDeleteModal(false);
      await fetchInvestor();
    } catch (err) {
      toast.showError(err.message || 'Failed to archive investor');
      console.error('Archive investor error:', err);
    } finally {
      setArchiving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!investorId) {
      toast.showError('Invalid investor ID');
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/investors/${investorId}?force=true`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete investor');
      }

      toast.showSuccess(data.message || 'Investor permanently deleted successfully!');
      setShowDeleteModal(false);
      router.push('/investors');
    } catch (err) {
      toast.showError(err.message || 'Failed to delete investor');
      console.error('Delete investor error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestoreClick = () => {
    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = async () => {
    if (!investorId) {
      toast.showError('Invalid investor ID');
      return;
    }

    setRestoring(true);
    try {
      const response = await fetch(`/api/investors/${investorId}/restore`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to restore investor');
      }

      toast.showSuccess(data.message || 'Investor restored successfully!');
      setShowRestoreModal(false);
      await fetchInvestor();
    } catch (err) {
      toast.showError(err.message || 'Failed to restore investor');
      console.error('Restore investor error:', err);
    } finally {
      setRestoring(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-96"></div>
            </div>
            <LoadingCard count={2} showHeader={true} lines={6} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !investor) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || 'Investor not found'}
          </div>
          <Link href="/investors" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
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
            className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block"
          >
            ← Back to Investors
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">{investor.name}</h1>
                {investor.status === 'ARCHIVED' && <ArchiveBadge />}
              </div>
              <p className="mt-2 text-sm text-gray-700">
                {investor.email || 'No email'} {investor.phone && `• ${investor.phone}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleOpenStatementGenerator}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Generate Statement
              </button>
              {canAccess('manage_investors') && investor.status !== 'ARCHIVED' && (
                <>
                  <button
                    onClick={handleArchiveClick}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    Archive
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    Delete
                  </button>
                </>
              )}
              {canAccess('manage_investors') && investor.status === 'ARCHIVED' && (
                <>
                  <button
                    onClick={handleRestoreClick}
                    disabled={restoring}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {restoring ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete Permanently'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-base font-semibold text-gray-700 leading-normal">Total Invested</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(investor.totalInvested || 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-base font-semibold text-gray-700 leading-normal">Investment Type</div>
            <div className="text-xl font-semibold text-gray-900 mt-1">
              {investor.investmentType}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-base font-semibold text-gray-700 leading-normal">Status</div>
            <div className="text-xl font-semibold text-gray-900 mt-1">{investor.status}</div>
          </div>
        </div>

        {/* Investment Allocations */}
        <div className="mb-6">
          <AllocationManager
            investorId={investor._id}
            totalInvested={investor.totalInvested || 0}
            onUpdate={() => {
              // Refresh investor data after allocation update
              if (investorId) {
                fetchInvestor();
              }
            }}
          />
        </div>

        {/* Loan Terms (if applicable) */}
        {investor.loanTerms && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Loan Terms</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {investor.loanTerms.interestRate && (
                <div>
                  <div className="text-sm text-gray-700 font-medium mb-1">Interest Rate</div>
                  <div className="text-lg font-semibold text-gray-900">{investor.loanTerms.interestRate}%</div>
                </div>
              )}
              {investor.loanTerms.repaymentPeriod && (
                <div>
                  <div className="text-sm text-gray-700 font-medium mb-1">Repayment Period</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {investor.loanTerms.repaymentPeriod} months
                  </div>
                </div>
              )}
              {investor.loanTerms.startDate && (
                <div>
                  <div className="text-sm text-gray-700 font-medium mb-1">Start Date</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatDate(investor.loanTerms.startDate)}
                  </div>
                </div>
              )}
              {investor.loanTerms.endDate && (
                <div>
                  <div className="text-sm text-gray-700 font-medium mb-1">End Date</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatDate(investor.loanTerms.endDate)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contributions */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 relative">
          <LoadingOverlay 
            isLoading={isSubmitting || fetchingContributions} 
            message={isSubmitting ? "Adding contribution..." : "Loading contributions..."} 
            fullScreen={false} 
          />
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Contributions</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={isSubmitting || fetchingContributions}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {showAddForm ? 'Cancel' : '+ Add Contribution'}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddContribution} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Amount</label>
                  <input
                    type="number"
                    value={newContribution.amount}
                    onChange={(e) =>
                      setNewContribution({ ...newContribution, amount: e.target.value })
                    }
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Date</label>
                  <input
                    type="date"
                    value={newContribution.date}
                    onChange={(e) =>
                      setNewContribution({ ...newContribution, date: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Type</label>
                  <select
                    value={newContribution.type}
                    onChange={(e) =>
                      setNewContribution({ ...newContribution, type: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="EQUITY">Equity</option>
                    <option value="LOAN">Loan</option>
                    <option value="MIXED">Mixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Notes</label>
                  <input
                    type="text"
                    value={newContribution.notes}
                    onChange={(e) =>
                      setNewContribution({ ...newContribution, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <LoadingButton
                type="submit"
                isLoading={isSubmitting}
                loadingText="Adding..."
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add Contribution
              </LoadingButton>
            </form>
          )}

          {contributions.length === 0 ? (
            <div className="text-center text-gray-600 py-8">No contributions yet</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contributions.map((contrib, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(contrib.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(contrib.amount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{contrib.type}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{contrib.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Documents */}
        {investor.documents && investor.documents.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {investor.documents.map((doc, idx) => (
                <div key={idx} className="border border-gray-300 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium block"
                  >
                    {doc.fileName || `Document ${idx + 1}`}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Statement Generator Modal */}
      {showStatementGenerator && investor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <StatementGenerator
              investorId={investor?._id}
              investorName={investor?.name}
              onClose={() => setShowStatementGenerator(false)}
            />
          </div>
        </div>
      )}

      {/* Archive/Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => !deleting && !archiving && setShowDeleteModal(false)}
        onArchive={handleArchiveConfirm}
        onDelete={handleDeleteConfirm}
        title={investor?.status === 'ARCHIVED' ? 'Delete Investor Permanently' : 'Archive or Delete Investor'}
        message={
          investor ? (
            <>
              <p className="mb-3">
                {investor.status === 'ARCHIVED' ? (
                  <>
                    Are you sure you want to permanently delete <strong>"{investor.name}"</strong>?
                    <br />
                    <span className="text-red-600 font-medium">This action cannot be undone.</span>
                  </>
                ) : (
                  <>
                    What would you like to do with <strong>"{investor.name}"</strong>?
                  </>
                )}
              </p>
              {investor.status !== 'ARCHIVED' && (
                <>
                  <p className="mb-2 font-medium">Permanent deletion will:</p>
                  <ul className="list-disc list-inside mb-3 space-y-1 text-gray-600">
                    <li>Remove all project allocations</li>
                    <li>Recalculate finances for all affected projects</li>
                    <li>Permanently delete the investor record</li>
                  </ul>
                  {investor.projectAllocations && investor.projectAllocations.length > 0 && (
                    <p className="text-yellow-600 font-medium mb-2">
                      ⚠️ This investor has {investor.projectAllocations.length} project allocation(s).
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            'Are you sure you want to proceed?'
          )
        }
        archiveLabel="Archive"
        deleteLabel="Delete Permanently"
        cancelText="Cancel"
        variant={investor?.status === 'ARCHIVED' ? 'danger' : 'both'}
        isArchiving={archiving}
        isDeleting={deleting}
        showRecommendation={investor?.status !== 'ARCHIVED' && investor?.projectAllocations && investor.projectAllocations.length > 0}
        dependencies={investor?.projectAllocations ? { allocations: investor.projectAllocations.length } : null}
      />

      {/* Restore Modal */}
      <RestoreModal
        isOpen={showRestoreModal}
        onClose={() => !restoring && setShowRestoreModal(false)}
        onRestore={handleRestoreConfirm}
        title="Restore Investor"
        message="Are you sure you want to restore this investor? Project finances will be recalculated for all affected projects."
        itemName={investor?.name}
        isLoading={restoring}
      />
    </AppLayout>
  );
}

