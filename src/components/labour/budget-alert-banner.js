/**
 * Budget Alert Banner Component
 * Displays labour budget alerts in a banner format
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, TrendingUp, DollarSign } from 'lucide-react';
import Link from 'next/link';

export function BudgetAlertBanner({ projectId, phaseId, onDismiss }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, [projectId, phaseId]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      let url = '/api/labour/budget-alerts?';
      if (phaseId) {
        url += `phaseId=${phaseId}`;
      } else if (projectId) {
        url += `projectId=${projectId}`;
      } else {
        setLoading(false);
        return;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.data.hasAlert) {
        setAlerts(data.data.alerts);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      console.error('Error fetching budget alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (loading || dismissed || alerts.length === 0) {
    return null;
  }

  // Get highest severity alert
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const highAlerts = alerts.filter((a) => a.severity === 'high');
  const primaryAlert = criticalAlerts[0] || highAlerts[0] || alerts[0];

  const severityStyles = {
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-600',
    },
    high: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-800',
      icon: 'text-orange-600',
    },
    medium: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: 'text-yellow-600',
    },
  };

  const style = severityStyles[primaryAlert.severity] || severityStyles.medium;

  return (
    <div
      className={`${style.bg} ${style.border} border rounded-lg p-4 mb-4 relative`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 ${style.icon} mt-0.5 flex-shrink-0`} />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className={`text-sm font-semibold ${style.text}`}>
              Labour Budget Alert
            </h3>
            <button
              onClick={handleDismiss}
              className={`${style.text} hover:opacity-70`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className={`text-sm ${style.text} mb-2`}>{primaryAlert.message}</p>

          {/* Additional alerts count */}
          {alerts.length > 1 && (
            <p className={`text-xs ${style.text} opacity-75 mb-2`}>
              +{alerts.length - 1} more alert{alerts.length - 1 !== 1 ? 's' : ''}
            </p>
          )}

          {/* Action link */}
          {primaryAlert.phaseId && (
            <Link
              href={`/phases/${primaryAlert.phaseId}`}
              className={`text-xs ${style.text} underline hover:opacity-70`}
            >
              View Phase →
            </Link>
          )}
          {primaryAlert.projectId && !primaryAlert.phaseId && (
            <Link
              href={`/projects/${primaryAlert.projectId}`}
              className={`text-xs ${style.text} underline hover:opacity-70`}
            >
              View Project →
            </Link>
          )}
        </div>
      </div>

      {/* Budget details */}
      {primaryAlert.percentage !== undefined && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <DollarSign className={`w-3 h-3 ${style.icon}`} />
              <span className={style.text}>
                {primaryAlert.percentage.toFixed(1)}% utilized
              </span>
            </div>
            {primaryAlert.amount !== undefined && primaryAlert.amount > 0 && (
              <div className="flex items-center gap-1">
                <TrendingUp className={`w-3 h-3 ${style.icon}`} />
                <span className={style.text}>
                  {primaryAlert.amount.toLocaleString()} KES remaining
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Budget Alert List Component
 * Displays all budget alerts in a list format
 */
export function BudgetAlertList({ projectId, phaseId, compact = false }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetchAlerts();
  }, [projectId, phaseId]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      let url = '/api/labour/budget-alerts?';
      if (phaseId) {
        url += `phaseId=${phaseId}`;
      } else if (projectId) {
        url += `projectId=${projectId}`;
      } else {
        setLoading(false);
        return;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setAlerts(data.data.alerts || []);
        setSummary(data.data.summary || null);
      }
    } catch (err) {
      console.error('Error fetching budget alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-sm text-gray-600">Loading alerts...</p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-800">
          ✓ No labour budget alerts. All budgets are within acceptable limits.
        </p>
      </div>
    );
  }

  const severityStyles = {
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-600',
      badge: 'bg-red-100 text-red-800',
    },
    high: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-800',
      icon: 'text-orange-600',
      badge: 'bg-orange-100 text-orange-800',
    },
    medium: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: 'text-yellow-600',
      badge: 'bg-yellow-100 text-yellow-800',
    },
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {!compact && (
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Budget Alerts</h3>
          {summary && (
            <p className="text-sm text-gray-600 mt-1">
              {summary.totalAlerts} alert{summary.totalAlerts !== 1 ? 's' : ''} found
            </p>
          )}
        </div>
      )}

      <div className="divide-y divide-gray-200">
        {alerts.map((alert, index) => {
          const style = severityStyles[alert.severity] || severityStyles.medium;

          return (
            <div
              key={index}
              className={`${style.bg} ${style.border} border-l-4 p-4`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 ${style.icon} mt-0.5 flex-shrink-0`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-medium ${style.badge}`}
                    >
                      {alert.severity.toUpperCase()}
                    </span>
                    {alert.level && (
                      <span className="text-xs text-gray-600">
                        {alert.level === 'project' ? 'Project' : 'Phase'} Level
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-medium ${style.text} mb-1`}>
                    {alert.message}
                  </p>
                  {alert.phaseName && (
                    <p className="text-xs text-gray-600 mb-2">
                      Phase: {alert.phaseName}
                    </p>
                  )}
                  {alert.projectName && !alert.phaseName && (
                    <p className="text-xs text-gray-600 mb-2">
                      Project: {alert.projectName}
                    </p>
                  )}

                  {/* Details */}
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    {alert.percentage !== undefined && (
                      <div className="flex items-center gap-1">
                        <DollarSign className={`w-3 h-3 ${style.icon}`} />
                        <span className={style.text}>
                          {alert.percentage.toFixed(1)}% utilized
                        </span>
                      </div>
                    )}
                    {alert.amount !== undefined && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className={`w-3 h-3 ${style.icon}`} />
                        <span className={style.text}>
                          {alert.amount > 0
                            ? `${alert.amount.toLocaleString()} KES remaining`
                            : `${Math.abs(alert.amount).toLocaleString()} KES over`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action link */}
                  {alert.phaseId && (
                    <Link
                      href={`/phases/${alert.phaseId}`}
                      className={`text-xs ${style.text} underline hover:opacity-70 mt-2 inline-block`}
                    >
                      View Phase Details →
                    </Link>
                  )}
                  {alert.projectId && !alert.phaseId && (
                    <Link
                      href={`/projects/${alert.projectId}`}
                      className={`text-xs ${style.text} underline hover:opacity-70 mt-2 inline-block`}
                    >
                      View Project Details →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

