/**
 * Investor Detail Page
 * Displays full investor details with contributions and statements
 * 
 * Route: /investors/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { ImagePreview } from '@/components/uploads/image-preview';
import { LoadingButton, LoadingCard, LoadingSpinner, LoadingOverlay } from '@/components/loading';
import { StatementGenerator } from '@/components/investors/statement-generator';
import { EnhancedAllocationManager } from '@/components/investors/enhanced-allocation-manager';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal, RestoreModal } from '@/components/modals';
import { ArchiveBadge } from '@/components/badges';
import { useToast } from '@/components/toast';

export default function InvestorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const investorId = params?.id;
  const returnTo = searchParams.get('returnTo');
  const returnProjectId = searchParams.get('projectId');
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [investor, setInvestor] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchingContributions, setFetchingContributions] = useState(false);
  const [reconciling, setReconciling] = useState(false);
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

      const response = await fetch(`/api/investors/${investorId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
      const response = await fetch(`/api/investors/${investorId}/contributions`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
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

  const handleReconcileContributions = async () => {
    if (!investorId) {
      toast.showError('Invalid investor ID');
      return;
    }

    setReconciling(true);
    try {
      const response = await fetch(`/api/investors/${investorId}/reconcile`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reconcile contributions');
      }

      toast.showSuccess(data.message || 'Contributions reconciled successfully!');
      await fetchInvestor();
      await fetchContributions();
    } catch (err) {
      toast.showError(err.message || 'Failed to reconcile contributions');
      console.error('Reconcile contributions error:', err);
    } finally {
      setReconciling(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!investorId) {
      toast.showError('Invalid investor ID');
      return;
    }

    setArchiving(true);
    try {
      const response = await fetch(`/api/investors/${investorId}/archive`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
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
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
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
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
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
              <div className="h-8 ds-bg-surface-muted rounded w-64 mb-2"></div>
              <div className="h-4 ds-bg-surface-muted rounded w-96"></div>
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
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded text-sm sm:text-base">
            {error || 'Investor not found'}
          </div>
          <Link href="/investors" className="mt-4 inline-block text-blue-600 hover:text-blue-800 active:text-blue-900 text-sm sm:text-base transition-colors touch-manipulation">
            ← Back to Investors
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {returnTo && (
          <div className="mb-6 rounded-lg border border-blue-400/60 bg-blue-50 px-4 py-3 text-blue-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-semibold">Return to bulk material request</p>
                <p className="text-xs">Allocate funds, then jump back to continue supplier assignment.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {returnProjectId && (
                  <Link
                    href={`/financing?projectId=${returnProjectId}&returnTo=${encodeURIComponent(returnTo)}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-400/60 ds-bg-surface text-blue-800 hover:bg-blue-100"
                  >
                    View Financing
                  </Link>
                )}
                <Link
                  href={returnTo}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-400/60 ds-bg-surface text-blue-800 hover:bg-blue-100"
                >
                  Back to Bulk Request
                </Link>
              </div>
            </div>
          </div>
        )}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/investors"
            className="text-blue-600 hover:text-blue-800 active:text-blue-900 text-sm font-medium mb-4 inline-block transition-colors touch-manipulation"
          >
            ← Back to Investors
          </Link>
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight break-words">{investor.name}</h1>
                {investor.status === 'ARCHIVED' && <ArchiveBadge />}
              </div>
              <p className="mt-2 text-xs sm:text-sm ds-text-secondary break-words">
                {investor.email || 'No email'} {investor.phone && <span className="block sm:inline sm:ml-2 mt-1 sm:mt-0">• {investor.phone}</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 w-full md:w-auto">
              <button
                onClick={handleOpenStatementGenerator}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors text-sm font-medium touch-manipulation"
              >
                Generate Statement
              </button>
              {canAccess('manage_investors') && investor.status !== 'ARCHIVED' && (
                <>
                  <button
                    onClick={handleArchiveClick}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 active:bg-slate-800 transition-colors text-sm font-medium touch-manipulation"
                  >
                    Archive
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors text-sm font-medium touch-manipulation"
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
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50 text-sm font-medium touch-manipulation"
                  >
                    {restoring ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    disabled={deleting}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-50 text-sm font-medium touch-manipulation"
                  >
                    {deleting ? 'Deleting...' : 'Delete Permanently'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
          <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6">
            <div className="text-sm sm:text-base font-semibold ds-text-secondary leading-normal">Total Invested</div>
            <div className="text-xl sm:text-2xl font-bold ds-text-primary mt-1">
              {formatCurrency(investor.totalInvested || 0)}
            </div>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6">
            <div className="text-sm sm:text-base font-semibold ds-text-secondary leading-normal">Investment Type</div>
            <div className="text-lg sm:text-xl font-semibold ds-text-primary mt-1">
              {investor.investmentType}
            </div>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6">
            <div className="text-sm sm:text-base font-semibold ds-text-secondary leading-normal">Status</div>
            <div className="text-lg sm:text-xl font-semibold ds-text-primary mt-1">{investor.status}</div>
          </div>
        </div>

        {canAccess('manage_investors') && investor && contributions.length > 0 && (
          (() => {
            const contributionsTotal = contributions
              .filter((entry) => entry.type !== 'RETURN')
              .reduce((sum, entry) => sum + (entry.amount || 0), 0);
            const totalInvested = investor.totalInvested || 0;
            const delta = totalInvested - contributionsTotal;
            if (Math.abs(delta) < 0.01) return null;
            return (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs sm:text-sm text-amber-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">Data mismatch detected.</span> Contributions total {formatCurrency(contributionsTotal)} but Total Invested is {formatCurrency(totalInvested)}.
                </div>
                <button
                  onClick={handleReconcileContributions}
                  disabled={reconciling}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700 active:bg-amber-800 disabled:opacity-60 text-sm touch-manipulation"
                >
                  {reconciling ? 'Reconciling...' : 'Reconcile Contributions'}
                </button>
              </div>
            );
          })()
        )}

        {/* Investment Allocations */}
        <div className="mb-6">
          <EnhancedAllocationManager
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
          <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 mb-6">
            <h2 className="text-base sm:text-lg font-semibold ds-text-primary mb-4">Loan Terms</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {investor.loanTerms.interestRate && (
                <div>
                  <div className="text-sm ds-text-secondary font-medium mb-1">Interest Rate</div>
                  <div className="text-lg font-semibold ds-text-primary">{investor.loanTerms.interestRate}%</div>
                </div>
              )}
              {investor.loanTerms.repaymentPeriod && (
                <div>
                  <div className="text-sm ds-text-secondary font-medium mb-1">Repayment Period</div>
                  <div className="text-lg font-semibold ds-text-primary">
                    {investor.loanTerms.repaymentPeriod} months
                  </div>
                </div>
              )}
              {investor.loanTerms.startDate && (
                <div>
                  <div className="text-sm ds-text-secondary font-medium mb-1">Start Date</div>
                  <div className="text-lg font-semibold ds-text-primary">
                    {formatDate(investor.loanTerms.startDate)}
                  </div>
                </div>
              )}
              {investor.loanTerms.endDate && (
                <div>
                  <div className="text-sm ds-text-secondary font-medium mb-1">End Date</div>
                  <div className="text-lg font-semibold ds-text-primary">
                    {formatDate(investor.loanTerms.endDate)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contributions */}
        <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 mb-6 relative">
          <LoadingOverlay 
            isLoading={isSubmitting || fetchingContributions} 
            message={isSubmitting ? "Adding contribution..." : "Loading contributions..."} 
            fullScreen={false} 
          />
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4">
            <h2 className="text-base sm:text-lg font-semibold ds-text-primary">Contributions</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              disabled={isSubmitting || fetchingContributions}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {showAddForm ? 'Cancel' : '+ Add Contribution'}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddContribution} className="mb-6 p-4 ds-bg-surface-muted rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">Amount</label>
                  <input
                    type="number"
                    value={newContribution.amount}
                    onChange={(e) =>
                      setNewContribution({ ...newContribution, amount: e.target.value })
                    }
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
                  />
                </div>
                <div>
                  <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={newContribution.date}
                      onChange={(e) =>
                        setNewContribution({ ...newContribution, date: e.target.value })
                      }
                      required
                      className="w-full px-3 pr-12 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer touch-manipulation"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        const input = e.target.closest('.relative').querySelector('input[type="date"]');
                        if (input) {
                          input.showPicker?.();
                          input.focus();
                        }
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-auto cursor-pointer hover:ds-bg-surface-muted rounded-r-lg transition-colors"
                      aria-label="Open date picker"
                      tabIndex={-1}
                    >
                      <svg className="w-5 h-5 ds-text-secondary hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">Type</label>
                  <select
                    value={newContribution.type}
                    onChange={(e) =>
                      setNewContribution({ ...newContribution, type: e.target.value })
                    }
                    required
                    className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
                  >
                    <option value="EQUITY">Equity</option>
                    <option value="LOAN">Loan</option>
                    <option value="MIXED">Mixed</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">Notes</label>
                  <input
                    type="text"
                    value={newContribution.notes}
                    onChange={(e) =>
                      setNewContribution({ ...newContribution, notes: e.target.value })
                    }
                    className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
                  />
                </div>
              </div>
              <LoadingButton
                type="submit"
                isLoading={isSubmitting}
                loadingText="Adding..."
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-sm font-medium touch-manipulation"
              >
                Add Contribution
              </LoadingButton>
            </form>
          )}

          {contributions.length === 0 ? (
            <div className="text-center ds-text-secondary py-8 text-sm sm:text-base">No contributions yet</div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wide">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wide">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wide">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wide">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {contributions.map((contrib, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          {formatDate(contrib.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-primary">
                          {formatCurrency(contrib.amount || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">{contrib.type}</td>
                        <td className="px-6 py-4 text-sm ds-text-secondary">{contrib.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {contributions.map((contrib, idx) => (
                  <div key={idx} className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold ds-text-primary">{formatCurrency(contrib.amount || 0)}</p>
                        <p className="text-xs ds-text-secondary mt-1">{formatDate(contrib.date)}</p>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {contrib.type}
                      </span>
                    </div>
                    {contrib.notes && (
                      <p className="text-sm ds-text-secondary mt-2">{contrib.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Documents */}
        {investor.documents && investor.documents.length > 0 && (
          <div className="ds-bg-surface rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold ds-text-primary mb-4">Documents</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {investor.documents.map((doc, idx) => (
                <div key={idx} className="border ds-border-subtle rounded-lg p-4 ds-bg-surface-muted hover:ds-bg-surface-muted transition">
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
          <div className="ds-bg-surface rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                  <ul className="list-disc list-inside mb-3 space-y-1 ds-text-secondary">
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

