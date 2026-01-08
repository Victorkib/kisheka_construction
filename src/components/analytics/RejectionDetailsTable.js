/**
 * Rejection Details Table Component
 * 
 * Displays detailed information about recent rejections in a table format
 */

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

const RejectionDetailsTable = ({ rejections }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  const itemsPerPage = 10;

  if (!rejections || rejections.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No rejection details available</p>
      </div>
    );
  }

  // Filter and sort rejections
  const filteredAndSortedRejections = [...rejections]
    .filter(rejection => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        rejection.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rejection.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rejection.materialName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rejection.reason?.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || rejection.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'date':
          compareValue = new Date(a.rejectionDate) - new Date(b.rejectionDate);
          break;
        case 'supplier':
          compareValue = (a.supplierName || '').localeCompare(b.supplierName || '');
          break;
        case 'material':
          compareValue = (a.materialName || '').localeCompare(b.materialName || '');
          break;
        case 'reason':
          compareValue = (a.reason || '').localeCompare(b.reason || '');
          break;
        case 'status':
          compareValue = (a.status || '').localeCompare(b.status || '');
          break;
        case 'impact':
          compareValue = (a.financialImpact || 0) - (b.financialImpact || 0);
          break;
        default:
          compareValue = new Date(a.rejectionDate) - new Date(b.rejectionDate);
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRejections.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRejections = filteredAndSortedRejections.slice(startIndex, endIndex);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'escalated':
        return 'danger';
      case 'retry':
        return 'info';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'escalated':
        return <AlertTriangle className="w-4 h-4" />;
      case 'retry':
        return <Eye className="w-4 h-4" />;
      default:
        return <XCircle className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getImpactLevel = (impact) => {
    if (!impact) return 'low';
    if (impact >= 10000) return 'high';
    if (impact >= 5000) return 'medium';
    return 'low';
  };

  const getImpactColor = (impact) => {
    const level = getImpactLevel(impact);
    switch (level) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order, supplier, material, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="escalated">Escalated</option>
            <option value="retry">Retry</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedRejections.length)} of {filteredAndSortedRejections.length} rejections
        </span>
        {searchTerm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchTerm('')}
          >
            Clear Search
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('date')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Date</span>
                  {sortBy === 'date' && (
                    <span className="text-blue-600">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('supplier')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Supplier</span>
                  {sortBy === 'supplier' && (
                    <span className="text-blue-600">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('material')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Material</span>
                  {sortBy === 'material' && (
                    <span className="text-blue-600">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('reason')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Reason</span>
                  {sortBy === 'reason' && (
                    <span className="text-blue-600">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Status</span>
                  {sortBy === 'status' && (
                    <span className="text-blue-600">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('impact')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Impact</span>
                  {sortBy === 'impact' && (
                    <span className="text-blue-600">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentRejections.map((rejection) => (
              <tr key={rejection.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{rejection.orderNumber}</div>
                    <div className="text-gray-500">{formatDate(rejection.rejectionDate)}</div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{rejection.supplierName}</div>
                    <div className="text-gray-500">ID: {rejection.supplierId}</div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{rejection.materialName}</div>
                    <div className="text-gray-500">{rejection.quantity} units</div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-gray-900">
                  <div className="max-w-xs">
                    <p className="truncate" title={rejection.reason}>
                      {rejection.reason}
                    </p>
                    {rejection.category && (
                      <Badge variant="info" size="sm" className="mt-1">
                        {rejection.category}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <Badge variant={getStatusColor(rejection.status)} size="sm">
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(rejection.status)}
                      <span>{rejection.status}</span>
                    </div>
                  </Badge>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center space-x-2">
                    <span className={`text-${getImpactColor(rejection.financialImpact)}-600 font-medium`}>
                      {formatCurrency(rejection.financialImpact)}
                    </span>
                    <Badge variant={getImpactColor(rejection.financialImpact)} size="sm">
                      {getImpactLevel(rejection.financialImpact)}
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RejectionDetailsTable;
