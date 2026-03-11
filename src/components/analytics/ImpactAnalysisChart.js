/**
 * Impact Analysis Chart Component
 * 
 * Displays financial and operational impact of rejections
 */

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { DollarSign, TrendingDown, AlertTriangle, Package, Clock, Users } from 'lucide-react';

const ImpactAnalysisChart = ({ impact }) => {
  const [viewType, setViewType] = useState('financial');

  if (!impact) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold ds-text-primary mb-4">Impact Analysis</h3>
          <div className="flex items-center justify-center h-64 ds-text-muted">
            <div className="text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-2 ds-text-muted" />
              <p>No impact data available</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
  };

  // Financial Impact View
  const FinancialImpactView = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-red-50 border border-red-400/60 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-red-600" />
            <Badge variant="danger">High Impact</Badge>
          </div>
          <p className="text-sm ds-text-secondary mb-1">Total Financial Impact</p>
          <p className="text-2xl font-bold ds-text-primary">
            {formatCurrency(impact.totalFinancialImpact)}
          </p>
          {impact.financialImpactChange && (
            <p className={`text-sm mt-2 ${impact.financialImpactChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {impact.financialImpactChange > 0 ? '+' : ''}{impact.financialImpactChange}% vs last period
            </p>
          )}
        </div>

        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-5 h-5 text-orange-600" />
            <Badge variant="warning">Growing</Badge>
          </div>
          <p className="text-sm ds-text-secondary mb-1">Avg Cost per Rejection</p>
          <p className="text-2xl font-bold ds-text-primary">
            {formatCurrency(impact.avgCostPerRejection)}
          </p>
          <p className="text-sm ds-text-muted mt-2">
            Based on {impact.totalRejections} rejections
          </p>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-400/60 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-5 h-5 text-blue-600" />
            <Badge variant="info">Metric</Badge>
          </div>
          <p className="text-sm ds-text-secondary mb-1">Opportunity Cost</p>
          <p className="text-2xl font-bold ds-text-primary">
            {formatCurrency(impact.opportunityCost)}
          </p>
          <p className="text-sm ds-text-muted mt-2">
            Lost revenue potential
          </p>
        </div>
      </div>

      {/* Impact Breakdown */}
      <div>
        <h4 className="text-lg font-medium ds-text-primary mb-4">Impact Breakdown</h4>
        <div className="space-y-4">
          {impact.impactBreakdown?.map((item, index) => {
            const percentage = impact.totalFinancialImpact > 0 
              ? (item.amount / impact.totalFinancialImpact) * 100 
              : 0;
            
            return (
              <div key={item.category} className="p-4 ds-bg-surface-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium ds-text-primary">{item.category}</h5>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium ds-text-primary">
                      {formatCurrency(item.amount)}
                    </span>
                    <Badge variant={percentage > 30 ? 'warning' : 'info'}>
                      {percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <div className="w-full ds-bg-surface-muted rounded-full h-2">
                  <div
                    className={`bg-${index === 0 ? 'red' : index === 1 ? 'orange' : index === 2 ? 'yellow' : 'blue'}-500 h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-sm ds-text-secondary mt-2">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost Trends */}
      {impact.costTrends && (
        <div>
          <h4 className="text-lg font-medium ds-text-primary mb-4">Cost Trends</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {impact.costTrends.map((trend, index) => (
              <div key={trend.period} className="p-3 ds-bg-surface-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium ds-text-secondary">{trend.period}</span>
                  <div className="text-right">
                    <p className="font-medium ds-text-primary">{formatCurrency(trend.totalCost)}</p>
                    <p className="text-xs ds-text-muted">{trend.rejectionCount} rejections</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Operational Impact View
  const OperationalImpactView = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-purple-50 border border-purple-400/60 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-purple-600" />
            <Badge variant="info">Time Impact</Badge>
          </div>
          <p className="text-sm ds-text-secondary mb-1">Total Time Lost</p>
          <p className="text-2xl font-bold ds-text-primary">
            {impact.totalTimeLost || 0}h
          </p>
          <p className="text-sm ds-text-muted mt-2">
            Across all rejections
          </p>
        </div>

        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <Badge variant="info">Staff Impact</Badge>
          </div>
          <p className="text-sm ds-text-secondary mb-1">Staff Hours Affected</p>
          <p className="text-2xl font-bold ds-text-primary">
            {impact.staffHoursAffected || 0}h
          </p>
          <p className="text-sm ds-text-muted mt-2">
            {impact.staffAffected || 0} staff members
          </p>
        </div>

        <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-5 h-5 text-teal-600" />
            <Badge variant="info">Operations</Badge>
          </div>
          <p className="text-sm ds-text-secondary mb-1">Projects Delayed</p>
          <p className="text-2xl font-bold ds-text-primary">
            {impact.projectsDelayed || 0}
          </p>
          <p className="text-sm ds-text-muted mt-2">
            Avg delay: {impact.avgDelayDays || 0} days
          </p>
        </div>
      </div>

      {/* Operational Metrics */}
      <div>
        <h4 className="text-lg font-medium ds-text-primary mb-4">Operational Metrics</h4>
        <div className="space-y-4">
          <div className="p-4 ds-bg-surface-muted rounded-lg">
            <h5 className="font-medium ds-text-primary mb-3">Resolution Efficiency</h5>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm ds-text-secondary mb-1">Avg Resolution Time</p>
                <p className="text-lg font-semibold ds-text-primary">
                  {impact.avgResolutionTime || 0} hours
                </p>
              </div>
              <div>
                <p className="text-sm ds-text-secondary mb-1">Resolution Success Rate</p>
                <p className="text-lg font-semibold ds-text-primary">
                  {(impact.resolutionSuccessRate || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 ds-bg-surface-muted rounded-lg">
            <h5 className="font-medium ds-text-primary mb-3">Resource Utilization</h5>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm ds-text-secondary mb-1">Management Time</p>
                <p className="text-lg font-semibold ds-text-primary">
                  {impact.managementTime || 0} hours
                </p>
              </div>
              <div>
                <p className="text-sm ds-text-secondary mb-1">Communication Overhead</p>
                <p className="text-lg font-semibold ds-text-primary">
                  {impact.communicationOverhead || 0} hours
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Impact by Department */}
      {impact.departmentImpact && (
        <div>
          <h4 className="text-lg font-medium ds-text-primary mb-4">Impact by Department</h4>
          <div className="space-y-3">
            {impact.departmentImpact.map((dept, index) => (
              <div key={dept.department} className="p-3 ds-bg-surface-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium ds-text-primary">{dept.department}</span>
                  <Badge variant={dept.impactLevel === 'high' ? 'danger' : 
                                 dept.impactLevel === 'medium' ? 'warning' : 'info'}>
                    {dept.impactLevel}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="ds-text-muted">Hours Lost</p>
                    <p className="font-medium ds-text-primary">{dept.hoursLost}h</p>
                  </div>
                  <div>
                    <p className="ds-text-muted">Staff Affected</p>
                    <p className="font-medium ds-text-primary">{dept.staffAffected}</p>
                  </div>
                  <div>
                    <p className="ds-text-muted">Cost Impact</p>
                    <p className="font-medium ds-text-primary">{formatCurrency(dept.costImpact)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold ds-text-primary">Impact Analysis</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewType('financial')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewType === 'financial'
                  ? 'bg-blue-100 text-blue-700'
                  : 'ds-bg-surface-muted ds-text-secondary hover:ds-bg-surface-muted'
              }`}
            >
              Financial Impact
            </button>
            <button
              onClick={() => setViewType('operational')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewType === 'operational'
                  ? 'bg-blue-100 text-blue-700'
                  : 'ds-bg-surface-muted ds-text-secondary hover:ds-bg-surface-muted'
              }`}
            >
              Operational Impact
            </button>
          </div>
        </div>

        {/* Overall Impact Summary */}
        <div className="mb-6 p-4 bg-red-50 border border-red-400/60 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div>
                <h4 className="font-medium ds-text-primary">Overall Impact Assessment</h4>
                <p className="text-sm ds-text-secondary">
                  Total impact: {formatCurrency(impact.totalFinancialImpact)} • {impact.totalRejections} rejections
                </p>
              </div>
            </div>
            <Badge variant={impact.impactLevel === 'high' ? 'danger' : 
                           impact.impactLevel === 'medium' ? 'warning' : 'info'}>
              {impact.impactLevel?.toUpperCase()} IMPACT
            </Badge>
          </div>
        </div>

        {/* View Content */}
        {viewType === 'financial' ? <FinancialImpactView /> : <OperationalImpactView />}

        {/* Recommendations */}
        <div className="mt-6 pt-6 border-t ds-border-subtle">
          <h4 className="text-sm font-medium ds-text-secondary mb-3">Impact Reduction Recommendations:</h4>
          <div className="space-y-2 text-sm ds-text-secondary">
            <div className="flex items-start space-x-2">
              <DollarSign className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Potential savings:</strong> {formatCurrency(impact.potentialSavings)} 
                {' '}with 25% reduction in rejections
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <TrendingDown className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Focus areas:</strong> {impact.topImpactAreas?.join(', ') || 'No data available'}
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <Clock className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Time savings:</strong> {impact.potentialTimeSavings || 0} hours 
                {' '}with improved processes
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ImpactAnalysisChart;
