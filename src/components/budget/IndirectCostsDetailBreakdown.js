/**
 * Indirect Costs Detail Breakdown Component
 * Shows detailed breakdown of indirect costs from both expenses and labour entries
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function IndirectCostsDetailBreakdown({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('combined'); // combined, expenses, labour

  useEffect(() => {
    if (projectId) {
      fetchIndirectCostsDetail();
    }
  }, [projectId]);

  const fetchIndirectCostsDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      const [indirectCostsRes, labourCostsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/indirect-costs`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/labour/indirect-costs?projectId=${projectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
      ]);

      const indirectCostsData = await indirectCostsRes.json();
      const labourCostsData = await labourCostsRes.json();

      if (!indirectCostsData.success || !labourCostsData.success) {
        throw new Error('Failed to fetch indirect costs details');
      }

      setData({
        expenses: indirectCostsData.data,
        labour: labourCostsData.data
      });
    } catch (err) {
      console.error('Fetch indirect costs detail error:', err);
      setError(err.message || 'Failed to load indirect costs details');
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

  const categoryLabels = {
    utilities: '⚡ Utilities',
    siteOverhead: '🏢 Site Overhead',
    transportation: '🚚 Transportation',
    safetyCompliance: '🛡️ Safety & Compliance',
  };

  if (loading) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 ds-bg-surface-muted rounded w-1/3"></div>
          <div className="h-4 ds-bg-surface-muted rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-3 ds-bg-surface-muted rounded"></div>
            <div className="h-3 ds-bg-surface-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6 border-2 border-red-400/60">
        <div className="text-red-600">
          <p className="font-semibold mb-2">Error loading details</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const expensesTotal = data.expenses?.spent || 0;
  const labourTotal = data.labour?.summary?.totalCost || 0;
  const combinedTotal = expensesTotal + labourTotal;

  const renderCategoryBreakdown = (byCategory) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {Object.entries(byCategory).map(([category, info]) => {
          const amount = info.total || info;
          const percentage = combinedTotal > 0 ? (amount / combinedTotal) * 100 : 0;
          
          return (
            <div key={category} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border ds-border-subtle">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold ds-text-primary">
                  {categoryLabels[category] || category}
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(amount)}
                </span>
              </div>
              <div className="w-full ds-bg-surface-muted rounded-full h-2 mb-2">
                <div
                  className="bg-gradient-to-r from-blue-600 to-blue-400 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, percentage)}%` }}
                ></div>
              </div>
              <p className="text-xs ds-text-secondary">
                {percentage.toFixed(1)}% of total indirect costs {info.count && `(${info.count} items)`}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ds-bg-surface rounded-lg shadow p-4 border-l-4 border-blue-600">
          <p className="text-xs ds-text-secondary uppercase tracking-wide mb-1">Expenses</p>
          <p className="text-2xl font-bold ds-text-primary">{formatCurrency(expensesTotal)}</p>
          <p className="text-xs ds-text-muted mt-2">From approved indirect cost expenses</p>
        </div>

        <div className="ds-bg-surface rounded-lg shadow p-4 border-l-4 border-green-600">
          <p className="text-xs ds-text-secondary uppercase tracking-wide mb-1">Labour</p>
          <p className="text-2xl font-bold ds-text-primary">{formatCurrency(labourTotal)}</p>
          <p className="text-xs ds-text-muted mt-2">From {data.labour?.summary?.entryCount || 0} indirect labour entries ({data.labour?.summary?.totalHours || 0} hrs)</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-4 border-l-4 border-blue-800">
          <p className="text-xs ds-text-secondary uppercase tracking-wide font-semibold mb-1">Total Indirect</p>
          <p className="text-2xl font-bold text-blue-900">{formatCurrency(combinedTotal)}</p>
          <p className="text-xs ds-text-secondary mt-2">Combined expenses + labour</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
        <div className="flex border-b ds-border-subtle">
          <button
            onClick={() => setActiveTab('combined')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === 'combined'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'ds-text-secondary hover:ds-text-primary'
            }`}
          >
            Combined View
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === 'expenses'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'ds-text-secondary hover:ds-text-primary'
            }`}
          >
            Expenses Only
          </button>
          <button
            onClick={() => setActiveTab('labour')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition ${
              activeTab === 'labour'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'ds-text-secondary hover:ds-text-primary'
            }`}
          >
            Labour Entries
          </button>
        </div>

        <div className="p-6">
          {/* Combined View */}
          {activeTab === 'combined' && (
            <div>
              <h3 className="text-lg font-semibold ds-text-primary mb-4">
                Indirect Costs by Category (Expenses + Labour)
              </h3>
              {renderCategoryBreakdown({
                utilities: {
                  total: (data.expenses?.byCategory?.utilities || 0) + (data.labour?.byCategory?.utilities?.total || 0),
                  count: (data.expenses?.byCategory?.utilities ? 1 : 0) + (data.labour?.byCategory?.utilities?.count || 0)
                },
                siteOverhead: {
                  total: (data.expenses?.byCategory?.siteOverhead || 0) + (data.labour?.byCategory?.siteOverhead?.total || 0),
                  count: (data.expenses?.byCategory?.siteOverhead ? 1 : 0) + (data.labour?.byCategory?.siteOverhead?.count || 0)
                },
                transportation: {
                  total: (data.expenses?.byCategory?.transportation || 0) + (data.labour?.byCategory?.transportation?.total || 0),
                  count: (data.expenses?.byCategory?.transportation ? 1 : 0) + (data.labour?.byCategory?.transportation?.count || 0)
                },
                safetyCompliance: {
                  total: (data.expenses?.byCategory?.safetyCompliance || 0) + (data.labour?.byCategory?.safetyCompliance?.total || 0),
                  count: (data.expenses?.byCategory?.safetyCompliance ? 1 : 0) + (data.labour?.byCategory?.safetyCompliance?.count || 0)
                },
              })}
            </div>
          )}

          {/* Expenses Only */}
          {activeTab === 'expenses' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold ds-text-primary">Expenses by Category</h3>
                <Link
                  href={`/expenses?isIndirectCost=true`}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View all expenses →
                </Link>
              </div>
              {renderCategoryBreakdown(data.expenses?.byCategory || {})}
            </div>
          )}

          {/* Labour Entries */}
          {activeTab === 'labour' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold ds-text-primary">Labour Entries by Category</h3>
                <Link
                  href="/labour/entries"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View all entries →
                </Link>
              </div>
              {data.labour?.byCategory && Object.values(data.labour.byCategory).some(cat => cat.total > 0) ? (
                renderCategoryBreakdown(data.labour.byCategory)
              ) : (
                <div className="text-center py-8">
                  <p className="ds-text-secondary mb-4">No indirect labour entries recorded yet</p>
                  <Link
                    href="/labour/entries/new"
                    className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    Create Labour Entry
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">💡 Tip:</span> Both expense transactions and labour entries are tracked against your indirect costs budget. Use categories to organize and control spending by type.
        </p>
      </div>
    </div>
  );
}
