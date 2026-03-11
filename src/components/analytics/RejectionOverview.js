/**
 * Rejection Overview Component
 * 
 * Displays key metrics and overview cards for rejection analytics
 */

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  Clock,
  DollarSign,
  Users,
  CheckCircle
} from 'lucide-react';

const RejectionOverview = ({ overview }) => {
  if (!overview) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-6">
            <div className="animate-pulse">
              <div className="h-4 ds-bg-surface-muted rounded w-1/2 mb-2"></div>
              <div className="h-8 ds-bg-surface-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 ds-bg-surface-muted rounded w-1/3"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      title: 'Total Rejections',
      value: overview.totalRejections?.toLocaleString() || '0',
      change: overview.rejectionRateChange,
      icon: AlertTriangle,
      color: 'red',
      format: 'number'
    },
    {
      title: 'Rejection Rate',
      value: `${overview.rejectionRate || 0}%`,
      change: overview.rejectionRateChange,
      icon: TrendingDown,
      color: 'orange',
      format: 'percentage'
    },
    {
      title: 'Avg Resolution Time',
      value: overview.avgResolutionTime || '0h',
      change: overview.resolutionTimeChange,
      icon: Clock,
      color: 'blue',
      format: 'time'
    },
    {
      title: 'Financial Impact',
      value: `$${(overview.financialImpact || 0).toLocaleString()}`,
      change: overview.financialImpactChange,
      icon: DollarSign,
      color: 'purple',
      format: 'currency'
    },
    {
      title: 'Suppliers Affected',
      value: overview.suppliersAffected || 0,
      change: overview.suppliersAffectedChange,
      icon: Users,
      color: 'green',
      format: 'number'
    },
    {
      title: 'Categories Affected',
      value: overview.categoriesAffected || 0,
      change: overview.categoriesAffectedChange,
      icon: Package,
      color: 'indigo',
      format: 'number'
    },
    {
      title: 'Resolution Rate',
      value: `${overview.resolutionRate || 0}%`,
      change: overview.resolutionRateChange,
      icon: CheckCircle,
      color: 'teal',
      format: 'percentage'
    },
    {
      title: 'Repeat Rejections',
      value: overview.repeatRejections || 0,
      change: overview.repeatRejectionsChange,
      icon: AlertTriangle,
      color: 'red',
      format: 'number'
    }
  ];

  const getChangeColor = (change) => {
    if (!change) return 'ds-text-muted';
    return change > 0 ? 'text-red-500' : 'text-emerald-400';
  };

  const getChangeIcon = (change) => {
    if (!change) return null;
    return change > 0 ? (
      <TrendingUp className="w-3 h-3" />
    ) : (
      <TrendingDown className="w-3 h-3" />
    );
  };

  const formatChange = (change, format) => {
    if (!change) return 'No change';
    const prefix = change > 0 ? '+' : '';
    const suffix = format === 'percentage' ? '%' : '';
    return `${prefix}${Math.abs(change)}${suffix}`;
  };

  const getColorClasses = (color) => {
    const colorMap = {
      red: {
        bg: 'bg-red-500/10',
        icon: 'text-red-600',
        border: 'border-red-400/60'
      },
      orange: {
        bg: 'bg-orange-500/10',
        icon: 'text-orange-600',
        border: 'border-orange-200'
      },
      blue: {
        bg: 'bg-blue-500/10',
        icon: 'text-blue-600',
        border: 'border-blue-400/60'
      },
      purple: {
        bg: 'bg-purple-500/10',
        icon: 'text-purple-600',
        border: 'border-purple-400/60'
      },
      green: {
        bg: 'bg-green-500/10',
        icon: 'text-green-600',
        border: 'border-green-400/60'
      },
      indigo: {
        bg: 'bg-indigo-500/10',
        icon: 'text-indigo-600',
        border: 'border-indigo-200'
      },
      teal: {
        bg: 'bg-teal-500/10',
        icon: 'text-teal-600',
        border: 'border-teal-200'
      }
    };
    return colorMap[color] || colorMap.blue;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metrics.map((metric, index) => {
        const colorClasses = getColorClasses(metric.color);
        const Icon = metric.icon;
        
        return (
          <Card key={index} className={`p-6 border-l-4 ${colorClasses.border}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium ds-text-secondary mb-1">
                  {metric.title}
                </p>
                <p className="text-2xl font-bold ds-text-primary mb-2">
                  {metric.value}
                </p>
                
                {metric.change !== undefined && (
                  <div className={`flex items-center text-sm ${getChangeColor(metric.change)}`}>
                    {getChangeIcon(metric.change)}
                    <span className="ml-1">
                      {formatChange(metric.change, metric.format)}
                    </span>
                    <span className="ml-1 ds-text-muted">vs last period</span>
                  </div>
                )}
              </div>
              
              <div className={`p-3 rounded-lg ${colorClasses.bg}`}>
                <Icon className={`w-6 h-6 ${colorClasses.icon}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default RejectionOverview;
