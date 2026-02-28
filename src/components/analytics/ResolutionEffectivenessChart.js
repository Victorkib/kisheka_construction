/**
 * Resolution Effectiveness Chart Component
 * 
 * Displays rejection resolution patterns and effectiveness
 */

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

const ResolutionEffectivenessChart = ({ resolutions }) => {
  const [viewType, setViewType] = useState('effectiveness');

  if (!resolutions || resolutions.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold ds-text-primary mb-4">Resolution Effectiveness</h3>
          <div className="flex items-center justify-center h-64 ds-text-muted">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 ds-text-muted" />
              <p>No resolution data available</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Calculate overall statistics
  const totalRejections = resolutions.reduce((sum, r) => sum + r.count, 0);
  const avgResolutionTime = resolutions.reduce((sum, r) => sum + (r.avgResolutionTime || 0), 0) / resolutions.length;
  const overallSuccessRate = resolutions.reduce((sum, r) => sum + (r.successRate || 0), 0) / resolutions.length;

  // Sort resolutions by effectiveness
  const sortedByEffectiveness = [...resolutions].sort((a, b) => (b.successRate || 0) - (a.successRate || 0));
  const sortedByFrequency = [...resolutions].sort((a, b) => b.count - a.count);
  const sortedByTime = [...resolutions].sort((a, b) => (a.avgResolutionTime || 0) - (b.avgResolutionTime || 0));

  const getEffectivenessColor = (rate) => {
    if (rate >= 80) return 'green';
    if (rate >= 60) return 'yellow';
    if (rate >= 40) return 'orange';
    return 'red';
  };

  const getEffectivenessBadge = (rate) => {
    if (rate >= 80) return 'success';
    if (rate >= 60) return 'info';
    if (rate >= 40) return 'warning';
    return 'danger';
  };

  const formatTime = (hours) => {
    if (hours < 24) {
      return `${Math.round(hours)}h`;
    } else if (hours < 24 * 7) {
      return `${Math.round(hours / 24)}d`;
    } else {
      return `${Math.round(hours / (24 * 7))}w`;
    }
  };

  // Effectiveness view
  const EffectivenessView = ({ data }) => (
    <div className="space-y-4">
      {data.map((resolution, index) => {
        const effectivenessColor = getEffectivenessColor(resolution.successRate);
        const percentage = (resolution.count / totalRejections) * 100;
        
        return (
          <div
            key={resolution.resolutionType}
            className={`p-4 border-l-4 border-${effectivenessColor}-500 ds-bg-surface-muted rounded-r-lg`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-${effectivenessColor}-100`}>
                  {resolution.successRate >= 80 ? (
                    <CheckCircle className={`w-5 h-5 text-${effectivenessColor}-600`} />
                  ) : resolution.successRate >= 40 ? (
                    <Clock className={`w-5 h-5 text-${effectivenessColor}-600`} />
                  ) : (
                    <AlertTriangle className={`w-5 h-5 text-${effectivenessColor}-600`} />
                  )}
                </div>
                <div>
                  <h4 className="font-medium ds-text-primary">
                    {resolution.resolutionType}
                  </h4>
                  <p className="text-sm ds-text-secondary">
                    Used {resolution.count} times ({percentage.toFixed(1)}%)
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <Badge variant={getEffectivenessBadge(resolution.successRate)}>
                  {resolution.successRate}% success
                </Badge>
                {index < 3 && (
                  <p className="text-xs ds-text-muted mt-1">#{index + 1} most effective</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="ds-text-muted">Avg Resolution Time</p>
                <p className="font-medium ds-text-primary">
                  {formatTime(resolution.avgResolutionTime || 0)}
                </p>
              </div>
              <div>
                <p className="ds-text-muted">Success Rate</p>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 ds-bg-surface-muted rounded-full h-2">
                    <div
                      className={`bg-${effectivenessColor}-500 h-2 rounded-full`}
                      style={{ width: `${resolution.successRate}%` }}
                    />
                  </div>
                  <span className="font-medium ds-text-primary">
                    {resolution.successRate}%
                  </span>
                </div>
              </div>
              <div>
                <p className="ds-text-muted">Cost Impact</p>
                <p className="font-medium ds-text-primary">
                  ${((resolution.costImpact || 0) / 1000).toFixed(1)}k
                </p>
              </div>
            </div>
            
            {resolution.trend && (
              <div className="mt-3 flex items-center text-xs">
                {resolution.trend > 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                ) : (
                  <TrendingUp className="w-3 h-3 text-red-500 mr-1 rotate-180" />
                )}
                <span className={resolution.trend > 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(resolution.trend)}% effectiveness change
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Frequency view
  const FrequencyView = ({ data }) => (
    <div className="space-y-3">
      {data.map((resolution, index) => {
        const percentage = (resolution.count / totalRejections) * 100;
        const effectivenessColor = getEffectivenessColor(resolution.successRate);
        
        return (
          <div key={resolution.resolutionType} className="flex items-center space-x-4">
            <div className="w-8 text-center">
              <span className="text-sm font-medium ds-text-muted">#{index + 1}</span>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium ds-text-secondary">
                  {resolution.resolutionType}
                </span>
                <div className="flex items-center space-x-2">
                  <Badge variant={getEffectivenessBadge(resolution.successRate)}>
                    {resolution.successRate}%
                  </Badge>
                  <span className="text-sm ds-text-secondary">
                    {resolution.count} uses
                  </span>
                </div>
              </div>
              <div className="w-full ds-bg-surface-muted rounded-full h-2">
                <div
                  className={`bg-${effectivenessColor}-500 h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Time analysis view
  const TimeAnalysisView = ({ data }) => (
    <div className="space-y-4">
      {data.map((resolution, index) => {
        const effectivenessColor = getEffectivenessColor(resolution.successRate);
        const maxTime = Math.max(...data.map(r => r.avgResolutionTime || 0));
        const timePercentage = ((resolution.avgResolutionTime || 0) / maxTime) * 100;
        
        return (
          <div key={resolution.resolutionType} className="p-3 ds-bg-surface-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <Clock className={`w-4 h-4 text-${effectivenessColor}-600`} />
                <span className="font-medium ds-text-primary">
                  {resolution.resolutionType}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={getEffectivenessBadge(resolution.successRate)}>
                  {resolution.successRate}% success
                </Badge>
                <span className="text-sm ds-text-secondary">
                  {formatTime(resolution.avgResolutionTime || 0)}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="w-full ds-bg-surface-muted rounded-full h-2">
                  <div
                    className={`bg-${effectivenessColor}-500 h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${timePercentage}%` }}
                  />
                </div>
              </div>
              <span className="text-xs ds-text-muted w-16 text-right">
                {resolution.count} uses
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  const getCurrentData = () => {
    switch (viewType) {
      case 'effectiveness':
        return sortedByEffectiveness;
      case 'frequency':
        return sortedByFrequency;
      case 'time':
        return sortedByTime;
      default:
        return sortedByEffectiveness;
    }
  };

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold ds-text-primary">Resolution Effectiveness</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewType('effectiveness')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewType === 'effectiveness'
                  ? 'bg-blue-100 text-blue-700'
                  : 'ds-bg-surface-muted ds-text-secondary hover:ds-bg-surface-muted'
              }`}
            >
              By Effectiveness
            </button>
            <button
              onClick={() => setViewType('frequency')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewType === 'frequency'
                  ? 'bg-blue-100 text-blue-700'
                  : 'ds-bg-surface-muted ds-text-secondary hover:ds-bg-surface-muted'
              }`}
            >
              By Frequency
            </button>
            <button
              onClick={() => setViewType('time')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewType === 'time'
                  ? 'bg-blue-100 text-blue-700'
                  : 'ds-bg-surface-muted ds-text-secondary hover:ds-bg-surface-muted'
              }`}
            >
              By Time
            </button>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <CheckCircle className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-sm ds-text-secondary">Overall Success Rate</p>
            <p className="text-lg font-semibold ds-text-primary">
              {overallSuccessRate.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <Clock className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-sm ds-text-secondary">Avg Resolution Time</p>
            <p className="text-lg font-semibold ds-text-primary">
              {formatTime(avgResolutionTime)}
            </p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-sm ds-text-secondary">Total Resolutions</p>
            <p className="text-lg font-semibold ds-text-primary">
              {totalRejections.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Data View */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {viewType === 'effectiveness' && <EffectivenessView data={getCurrentData()} />}
          {viewType === 'frequency' && <FrequencyView data={getCurrentData()} />}
          {viewType === 'time' && <TimeAnalysisView data={getCurrentData()} />}
        </div>

        {/* Recommendations */}
        <div className="mt-4 pt-4 border-t ds-border-subtle">
          <h4 className="text-sm font-medium ds-text-secondary mb-2">Recommendations:</h4>
          <div className="space-y-2 text-sm ds-text-secondary">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>
                Focus on <strong>{sortedByEffectiveness[0]?.resolutionType}</strong> - highest success rate ({sortedByEffectiveness[0]?.successRate}%)
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>
                Consider <strong>{sortedByTime[0]?.resolutionType}</strong> for faster resolutions ({formatTime(sortedByTime[0]?.avgResolutionTime || 0)})
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <span>
                Review <strong>{sortedByEffectiveness[sortedByEffectiveness.length - 1]?.resolutionType}</strong> - low success rate
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ResolutionEffectivenessChart;
