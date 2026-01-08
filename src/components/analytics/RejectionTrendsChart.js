/**
 * Rejection Trends Chart Component
 * 
 * Displays rejection trends over time with line charts
 */

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { ChartLine, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

const RejectionTrendsChart = ({ trends }) => {
  const [timeRange, setTimeRange] = useState('daily');
  const [metric, setMetric] = useState('count');

  if (!trends || trends.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rejection Trends</h3>
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <ChartLine className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No trend data available</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Filter trends based on selected time range
  const getFilteredTrends = () => {
    const now = new Date();
    let cutoffDate;

    switch (timeRange) {
      case 'daily':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days
        break;
      case 'weekly':
        cutoffDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks
        break;
      case 'monthly':
        cutoffDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000); // 12 months
        break;
      default:
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return trends.filter(trend => new Date(trend.date) >= cutoffDate);
  };

  const filteredTrends = getFilteredTrends();

  // Simple line chart implementation
  const SimpleLineChart = ({ data, height = 300 }) => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <ChartLine className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No data available for selected period</p>
          </div>
        </div>
      );
    }

    const width = 600;
    const padding = 40;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Get data values based on selected metric
    const getDataValues = () => {
      switch (metric) {
        case 'count':
          return data.map(d => d.rejectionCount);
        case 'rate':
          return data.map(d => d.rejectionRate);
        case 'impact':
          return data.map(d => d.financialImpact || 0);
        default:
          return data.map(d => d.rejectionCount);
      }
    };

    const values = getDataValues();
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const valueRange = maxValue - minValue || 1;

    // Create points for the line
    const points = data.map((d, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const value = values[index];
      const y = padding + (1 - (value - minValue) / valueRange) * chartHeight;
      return { x, y, value, date: d.date };
    });

    // Create SVG path
    const pathData = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    const formatDate = (dateString) => {
      const date = new Date(dateString);
      switch (timeRange) {
        case 'daily':
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        case 'weekly':
          return `Week ${Math.ceil(date.getDate() / 7)}`;
        case 'monthly':
          return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        default:
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    };

    const formatValue = (value) => {
      switch (metric) {
        case 'count':
          return value.toLocaleString();
        case 'rate':
          return `${value.toFixed(1)}%`;
        case 'impact':
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(value);
        default:
          return value.toLocaleString();
      }
    };

    return (
      <div className="relative">
        <svg width={width} height={height} className="w-full">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = padding + fraction * chartHeight;
            return (
              <line
                key={fraction}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            );
          })}

          {/* Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const value = minValue + (1 - fraction) * valueRange;
            const y = padding + fraction * chartHeight;
            return (
              <text
                key={fraction}
                x={padding - 10}
                y={y + 5}
                textAnchor="end"
                className="text-xs fill-gray-500"
              >
                {formatValue(value)}
              </text>
            );
          })}

          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
          />

          {/* Area under line */}
          <path
            d={`${pathData} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`}
            fill="url(#gradient)"
            opacity="0.3"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Data points */}
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#3B82F6"
              stroke="white"
              strokeWidth="2"
              className="hover:r-6 transition-all cursor-pointer"
            />
          ))}

          {/* X-axis labels */}
          {points.filter((_, index) => index % Math.ceil(points.length / 8) === 0).map((point, index) => (
            <text
              key={index}
              x={point.x}
              y={height - padding + 20}
              textAnchor="middle"
              className="text-xs fill-gray-500"
            >
              {formatDate(point.date)}
            </text>
          ))}
        </svg>
      </div>
    );
  };

  // Calculate trend statistics
  const calculateTrendStats = () => {
    if (filteredTrends.length < 2) return null;

    const recent = filteredTrends.slice(-7); // Last 7 periods
    const previous = filteredTrends.slice(-14, -7); // Previous 7 periods

    const recentSum = recent.reduce((sum, t) => {
      switch (metric) {
        case 'count': return sum + t.rejectionCount;
        case 'rate': return sum + t.rejectionRate;
        case 'impact': return sum + (t.financialImpact || 0);
        default: return sum + t.rejectionCount;
      }
    }, 0);

    const previousSum = previous.reduce((sum, t) => {
      switch (metric) {
        case 'count': return sum + t.rejectionCount;
        case 'rate': return sum + t.rejectionRate;
        case 'impact': return sum + (t.financialImpact || 0);
        default: return sum + t.rejectionCount;
      }
    }, 0);

    const change = previousSum > 0 ? ((recentSum - previousSum) / previousSum) * 100 : 0;

    return {
      recent: recentSum / recent.length,
      previous: previousSum / previous.length,
      change,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
    };
  };

  const trendStats = calculateTrendStats();

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Rejection Trends</h3>
          <div className="flex items-center space-x-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="count">Rejection Count</option>
              <option value="rate">Rejection Rate</option>
              <option value="impact">Financial Impact</option>
            </select>
          </div>
        </div>

        {/* Trend Statistics */}
        {trendStats && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <p className="text-sm text-gray-600">Recent Average</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {metric === 'count' ? Math.round(trendStats.recent).toLocaleString() :
                     metric === 'rate' ? `${trendStats.recent.toFixed(1)}%` :
                     new Intl.NumberFormat('en-US', {
                       style: 'currency',
                       currency: 'USD',
                       minimumFractionDigits: 0,
                     }).format(trendStats.recent)}
                  </p>
                </div>
                
                <div className="flex items-center">
                  {trendStats.direction === 'up' ? (
                    <TrendingUp className="w-4 h-4 text-red-500 mr-1" />
                  ) : trendStats.direction === 'down' ? (
                    <TrendingDown className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <div className="w-4 h-4 mr-1" />
                  )}
                  <span className={`text-sm font-medium ${
                    trendStats.direction === 'up' ? 'text-red-600' :
                    trendStats.direction === 'down' ? 'text-green-600' :
                    'text-gray-600'
                  }`}>
                    {trendStats.change > 0 ? '+' : ''}{trendStats.change.toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">vs previous period</span>
                </div>
              </div>
              
              <Badge variant={trendStats.direction === 'up' ? 'warning' : 
                           trendStats.direction === 'down' ? 'success' : 'info'}>
                {trendStats.direction === 'up' ? 'Increasing' :
                 trendStats.direction === 'down' ? 'Decreasing' : 'Stable'}
              </Badge>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="mb-4">
          <SimpleLineChart data={filteredTrends} height={300} />
        </div>

        {/* Key Insights */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Key Insights:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                Period: {timeRange === 'daily' ? 'Last 30 days' :
                        timeRange === 'weekly' ? 'Last 12 weeks' : 'Last 12 months'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <ChartLine className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                Data points: {filteredTrends.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RejectionTrendsChart;
