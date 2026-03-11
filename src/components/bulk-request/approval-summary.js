/**
 * Approval Summary Component
 * Shows summary of approval decisions and status
 */

'use client';

export function ApprovalSummary({ batch, materialRequests = [] }) {
  const totalRequests = materialRequests.length;
  const approvedCount = materialRequests.filter((req) => req.status === 'approved').length;
  const rejectedCount = materialRequests.filter((req) => req.status === 'rejected').length;
  const pendingCount = materialRequests.filter((req) =>
    ['requested', 'pending_approval'].includes(req.status)
  ).length;

  const totalEstimatedCost = materialRequests.reduce((sum, req) => {
    return sum + (req.estimatedCost || 0);
  }, 0);

  const approvedCost = materialRequests
    .filter((req) => req.status === 'approved')
    .reduce((sum, req) => {
      return sum + (req.estimatedCost || 0);
    }, 0);

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'KES 0';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = () => {
    if (batch.status === 'approved') return 'bg-green-50 border-green-400/60';
    if (batch.status === 'cancelled') return 'bg-red-50 border-red-400/60';
    if (pendingCount > 0) return 'bg-yellow-50 border-yellow-400/60';
    return 'ds-bg-surface-muted ds-border-subtle';
  };

  return (
    <div className={`rounded-lg border p-6 ${getStatusColor()}`}>
      <h3 className="text-lg font-semibold ds-text-primary mb-4">Approval Summary</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-sm ds-text-secondary">Total Requests</p>
          <p className="text-2xl font-bold ds-text-primary">{totalRequests}</p>
        </div>
        <div>
          <p className="text-sm text-green-700">Approved</p>
          <p className="text-2xl font-bold text-green-900">{approvedCount}</p>
        </div>
        <div>
          <p className="text-sm text-red-700">Rejected</p>
          <p className="text-2xl font-bold text-red-900">{rejectedCount}</p>
        </div>
        <div>
          <p className="text-sm text-yellow-700">Pending</p>
          <p className="text-2xl font-bold text-yellow-900">{pendingCount}</p>
        </div>
      </div>
      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm ds-text-secondary">Total Estimated Cost</p>
            <p className="text-xl font-bold ds-text-primary">{formatCurrency(totalEstimatedCost)}</p>
          </div>
          <div>
            <p className="text-sm text-green-700">Approved Cost</p>
            <p className="text-xl font-bold text-green-900">{formatCurrency(approvedCost)}</p>
          </div>
        </div>
      </div>
      {batch.approvedAt && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm ds-text-secondary">
            Approved by: <span className="font-medium">{batch.approvedByName || 'N/A'}</span>
          </p>
          <p className="text-sm ds-text-secondary">
            Approved at:{' '}
            <span className="font-medium">
              {new Date(batch.approvedAt).toLocaleString('en-KE')}
            </span>
          </p>
          {batch.approvalNotes && (
            <p className="text-sm ds-text-secondary mt-2">
              Notes: <span className="font-medium">{batch.approvalNotes}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

