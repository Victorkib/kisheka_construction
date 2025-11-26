/**
 * Create Purchase Order Page
 * Form to create purchase order from approved material request
 * 
 * Route: /purchase-orders/new
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';

function NewPurchaseOrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [floors, setFloors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [availableCapital, setAvailableCapital] = useState(null);
  const [loadingCapital, setLoadingCapital] = useState(false);
  const [capitalValidation, setCapitalValidation] = useState(null);

  const [formData, setFormData] = useState({
    materialRequestId: '',
    supplierId: '',
    projectId: '',
    floorId: '',
    categoryId: '',
    category: '',
    materialName: '',
    description: '',
    quantityOrdered: '',
    unit: 'piece',
    unitCost: '',
    totalCost: '',
    deliveryDate: '',
    terms: '',
    notes: '',
  });

  // Fetch data on mount
  useEffect(() => {
    fetchProjects();
    fetchSuppliers();
    fetchCategories();
  }, []);

  // Handle URL parameters - fetch request details first to get projectId
  useEffect(() => {
    const requestIdFromUrl = searchParams.get('requestId');
    const projectIdFromUrl = searchParams.get('projectId');

    if (requestIdFromUrl) {
      // Fetch request details first to get projectId and validate request
      fetchMaterialRequestDetails(requestIdFromUrl).then((request) => {
        if (request && request.projectId) {
          // Set both requestId and projectId from the fetched request
          setFormData((prev) => ({ 
            ...prev, 
            materialRequestId: requestIdFromUrl,
            projectId: request.projectId.toString()
          }));
          // Fetch approved requests for that project
          fetchApprovedMaterialRequests(request.projectId.toString(), requestIdFromUrl);
        }
      });
    } else if (projectIdFromUrl) {
      // If no requestId but projectId provided, just set projectId
      setFormData((prev) => ({ ...prev, projectId: projectIdFromUrl }));
    }
  }, [searchParams]);

  // Fetch approved material requests when project changes (but not if requestId is being processed)
  useEffect(() => {
    if (formData.projectId) {
      // Only fetch if we don't have a specific requestId from URL being processed
      const requestIdFromUrl = searchParams.get('requestId');
      if (!requestIdFromUrl || formData.materialRequestId !== requestIdFromUrl) {
        fetchApprovedMaterialRequests(formData.projectId);
      }
      fetchFloors(formData.projectId);
      fetchAvailableCapital(formData.projectId);
    } else {
      setMaterialRequests([]);
      setFloors([]);
      setAvailableCapital(null);
    }
  }, [formData.projectId, formData.materialRequestId, searchParams]);

  // Fetch material request details when selected (but not if it's from URL - already fetched)
  useEffect(() => {
    const requestIdFromUrl = searchParams.get('requestId');
    if (formData.materialRequestId && formData.materialRequestId !== requestIdFromUrl) {
      // Only fetch if it's a new selection (not from URL, which is handled separately)
      fetchMaterialRequestDetails(formData.materialRequestId);
    }
  }, [formData.materialRequestId, searchParams]);

  // Calculate total cost and validate capital when quantity or unit cost changes
  useEffect(() => {
    if (formData.quantityOrdered && formData.unitCost) {
      const total = parseFloat(formData.quantityOrdered) * parseFloat(formData.unitCost);
      setFormData((prev) => ({ ...prev, totalCost: total.toFixed(2) }));
      
      // Validate capital if project is selected
      if (formData.projectId && availableCapital !== null) {
        validateCapital(total);
      }
    } else {
      setFormData((prev) => ({ ...prev, totalCost: '' }));
      setCapitalValidation(null);
    }
  }, [formData.quantityOrdered, formData.unitCost, formData.projectId, availableCapital]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        // API returns projects array directly in data.data
        const projectsList = Array.isArray(data.data) ? data.data : [];
        if (projectsList.length === 0) {
          console.warn('No projects found. API response:', data);
        } else {
          console.log('Fetched projects:', projectsList.length);
        }
        setProjects(projectsList);
      } else {
        console.error('Failed to fetch projects:', data.error);
        setProjects([]);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setProjects([]);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/users?role=supplier&status=active');
      const data = await response.json();
      if (data.success) {
        // API returns { users: [...], pagination: {...}, ... }
        setSuppliers(data.data?.users || []);
      } else {
        setSuppliers([]);
        console.error('Failed to fetch suppliers:', data.error);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setSuppliers([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (data.success) {
        // API returns categories array directly in data.data
        const categoriesList = Array.isArray(data.data) ? data.data : [];
        setCategories(categoriesList);
      } else {
        setCategories([]);
        console.error('Failed to fetch categories:', data.error);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setCategories([]);
    }
  };

  const fetchFloors = async (projectId) => {
    try {
      if (!projectId) {
        setFloors([]);
        return;
      }
      const response = await fetch(`/api/floors?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setFloors(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
      setFloors([]);
    }
  };

  const fetchApprovedMaterialRequests = async (projectId, specificRequestId = null) => {
    try {
      setLoadingRequests(true);
      // Use ready_to_order filter to get approved/converted requests without purchase orders
      const response = await fetch(`/api/material-requests?projectId=${projectId}&status=ready_to_order`);
      const data = await response.json();
      if (data.success) {
        let requests = data.data.requests || [];
        
        // If specific requestId provided and not in results, fetch it separately and add it
        if (specificRequestId && !requests.find(r => r._id === specificRequestId)) {
          try {
            const specificResponse = await fetch(`/api/material-requests/${specificRequestId}`);
            const specificData = await specificResponse.json();
            if (specificData.success && specificData.data) {
              const specificRequest = specificData.data;
              // Only add if it's approved/converted and has no linked PO
              if (
                (specificRequest.status === 'approved' || specificRequest.status === 'converted_to_order') &&
                !specificRequest.linkedPurchaseOrderId &&
                specificRequest.projectId?.toString() === projectId
              ) {
                // Add to beginning of list with indicator
                requests = [{ ...specificRequest, _isFromUrl: true }, ...requests];
              }
            }
          } catch (err) {
            console.error('Error fetching specific material request:', err);
          }
        }
        
        setMaterialRequests(requests);
      } else {
        setMaterialRequests([]);
      }
    } catch (err) {
      console.error('Error fetching material requests:', err);
      setMaterialRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchMaterialRequestDetails = async (requestId) => {
    try {
      const response = await fetch(`/api/material-requests/${requestId}`);
      const data = await response.json();
      
      if (!data.success || !data.data) {
        setError('Material request not found. Please check the request ID and try again.');
        return null;
      }
      
      const request = data.data;
      
      // Validate request can be used for PO creation
      if (request.status !== 'approved' && request.status !== 'converted_to_order') {
        setError(`This request has status '${request.status}'. Only approved requests can be used to create purchase orders.`);
        return null;
      }
      
      if (request.linkedPurchaseOrderId) {
        setError('This request has already been converted to a purchase order. Please select a different request.');
        return null;
      }
      
      // Clear any previous errors if request is valid
      if (error && (error.includes('Material request') || error.includes('status') || error.includes('already been converted'))) {
        setError(null);
      }
      
      // Pre-fill form with request details
      setFormData((prev) => ({
        ...prev,
        materialRequestId: requestId,
        projectId: request.projectId?.toString() || prev.projectId,
        floorId: request.floorId?.toString() || prev.floorId,
        categoryId: request.categoryId?.toString() || prev.categoryId,
        category: request.category || prev.category,
        materialName: request.materialName || prev.materialName,
        description: request.description || prev.description,
        quantityOrdered: request.quantityNeeded?.toString() || prev.quantityOrdered,
        unit: request.unit || prev.unit,
        unitCost: request.estimatedUnitCost?.toString() || prev.unitCost,
        totalCost: request.estimatedCost?.toString() || prev.totalCost,
      }));
      
      return request;
    } catch (err) {
      console.error('Error fetching material request details:', err);
      setError('Failed to fetch material request details. Please try again.');
      return null;
    }
  };

  const fetchAvailableCapital = async (projectId) => {
    if (!canAccess('view_financing')) return;

    try {
      setLoadingCapital(true);
      const response = await fetch(`/api/project-finances?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        const capital = data.data.availableCapital !== undefined 
          ? data.data.availableCapital 
          : data.data.capitalBalance || 0;
        setAvailableCapital(capital);
      }
    } catch (err) {
      console.error('Error fetching available capital:', err);
    } finally {
      setLoadingCapital(false);
    }
  };

  const validateCapital = (totalCost) => {
    if (availableCapital === null) {
      setCapitalValidation(null);
      return;
    }

    if (totalCost > availableCapital) {
      setCapitalValidation({
        isValid: false,
        message: `Insufficient capital. Required: ${formatCurrency(totalCost)}, Available: ${formatCurrency(availableCapital)}`,
      });
    } else {
      setCapitalValidation({
        isValid: true,
        message: `Capital available. Required: ${formatCurrency(totalCost)}, Available: ${formatCurrency(availableCapital)}`,
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Clear floor selection when project changes
      if (name === 'projectId') {
        updated.floorId = '';
      }
      // Handle category selection
      if (name === 'categoryId') {
        const selectedCategory = categories.find((cat) => cat._id === value);
        updated.category = selectedCategory ? selectedCategory.name : '';
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.materialRequestId) {
      setError('Material request is required');
      return;
    }
    if (!formData.supplierId) {
      setError('Supplier is required');
      return;
    }
    if (!formData.projectId) {
      setError('Project is required');
      return;
    }
    if (!formData.materialName || formData.materialName.trim().length < 2) {
      setError('Material name is required');
      return;
    }
    if (!formData.quantityOrdered || parseFloat(formData.quantityOrdered) <= 0) {
      setError('Quantity ordered must be greater than 0');
      return;
    }
    if (!formData.unitCost || parseFloat(formData.unitCost) < 0) {
      setError('Unit cost must be a non-negative number');
      return;
    }
    if (!formData.deliveryDate) {
      setError('Delivery date is required');
      return;
    }
    if (new Date(formData.deliveryDate) < new Date()) {
      setError('Delivery date must be in the future');
      return;
    }

    // CRITICAL: Validate capital before submission
    const totalCost = parseFloat(formData.totalCost);
    if (availableCapital !== null && totalCost > availableCapital) {
      const proceed = confirm(
        `WARNING: Total cost (${formatCurrency(totalCost)}) exceeds available capital (${formatCurrency(availableCapital)}). This will be blocked by the server. Do you want to continue?`
      );
      if (!proceed) {
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        materialRequestId: formData.materialRequestId,
        supplierId: formData.supplierId,
        projectId: formData.projectId,
        materialName: formData.materialName.trim(),
        description: formData.description?.trim() || '',
        quantityOrdered: parseFloat(formData.quantityOrdered),
        unit: formData.unit.trim(),
        unitCost: parseFloat(formData.unitCost),
        deliveryDate: formData.deliveryDate,
        terms: formData.terms?.trim() || '',
        notes: formData.notes?.trim() || '',
        ...(formData.floorId && { floorId: formData.floorId }),
        ...(formData.categoryId && { categoryId: formData.categoryId }),
        ...(formData.category && { category: formData.category }),
      };

      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Purchase order created successfully!');
        router.push(`/purchase-orders/${data.data._id}`);
      } else {
        setError(data.error || 'Failed to create purchase order');
        toast.showError(data.error || 'Failed to create purchase order');
      }
    } catch (err) {
      setError(err.message || 'Failed to create purchase order');
      toast.showError(err.message || 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '0.00';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/purchase-orders"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Purchase Orders
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Create Purchase Order</h1>
          <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Create a purchase order from an approved material request</p>
        </div>

        {/* Capital Warning */}
        {capitalValidation && !capitalValidation.isValid && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">⚠️ Insufficient Capital</p>
            <p className="text-sm mt-1">{capitalValidation.message}</p>
            <p className="text-sm mt-1">This purchase order will be blocked by the server if submitted.</p>
          </div>
        )}

        {/* Capital Validation Success */}
        {capitalValidation && capitalValidation.isValid && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">
            <p className="text-sm">{capitalValidation.message}</p>
          </div>
        )}

        {/* Available Capital Display */}
        {formData.projectId && availableCapital !== null && canAccess('view_financing') && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6">
            <p className="text-sm">
              <span className="font-semibold">Available Capital:</span> {formatCurrency(availableCapital)}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Quick Actions - Approved Requests Ready to Order */}
        {!formData.projectId && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <p className="text-sm text-gray-700 mb-4">Select a project above to see approved requests ready for ordering, or browse all ready requests:</p>
            <Link
              href="/material-requests?status=ready_to_order"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2 rounded-lg transition"
            >
              View All Ready to Order Requests →
            </Link>
          </div>
        )}

        {/* Approved Requests List (when project selected) */}
        {formData.projectId && materialRequests.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Approved Requests Ready to Order</h2>
            <p className="text-sm text-gray-700 mb-4">Select a request below to quickly create an order, or use the form to create manually:</p>
            <div className="space-y-3">
              {materialRequests.slice(0, 5).map((request) => (
                <div
                  key={request._id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/material-requests/${request._id}`}
                          className="font-semibold text-gray-900 hover:text-purple-600"
                        >
                          {request.requestNumber}
                        </Link>
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                          {request.urgency?.toUpperCase() || 'MEDIUM'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{request.materialName}</p>
                      <p className="text-sm text-gray-700">
                        {request.quantityNeeded} {request.unit}
                        {request.estimatedCost && (
                          <span className="ml-2">• Est: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(request.estimatedCost)}</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, materialRequestId: request._id }));
                        fetchMaterialRequestDetails(request._id);
                        // Scroll to form
                        setTimeout(() => {
                          document.getElementById('purchase-order-form')?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                      className="ml-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition"
                    >
                      Use This Request
                    </button>
                  </div>
                </div>
              ))}
              {materialRequests.length > 5 && (
                <Link
                  href={`/material-requests?projectId=${formData.projectId}&status=ready_to_order`}
                  className="block text-center text-sm text-purple-600 hover:text-purple-800 font-medium py-2"
                >
                  View all {materialRequests.length} requests →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form id="purchase-order-form" onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          <div className="space-y-6">
            {/* Material Request Selection */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Material Request <span className="text-red-500">*</span>
              </label>
              {loadingRequests ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm">
                  Loading available requests...
                </div>
              ) : (
                <>
                  <select
                    name="materialRequestId"
                    value={formData.materialRequestId}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select an approved material request</option>
                    {materialRequests.map((request) => {
                      const requestId = request._id?.toString() || request.id?.toString() || '';
                      return (
                        <option key={requestId || `request-${request.requestNumber}`} value={requestId}>
                          {request.requestNumber} - {request.materialName} ({request.quantityNeeded} {request.unit})
                          {request.status === 'converted_to_order' ? ' [Ready for Order]' : ''}
                          {request._isFromUrl ? ' [From Link]' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {materialRequests.length === 0 && formData.projectId && !loadingRequests && (
                    <p className="text-sm text-gray-700 mt-1">
                      No approved material requests available for this project. 
                      {formData.materialRequestId && (
                        <span className="text-amber-600 block mt-1">
                          Note: The request from the URL may not be available for this project or may have already been converted.
                        </span>
                      )}
                    </p>
                  )}
                  {formData.materialRequestId && !loadingRequests && !materialRequests.find(r => r._id === formData.materialRequestId) && (
                    <p className="text-sm text-amber-600 mt-1">
                      ⚠️ The selected request ID is not in the available requests list. Please verify the request is approved and not already converted to an order.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Project Selection */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a project</option>
                {projects.map((project) => {
                  const projectId = project._id?.toString() || project.id?.toString() || '';
                  return (
                    <option key={projectId || `project-${project.projectCode || project.projectName}`} value={projectId}>
                      {project.projectName} {project.projectCode && `(${project.projectCode})`}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Supplier Selection */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select
                name="supplierId"
                value={formData.supplierId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a supplier</option>
                {suppliers.map((supplier) => {
                  const supplierId = supplier._id?.toString() || supplier.id?.toString() || '';
                  return (
                    <option key={supplierId || `supplier-${supplier.email}`} value={supplierId}>
                      {supplier.firstName} {supplier.lastName} ({supplier.email})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Material Name */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Material Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="materialName"
                value={formData.materialName}
                onChange={handleChange}
                required
                minLength={2}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Description (Optional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Quantity and Unit Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Quantity Ordered <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="quantityOrdered"
                  value={formData.quantityOrdered}
                  onChange={handleChange}
                  required
                  min="0.01"
                  step="0.01"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Unit <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Unit Cost and Total Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Unit Cost <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="unitCost"
                  value={formData.unitCost}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Total Cost
                </label>
                <input
                  type="text"
                  value={formatCurrency(formData.totalCost || 0)}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                />
              </div>
            </div>

            {/* Delivery Date */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Delivery Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="deliveryDate"
                value={formData.deliveryDate}
                onChange={handleChange}
                required
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Terms */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Payment Terms (Optional)
              </label>
              <textarea
                name="terms"
                value={formData.terms}
                onChange={handleChange}
                rows={2}
                placeholder="e.g., Net 30, Payment on delivery, etc."
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Additional Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
              <Link
                href="/purchase-orders"
                className="px-6 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                isLoading={loading}
                disabled={capitalValidation && !capitalValidation.isValid}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Purchase Order
              </LoadingButton>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <NewPurchaseOrderPageContent />
    </Suspense>
  );
}

