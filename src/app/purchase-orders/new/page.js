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
import { LoadingSpinner, LoadingButton, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { WorkflowGuide } from '@/components/workflow/WorkflowGuide';
import { HelpIcon, FieldHelp } from '@/components/help/HelpTooltip';

function NewPurchaseOrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess, user } = usePermissions();
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
  const [validatingCapital, setValidatingCapital] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [creatingSupplier, setCreatingSupplier] = useState(false);

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
    customUnit: '',
    unitCost: '',
    totalCost: '',
    deliveryDate: '',
    terms: '',
    notes: '',
  });

  // Predefined unit options
  const unitOptions = [
    'piece',
    'bag',
    'kg',
    'ton',
    'liter',
    'gallon',
    'meter',
    'square meter',
    'cubic meter',
    'roll',
    'sheet',
    'box',
    'carton',
    'pack',
    'set',
    'pair',
    'dozen',
    'others'
  ];

  // Check if user has access to create purchase orders
  useEffect(() => {
    if (user) {
      const userRole = user.role?.toLowerCase();
      if (userRole === 'clerk' || userRole === 'site_clerk') {
        toast.showError('You do not have permission to create purchase orders');
        router.push('/dashboard/clerk');
        return;
      }
      if (!canAccess('create_purchase_order')) {
        toast.showError('You do not have permission to create purchase orders');
        router.push('/dashboard');
        return;
      }
    }
  }, [user, canAccess, router, toast]);

  // Fetch data on mount
  useEffect(() => {
    if (user && (user.role?.toLowerCase() !== 'clerk' && user.role?.toLowerCase() !== 'site_clerk')) {
      fetchProjects();
      fetchSuppliers();
      fetchCategories();
    }
  }, [user]);

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
    const quantity = parseFloat(formData.quantityOrdered);
    const unitCost = parseFloat(formData.unitCost);
    
    if (!isNaN(quantity) && !isNaN(unitCost) && quantity > 0 && unitCost >= 0) {
      const total = quantity * unitCost;
      setFormData((prev) => ({ ...prev, totalCost: total.toFixed(2) }));
      
      // Validate capital if project is selected
      if (formData.projectId && availableCapital !== null) {
        validateCapital(total).catch(err => {
          console.error('Capital validation error:', err);
        });
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
      // Updated to use suppliers collection instead of users
      const response = await fetch('/api/suppliers?status=active&limit=100');
      const data = await response.json();
      if (data.success) {
        // API returns { suppliers: [...], pagination: {...}, ... }
        setSuppliers(data.data?.suppliers || []);
      } else {
        setSuppliers([]);
        console.error('Failed to fetch suppliers:', data.error);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setSuppliers([]);
    }
  };

  const handleCreateSupplier = async (supplierData) => {
    setCreatingSupplier(true);
    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create supplier');
      }

      // Refresh suppliers list
      await fetchSuppliers();
      
      // Auto-select new supplier
      const newSupplierId = data.data._id?.toString() || data.data.id?.toString();
      if (newSupplierId) {
        setFormData((prev) => ({ ...prev, supplierId: newSupplierId }));
      }

      setShowSupplierModal(false);
      toast.showSuccess('Supplier created and selected successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to create supplier');
      console.error('Create supplier error:', err);
    } finally {
      setCreatingSupplier(false);
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
      setFormData((prev) => {
        const requestUnit = request.unit || prev.unit || 'piece';
        // Check if unit is in predefined list, if not, use "others" and set customUnit
        const isUnitInList = unitOptions.includes(requestUnit?.toLowerCase());
        const finalUnit = isUnitInList ? requestUnit?.toLowerCase() : 'others';
        const customUnitValue = isUnitInList ? '' : requestUnit;
        
        return {
        ...prev,
        materialRequestId: requestId,
        projectId: request.projectId?.toString() || prev.projectId,
        floorId: request.floorId?.toString() || prev.floorId,
        categoryId: request.categoryId?.toString() || prev.categoryId,
        category: request.category || prev.category,
        materialName: request.materialName || prev.materialName,
        description: request.description || prev.description,
        quantityOrdered: request.quantityNeeded?.toString() || prev.quantityOrdered,
          unit: finalUnit,
          customUnit: customUnitValue,
        unitCost: request.estimatedUnitCost?.toString() || prev.unitCost,
        totalCost: request.estimatedCost?.toString() || prev.totalCost,
        };
      });
      
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

  const validateCapital = async (totalCost) => {
    if (!formData.projectId || availableCapital === null) {
      setCapitalValidation(null);
      return;
    }

    setValidatingCapital(true);
    try {
      // Simulate validation delay for better UX
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (totalCost > availableCapital) {
        setCapitalValidation({
          isValid: false,
          message: `Insufficient capital. Required: ${formatCurrency(totalCost)}, Available: ${formatCurrency(availableCapital)}, Shortfall: ${formatCurrency(totalCost - availableCapital)}`,
          available: availableCapital,
          required: totalCost,
          shortfall: totalCost - availableCapital,
        });
      } else {
        setCapitalValidation({
          isValid: true,
          message: `Capital validation passed. Available: ${formatCurrency(availableCapital)}, Required: ${formatCurrency(totalCost)}`,
          available: availableCapital,
          required: totalCost,
        });
      }
    } catch (err) {
      console.error('Capital validation error:', err);
      setCapitalValidation(null);
    } finally {
      setValidatingCapital(false);
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
      // Handle unit selection - clear custom unit if not "others"
      if (name === 'unit') {
        if (value !== 'others') {
          updated.customUnit = '';
        }
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
    // Validate unit - if "others" is selected, customUnit must be provided
    if (!formData.unit || formData.unit.trim().length === 0) {
      setError('Unit is required');
      return;
    }
    if (formData.unit === 'others' && (!formData.customUnit || formData.customUnit.trim().length === 0)) {
      setError('Please enter a custom unit name');
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
        unit: formData.unit === 'others' ? formData.customUnit.trim() : formData.unit.trim(),
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

      // Handle HTTP errors before parsing JSON
      if (!response.ok) {
        let errorMessage = 'Failed to create purchase order';
        
        if (response.status === 404) {
          errorMessage = 'Purchase order API route not found. The server may not be running correctly or the route may have been moved. Please refresh the page and try again.';
          console.error('[Purchase Order Creation] 404 Error - Route not found');
          console.error('[Purchase Order Creation] Request URL:', '/api/purchase-orders');
          console.error('[Purchase Order Creation] Request Method:', 'POST');
          console.error('[Purchase Order Creation] Request Payload:', payload);
        } else if (response.status === 401) {
          errorMessage = 'You are not authorized to create purchase orders. Please log in again.';
        } else if (response.status === 403) {
          errorMessage = 'You do not have permission to create purchase orders. Only Project Managers and Owners can create purchase orders.';
        } else if (response.status === 400) {
          // Try to get error message from response
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || 'Invalid request. Please check your input.';
          } catch (e) {
            errorMessage = 'Invalid request. Please check your input.';
          }
        } else if (response.status === 500) {
          errorMessage = 'Server error occurred. Please try again later or contact support.';
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        setError(errorMessage);
        toast.showError(errorMessage);
        return;
      }

      // Parse JSON response
      let data;
      try {
        data = await response.json();
      } catch (err) {
        console.error('[Purchase Order Creation] Failed to parse response:', err);
        setError('Invalid response from server. Please try again.');
        toast.showError('Invalid response from server. Please try again.');
        return;
      }

      if (data.success) {
        toast.showSuccess('Purchase order created successfully!');
        // API returns { order: {...}, capitalInfo: {...} }
        const orderId = data.data?.order?._id || data.data?._id;
        if (orderId) {
          router.push(`/purchase-orders/${orderId}`);
        } else {
          console.error('Purchase order created but ID not found in response:', data);
          setError('Purchase order created but navigation failed. Please refresh the page.');
          toast.showError('Purchase order created but navigation failed.');
        }
      } else {
        setError(data.error || 'Failed to create purchase order');
        toast.showError(data.error || 'Failed to create purchase order');
      }
    } catch (err) {
      console.error('[Purchase Order Creation] Network or other error:', err);
      setError(err.message || 'Failed to create purchase order. Please check your connection and try again.');
      toast.showError(err.message || 'Failed to create purchase order. Please check your connection and try again.');
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Loading Overlay */}
        <LoadingOverlay 
          isLoading={loading || validatingCapital} 
          message={
            loading ? "Creating purchase order..." :
            validatingCapital ? "Validating capital availability..." :
            "Processing..."
          } 
          fullScreen={false} 
        />
        {/* Header */}
        <div className="mb-8">
          <Breadcrumbs 
            items={[
              { label: 'Purchase Orders', href: '/purchase-orders' },
              { label: 'Create Order', href: '/purchase-orders/new', current: true },
            ]}
          />
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Create Purchase Order</h1>
          <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Create a purchase order from an approved material request</p>
        </div>

        {/* Capital Validation Loading */}
        {validatingCapital && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-center gap-2">
              <LoadingSpinner size="sm" color="blue-600" />
              <p className="text-sm">Validating capital availability...</p>
            </div>
          </div>
        )}

        {/* Capital Warning */}
        {capitalValidation && !capitalValidation.isValid && !validatingCapital && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">⚠️ Insufficient Capital</p>
            <p className="text-sm mt-1">{capitalValidation.message}</p>
            <p className="text-sm mt-1">This purchase order will be blocked by the server if submitted.</p>
          </div>
        )}

        {/* Capital Validation Success */}
        {capitalValidation && capitalValidation.isValid && !validatingCapital && (
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

        {/* Workflow Guide */}
        <WorkflowGuide projectId={formData.projectId} compact={true} />

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
                <HelpIcon 
                  content="Select an approved material request to create a purchase order from. Only approved requests are available."
                  position="right"
                />
              </label>
              <FieldHelp>
                Choose an approved material request. The form will auto-fill details from the selected request.
              </FieldHelp>
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
                <HelpIcon 
                  content="Select the project this purchase order is for. Capital availability will be checked for this project."
                  position="right"
                />
              </label>
              <FieldHelp>
                The project this purchase order belongs to. Capital will be validated against this project.
              </FieldHelp>
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-base font-semibold text-gray-700 leading-normal">
                  Supplier <span className="text-red-500">*</span>
                  <HelpIcon 
                    content="Select the supplier who will fulfill this purchase order. You can create a new supplier if needed."
                    position="right"
                  />
                </label>
                {canAccess('create_supplier') && (
                  <button
                    type="button"
                    onClick={() => setShowSupplierModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Create New Supplier
                  </button>
                )}
              </div>
              <FieldHelp>
                Choose the supplier for this order. Create a new supplier if they're not in the list.
              </FieldHelp>
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
                  const displayName = supplier.name || supplier.contactPerson || supplier.email || 'Unknown Supplier';
                  const contactInfo = supplier.contactPerson ? ` - ${supplier.contactPerson}` : '';
                  return (
                    <option key={supplierId || `supplier-${supplier.email}`} value={supplierId}>
                      {displayName}{contactInfo} ({supplier.email})
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
                  <HelpIcon 
                    content="Enter the quantity you're ordering. This may differ from the requested quantity."
                    position="right"
                  />
                </label>
                <FieldHelp>
                  Quantity to order. May differ from the requested quantity.
                </FieldHelp>
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
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {unitOptions.map((option) => (
                    <option key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
                {formData.unit === 'others' && (
                  <input
                    type="text"
                    name="customUnit"
                    value={formData.customUnit}
                    onChange={handleChange}
                    required
                    placeholder="Enter custom unit name"
                    className="w-full mt-2 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                  />
                )}
              </div>
            </div>

            {/* Unit Cost and Total Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Unit Cost <span className="text-red-500">*</span>
                  <HelpIcon 
                    content="Enter the cost per unit. The total cost will be calculated automatically (Quantity × Unit Cost)."
                    position="right"
                  />
                </label>
                <FieldHelp>
                  Cost per unit. Total cost is calculated automatically.
                </FieldHelp>
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
                  <HelpIcon 
                    content="Total cost is calculated automatically from Quantity × Unit Cost. This amount will be committed from project capital."
                    position="right"
                  />
                </label>
                <FieldHelp>
                  Calculated automatically. This amount will be committed from project capital.
                </FieldHelp>
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
                <HelpIcon 
                  content="Select the expected delivery date for this order. This helps with planning and tracking."
                  position="right"
                />
              </label>
              <FieldHelp>
                Expected delivery date. Helps with planning and tracking.
              </FieldHelp>
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
                isLoading={loading || validatingCapital}
                loadingText={loading ? "Creating Purchase Order..." : "Validating..."}
                disabled={capitalValidation && !capitalValidation.isValid}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Purchase Order
              </LoadingButton>
            </div>
          </div>
          </form>

          {/* Supplier Creation Modal */}
          {showSupplierModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Create New Supplier</h2>
                  <button
                    type="button"
                    onClick={() => setShowSupplierModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <SupplierCreationForm
                  onSubmit={handleCreateSupplier}
                  onCancel={() => setShowSupplierModal(false)}
                  loading={creatingSupplier}
                />
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // Supplier Creation Form Component (Modal)
  function SupplierCreationForm({ onSubmit, onCancel, loading }) {
    const [formData, setFormData] = useState({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      alternatePhone: '',
      alternateEmail: '',
      businessType: '',
      taxId: '',
      address: '',
      preferredContactMethod: 'all',
      emailEnabled: true,
      smsEnabled: true,
      pushNotificationsEnabled: true,
      status: 'active',
    });
    const [error, setError] = useState(null);

    const handleChange = (e) => {
      const { name, value, type, checked } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setError(null);

      // Validation
      if (!formData.name || formData.name.trim().length === 0) {
        setError('Supplier name is required');
        return;
      }

      if (!formData.email || formData.email.trim().length === 0) {
        setError('Email is required');
        return;
      }

      if (!formData.phone || formData.phone.trim().length === 0) {
        setError('Phone number is required');
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setError('Invalid email format');
        return;
      }

      await onSubmit(formData);
    };

    return (
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input
              type="text"
              name="contactPerson"
              value={formData.contactPerson}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
            disabled={loading}
          >
            Cancel
          </button>
          <LoadingButton
            type="submit"
            isLoading={loading}
            loadingText="Creating..."
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Supplier
          </LoadingButton>
        </div>
      </form>
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

