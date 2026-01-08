/**
 * Rejection Reasons Chart Component
 * 
 * Displays a pie chart and bar chart of rejection reasons
 */

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { ChartBar, ChartPie } from 'lucide-react';

// Simple bar chart implementation (since we don't have a charting library)
const SimpleBarChart = ({ data, height = 300 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <ChartBar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(item => item.count));
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-teal-500'
  ];

  return (
    <div className="space-y-3" style={{ height: `${height}px` }}>
      {data.map((item, index) => {
        const percentage = (item.count / maxValue) * 100;
        const color = colors[index % colors.length];
        
        return (
          <div key={item.reason} className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 truncate">
                  {item.reason}
                </span>
                <span className="text-sm text-gray-600 ml-2">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${color} h-2 rounded-full transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Simple pie chart implementation
const SimplePieChart = ({ data, size = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <ChartPie className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#8B5CF6', // purple
    '#6366F1', // indigo
    '#EC4899', // pink
    '#14B8A6'  // teal
  ];

  const total = data.reduce((sum, item) => sum + item.count, 0);
  let currentAngle = 0;

  const createPath = (startAngle, endAngle, radius) => {
    const start = polarToCartesian(0, 0, radius, endAngle);
    const end = polarToCartesian(0, 0, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
      "M", 0, 0,
      "L", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ");
  };

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`-${size/2} -${size/2} ${size} ${size}`}>
        {data.map((item, index) => {
          const percentage = (item.count / total) * 100;
          const angle = (percentage / 100) * 360;
          const endAngle = currentAngle + angle;
          
          const path = createPath(currentAngle, endAngle, size / 2);
          currentAngle = endAngle;
          
          return (
            <g key={item.reason}>
              <path
                d={path}
                fill={colors[index % colors.length]}
                stroke="white"
                strokeWidth="2"
              />
            </g>
          );
        })}
      </svg>
      
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {data.map((item, index) => (
          <div key={item.reason} className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="text-gray-600 truncate">{item.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const RejectionReasonsChart = ({ reasons }) => {
  const [viewType, setViewType] = useState('bar');

  if (!reasons || reasons.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rejection Reasons</h3>
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <ChartBar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No rejection reasons data available</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Rejection Reasons</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewType('bar')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewType === 'bar'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Bar Chart
            </button>
            <button
              onClick={() => setViewType('pie')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewType === 'pie'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pie Chart
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Total Reasons: {reasons.length}</span>
            <span>Total Rejections: {reasons.reduce((sum, r) => sum + r.count, 0)}</span>
          </div>
        </div>

        {viewType === 'bar' ? (
          <SimpleBarChart data={reasons} height={300} />
        ) : (
          <SimplePieChart data={reasons.slice(0, 8)} size={250} />
        )}

        {viewType === 'bar' && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Top Reasons:</h4>
            {reasons.slice(0, 5).map((reason, index) => (
              <div key={reason.reason} className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">#{index + 1}</span>
                  <span className="text-gray-700">{reason.reason}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={reason.percentage > 20 ? 'warning' : 'info'}>
                    {reason.percentage}%
                  </Badge>
                  <span className="text-gray-600">{reason.count} rejections</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default RejectionReasonsChart;
