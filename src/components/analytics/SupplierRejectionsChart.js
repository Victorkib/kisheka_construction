/**
 * Supplier Rejections Chart Component
 * 
 * Displays supplier rejection rates and patterns
 */

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { Users, TrendingUp, AlertTriangle } from 'lucide-react';

const SupplierRejectionsChart = ({ suppliers }) => {
  const [sortBy, setSortBy] = useState('count');
  const [viewType, setViewType] = useState('list');

  if (!suppliers || suppliers.length === 0) {
    return (
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier Rejections</h3>
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No supplier rejection data available</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Sort suppliers based on selected criteria
  const sortedSuppliers = [...suppliers].sort((a, b) => {
    switch (sortBy) {
      case 'count':
        return b.rejectionCount - a.rejectionCount;
      case 'rate':
        return b.rejectionRate - a.rejectionRate;
      case 'impact':
        return (b.financialImpact || 0) - (a.financialImpact || 0);
      case 'name':
        return a.supplierName.localeCompare(b.supplierName);
      default:
        return b.rejectionCount - a.rejectionCount;
    }
  });

  const getSeverityColor = (rate) => {
    if (rate >= 20) return 'red';
    if (rate >= 10) return 'orange';
    if (rate >= 5) return 'yellow';
    return 'green';
  };

  const getBadgeVariant = (rate) => {
    if (rate >= 20) return 'danger';
    if (rate >= 10) return 'warning';
    if (rate >= 5) return 'info';
    return 'success';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Simple horizontal bar chart
  const HorizontalBarChart = ({ data, height = 300 }) => {
    const maxValue = Math.max(...data.map(item => item.rejectionCount));
    
    return (
      <div className="space-y-3" style={{ height: `${height}px`, overflowY: 'auto' }}>
        {data.map((supplier, index) => {
          const percentage = (supplier.rejectionCount / maxValue) * 100;
          const severityColor = getSeverityColor(supplier.rejectionRate);
          
          return (
            <div key={supplier.supplierId} className="flex items-center space-x-3">
              <div className="w-32 flex-shrink-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {supplier.supplierName}
                </p>
                <p className="text-xs text-gray-500">
                  {supplier.totalOrders} orders
                </p>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">
                    {supplier.rejectionCount} rejections
                  </span>
                  <Badge variant={getBadgeVariant(supplier.rejectionRate)}>
                    {supplier.rejectionRate}%
                  </Badge>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`bg-${severityColor}-500 h-2 rounded-full transition-all duration-300`}
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

  // List view
  const ListView = ({ data }) => (
    <div className="space-y-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
      {data.map((supplier, index) => {
        const severityColor = getSeverityColor(supplier.rejectionRate);
        
        return (
          <div
            key={supplier.supplierId}
            className={`p-4 border-l-4 border-${severityColor}-500 bg-gray-50 rounded-r-lg`}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-medium text-gray-900">
                  {supplier.supplierName}
                </h4>
                <p className="text-sm text-gray-600">
                  {supplier.totalOrders} total orders
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge variant={getBadgeVariant(supplier.rejectionRate)}>
                  {supplier.rejectionRate}% rate
                </Badge>
                {index < 3 && (
                  <span className="text-xs font-medium text-gray-500">
                    #{index + 1}
                  </span>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Rejections</p>
                <p className="font-medium text-gray-900">
                  {supplier.rejectionCount}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Financial Impact</p>
                <p className="font-medium text-gray-900">
                  {formatCurrency(supplier.financialImpact)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Top Reason</p>
                <p className="font-medium text-gray-900 truncate">
                  {supplier.topReason || 'N/A'}
                </p>
              </div>
            </div>
            
            {supplier.trend && (
              <div className="mt-3 flex items-center text-xs">
                {supplier.trend > 0 ? (
                  <TrendingUp className="w-3 h-3 text-red-500 mr-1" />
                ) : (
                  <TrendingUp className="w-3 h-3 text-green-500 mr-1 rotate-180" />
                )}
                <span className={supplier.trend > 0 ? 'text-red-600' : 'text-green-600'}>
                  {Math.abs(supplier.trend)}% vs last period
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Supplier Rejections</h3>
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="count">Sort by Count</option>
              <option value="rate">Sort by Rate</option>
              <option value="impact">Sort by Impact</option>
              <option value="name">Sort by Name</option>
            </select>
            
            <div className="flex space-x-1">
              <button
                onClick={() => setViewType('list')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  viewType === 'list'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewType('chart')}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  viewType === 'chart'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Chart
              </button>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Total Suppliers: {suppliers.length}</span>
            <span>Avg Rejection Rate: {
              (suppliers.reduce((sum, s) => sum + s.rejectionRate, 0) / suppliers.length).toFixed(1)
            }%</span>
          </div>
        </div>

        {viewType === 'chart' ? (
          <HorizontalBarChart data={sortedSuppliers.slice(0, 10)} />
        ) : (
          <ListView data={sortedSuppliers.slice(0, 10)} />
        )}

        {/* Summary Statistics */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500 mr-1" />
                <span className="font-medium text-gray-900">High Risk</span>
              </div>
              <p className="text-gray-600">
                {suppliers.filter(s => s.rejectionRate >= 20).length} suppliers
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <AlertTriangle className="w-4 h-4 text-orange-500 mr-1" />
                <span className="font-medium text-gray-900">Medium Risk</span>
              </div>
              <p className="text-gray-600">
                {suppliers.filter(s => s.rejectionRate >= 10 && s.rejectionRate < 20).length} suppliers
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Users className="w-4 h-4 text-green-500 mr-1" />
                <span className="font-medium text-gray-900">Low Risk</span>
              </div>
              <p className="text-gray-600">
                {suppliers.filter(s => s.rejectionRate < 10).length} suppliers
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SupplierRejectionsChart;
