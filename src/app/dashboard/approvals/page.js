/**
 * Approval Queue Page
 * Displays all pending approvals for materials and expenses
 *
 * Route: /dashboard/approvals
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import {
  LoadingTable,
  LoadingButton,
  LoadingOverlay,
} from '@/components/loading';
import { CapitalBalanceWarning } from '@/components/financial/capital-balance-warning';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { ApprovalHistoryModal } from '@/components/approvals/ApprovalHistoryModal';

export default function ApprovalsPage() {
  const toast = useToast();
  const router = useRouter();
  const { canAccess, user } = usePermissions();
  const { currentProject } = useProjectContext();
  const [materials, setMaterials] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [initialExpenses, setInitialExpenses] = useState([]);
  const [materialRequests, setMaterialRequests] = useState([]);
  const [labourEntries, setLabourEntries] = useState([]);
  const [professionalFees, setProfessionalFees] = useState([]);
  const [professionalActivities, setProfessionalActivities] = useState([]);
  const [budgetReallocations, setBudgetReallocations] = useState([]);
  const [purchaseOrderModifications, setPurchaseOrderModifications] = useState([]);
  const [contingencyDraws, setContingencyDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [selectedInitialExpenses, setSelectedInitialExpenses] = useState([]);
  const [selectedMaterialRequests, setSelectedMaterialRequests] = useState([]);
  const [selectedLabourEntries, setSelectedLabourEntries] = useState([]);
  const [selectedProfessionalFees, setSelectedProfessionalFees] = useState([]);
  const [selectedProfessionalActivities, setSelectedProfessionalActivities] = useState([]);
  const [selectedBudgetReallocations, setSelectedBudgetReallocations] = useState([]);
  const [selectedPurchaseOrderModifications, setSelectedPurchaseOrderModifications] = useState([]);
  const [selectedContingencyDraws, setSelectedContingencyDraws] = useState([]);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('materials'); // 'materials', 'expenses', 'initial-expenses', 'material-requests', 'labour-entries', 'professional-fees', 'professional-activities', 'budget-reallocations', 'purchase-order-modifications', 'contingency-draws'
  
  // Set active tab from URL query parameter (for navigation from notifications)
  useEffect(() => {
    const tabFromUrl = searchParams?.get('tab');
    if (tabFromUrl && ['materials', 'expenses', 'initial-expenses', 'material-requests', 'labour-entries', 'professional-fees', 'professional-activities', 'budget-reallocations', 'purchase-order-modifications', 'contingency-draws'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);
  const [processingItems, setProcessingItems] = useState(new Set()); // Track items being processed
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState(null); // 'materials-approve', 'materials-reject', etc.
  const [rejectReason, setRejectReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectItemId, setRejectItemId] = useState(null);
  const [rejectItemType, setRejectItemType] = useState(null); // 'material', 'expense', 'initial-expense', 'material-request'
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date', 'amount', 'type', 'urgency'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  
  // Polling state
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const pollingIntervalRef = useRef(null);
  
  // Retry state
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const maxRetries = 3;
  const retryTimeoutRef = useRef(null);
  
  // Analytics state
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Approval history modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItemId, setHistoryItemId] = useState(null);
  const [historyItemType, setHistoryItemType] = useState(null);
  const [historyItemName, setHistoryItemName] = useState(null);
  
  // Function to open approval history modal
  const openHistoryModal = (itemId, itemType, itemName) => {
    setHistoryItemId(itemId);
    setHistoryItemType(itemType);
    setHistoryItemName(itemName);
    setShowHistoryModal(true);
  };
  
  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setHistoryItemId(null);
    setHistoryItemType(null);
    setHistoryItemName(null);
  };
  
  // Cross-type bulk operations
  const getTotalSelectedCount = () => {
    return (
      selectedMaterials.length +
      selectedExpenses.length +
      selectedInitialExpenses.length +
      selectedMaterialRequests.length +
      selectedLabourEntries.length +
      selectedProfessionalFees.length +
      selectedProfessionalActivities.length +
      selectedBudgetReallocations.length +
      selectedPurchaseOrderModifications.length +
      selectedContingencyDraws.length
    );
  };
  
  const getSelectedItemsByType = () => {
    return {
      materials: selectedMaterials,
      expenses: selectedExpenses,
      initial_expenses: selectedInitialExpenses,
      material_requests: selectedMaterialRequests,
      labour_entries: selectedLabourEntries,
      professional_fees: selectedProfessionalFees,
      professional_activities: selectedProfessionalActivities,
      budget_reallocations: selectedBudgetReallocations,
      purchase_order_modifications: selectedPurchaseOrderModifications,
      contingency_draws: selectedContingencyDraws,
    };
  };
  
  const handleCrossTypeBulkApprove = async () => {
    const itemsByType = getSelectedItemsByType();
    const allItems = [];
    
    // Build items array with type information
    Object.entries(itemsByType).forEach(([type, ids]) => {
      ids.forEach((id) => {
        allItems.push({ type, id });
      });
    });
    
    if (allItems.length === 0) {
      toast.showError('Please select items to approve');
      return;
    }
    
    setBulkProcessing(true);
    setShowBulkApproveModal(false);
    
    try {
      // Process each type in parallel
      const typePromises = Object.entries(itemsByType).map(async ([type, ids]) => {
        if (ids.length === 0) return { type, successful: 0, failed: 0 };
        
        let handler;
        switch (type) {
          case 'materials':
            handler = handleApproveMaterial;
            break;
          case 'expenses':
            handler = handleApproveExpense;
            break;
          case 'initial_expenses':
            handler = handleApproveInitialExpense;
            break;
          case 'material_requests':
            handler = handleApproveMaterialRequest;
            break;
          case 'labour_entries':
            handler = handleApproveLabourEntry;
            break;
          case 'professional_fees':
            handler = handleApproveProfessionalFee;
            break;
          case 'professional_activities':
            handler = handleApproveProfessionalActivity;
            break;
          case 'budget_reallocations':
            handler = handleApproveBudgetReallocation;
            break;
          case 'purchase_order_modifications':
            handler = handleApprovePurchaseOrderModification;
            break;
          case 'contingency_draws':
            handler = handleApproveContingencyDraw;
            break;
          default:
            return { type, successful: 0, failed: 0 };
        }
        
        const { successful, failed } = await executeBulkOperation(ids, handler, approvalNotes);
        return { type, successful, failed };
      });
      
      const results = await Promise.all(typePromises);
      const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
      
      // Clear all selections
      setSelectedMaterials([]);
      setSelectedExpenses([]);
      setSelectedInitialExpenses([]);
      setSelectedMaterialRequests([]);
      setSelectedLabourEntries([]);
      setSelectedProfessionalFees([]);
      setSelectedProfessionalActivities([]);
      setSelectedBudgetReallocations([]);
      setSelectedPurchaseOrderModifications([]);
      setSelectedContingencyDraws([]);
      
      if (totalSuccessful > 0) {
        toast.showSuccess(
          `Approved ${totalSuccessful} item(s) across ${results.filter(r => r.successful > 0).length} type(s) successfully!${totalFailed > 0 ? ` (${totalFailed} failed)` : ''}`
        );
      }
      if (totalFailed > 0 && totalSuccessful === 0) {
        toast.showError(`Failed to approve ${totalFailed} item(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setApprovalNotes('');
    }
  };
  
  const handleCrossTypeBulkReject = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }
    
    const itemsByType = getSelectedItemsByType();
    const allItems = [];
    
    Object.entries(itemsByType).forEach(([type, ids]) => {
      ids.forEach((id) => {
        allItems.push({ type, id });
      });
    });
    
    if (allItems.length === 0) {
      toast.showError('Please select items to reject');
      return;
    }
    
    setShowBulkRejectModal(false);
    setBulkProcessing(true);
    
    try {
      const typePromises = Object.entries(itemsByType).map(async ([type, ids]) => {
        if (ids.length === 0) return { type, successful: 0, failed: 0 };
        
        let handler;
        switch (type) {
          case 'materials':
            handler = handleRejectMaterial;
            break;
          case 'expenses':
            handler = handleRejectExpense;
            break;
          case 'initial_expenses':
            handler = handleRejectInitialExpense;
            break;
          case 'material_requests':
            handler = handleRejectMaterialRequest;
            break;
          case 'professional_fees':
            handler = handleRejectProfessionalFee;
            break;
          case 'professional_activities':
            handler = handleRejectProfessionalActivity;
            break;
          case 'budget_reallocations':
            handler = handleRejectBudgetReallocation;
            break;
          case 'purchase_order_modifications':
            handler = handleRejectPurchaseOrderModification;
            break;
          case 'contingency_draws':
            handler = handleRejectContingencyDraw;
            break;
          default:
            return { type, successful: 0, failed: 0 };
        }
        
        const { successful, failed } = await executeBulkOperation(ids, handler, rejectReason);
        return { type, successful, failed };
      });
      
      const results = await Promise.all(typePromises);
      const totalSuccessful = results.reduce((sum, r) => sum + r.successful, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
      
      // Clear all selections
      setSelectedMaterials([]);
      setSelectedExpenses([]);
      setSelectedInitialExpenses([]);
      setSelectedMaterialRequests([]);
      setSelectedLabourEntries([]);
      setSelectedProfessionalFees([]);
      setSelectedProfessionalActivities([]);
      setSelectedBudgetReallocations([]);
      setSelectedPurchaseOrderModifications([]);
      setSelectedContingencyDraws([]);
      
      if (totalSuccessful > 0) {
        toast.showSuccess(
          `Rejected ${totalSuccessful} item(s) across ${results.filter(r => r.successful > 0).length} type(s) successfully!${totalFailed > 0 ? ` (${totalFailed} failed)` : ''}`
        );
      }
      if (totalFailed > 0 && totalSuccessful === 0) {
        toast.showError(`Failed to reject ${totalFailed} item(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setRejectReason('');
    }
  };

  // Check if user has access to approvals page
  useEffect(() => {
    if (user) {
      const userRole = user.role?.toLowerCase();
      if (userRole === 'clerk' || userRole === 'site_clerk') {
        toast.showError(
          'You do not have permission to view the approvals page',
        );
        router.push('/dashboard/clerk');
        return;
      }
      if (!canAccess('view_approvals')) {
        toast.showError(
          'You do not have permission to view the approvals page',
        );
        router.push('/dashboard');
        return;
      }
    }
  }, [user, canAccess, router, toast]);

  const fetchPendingApprovals = useCallback(async (isPollingUpdate = false) => {
    // Don't fetch if no project selected (multi-project system requirement)
    if (!currentProject) {
      setLoading(false);
      setMaterials([]);
      setExpenses([]);
      setInitialExpenses([]);
      setMaterialRequests([]);
      setLabourEntries([]);
      setProfessionalFees([]);
      setProfessionalActivities([]);
      setBudgetReallocations([]);
      setPurchaseOrderModifications([]);
      setContingencyDraws([]);
      return;
    }

    try {
      // Only show loading spinner on initial load, not on polling updates
      if (!isPollingUpdate) {
        setLoading(true);
      } else {
        setIsPolling(true);
      }
      setError(null);

      const projectId = normalizeProjectId(currentProject._id);
      if (!projectId) {
        throw new Error('Invalid project ID');
      }

      const projectIdParam = `&projectId=${projectId}`;
      
      // Optimize: Fetch all requests in parallel instead of sequentially
      // This reduces total fetch time from ~2-3 seconds to ~500ms
      const cacheHeaders = {
        'Cache-Control': isPollingUpdate ? 'no-cache, no-store, must-revalidate' : 'max-age=30',
        'Pragma': 'no-cache',
      };

      const fetchOptions = {
        cache: isPollingUpdate ? 'no-store' : 'default',
        headers: cacheHeaders,
      };

      // Fetch all approval types in parallel
      const [
        materialsResponse,
        expensesResponse,
        initialExpensesResponse,
        materialRequestsResponse,
        labourEntriesResponse,
        professionalFeesResponse,
        professionalActivitiesResponse,
        budgetReallocationsResponse,
        purchaseOrdersResponse,
        contingencySummaryResponse,
      ] = await Promise.all([
        fetch(`/api/materials?status=pending_approval&limit=100${projectIdParam}`, fetchOptions),
        fetch(`/api/expenses?status=PENDING&limit=100${projectIdParam}`, fetchOptions),
        fetch(`/api/initial-expenses?status=pending_approval&limit=100${projectIdParam}`, fetchOptions),
        fetch(`/api/material-requests?status=pending_approval&limit=100${projectIdParam}`, fetchOptions),
        fetch(`/api/labour/entries?status=pending_approval&limit=100${projectIdParam}`, fetchOptions),
        fetch(`/api/professional-fees?status=PENDING&limit=100${projectIdParam}`, fetchOptions),
        fetch(`/api/professional-activities?status=pending_approval&limit=100${projectIdParam}`, fetchOptions),
        fetch(`/api/budget-reallocations?status=pending&limit=100${projectIdParam}`, fetchOptions),
        fetch(`/api/purchase-orders?status=order_modified&limit=100${projectIdParam}`, fetchOptions),
        fetch(`/api/projects/${projectId}/contingency`, fetchOptions),
      ]);

      // Process all responses in parallel
      const [
        materialsData,
        expensesData,
        initialExpensesData,
        materialRequestsData,
        labourEntriesData,
        professionalFeesData,
        professionalActivitiesData,
        budgetReallocationsData,
        purchaseOrdersData,
        contingencySummaryData,
      ] = await Promise.all([
        materialsResponse.json(),
        expensesResponse.json(),
        initialExpensesResponse.json(),
        materialRequestsResponse.json(),
        labourEntriesResponse.json(),
        professionalFeesResponse.json(),
        professionalActivitiesResponse.json(),
        budgetReallocationsResponse.json(),
        purchaseOrdersResponse.json(),
        contingencySummaryResponse.json(),
      ]);

      // Set materials
      if (materialsData.success) {
        setMaterials(materialsData.data.materials || []);
      }

      // Set expenses
      if (expensesData.success) {
        setExpenses(expensesData.data.expenses || []);
      }

      // Set initial expenses
      if (initialExpensesData.success) {
        setInitialExpenses(initialExpensesData.data.expenses || []);
      }

      // Set material requests (filter for pending_approval and requested)
      if (materialRequestsData.success) {
        const pendingRequests = (materialRequestsData.data.requests || []).filter(
          (req) => req.status === 'pending_approval' || req.status === 'requested'
        );
        setMaterialRequests(pendingRequests);
      }

      // Set labour entries
      if (labourEntriesData.success) {
        setLabourEntries(labourEntriesData.data.entries || []);
      }

      // Set professional fees (filter for PENDING and pending_approval)
      if (professionalFeesData.success) {
        const pendingFees = (professionalFeesData.data.fees || []).filter(
          (fee) => fee.status === 'PENDING' || fee.status === 'pending_approval'
        );
        setProfessionalFees(pendingFees);
      }

      // Set professional activities (filter for pending_approval and draft)
      if (professionalActivitiesData.success) {
        const pendingActivities = (professionalActivitiesData.data.activities || []).filter(
          (activity) => activity.status === 'pending_approval' || activity.status === 'draft'
        );
        setProfessionalActivities(pendingActivities);
      }

      // Set budget reallocations
      if (budgetReallocationsData.success) {
        setBudgetReallocations(budgetReallocationsData.data.reallocations || []);
      }

      // Set purchase order modifications
      if (purchaseOrdersData.success) {
        const modifiedOrders = (purchaseOrdersData.data.orders || []).filter(
          (order) => order.status === 'order_modified'
        );
        setPurchaseOrderModifications(modifiedOrders);
      }

      // Set contingency draws (count only for now)
      if (contingencySummaryData.success && contingencySummaryData.data.pendingDraws > 0) {
        setContingencyDraws([]); // Placeholder - will be populated when endpoint is available
      } else {
        setContingencyDraws([]);
      }
      
      // Update last updated timestamp
      setLastUpdated(new Date());
      // Reset retry count on success
      setRetryCount(0);
      setIsRetrying(false);
      
      // Mark approval-related notifications as read when viewing approvals page
      if (currentProject) {
        try {
          // Mark all approval_needed notifications for this project as read
          const response = await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              projectId: projectId,
              type: 'approval_needed', // Only mark approval_needed notifications
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.data?.markedCount > 0) {
              // Silently mark as read - no need to show toast for this
              console.log(`Marked ${data.data.markedCount} approval notification(s) as read`);
            }
          }
        } catch (err) {
          // Non-critical - don't break the flow if notification marking fails
          console.error('Error marking notifications as read:', err);
        }
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch approvals';
      setError(errorMessage);
      console.error('Fetch approvals error:', err);
      
      // Auto-retry logic for network errors (only on initial load, not polling)
      if (!isPollingUpdate) {
        setRetryCount((prevCount) => {
          if (prevCount < maxRetries) {
            setIsRetrying(true);
            const nextCount = prevCount + 1;
            
            // Clear any existing retry timeout
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }
            
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, prevCount) * 1000;
            retryTimeoutRef.current = setTimeout(() => {
              fetchPendingApprovals(false);
            }, delay);
            
            return nextCount;
          } else {
            setIsRetrying(false);
            return prevCount;
          }
        });
      } else {
        setIsRetrying(false);
      }
    } finally {
      setLoading(false);
      setIsPolling(false);
    }
  }, [currentProject]);

  // Initial fetch and polling setup
  useEffect(() => {
    if (
      user &&
      user.role?.toLowerCase() !== 'clerk' &&
      user.role?.toLowerCase() !== 'site_clerk'
    ) {
      // Initial fetch
      fetchPendingApprovals(false);
      
      // Set up polling - only if project is selected
      if (currentProject) {
        // Clear any existing interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        
        // Set up new polling interval (every 45 seconds)
        pollingIntervalRef.current = setInterval(() => {
          if (currentProject) {
            fetchPendingApprovals(true); // Pass true to indicate this is a polling update
          }
        }, 45000); // 45 seconds
      } else {
        // Stop polling if no project selected
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    }
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [user, currentProject, fetchPendingApprovals]); // Add currentProject to dependencies to refetch when project changes

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!currentProject) return;
    
    setAnalyticsLoading(true);
    try {
      const response = await fetch(`/api/approvals/analytics?projectId=${currentProject._id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAnalytics(data.data);
      } else {
        console.error('Failed to fetch analytics:', data.error);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [currentProject]);

  // Fetch analytics when toggled
  useEffect(() => {
    if (showAnalytics && currentProject && !analytics) {
      fetchAnalytics();
    }
  }, [showAnalytics, currentProject, analytics, fetchAnalytics]);

  const handleApproveMaterial = async (materialId, notes = '') => {
    setProcessingItems((prev) => new Set(prev).add(materialId));
    try {
      const response = await fetch(`/api/materials/${materialId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve material');
      }

      // Remove from list
      setMaterials((prev) => prev.filter((m) => m._id !== materialId));
      setSelectedMaterials((prev) => prev.filter((id) => id !== materialId));
      toast.showSuccess('Material approved successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Approve error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(materialId);
        return next;
      });
    }
  };

  const handleRejectMaterialClick = (materialId) => {
    setRejectItemId(materialId);
    setRejectItemType('material');
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectMaterial = async (materialId, reason) => {
    if (!reason) {
      handleRejectMaterialClick(materialId);
      return;
    }

    setProcessingItems((prev) => new Set(prev).add(materialId));
    try {
      const response = await fetch(`/api/materials/${materialId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject material');
      }

      // Remove from list
      setMaterials((prev) => prev.filter((m) => m._id !== materialId));
      setSelectedMaterials((prev) => prev.filter((id) => id !== materialId));
      toast.showSuccess('Material rejected successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Reject error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(materialId);
        return next;
      });
    }
  };

  const handleApproveExpense = async (expenseId, notes = '') => {
    try {
      const response = await fetch(`/api/expenses/${expenseId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve expense');
      }

      // Remove from list
      setExpenses((prev) => prev.filter((e) => e._id !== expenseId));
      setSelectedExpenses((prev) => prev.filter((id) => id !== expenseId));
      toast.showSuccess('Expense approved successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Approve expense error:', err);
    }
  };

  const handleRejectExpenseClick = (expenseId) => {
    setRejectItemId(expenseId);
    setRejectItemType('expense');
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectExpense = async (expenseId, reason) => {
    if (!reason) {
      handleRejectExpenseClick(expenseId);
      return;
    }

    try {
      const response = await fetch(`/api/expenses/${expenseId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject expense');
      }

      // Remove from list
      setExpenses((prev) => prev.filter((e) => e._id !== expenseId));
      setSelectedExpenses((prev) => prev.filter((id) => id !== expenseId));
      toast.showSuccess('Expense rejected successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Reject expense error:', err);
    }
  };

  // Helper function for parallel bulk operations
  const executeBulkOperation = async (items, operation, notesOrReason = '') => {
    const results = await Promise.allSettled(
      items.map((itemId) => operation(itemId, notesOrReason))
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { successful, failed, total: items.length };
  };

  const handleBulkApproveMaterialsClick = () => {
    if (selectedMaterials.length === 0) {
      toast.showError('Please select materials to approve');
      return;
    }
    setBulkActionType('materials-approve');
    setApprovalNotes('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApproveMaterials = async () => {
    setBulkProcessing(true);
    setShowBulkApproveModal(false);

    try {
      // Process all approvals in parallel for better performance
      const results = await Promise.allSettled(
        selectedMaterials.map((itemId) => handleApproveMaterial(itemId, approvalNotes))
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      setSelectedMaterials([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Approved ${successful} material(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to approve ${failed} material(s)`);
      }
      
      // Refresh data after bulk operation
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setApprovalNotes('');
    }
  };

  const handleBulkRejectMaterialsClick = () => {
    if (selectedMaterials.length === 0) {
      toast.showError('Please select materials to reject');
      return;
    }
    setBulkActionType('materials-reject');
    setRejectReason('');
    setShowBulkRejectModal(true);
  };

  const handleBulkRejectMaterials = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }
    setShowBulkRejectModal(false);
    setBulkProcessing(true);
    try {
      // Process all rejections in parallel
      const results = await Promise.allSettled(
        selectedMaterials.map((itemId) => handleRejectMaterial(itemId, rejectReason))
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      setSelectedMaterials([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Rejected ${successful} material(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to reject ${failed} material(s)`);
      }
      
      // Refresh data after bulk operation
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setRejectReason('');
    }
  };

  const handleBulkApproveExpensesClick = () => {
    if (selectedExpenses.length === 0) {
      toast.showError('Please select expenses to approve');
      return;
    }
    setBulkActionType('expenses-approve');
    setApprovalNotes('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApproveExpenses = async () => {
    setBulkProcessing(true);
    setShowBulkApproveModal(false);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedExpenses,
        handleApproveExpense,
        approvalNotes
      );

      setSelectedExpenses([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Approved ${successful} expense(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to approve ${failed} expense(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setApprovalNotes('');
    }
  };

  const handleBulkRejectExpensesClick = () => {
    if (selectedExpenses.length === 0) {
      toast.showError('Please select expenses to reject');
      return;
    }
    setBulkActionType('expenses-reject');
    setRejectReason('');
    setShowBulkRejectModal(true);
  };

  const handleBulkRejectExpenses = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }
    setShowBulkRejectModal(false);
    setBulkProcessing(true);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedExpenses,
        handleRejectExpense,
        rejectReason
      );

      setSelectedExpenses([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Rejected ${successful} expense(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to reject ${failed} expense(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setRejectReason('');
    }
  };

  const toggleSelectMaterial = (materialId) => {
    setSelectedMaterials((prev) =>
      prev.includes(materialId)
        ? prev.filter((id) => id !== materialId)
        : [...prev, materialId],
    );
  };

  const toggleSelectAllMaterials = () => {
    const filteredIds = filteredMaterials.map((m) => m._id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedMaterials.includes(id));
    if (allFilteredSelected) {
      // Deselect all filtered items
      setSelectedMaterials(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered items
      setSelectedMaterials(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const toggleSelectExpense = (expenseId) => {
    setSelectedExpenses((prev) =>
      prev.includes(expenseId)
        ? prev.filter((id) => id !== expenseId)
        : [...prev, expenseId],
    );
  };

  const toggleSelectAllExpenses = () => {
    const filteredIds = filteredExpenses.map((e) => e._id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedExpenses.includes(id));
    if (allFilteredSelected) {
      setSelectedExpenses(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedExpenses(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleApproveInitialExpense = async (initialExpenseId, notes = '') => {
    try {
      const response = await fetch(
        `/api/initial-expenses/${initialExpenseId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: true, notes }),
        },
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve initial expense');
      }

      setInitialExpenses((prev) =>
        prev.filter((e) => e._id !== initialExpenseId),
      );
      setSelectedInitialExpenses((prev) =>
        prev.filter((id) => id !== initialExpenseId),
      );
      toast.showSuccess('Initial expense approved successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Approve initial expense error:', err);
    }
  };

  const handleRejectInitialExpenseClick = (initialExpenseId) => {
    setRejectItemId(initialExpenseId);
    setRejectItemType('initial-expense');
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectInitialExpense = async (initialExpenseId, reason) => {
    if (!reason) {
      handleRejectInitialExpenseClick(initialExpenseId);
      return;
    }

    try {
      const response = await fetch(
        `/api/initial-expenses/${initialExpenseId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: false, notes: reason }),
        },
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject initial expense');
      }

      setInitialExpenses((prev) =>
        prev.filter((e) => e._id !== initialExpenseId),
      );
      setSelectedInitialExpenses((prev) =>
        prev.filter((id) => id !== initialExpenseId),
      );
      toast.showSuccess('Initial expense rejected successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Reject initial expense error:', err);
    }
  };

  const toggleSelectInitialExpense = (initialExpenseId) => {
    setSelectedInitialExpenses((prev) =>
      prev.includes(initialExpenseId)
        ? prev.filter((id) => id !== initialExpenseId)
        : [...prev, initialExpenseId],
    );
  };

  const toggleSelectAllInitialExpenses = () => {
    const filteredIds = filteredInitialExpenses.map((e) => e._id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedInitialExpenses.includes(id));
    if (allFilteredSelected) {
      setSelectedInitialExpenses(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedInitialExpenses(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleBulkApproveInitialExpensesClick = () => {
    if (selectedInitialExpenses.length === 0) {
      toast.showError('Please select initial expenses to approve');
      return;
    }
    setBulkActionType('initial-expenses-approve');
    setApprovalNotes('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApproveInitialExpenses = async () => {
    setBulkProcessing(true);
    setShowBulkApproveModal(false);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedInitialExpenses,
        handleApproveInitialExpense,
        approvalNotes
      );

      setSelectedInitialExpenses([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Approved ${successful} initial expense(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to approve ${failed} initial expense(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setApprovalNotes('');
    }
  };

  const handleBulkRejectInitialExpensesClick = () => {
    if (selectedInitialExpenses.length === 0) {
      toast.showError('Please select initial expenses to reject');
      return;
    }
    setBulkActionType('initial-expenses-reject');
    setRejectReason('');
    setShowBulkRejectModal(true);
  };

  const handleBulkRejectInitialExpenses = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }
    setShowBulkRejectModal(false);
    setBulkProcessing(true);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedInitialExpenses,
        handleRejectInitialExpense,
        rejectReason
      );

      setSelectedInitialExpenses([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Rejected ${successful} initial expense(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to reject ${failed} initial expense(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setRejectReason('');
    }
  };

  // Material Requests Handlers
  const handleApproveMaterialRequest = async (requestId, notes = '') => {
    setProcessingItems((prev) => new Set(prev).add(requestId));
    try {
      const response = await fetch(`/api/material-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes: notes }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve material request');
      }

      // Remove from list
      setMaterialRequests((prev) => prev.filter((r) => r._id !== requestId));
      setSelectedMaterialRequests((prev) => prev.filter((id) => id !== requestId));
      toast.showSuccess('Material request approved successfully!');
      
      if (data.data?.financialWarning) {
        toast.showWarning(data.data.financialWarning.message);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Approve material request error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleRejectMaterialRequestClick = (requestId) => {
    setRejectItemId(requestId);
    setRejectItemType('material-request');
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectMaterialRequest = async (requestId, reason) => {
    if (!reason) {
      handleRejectMaterialRequestClick(requestId);
      return;
    }

    setProcessingItems((prev) => new Set(prev).add(requestId));
    try {
      const response = await fetch(`/api/material-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject material request');
      }

      // Remove from list
      setMaterialRequests((prev) => prev.filter((r) => r._id !== requestId));
      setSelectedMaterialRequests((prev) => prev.filter((id) => id !== requestId));
      toast.showSuccess('Material request rejected successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Reject material request error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const toggleSelectMaterialRequest = (requestId) => {
    setSelectedMaterialRequests((prev) =>
      prev.includes(requestId)
        ? prev.filter((id) => id !== requestId)
        : [...prev, requestId],
    );
  };

  const toggleSelectAllMaterialRequests = () => {
    const filteredIds = filteredMaterialRequests.map((r) => r._id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedMaterialRequests.includes(id));
    if (allFilteredSelected) {
      setSelectedMaterialRequests(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedMaterialRequests(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleBulkApproveMaterialRequestsClick = () => {
    if (selectedMaterialRequests.length === 0) {
      toast.showError('Please select material requests to approve');
      return;
    }
    setBulkActionType('material-requests-approve');
    setApprovalNotes('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApproveMaterialRequests = async () => {
    setBulkProcessing(true);
    setShowBulkApproveModal(false);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedMaterialRequests,
        handleApproveMaterialRequest,
        approvalNotes
      );

      setSelectedMaterialRequests([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Approved ${successful} material request(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to approve ${failed} material request(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setApprovalNotes('');
    }
  };

  const handleBulkRejectMaterialRequestsClick = () => {
    if (selectedMaterialRequests.length === 0) {
      toast.showError('Please select material requests to reject');
      return;
    }
    setBulkActionType('material-requests-reject');
    setRejectReason('');
    setShowBulkRejectModal(true);
  };

  const handleBulkRejectMaterialRequests = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }
    setShowBulkRejectModal(false);
    setBulkProcessing(true);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedMaterialRequests,
        handleRejectMaterialRequest,
        rejectReason
      );

      setSelectedMaterialRequests([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Rejected ${successful} material request(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to reject ${failed} material request(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setRejectReason('');
    }
  };

  // Labour Entries Handlers
  const handleApproveLabourEntry = async (entryId) => {
    setProcessingItems((prev) => new Set(prev).add(entryId));
    try {
      const response = await fetch(`/api/labour/entries/${entryId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve labour entry');
      }

      // Remove from list
      setLabourEntries((prev) => prev.filter((e) => e._id !== entryId));
      setSelectedLabourEntries((prev) => prev.filter((id) => id !== entryId));
      toast.showSuccess('Labour entry approved successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Approve labour entry error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }
  };

  const toggleSelectLabourEntry = (entryId) => {
    setSelectedLabourEntries((prev) =>
      prev.includes(entryId)
        ? prev.filter((id) => id !== entryId)
        : [...prev, entryId],
    );
  };

  const toggleSelectAllLabourEntries = () => {
    const filteredIds = filteredLabourEntries.map((e) => e._id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedLabourEntries.includes(id));
    if (allFilteredSelected) {
      setSelectedLabourEntries(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedLabourEntries(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleBulkApproveLabourEntriesClick = () => {
    if (selectedLabourEntries.length === 0) {
      toast.showError('Please select labour entries to approve');
      return;
    }
    setBulkActionType('labour-entries-approve');
    setApprovalNotes('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApproveLabourEntries = async () => {
    setBulkProcessing(true);
    setShowBulkApproveModal(false);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedLabourEntries,
        handleApproveLabourEntry,
        ''
      );

      setSelectedLabourEntries([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Approved ${successful} labour entry(ies) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to approve ${failed} labour entry(ies)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setApprovalNotes('');
    }
  };

  // Professional Fees Handlers
  const handleApproveProfessionalFee = async (feeId, notes = '') => {
    setProcessingItems((prev) => new Set(prev).add(feeId));
    try {
      const response = await fetch(`/api/professional-fees/${feeId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes: notes }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve professional fee');
      }

      // Remove from list
      setProfessionalFees((prev) => prev.filter((f) => f._id !== feeId));
      setSelectedProfessionalFees((prev) => prev.filter((id) => id !== feeId));
      toast.showSuccess('Professional fee approved successfully!');
      
      if (data.data?.financialWarning) {
        toast.showWarning(data.data.financialWarning.message);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Approve professional fee error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(feeId);
        return next;
      });
    }
  };

  const handleRejectProfessionalFeeClick = (feeId) => {
    setRejectItemId(feeId);
    setRejectItemType('professional-fee');
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectProfessionalFee = async (feeId, reason) => {
    if (!reason) {
      handleRejectProfessionalFeeClick(feeId);
      return;
    }

    setProcessingItems((prev) => new Set(prev).add(feeId));
    try {
      const response = await fetch(`/api/professional-fees/${feeId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject professional fee');
      }

      // Remove from list
      setProfessionalFees((prev) => prev.filter((f) => f._id !== feeId));
      setSelectedProfessionalFees((prev) => prev.filter((id) => id !== feeId));
      toast.showSuccess('Professional fee rejected successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Reject professional fee error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(feeId);
        return next;
      });
    }
  };

  const toggleSelectProfessionalFee = (feeId) => {
    setSelectedProfessionalFees((prev) =>
      prev.includes(feeId)
        ? prev.filter((id) => id !== feeId)
        : [...prev, feeId],
    );
  };

  const toggleSelectAllProfessionalFees = () => {
    const filteredIds = filteredProfessionalFees.map((f) => f._id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedProfessionalFees.includes(id));
    if (allFilteredSelected) {
      setSelectedProfessionalFees(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedProfessionalFees(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleBulkApproveProfessionalFeesClick = () => {
    if (selectedProfessionalFees.length === 0) {
      toast.showError('Please select professional fees to approve');
      return;
    }
    setBulkActionType('professional-fees-approve');
    setApprovalNotes('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApproveProfessionalFees = async () => {
    setBulkProcessing(true);
    setShowBulkApproveModal(false);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedProfessionalFees,
        handleApproveProfessionalFee,
        approvalNotes
      );

      setSelectedProfessionalFees([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Approved ${successful} professional fee(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to approve ${failed} professional fee(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setApprovalNotes('');
    }
  };

  const handleBulkRejectProfessionalFeesClick = () => {
    if (selectedProfessionalFees.length === 0) {
      toast.showError('Please select professional fees to reject');
      return;
    }
    setBulkActionType('professional-fees-reject');
    setRejectReason('');
    setShowBulkRejectModal(true);
  };

  const handleBulkRejectProfessionalFees = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }
    setShowBulkRejectModal(false);
    setBulkProcessing(true);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedProfessionalFees,
        handleRejectProfessionalFee,
        rejectReason
      );

      setSelectedProfessionalFees([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Rejected ${successful} professional fee(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to reject ${failed} professional fee(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setRejectReason('');
    }
  };

  // Professional Activities Handlers
  const handleApproveProfessionalActivity = async (activityId, notes = '') => {
    setProcessingItems((prev) => new Set(prev).add(activityId));
    try {
      const response = await fetch(`/api/professional-activities/${activityId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes: notes }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve professional activity');
      }

      // Remove from list
      setProfessionalActivities((prev) => prev.filter((a) => a._id !== activityId));
      setSelectedProfessionalActivities((prev) => prev.filter((id) => id !== activityId));
      toast.showSuccess('Professional activity approved successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Approve professional activity error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
    }
  };

  const handleRejectProfessionalActivityClick = (activityId) => {
    setRejectItemId(activityId);
    setRejectItemType('professional-activity');
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectProfessionalActivity = async (activityId, reason) => {
    if (!reason) {
      handleRejectProfessionalActivityClick(activityId);
      return;
    }

    setProcessingItems((prev) => new Set(prev).add(activityId));
    try {
      const response = await fetch(`/api/professional-activities/${activityId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject professional activity');
      }

      // Remove from list
      setProfessionalActivities((prev) => prev.filter((a) => a._id !== activityId));
      setSelectedProfessionalActivities((prev) => prev.filter((id) => id !== activityId));
      toast.showSuccess('Professional activity rejected successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Reject professional activity error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
    }
  };

  const toggleSelectProfessionalActivity = (activityId) => {
    setSelectedProfessionalActivities((prev) =>
      prev.includes(activityId)
        ? prev.filter((id) => id !== activityId)
        : [...prev, activityId],
    );
  };

  const toggleSelectAllProfessionalActivities = () => {
    const filteredIds = filteredProfessionalActivities.map((a) => a._id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedProfessionalActivities.includes(id));
    if (allFilteredSelected) {
      setSelectedProfessionalActivities(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedProfessionalActivities(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleBulkApproveProfessionalActivitiesClick = () => {
    if (selectedProfessionalActivities.length === 0) {
      toast.showError('Please select professional activities to approve');
      return;
    }
    setBulkActionType('professional-activities-approve');
    setApprovalNotes('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApproveProfessionalActivities = async () => {
    setBulkProcessing(true);
    setShowBulkApproveModal(false);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedProfessionalActivities,
        handleApproveProfessionalActivity,
        approvalNotes
      );

      setSelectedProfessionalActivities([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Approved ${successful} professional activity(ies) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to approve ${failed} professional activity(ies)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setApprovalNotes('');
    }
  };

  const handleBulkRejectProfessionalActivitiesClick = () => {
    if (selectedProfessionalActivities.length === 0) {
      toast.showError('Please select professional activities to reject');
      return;
    }
    setBulkActionType('professional-activities-reject');
    setRejectReason('');
    setShowBulkRejectModal(true);
  };

  const handleBulkRejectProfessionalActivities = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }
    setShowBulkRejectModal(false);
    setBulkProcessing(true);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedProfessionalActivities,
        handleRejectProfessionalActivity,
        rejectReason
      );

      setSelectedProfessionalActivities([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Rejected ${successful} professional activity(ies) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to reject ${failed} professional activity(ies)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setRejectReason('');
    }
  };

  // Budget Reallocations Handlers
  const handleApproveBudgetReallocation = async (reallocationId, notes = '') => {
    setProcessingItems((prev) => new Set(prev).add(reallocationId));
    try {
      const response = await fetch(`/api/budget-reallocations/${reallocationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes: notes }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve budget reallocation');
      }

      // Remove from list
      setBudgetReallocations((prev) => prev.filter((r) => r._id !== reallocationId));
      setSelectedBudgetReallocations((prev) => prev.filter((id) => id !== reallocationId));
      toast.showSuccess('Budget reallocation approved and executed successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Approve budget reallocation error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(reallocationId);
        return next;
      });
    }
  };

  const handleRejectBudgetReallocationClick = (reallocationId) => {
    setRejectItemId(reallocationId);
    setRejectItemType('budget-reallocation');
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectBudgetReallocation = async (reallocationId, reason) => {
    if (!reason) {
      handleRejectBudgetReallocationClick(reallocationId);
      return;
    }

    setProcessingItems((prev) => new Set(prev).add(reallocationId));
    try {
      const response = await fetch(`/api/budget-reallocations/${reallocationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject budget reallocation');
      }

      // Remove from list
      setBudgetReallocations((prev) => prev.filter((r) => r._id !== reallocationId));
      setSelectedBudgetReallocations((prev) => prev.filter((id) => id !== reallocationId));
      toast.showSuccess('Budget reallocation rejected successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Reject budget reallocation error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(reallocationId);
        return next;
      });
    }
  };

  const toggleSelectBudgetReallocation = (reallocationId) => {
    setSelectedBudgetReallocations((prev) =>
      prev.includes(reallocationId)
        ? prev.filter((id) => id !== reallocationId)
        : [...prev, reallocationId],
    );
  };

  const toggleSelectAllBudgetReallocations = () => {
    const filteredIds = filteredBudgetReallocations.map((r) => r._id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedBudgetReallocations.includes(id));
    if (allFilteredSelected) {
      setSelectedBudgetReallocations(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedBudgetReallocations(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleBulkApproveBudgetReallocationsClick = () => {
    if (selectedBudgetReallocations.length === 0) {
      toast.showError('Please select budget reallocations to approve');
      return;
    }
    setBulkActionType('budget-reallocations-approve');
    setApprovalNotes('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApproveBudgetReallocations = async () => {
    setBulkProcessing(true);
    setShowBulkApproveModal(false);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedBudgetReallocations,
        handleApproveBudgetReallocation,
        approvalNotes
      );

      setSelectedBudgetReallocations([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Approved ${successful} budget reallocation(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to approve ${failed} budget reallocation(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setApprovalNotes('');
    }
  };

  const handleBulkRejectBudgetReallocationsClick = () => {
    if (selectedBudgetReallocations.length === 0) {
      toast.showError('Please select budget reallocations to reject');
      return;
    }
    setBulkActionType('budget-reallocations-reject');
    setRejectReason('');
    setShowBulkRejectModal(true);
  };

  const handleBulkRejectBudgetReallocations = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }
    setShowBulkRejectModal(false);
    setBulkProcessing(true);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedBudgetReallocations,
        handleRejectBudgetReallocation,
        rejectReason
      );

      setSelectedBudgetReallocations([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Rejected ${successful} budget reallocation(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to reject ${failed} budget reallocation(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setRejectReason('');
    }
  };

  // Purchase Order Modifications Handlers
  const handleApprovePurchaseOrderModification = async (orderId, notes = '') => {
    setProcessingItems((prev) => new Set(prev).add(orderId));
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}/approve-modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes: notes }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve purchase order modification');
      }

      // Remove from list
      setPurchaseOrderModifications((prev) => prev.filter((o) => o._id !== orderId));
      setSelectedPurchaseOrderModifications((prev) => prev.filter((id) => id !== orderId));
      toast.showSuccess('Purchase order modification approved successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Approve purchase order modification error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleRejectPurchaseOrderModificationClick = (orderId) => {
    setRejectItemId(orderId);
    setRejectItemType('purchase-order-modification');
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectPurchaseOrderModification = async (orderId, reason) => {
    if (!reason) {
      handleRejectPurchaseOrderModificationClick(orderId);
      return;
    }

    setProcessingItems((prev) => new Set(prev).add(orderId));
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}/reject-modification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject purchase order modification');
      }

      // Remove from list
      setPurchaseOrderModifications((prev) => prev.filter((o) => o._id !== orderId));
      setSelectedPurchaseOrderModifications((prev) => prev.filter((id) => id !== orderId));
      toast.showSuccess('Purchase order modification rejected successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Reject purchase order modification error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const toggleSelectPurchaseOrderModification = (orderId) => {
    setSelectedPurchaseOrderModifications((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  };

  const toggleSelectAllPurchaseOrderModifications = () => {
    const filteredIds = filteredPurchaseOrderModifications.map((o) => o._id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedPurchaseOrderModifications.includes(id));
    if (allFilteredSelected) {
      setSelectedPurchaseOrderModifications(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedPurchaseOrderModifications(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleBulkApprovePurchaseOrderModificationsClick = () => {
    if (selectedPurchaseOrderModifications.length === 0) {
      toast.showError('Please select purchase order modifications to approve');
      return;
    }
    setBulkActionType('purchase-order-modifications-approve');
    setApprovalNotes('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApprovePurchaseOrderModifications = async () => {
    setBulkProcessing(true);
    setShowBulkApproveModal(false);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedPurchaseOrderModifications,
        handleApprovePurchaseOrderModification,
        approvalNotes
      );

      setSelectedPurchaseOrderModifications([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Approved ${successful} purchase order modification(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to approve ${failed} purchase order modification(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setApprovalNotes('');
    }
  };

  const handleBulkRejectPurchaseOrderModificationsClick = () => {
    if (selectedPurchaseOrderModifications.length === 0) {
      toast.showError('Please select purchase order modifications to reject');
      return;
    }
    setBulkActionType('purchase-order-modifications-reject');
    setRejectReason('');
    setShowBulkRejectModal(true);
  };

  const handleBulkRejectPurchaseOrderModifications = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }
    setShowBulkRejectModal(false);
    setBulkProcessing(true);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedPurchaseOrderModifications,
        handleRejectPurchaseOrderModification,
        rejectReason
      );

      setSelectedPurchaseOrderModifications([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Rejected ${successful} purchase order modification(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to reject ${failed} purchase order modification(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setRejectReason('');
    }
  };

  // Contingency Draws Handlers
  const handleApproveContingencyDraw = async (drawId, notes = '') => {
    if (!currentProject) {
      toast.showError('No project selected');
      return;
    }

    setProcessingItems((prev) => new Set(prev).add(drawId));
    try {
      const response = await fetch(`/api/projects/${currentProject._id}/contingency/draw/${drawId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true, notes }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve contingency draw');
      }

      // Remove from list
      setContingencyDraws((prev) => prev.filter((d) => d._id !== drawId));
      setSelectedContingencyDraws((prev) => prev.filter((id) => id !== drawId));
      toast.showSuccess('Contingency draw approved successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Approve contingency draw error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(drawId);
        return next;
      });
    }
  };

  const handleRejectContingencyDrawClick = (drawId) => {
    setRejectItemId(drawId);
    setRejectItemType('contingency-draw');
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectContingencyDraw = async (drawId, reason) => {
    if (!reason) {
      handleRejectContingencyDrawClick(drawId);
      return;
    }

    if (!currentProject) {
      toast.showError('No project selected');
      return;
    }

    setProcessingItems((prev) => new Set(prev).add(drawId));
    try {
      const response = await fetch(`/api/projects/${currentProject._id}/contingency/draw/${drawId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, notes: reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject contingency draw');
      }

      // Remove from list
      setContingencyDraws((prev) => prev.filter((d) => d._id !== drawId));
      setSelectedContingencyDraws((prev) => prev.filter((id) => id !== drawId));
      toast.showSuccess('Contingency draw rejected successfully!');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
      console.error('Reject contingency draw error:', err);
    } finally {
      setProcessingItems((prev) => {
        const next = new Set(prev);
        next.delete(drawId);
        return next;
      });
    }
  };

  const toggleSelectContingencyDraw = (drawId) => {
    setSelectedContingencyDraws((prev) =>
      prev.includes(drawId)
        ? prev.filter((id) => id !== drawId)
        : [...prev, drawId],
    );
  };

  const toggleSelectAllContingencyDraws = () => {
    const filteredIds = filteredContingencyDraws.map((d) => d._id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedContingencyDraws.includes(id));
    if (allFilteredSelected) {
      setSelectedContingencyDraws(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedContingencyDraws(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleBulkApproveContingencyDrawsClick = () => {
    if (selectedContingencyDraws.length === 0) {
      toast.showError('Please select contingency draws to approve');
      return;
    }
    setBulkActionType('contingency-draws-approve');
    setApprovalNotes('');
    setShowBulkApproveModal(true);
  };

  const handleBulkApproveContingencyDraws = async () => {
    setBulkProcessing(true);
    setShowBulkApproveModal(false);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedContingencyDraws,
        handleApproveContingencyDraw,
        approvalNotes
      );

      setSelectedContingencyDraws([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Approved ${successful} contingency draw(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to approve ${failed} contingency draw(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setApprovalNotes('');
    }
  };

  const handleBulkRejectContingencyDrawsClick = () => {
    if (selectedContingencyDraws.length === 0) {
      toast.showError('Please select contingency draws to reject');
      return;
    }
    setBulkActionType('contingency-draws-reject');
    setRejectReason('');
    setShowBulkRejectModal(true);
  };

  const handleBulkRejectContingencyDraws = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }
    setShowBulkRejectModal(false);
    setBulkProcessing(true);
    try {
      const { successful, failed } = await executeBulkOperation(
        selectedContingencyDraws,
        handleRejectContingencyDraw,
        rejectReason
      );

      setSelectedContingencyDraws([]);
      
      if (successful > 0) {
        toast.showSuccess(
          `Rejected ${successful} contingency draw(s) successfully!${failed > 0 ? ` (${failed} failed)` : ''}`
        );
      }
      if (failed > 0 && successful === 0) {
        toast.showError(`Failed to reject ${failed} contingency draw(s)`);
      }
      
      fetchPendingApprovals(false);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setRejectReason('');
    }
  };

  // Export approvals data to CSV
  const handleExportCSV = useCallback(async () => {
    if (!currentProject) {
      toast.showError('Please select a project');
      return;
    }
    
    setExporting(true);
    try {
      // Collect all pending items
      const allItems = [];
      
      const addItems = (items, type, titleField, amountField) => {
        items.forEach(item => {
          allItems.push({
            Type: type,
            Title: item[titleField] || 'N/A',
            Amount: item[amountField] || 0,
            Status: item.status || 'pending',
            Date: item.createdAt || item.submittedAt || item.requestedAt || item.entryDate || item.activityDate || 'N/A',
            RequestedBy: item.requestedByName || item.createdByName || item.submittedByName || 'Unknown',
          });
        });
      };
      
      addItems(materials, 'Material', 'name', 'totalCost');
      addItems(expenses, 'Expense', 'description', 'amount');
      addItems(initialExpenses, 'Initial Expense', 'itemName', 'amount');
      addItems(materialRequests, 'Material Request', 'materialName', 'estimatedCost');
      addItems(labourEntries, 'Labour Entry', 'taskDescription', 'totalCost');
      addItems(professionalFees, 'Professional Fee', 'description', 'amount');
      addItems(professionalActivities, 'Professional Activity', 'activityType', 'feesCharged');
      addItems(budgetReallocations, 'Budget Reallocation', 'reason', 'amount');
      addItems(purchaseOrderModifications, 'PO Modification', 'orderNumber', 'totalCost');
      addItems(contingencyDraws, 'Contingency Draw', 'reason', 'amount');
      
      // Convert to CSV
      const headers = ['Type', 'Title', 'Amount', 'Status', 'Date', 'RequestedBy'];
      const csvRows = [
        headers.join(','),
        ...allItems.map(item => [
          `"${item.Type}"`,
          `"${item.Title}"`,
          item.Amount,
          `"${item.Status}"`,
          `"${item.Date}"`,
          `"${item.RequestedBy}"`,
        ].join(',')),
      ];
      
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `approvals-${currentProject.projectCode || currentProject._id}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.showSuccess('Approvals data exported successfully!');
    } catch (err) {
      console.error('Export error:', err);
      toast.showError('Failed to export approvals data');
    } finally {
      setExporting(false);
    }
  }, [currentProject, materials, expenses, initialExpenses, materialRequests, labourEntries, professionalFees, professionalActivities, budgetReallocations, purchaseOrderModifications, contingencyDraws, toast]);
  
  // Helper function to get urgency badge color
  const getUrgencyBadgeColor = (urgency) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[urgency?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  // Helper function to calculate urgency based on age
  const calculateUrgencyFromAge = (item) => {
    const submittedDate = item.createdAt || item.submittedAt || item.requestedAt || item.entryDate || item.activityDate;
    if (!submittedDate) return 'medium';
    
    const daysSinceSubmission = Math.floor((new Date() - new Date(submittedDate)) / (1000 * 60 * 60 * 24));
    
    if (daysSinceSubmission >= 7) return 'critical';
    if (daysSinceSubmission >= 3) return 'high';
    if (daysSinceSubmission >= 1) return 'medium';
    return 'low';
  };

  // Helper function to get pending age text
  const getPendingAge = (item) => {
    const submittedDate = item.createdAt || item.submittedAt || item.requestedAt || item.entryDate || item.activityDate;
    if (!submittedDate) return null;
    
    const daysSinceSubmission = Math.floor((new Date() - new Date(submittedDate)) / (1000 * 60 * 60 * 24));
    const hoursSinceSubmission = Math.floor((new Date() - new Date(submittedDate)) / (1000 * 60 * 60));
    
    if (daysSinceSubmission > 0) {
      return `${daysSinceSubmission} day${daysSinceSubmission !== 1 ? 's' : ''}`;
    } else if (hoursSinceSubmission > 0) {
      return `${hoursSinceSubmission} hour${hoursSinceSubmission !== 1 ? 's' : ''}`;
    } else {
      return 'Just now';
    }
  };

  // Helper function to get effective urgency (from item or calculated from age)
  const getEffectiveUrgency = (item) => {
    // If item has explicit urgency, use it
    if (item.urgency) return item.urgency.toLowerCase();
    // Otherwise, calculate from age
    return calculateUrgencyFromAge(item);
  };

  // Helper function to filter items by search query
  const filterItems = (items, type) => {
    if (!searchQuery.trim()) return items;
    
    const query = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      // Search in common fields
      const searchableFields = [
        item.name || item.materialName || item.description || item.itemName || item.expenseCode || item.feeCode || item.activityCode || item.reason || item.materialDescription || '',
        item.requestNumber || item.entryNumber || item.orderNumber || item.feeCode || item.activityCode || '',
        item.supplierName || item.workerName || item.requestedByName || item.requestedBy?.name || '',
        item.category || item.feeType || item.activityType || item.reallocationType || item.drawType || '',
      ];
      
      return searchableFields.some(field => 
        field && field.toString().toLowerCase().includes(query)
      );
    });
  };

  // Helper function to sort items
  const sortItems = (items, type) => {
    const sorted = [...items];
    
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = a.createdAt || a.submittedAt || a.requestedAt || a.entryDate || a.activityDate || new Date(0);
          bValue = b.createdAt || b.submittedAt || b.requestedAt || b.entryDate || b.activityDate || new Date(0);
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
          break;
        case 'amount':
          aValue = a.totalCost || a.amount || a.estimatedCost || a.totalAmount || a.feesCharged || 0;
          bValue = b.totalCost || b.amount || b.estimatedCost || b.totalAmount || b.feesCharged || 0;
          break;
        case 'type':
          aValue = type || a.type || '';
          bValue = type || b.type || '';
          break;
        case 'urgency':
          const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          aValue = urgencyOrder[a.urgency?.toLowerCase()] || 0;
          bValue = urgencyOrder[b.urgency?.toLowerCase()] || 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };

  // Get filtered and sorted items for each type
  const filteredMaterials = sortItems(filterItems(materials, 'materials'), 'materials');
  const filteredExpenses = sortItems(filterItems(expenses, 'expenses'), 'expenses');
  const filteredInitialExpenses = sortItems(filterItems(initialExpenses, 'initial-expenses'), 'initial-expenses');
  const filteredMaterialRequests = sortItems(filterItems(materialRequests, 'material-requests'), 'material-requests');
  const filteredLabourEntries = sortItems(filterItems(labourEntries, 'labour-entries'), 'labour-entries');
  const filteredProfessionalFees = sortItems(filterItems(professionalFees, 'professional-fees'), 'professional-fees');
  const filteredProfessionalActivities = sortItems(filterItems(professionalActivities, 'professional-activities'), 'professional-activities');
  const filteredBudgetReallocations = sortItems(filterItems(budgetReallocations, 'budget-reallocations'), 'budget-reallocations');
  const filteredPurchaseOrderModifications = sortItems(filterItems(purchaseOrderModifications, 'purchase-order-modifications'), 'purchase-order-modifications');
  const filteredContingencyDraws = sortItems(filterItems(contingencyDraws, 'contingency-draws'), 'contingency-draws');

  // Check permissions for each type
  const canApproveMaterials =
    user &&
    ['owner', 'pm', 'project_manager'].includes(user.role?.toLowerCase());
  const canApproveExpenses =
    user &&
    ['owner', 'pm', 'project_manager', 'accountant'].includes(
      user.role?.toLowerCase(),
    );
  const canApproveInitialExpenses =
    user &&
    ['owner', 'pm', 'project_manager', 'accountant'].includes(
      user.role?.toLowerCase(),
    );
  const canApproveMaterialRequests =
    user &&
    ['owner', 'pm', 'project_manager'].includes(user.role?.toLowerCase());
  const canApproveLabourEntries =
    user &&
    ['owner', 'pm', 'project_manager'].includes(user.role?.toLowerCase());
  const canApproveProfessionalFees =
    user &&
    ['owner', 'pm', 'project_manager', 'accountant'].includes(user.role?.toLowerCase());
  const canApproveProfessionalActivities =
    user &&
    ['owner', 'pm', 'project_manager'].includes(user.role?.toLowerCase());
  const canApproveBudgetReallocations =
    user &&
    ['owner', 'pm', 'project_manager', 'accountant'].includes(user.role?.toLowerCase());
  const canApprovePurchaseOrderModifications =
    user &&
    ['owner', 'pm', 'project_manager'].includes(user.role?.toLowerCase());
  const canApproveContingencyDraws =
    user &&
    ['owner'].includes(user.role?.toLowerCase()); // Only OWNER can approve contingency draws

  const formatCurrency = (amount, currency = 'KES') => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingOverlay
          isLoading={processingItems.size > 0 || Boolean(bulkActionType)}
          message="Processing approvals..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">
                  Approval Queue
                </h1>
                {isPolling && (
                  <div className="flex items-center gap-2 text-sm ds-text-muted">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="hidden sm:inline">Updating...</span>
                  </div>
                )}
              </div>
              {currentProject ? (
                <>
                  <p className="text-base md:text-lg ds-text-secondary mt-2 leading-relaxed">
                    Review and approve pending submissions for{' '}
                    <span className="font-semibold ds-text-accent-primary">
                      {currentProject.projectName || 'Current Project'}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-sm ds-text-muted">
                      {materials.length} materials, {expenses.length} expenses, {initialExpenses.length}{' '}
                      initial expenses, {materialRequests.length} material requests, {labourEntries.length} labour entries,{' '}
                      {professionalFees.length} professional fees, {professionalActivities.length} professional activities,{' '}
                      {budgetReallocations.length} budget reallocations, {purchaseOrderModifications.length} PO modifications,{' '}
                      {contingencyDraws.length} contingency draws pending approval
                    </p>
                    {lastUpdated && (
                      <span className="text-xs ds-text-muted">
                        • Updated {lastUpdated.toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-base ds-text-secondary">
                    <strong>No project selected.</strong> Please select a project from the project switcher to view pending approvals.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search and Sort Controls */}
        {loading && !isPolling ? (
          <div className="mb-6 ds-bg-surface rounded-lg shadow p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <div className="h-4 bg-gray-200 animate-pulse rounded mb-2 w-16"></div>
                <div className="h-10 bg-gray-200 animate-pulse rounded-lg"></div>
              </div>
              <div>
                <div className="h-4 bg-gray-200 animate-pulse rounded mb-2 w-20"></div>
                <div className="h-10 bg-gray-200 animate-pulse rounded-lg"></div>
              </div>
              <div>
                <div className="h-4 bg-gray-200 animate-pulse rounded mb-2 w-16"></div>
                <div className="h-10 bg-gray-200 animate-pulse rounded-lg"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 ds-bg-surface rounded-lg shadow p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-semibold ds-text-secondary mb-2">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search by name, code, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
                />
              </div>
              
              {/* Sort By */}
              <div>
                <label className="block text-sm font-semibold ds-text-secondary mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="type">Type</option>
                  <option value="urgency">Urgency</option>
                </select>
              </div>
              
              {/* Sort Order */}
              <div>
                <label className="block text-sm font-semibold ds-text-secondary mb-2">
                  Order
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
            
            {/* Clear Filters Button */}
            {(searchQuery || sortBy !== 'date' || sortOrder !== 'desc') && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSortBy('date');
                    setSortOrder('desc');
                  }}
                  className="px-4 py-2 text-sm font-medium ds-text-secondary ds-bg-surface border ds-border-subtle rounded-lg hover:ds-bg-surface-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cross-Type Bulk Actions Banner */}
        {getTotalSelectedCount() > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">
                  {getTotalSelectedCount()} item(s) selected across multiple types
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-blue-700">
                  {selectedMaterials.length > 0 && <span>{selectedMaterials.length} Materials</span>}
                  {selectedExpenses.length > 0 && <span>{selectedExpenses.length} Expenses</span>}
                  {selectedInitialExpenses.length > 0 && <span>{selectedInitialExpenses.length} Initial Expenses</span>}
                  {selectedMaterialRequests.length > 0 && <span>{selectedMaterialRequests.length} Material Requests</span>}
                  {selectedLabourEntries.length > 0 && <span>{selectedLabourEntries.length} Labour Entries</span>}
                  {selectedProfessionalFees.length > 0 && <span>{selectedProfessionalFees.length} Professional Fees</span>}
                  {selectedProfessionalActivities.length > 0 && <span>{selectedProfessionalActivities.length} Professional Activities</span>}
                  {selectedBudgetReallocations.length > 0 && <span>{selectedBudgetReallocations.length} Budget Reallocations</span>}
                  {selectedPurchaseOrderModifications.length > 0 && <span>{selectedPurchaseOrderModifications.length} PO Modifications</span>}
                  {selectedContingencyDraws.length > 0 && <span>{selectedContingencyDraws.length} Contingency Draws</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={() => {
                    setBulkActionType('cross-type-approve');
                    setApprovalNotes('');
                    setShowBulkApproveModal(true);
                  }}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                >
                  Approve All Selected
                </LoadingButton>
                <LoadingButton
                  onClick={() => {
                    setBulkActionType('cross-type-reject');
                    setRejectReason('');
                    setShowBulkRejectModal(true);
                  }}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                >
                  Reject All Selected
                </LoadingButton>
              </div>
            </div>
          </div>
        )}

        {/* Cross-Type Bulk Actions Banner */}
        {getTotalSelectedCount() > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">
                  {getTotalSelectedCount()} item(s) selected across multiple types
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-blue-700">
                  {selectedMaterials.length > 0 && <span>{selectedMaterials.length} Materials</span>}
                  {selectedExpenses.length > 0 && <span>{selectedExpenses.length} Expenses</span>}
                  {selectedInitialExpenses.length > 0 && <span>{selectedInitialExpenses.length} Initial Expenses</span>}
                  {selectedMaterialRequests.length > 0 && <span>{selectedMaterialRequests.length} Material Requests</span>}
                  {selectedLabourEntries.length > 0 && <span>{selectedLabourEntries.length} Labour Entries</span>}
                  {selectedProfessionalFees.length > 0 && <span>{selectedProfessionalFees.length} Professional Fees</span>}
                  {selectedProfessionalActivities.length > 0 && <span>{selectedProfessionalActivities.length} Professional Activities</span>}
                  {selectedBudgetReallocations.length > 0 && <span>{selectedBudgetReallocations.length} Budget Reallocations</span>}
                  {selectedPurchaseOrderModifications.length > 0 && <span>{selectedPurchaseOrderModifications.length} PO Modifications</span>}
                  {selectedContingencyDraws.length > 0 && <span>{selectedContingencyDraws.length} Contingency Draws</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={() => {
                    setBulkActionType('cross-type-approve');
                    setApprovalNotes('');
                    setShowBulkApproveModal(true);
                  }}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                >
                  Approve All Selected
                </LoadingButton>
                <LoadingButton
                  onClick={() => {
                    setBulkActionType('cross-type-reject');
                    setRejectReason('');
                    setShowBulkRejectModal(true);
                  }}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                >
                  Reject All Selected
                </LoadingButton>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b ds-border-subtle overflow-x-auto">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
            <button
              onClick={() => setActiveTab('materials')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'materials'
                  ? 'ds-border-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Materials ({materials.length})
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'expenses'
                  ? 'ds-border-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Expenses ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('initial-expenses')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'initial-expenses'
                  ? 'ds-border-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Initial Expenses ({initialExpenses.length})
            </button>
            <button
              onClick={() => setActiveTab('material-requests')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'material-requests'
                  ? 'ds-border-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Material Requests ({materialRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('labour-entries')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'labour-entries'
                  ? 'ds-border-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Labour Entries ({labourEntries.length})
            </button>
            <button
              onClick={() => setActiveTab('professional-fees')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'professional-fees'
                  ? 'ds-border-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Professional Fees ({professionalFees.length})
            </button>
            <button
              onClick={() => setActiveTab('professional-activities')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'professional-activities'
                  ? 'ds-border-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Professional Activities ({professionalActivities.length})
            </button>
            <button
              onClick={() => setActiveTab('budget-reallocations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'budget-reallocations'
                  ? 'ds-border-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Budget Reallocations ({budgetReallocations.length})
            </button>
            <button
              onClick={() => setActiveTab('purchase-order-modifications')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'purchase-order-modifications'
                  ? 'ds-border-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              PO Modifications ({purchaseOrderModifications.length})
            </button>
            <button
              onClick={() => setActiveTab('contingency-draws')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'contingency-draws'
                  ? 'ds-border-accent-primary ds-text-accent-primary'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Contingency Draws ({contingencyDraws.length})
            </button>
          </nav>
        </div>

        {/* Bulk Actions - Materials */}
        {canApproveMaterials &&
          activeTab === 'materials' &&
          selectedMaterials.length > 0 && (
            <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4 mb-6 flex justify-between items-center">
              <span className="text-blue-800 font-medium">
                {selectedMaterials.length} material(s) selected
              </span>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={handleBulkApproveMaterialsClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Approve Selected
                </LoadingButton>
                <LoadingButton
                  onClick={handleBulkRejectMaterialsClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Selected
                </LoadingButton>
              </div>
            </div>
          )}

        {/* Bulk Actions - Expenses */}
        {canApproveExpenses &&
          activeTab === 'expenses' &&
          selectedExpenses.length > 0 && (
            <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4 mb-6 flex justify-between items-center">
              <span className="text-blue-800 font-medium">
                {selectedExpenses.length} expense(s) selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkApproveExpensesClick}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve Selected
                </button>
                <button
                  onClick={handleBulkRejectExpensesClick}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Reject Selected
                </button>
              </div>
            </div>
          )}

        {/* Bulk Actions - Initial Expenses */}
        {canApproveInitialExpenses &&
          activeTab === 'initial-expenses' &&
          selectedInitialExpenses.length > 0 && (
            <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4 mb-6 flex justify-between items-center">
              <span className="text-blue-800 font-medium">
                {selectedInitialExpenses.length} initial expense(s) selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkApproveInitialExpensesClick}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Approve Selected
                </button>
                <button
                  onClick={handleBulkRejectInitialExpensesClick}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Reject Selected
                </button>
              </div>
            </div>
          )}

        {/* Bulk Actions - Material Requests */}
        {canApproveMaterialRequests &&
          activeTab === 'material-requests' &&
          selectedMaterialRequests.length > 0 && (
            <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4 mb-6 flex justify-between items-center">
              <span className="text-blue-800 font-medium">
                {selectedMaterialRequests.length} material request(s) selected
              </span>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={handleBulkApproveMaterialRequestsClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Approve Selected
                </LoadingButton>
                <LoadingButton
                  onClick={handleBulkRejectMaterialRequestsClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Selected
                </LoadingButton>
              </div>
            </div>
          )}

        {/* Bulk Actions - Labour Entries */}
        {canApproveLabourEntries &&
          activeTab === 'labour-entries' &&
          selectedLabourEntries.length > 0 && (
            <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4 mb-6 flex justify-between items-center">
              <span className="text-blue-800 font-medium">
                {selectedLabourEntries.length} labour entry(ies) selected
              </span>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={handleBulkApproveLabourEntriesClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Approve Selected
                </LoadingButton>
              </div>
            </div>
          )}

        {/* Bulk Actions - Professional Fees */}
        {canApproveProfessionalFees &&
          activeTab === 'professional-fees' &&
          selectedProfessionalFees.length > 0 && (
            <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4 mb-6 flex justify-between items-center">
              <span className="text-blue-800 font-medium">
                {selectedProfessionalFees.length} professional fee(s) selected
              </span>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={handleBulkApproveProfessionalFeesClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Approve Selected
                </LoadingButton>
                <LoadingButton
                  onClick={handleBulkRejectProfessionalFeesClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Selected
                </LoadingButton>
              </div>
            </div>
          )}

        {/* Bulk Actions - Professional Activities */}
        {canApproveProfessionalActivities &&
          activeTab === 'professional-activities' &&
          selectedProfessionalActivities.length > 0 && (
            <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4 mb-6 flex justify-between items-center">
              <span className="text-blue-800 font-medium">
                {selectedProfessionalActivities.length} professional activity(ies) selected
              </span>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={handleBulkApproveProfessionalActivitiesClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Approve Selected
                </LoadingButton>
                <LoadingButton
                  onClick={handleBulkRejectProfessionalActivitiesClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Selected
                </LoadingButton>
              </div>
            </div>
          )}

        {/* Bulk Actions - Budget Reallocations */}
        {canApproveBudgetReallocations &&
          activeTab === 'budget-reallocations' &&
          selectedBudgetReallocations.length > 0 && (
            <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4 mb-6 flex justify-between items-center">
              <span className="text-blue-800 font-medium">
                {selectedBudgetReallocations.length} budget reallocation(s) selected
              </span>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={handleBulkApproveBudgetReallocationsClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Approve Selected
                </LoadingButton>
                <LoadingButton
                  onClick={handleBulkRejectBudgetReallocationsClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Selected
                </LoadingButton>
              </div>
            </div>
          )}

        {/* Bulk Actions - Purchase Order Modifications */}
        {canApprovePurchaseOrderModifications &&
          activeTab === 'purchase-order-modifications' &&
          selectedPurchaseOrderModifications.length > 0 && (
            <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4 mb-6 flex justify-between items-center">
              <span className="text-blue-800 font-medium">
                {selectedPurchaseOrderModifications.length} purchase order modification(s) selected
              </span>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={handleBulkApprovePurchaseOrderModificationsClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Approve Selected
                </LoadingButton>
                <LoadingButton
                  onClick={handleBulkRejectPurchaseOrderModificationsClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Selected
                </LoadingButton>
              </div>
            </div>
          )}

        {/* Bulk Actions - Contingency Draws */}
        {canApproveContingencyDraws &&
          activeTab === 'contingency-draws' &&
          selectedContingencyDraws.length > 0 && (
            <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4 mb-6 flex justify-between items-center">
              <span className="text-blue-800 font-medium">
                {selectedContingencyDraws.length} contingency draw(s) selected
              </span>
              <div className="flex gap-2">
                <LoadingButton
                  onClick={handleBulkApproveContingencyDrawsClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Approve Selected
                </LoadingButton>
                <LoadingButton
                  onClick={handleBulkRejectContingencyDrawsClick}
                  isLoading={bulkProcessing}
                  loadingText="Processing..."
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Reject Selected
                </LoadingButton>
              </div>
            </div>
          )}

        {/* Error Message with Retry */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex-1">
                <p className="font-semibold">Error loading approvals</p>
                <p className="text-sm mt-1">{error}</p>
                {retryCount > 0 && retryCount < maxRetries && (
                  <p className="text-xs mt-1 text-red-600">
                    Retrying... ({retryCount}/{maxRetries})
                  </p>
                )}
                {retryCount >= maxRetries && (
                  <p className="text-xs mt-1 text-red-600">
                    Maximum retries reached. Please try again manually.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {isRetrying ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Retrying...
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setError(null);
                      setRetryCount(0);
                      setIsRetrying(false);
                      // Clear any pending retry timeout
                      if (retryTimeoutRef.current) {
                        clearTimeout(retryTimeoutRef.current);
                        retryTimeoutRef.current = null;
                      }
                      fetchPendingApprovals(false);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Materials Table */}
        {activeTab === 'materials' && (
          <>
            {/* Capital Balance Warnings for Materials */}
            {!loading && filteredMaterials.length > 0 && (
              <div className="mb-6 space-y-3">
                {Array.from(
                  new Set(filteredMaterials.map((m) => m.projectId).filter(Boolean)),
                ).map((projectId) => {
                  const projectMaterials = filteredMaterials.filter(
                    (m) => m.projectId === projectId,
                  );
                  const totalAmount = projectMaterials.reduce(
                    (sum, m) => sum + (m.totalCost || 0),
                    0,
                  );
                  return (
                    <CapitalBalanceWarning
                      key={projectId}
                      projectId={projectId}
                      amountToApprove={totalAmount}
                    />
                  );
                })}
              </div>
            )}
            {loading ? (
              <LoadingTable rows={10} columns={6} showHeader={true} />
            ) : filteredMaterials.length === 0 ? (
              <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
                <p className="ds-text-secondary mb-4">
                  {searchQuery ? 'No materials match your search criteria' : 'No pending material approvals'}
                </p>
                <p className="text-sm ds-text-muted">
                  {searchQuery ? 'Try adjusting your search terms' : 'All materials have been reviewed'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      {canApproveMaterials && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              selectedMaterials.length === filteredMaterials.length &&
                              filteredMaterials.length > 0 &&
                              filteredMaterials.every(m => selectedMaterials.includes(m._id))
                            }
                            onChange={toggleSelectAllMaterials}
                            className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Material
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Submitted By
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Total Cost
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal hidden md:table-cell">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal hidden sm:table-cell">
                        Urgency
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal hidden sm:table-cell">
                        Pending
                      </th>
                      {canApproveMaterials && (
                        <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {filteredMaterials.map((material) => {
                      const effectiveUrgency = getEffectiveUrgency(material);
                      const pendingAge = getPendingAge(material);
                      return (
                      <tr
                        key={material._id}
                        className={`hover:ds-bg-surface-muted ${
                          selectedMaterials.includes(material._id)
                            ? 'bg-blue-50'
                            : ''
                        } ${effectiveUrgency === 'critical' ? 'border-l-4 border-red-500' : effectiveUrgency === 'high' ? 'border-l-4 border-orange-500' : ''}`}
                      >
                        {canApproveMaterials && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedMaterials.includes(material._id)}
                              onChange={() =>
                                toggleSelectMaterial(material._id)
                              }
                              className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div>
                            <Link
                              href={`/items/${material._id}`}
                              className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                            >
                              {material.name || material.materialName}
                            </Link>
                            {material.description && (
                              <div className="text-sm ds-text-secondary truncate max-w-xs mt-1 leading-normal">
                                {material.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm ds-text-primary">
                            {material.submittedBy?.name || 'Unknown'}
                          </div>
                          <div className="text-sm ds-text-secondary leading-normal">
                            {material.submittedBy?.email || ''}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {material.quantity ||
                              material.quantityPurchased ||
                              0}{' '}
                            {material.unit || ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium ds-text-primary">
                            KES {material.totalCost?.toLocaleString() || '0.00'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                          <span className="text-sm ds-text-primary">
                            {material.supplierName ||
                              material.supplier ||
                              'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-muted">
                            {material.createdAt
                              ? new Date(
                                  material.createdAt,
                                ).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getUrgencyBadgeColor(effectiveUrgency)}`}>
                            {effectiveUrgency.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                          {pendingAge && (
                            <span className={`text-xs ${
                              effectiveUrgency === 'critical' ? 'text-red-600 font-semibold' :
                              effectiveUrgency === 'high' ? 'text-orange-600 font-medium' :
                              'ds-text-muted'
                            }`}>
                              {pendingAge}
                            </span>
                          )}
                        </td>
                        {canApproveMaterials && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    handleApproveMaterial(material._id)
                                  }
                                  disabled={processingItems.has(material._id)}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingItems.has(material._id) ? 'Processing...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() =>
                                    handleRejectMaterialClick(material._id)
                                  }
                                  disabled={processingItems.has(material._id)}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reject
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  openHistoryModal(
                                    material._id,
                                    'materials',
                                    material.name || material.materialName
                                  )
                                }
                                className="text-xs text-blue-600 hover:text-blue-900 underline"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Expenses Table */}
        {activeTab === 'expenses' && (
          <>
            {/* Capital Balance Warnings for Expenses */}
            {!loading && filteredExpenses.length > 0 && (
              <div className="mb-6 space-y-3">
                {Array.from(
                  new Set(filteredExpenses.map((e) => e.projectId).filter(Boolean)),
                ).map((projectId) => {
                  const projectExpenses = filteredExpenses.filter(
                    (e) => e.projectId === projectId,
                  );
                  const totalAmount = projectExpenses.reduce(
                    (sum, e) => sum + (e.amount || 0),
                    0,
                  );
                  return (
                    <CapitalBalanceWarning
                      key={projectId}
                      projectId={projectId}
                      amountToApprove={totalAmount}
                    />
                  );
                })}
              </div>
            )}
            {loading ? (
              <LoadingTable rows={10} columns={6} showHeader={true} />
            ) : filteredExpenses.length === 0 ? (
              <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
                <p className="ds-text-secondary mb-4">
                  {searchQuery ? 'No expenses match your search criteria' : 'No pending expense approvals'}
                </p>
                <p className="text-sm ds-text-muted">
                  {searchQuery ? 'Try adjusting your search terms' : 'All expenses have been reviewed'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      {canApproveExpenses && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              selectedExpenses.length === filteredExpenses.length &&
                              filteredExpenses.length > 0 &&
                              filteredExpenses.every(e => selectedExpenses.includes(e._id))
                            }
                            onChange={toggleSelectAllExpenses}
                            className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Expense Code
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Submitted By
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal hidden sm:table-cell">
                        Urgency
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal hidden sm:table-cell">
                        Pending
                      </th>
                      {canApproveExpenses && (
                        <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {filteredExpenses.map((expense) => {
                      const effectiveUrgency = getEffectiveUrgency(expense);
                      const pendingAge = getPendingAge(expense);
                      return (
                      <tr
                        key={expense._id}
                        className={`hover:ds-bg-surface-muted ${
                          selectedExpenses.includes(expense._id)
                            ? 'bg-blue-50'
                            : ''
                        } ${effectiveUrgency === 'critical' ? 'border-l-4 border-red-500' : effectiveUrgency === 'high' ? 'border-l-4 border-orange-500' : ''}`}
                      >
                        {canApproveExpenses && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedExpenses.includes(expense._id)}
                              onChange={() => toggleSelectExpense(expense._id)}
                              className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <Link
                            href={`/expenses/${expense._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            {expense.expenseCode || 'N/A'}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm ds-text-primary max-w-xs truncate">
                            {expense.description || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {expense.category?.replace('_', ' ') || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium ds-text-primary">
                            {formatCurrency(expense.amount, expense.currency)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm ds-text-primary">
                            {expense.submittedBy?.name ||
                              expense.submittedBy?.email ||
                              'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-muted">
                            {expense.date
                              ? new Date(expense.date).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getUrgencyBadgeColor(effectiveUrgency)}`}>
                            {effectiveUrgency.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                          {pendingAge && (
                            <span className={`text-xs ${
                              effectiveUrgency === 'critical' ? 'text-red-600 font-semibold' :
                              effectiveUrgency === 'high' ? 'text-orange-600 font-medium' :
                              'ds-text-muted'
                            }`}>
                              {pendingAge}
                            </span>
                          )}
                        </td>
                        {canApproveExpenses && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    handleApproveExpense(expense._id)
                                  }
                                  disabled={processingItems.has(expense._id)}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingItems.has(expense._id) ? 'Processing...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() =>
                                    handleRejectExpenseClick(expense._id)
                                  }
                                  disabled={processingItems.has(expense._id)}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reject
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  openHistoryModal(
                                    expense._id,
                                    'expenses',
                                    expense.expenseCode || expense.description
                                  )
                                }
                                className="text-xs text-blue-600 hover:text-blue-900 underline"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Initial Expenses Table */}
        {activeTab === 'initial-expenses' && (
          <>
            {/* Capital Balance Warnings for Initial Expenses */}
            {!loading && filteredInitialExpenses.length > 0 && (
              <div className="mb-6 space-y-3">
                {Array.from(
                  new Set(
                    filteredInitialExpenses.map((e) => e.projectId).filter(Boolean),
                  ),
                ).map((projectId) => {
                  const projectInitialExpenses = filteredInitialExpenses.filter(
                    (e) => e.projectId === projectId,
                  );
                  const totalAmount = projectInitialExpenses.reduce(
                    (sum, e) => sum + (e.amount || 0),
                    0,
                  );
                  return (
                    <CapitalBalanceWarning
                      key={projectId}
                      projectId={projectId}
                      amountToApprove={totalAmount}
                    />
                  );
                })}
              </div>
            )}
            {loading ? (
              <LoadingTable rows={10} columns={6} showHeader={true} />
            ) : filteredInitialExpenses.length === 0 ? (
              <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
                <p className="ds-text-secondary mb-4">
                  {searchQuery ? 'No initial expenses match your search criteria' : 'No pending initial expense approvals'}
                </p>
                <p className="text-sm ds-text-muted">
                  {searchQuery ? 'Try adjusting your search terms' : 'All initial expenses have been reviewed'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      {canApproveInitialExpenses && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              selectedInitialExpenses.length === filteredInitialExpenses.length &&
                              filteredInitialExpenses.length > 0 &&
                              filteredInitialExpenses.every(e => selectedInitialExpenses.includes(e._id))
                            }
                            onChange={toggleSelectAllInitialExpenses}
                            className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Expense Code
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Item Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Date Paid
                      </th>
                      {canApproveInitialExpenses && (
                        <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {filteredInitialExpenses.map((expense) => (
                      <tr
                        key={expense._id}
                        className={`hover:ds-bg-surface-muted ${
                          selectedInitialExpenses.includes(expense._id)
                            ? 'bg-blue-50'
                            : ''
                        }`}
                      >
                        {canApproveInitialExpenses && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedInitialExpenses.includes(
                                expense._id,
                              )}
                              onChange={() =>
                                toggleSelectInitialExpense(expense._id)
                              }
                              className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <Link
                            href={`/initial-expenses/${expense._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            {expense.expenseCode || 'N/A'}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm ds-text-primary max-w-xs truncate">
                            {expense.itemName || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {expense.category?.replace('_', ' ') || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium ds-text-primary">
                            {formatCurrency(expense.amount)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-muted">
                            {expense.datePaid
                              ? new Date(expense.datePaid).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        {canApproveInitialExpenses && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    handleApproveInitialExpense(expense._id)
                                  }
                                  disabled={processingItems.has(expense._id)}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingItems.has(expense._id) ? 'Processing...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() =>
                                    handleRejectInitialExpenseClick(expense._id)
                                  }
                                  disabled={processingItems.has(expense._id)}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reject
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  openHistoryModal(
                                    expense._id,
                                    'initial_expenses',
                                    expense.expenseCode || expense.itemName
                                  )
                                }
                                className="text-xs text-blue-600 hover:text-blue-900 underline"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Material Requests Table */}
        {activeTab === 'material-requests' && (
          <>
            {loading ? (
              <LoadingTable rows={10} columns={6} showHeader={true} />
            ) : filteredMaterialRequests.length === 0 ? (
              <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
                <p className="ds-text-secondary mb-4">
                  {searchQuery ? 'No material requests match your search criteria' : 'No pending material request approvals'}
                </p>
                <p className="text-sm ds-text-muted">
                  {searchQuery ? 'Try adjusting your search terms' : 'All material requests have been reviewed'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      {canApproveMaterialRequests && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              selectedMaterialRequests.length === filteredMaterialRequests.length &&
                              filteredMaterialRequests.length > 0 &&
                              filteredMaterialRequests.every(r => selectedMaterialRequests.includes(r._id))
                            }
                            onChange={toggleSelectAllMaterialRequests}
                            className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Request Number
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Material Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Estimated Cost
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Urgency
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Requested By
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Requested
                      </th>
                      {canApproveMaterialRequests && (
                        <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {filteredMaterialRequests.map((request) => (
                      <tr
                        key={request._id}
                        className={`hover:ds-bg-surface-muted ${
                          selectedMaterialRequests.includes(request._id)
                            ? 'bg-blue-50'
                            : ''
                        }`}
                      >
                        {canApproveMaterialRequests && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedMaterialRequests.includes(request._id)}
                              onChange={() => toggleSelectMaterialRequest(request._id)}
                              className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                              disabled={processingItems.has(request._id)}
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <Link
                            href={`/material-requests/${request._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            {request.requestNumber || 'N/A'}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium ds-text-primary">
                              {request.materialName || 'N/A'}
                            </div>
                            {request.description && (
                              <div className="text-sm ds-text-secondary truncate max-w-xs mt-1 leading-normal">
                                {request.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {request.quantityNeeded || 0} {request.unit || ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium ds-text-primary">
                            {request.estimatedCost
                              ? formatCurrency(request.estimatedCost)
                              : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              request.urgency === 'critical'
                                ? 'bg-red-100 text-red-800'
                                : request.urgency === 'high'
                                  ? 'bg-orange-100 text-orange-800'
                                  : request.urgency === 'medium'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {request.urgency?.toUpperCase() || 'MEDIUM'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm ds-text-primary">
                            {request.requestedByName || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-muted">
                            {request.createdAt
                              ? new Date(request.createdAt).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        {canApproveMaterialRequests && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    handleApproveMaterialRequest(request._id)
                                  }
                                  disabled={processingItems.has(request._id)}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingItems.has(request._id) ? 'Processing...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() =>
                                    handleRejectMaterialRequestClick(request._id)
                                  }
                                  disabled={processingItems.has(request._id)}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reject
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  openHistoryModal(
                                    request._id,
                                    'material_requests',
                                    request.requestNumber || request.materialName
                                  )
                                }
                                className="text-xs text-blue-600 hover:text-blue-900 underline"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Labour Entries Table */}
        {activeTab === 'labour-entries' && (
          <>
            {loading ? (
              <LoadingTable rows={10} columns={7} showHeader={true} />
            ) : filteredLabourEntries.length === 0 ? (
              <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
                <p className="ds-text-secondary mb-4">
                  {searchQuery ? 'No labour entries match your search criteria' : 'No pending labour entry approvals'}
                </p>
                <p className="text-sm ds-text-muted">
                  {searchQuery ? 'Try adjusting your search terms' : 'All labour entries have been reviewed'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      {canApproveLabourEntries && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              selectedLabourEntries.length === filteredLabourEntries.length &&
                              filteredLabourEntries.length > 0 &&
                              filteredLabourEntries.every(e => selectedLabourEntries.includes(e._id))
                            }
                            onChange={toggleSelectAllLabourEntries}
                            className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Entry Number
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Worker
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Skill Type
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Hours
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Total Cost
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Entry Date
                      </th>
                      {canApproveLabourEntries && (
                        <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {filteredLabourEntries.map((entry) => (
                      <tr
                        key={entry._id}
                        className={`hover:ds-bg-surface-muted ${
                          selectedLabourEntries.includes(entry._id)
                            ? 'bg-blue-50'
                            : ''
                        }`}
                      >
                        {canApproveLabourEntries && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedLabourEntries.includes(entry._id)}
                              onChange={() => toggleSelectLabourEntry(entry._id)}
                              className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                              disabled={processingItems.has(entry._id)}
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <Link
                            href={`/labour/entries/${entry._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            {entry.entryNumber || 'N/A'}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium ds-text-primary">
                            {entry.workerName || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {entry.skillType || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {entry.totalHours || 0} hrs
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium ds-text-primary">
                            {formatCurrency(entry.totalCost || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-muted">
                            {entry.entryDate
                              ? new Date(entry.entryDate).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        {canApproveLabourEntries && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleApproveLabourEntry(entry._id)}
                                disabled={processingItems.has(entry._id)}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {processingItems.has(entry._id) ? 'Processing...' : 'Approve'}
                              </button>
                              <button
                                onClick={() =>
                                  openHistoryModal(
                                    entry._id,
                                    'labour_entries',
                                    entry.entryNumber || entry.taskDescription
                                  )
                                }
                                className="text-xs text-blue-600 hover:text-blue-900 underline"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Professional Fees Table */}
        {activeTab === 'professional-fees' && (
          <>
            {loading ? (
              <LoadingTable rows={10} columns={7} showHeader={true} />
            ) : filteredProfessionalFees.length === 0 ? (
              <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
                <p className="ds-text-secondary mb-4">
                  {searchQuery ? 'No professional fees match your search criteria' : 'No pending professional fee approvals'}
                </p>
                <p className="text-sm ds-text-muted">
                  {searchQuery ? 'Try adjusting your search terms' : 'All professional fees have been reviewed'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      {canApproveProfessionalFees && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              selectedProfessionalFees.length === filteredProfessionalFees.length &&
                              filteredProfessionalFees.length > 0 &&
                              filteredProfessionalFees.every(f => selectedProfessionalFees.includes(f._id))
                            }
                            onChange={toggleSelectAllProfessionalFees}
                            className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Fee Code
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Fee Type
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Invoice Number
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Created
                      </th>
                      {canApproveProfessionalFees && (
                        <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {filteredProfessionalFees.map((fee) => (
                      <tr
                        key={fee._id}
                        className={`hover:ds-bg-surface-muted ${
                          selectedProfessionalFees.includes(fee._id)
                            ? 'bg-blue-50'
                            : ''
                        }`}
                      >
                        {canApproveProfessionalFees && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedProfessionalFees.includes(fee._id)}
                              onChange={() => toggleSelectProfessionalFee(fee._id)}
                              className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                              disabled={processingItems.has(fee._id)}
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <Link
                            href={`/professional-fees/${fee._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            {fee.feeCode || 'N/A'}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {fee.feeType?.replace('_', ' ') || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm ds-text-primary max-w-xs truncate">
                            {fee.description || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium ds-text-primary">
                            {formatCurrency(fee.amount || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {fee.invoiceNumber || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-muted">
                            {fee.createdAt
                              ? new Date(fee.createdAt).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        {canApproveProfessionalFees && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveProfessionalFee(fee._id)}
                                  disabled={processingItems.has(fee._id)}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingItems.has(fee._id) ? 'Processing...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleRejectProfessionalFeeClick(fee._id)}
                                  disabled={processingItems.has(fee._id)}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reject
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  openHistoryModal(
                                    fee._id,
                                    'professional_fees',
                                    fee.feeCode || fee.description
                                  )
                                }
                                className="text-xs text-blue-600 hover:text-blue-900 underline"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Professional Activities Table */}
        {activeTab === 'professional-activities' && (
          <>
            {loading ? (
              <LoadingTable rows={10} columns={7} showHeader={true} />
            ) : filteredProfessionalActivities.length === 0 ? (
              <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
                <p className="ds-text-secondary mb-4">
                  {searchQuery ? 'No professional activities match your search criteria' : 'No pending professional activity approvals'}
                </p>
                <p className="text-sm ds-text-muted">
                  {searchQuery ? 'Try adjusting your search terms' : 'All professional activities have been reviewed'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      {canApproveProfessionalActivities && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              selectedProfessionalActivities.length === filteredProfessionalActivities.length &&
                              filteredProfessionalActivities.length > 0 &&
                              filteredProfessionalActivities.every(a => selectedProfessionalActivities.includes(a._id))
                            }
                            onChange={toggleSelectAllProfessionalActivities}
                            className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Activity Code
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Activity Type
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Fees Charged
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Activity Date
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Created
                      </th>
                      {canApproveProfessionalActivities && (
                        <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {filteredProfessionalActivities.map((activity) => (
                      <tr
                        key={activity._id}
                        className={`hover:ds-bg-surface-muted ${
                          selectedProfessionalActivities.includes(activity._id)
                            ? 'bg-blue-50'
                            : ''
                        }`}
                      >
                        {canApproveProfessionalActivities && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedProfessionalActivities.includes(activity._id)}
                              onChange={() => toggleSelectProfessionalActivity(activity._id)}
                              className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                              disabled={processingItems.has(activity._id)}
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <Link
                            href={`/professional-activities/${activity._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            {activity.activityCode || 'N/A'}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {activity.activityType?.replace('_', ' ') || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm ds-text-primary max-w-xs truncate">
                            {activity.notes || activity.observations || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium ds-text-primary">
                            {formatCurrency(activity.feesCharged || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-muted">
                            {activity.activityDate
                              ? new Date(activity.activityDate).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-muted">
                            {activity.createdAt
                              ? new Date(activity.createdAt).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        {canApproveProfessionalActivities && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveProfessionalActivity(activity._id)}
                                  disabled={processingItems.has(activity._id)}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingItems.has(activity._id) ? 'Processing...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleRejectProfessionalActivityClick(activity._id)}
                                  disabled={processingItems.has(activity._id)}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reject
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  openHistoryModal(
                                    activity._id,
                                    'professional_activities',
                                    activity.activityCode || activity.activityType
                                  )
                                }
                                className="text-xs text-blue-600 hover:text-blue-900 underline"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Budget Reallocations Table */}
        {activeTab === 'budget-reallocations' && (
          <>
            {loading ? (
              <LoadingTable rows={10} columns={7} showHeader={true} />
            ) : filteredBudgetReallocations.length === 0 ? (
              <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
                <p className="ds-text-secondary mb-4">
                  {searchQuery ? 'No budget reallocations match your search criteria' : 'No pending budget reallocation approvals'}
                </p>
                <p className="text-sm ds-text-muted">
                  {searchQuery ? 'Try adjusting your search terms' : 'All budget reallocations have been reviewed'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      {canApproveBudgetReallocations && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              selectedBudgetReallocations.length === filteredBudgetReallocations.length &&
                              filteredBudgetReallocations.length > 0 &&
                              filteredBudgetReallocations.every(r => selectedBudgetReallocations.includes(r._id))
                            }
                            onChange={toggleSelectAllBudgetReallocations}
                            className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        From
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        To
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Requested By
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Requested
                      </th>
                      {canApproveBudgetReallocations && (
                        <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {filteredBudgetReallocations.map((reallocation) => (
                      <tr
                        key={reallocation._id}
                        className={`hover:ds-bg-surface-muted ${
                          selectedBudgetReallocations.includes(reallocation._id)
                            ? 'bg-blue-50'
                            : ''
                        }`}
                      >
                        {canApproveBudgetReallocations && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedBudgetReallocations.includes(reallocation._id)}
                              onChange={() => toggleSelectBudgetReallocation(reallocation._id)}
                              className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                              disabled={processingItems.has(reallocation._id)}
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <Link
                            href={`/budget-reallocations/${reallocation._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            {reallocation.reallocationType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm ds-text-primary">
                            {reallocation.fromPhaseId ? 'Phase' : 'Project Budget'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm ds-text-primary">
                            {reallocation.toPhaseId ? 'Phase' : 'Project Budget'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium ds-text-primary">
                            {formatCurrency(reallocation.amount || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm ds-text-primary max-w-xs truncate">
                            {reallocation.reason || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {reallocation.requestedByName || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-muted">
                            {reallocation.requestedAt
                              ? new Date(reallocation.requestedAt).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        {canApproveBudgetReallocations && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveBudgetReallocation(reallocation._id)}
                                  disabled={processingItems.has(reallocation._id)}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingItems.has(reallocation._id) ? 'Processing...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleRejectBudgetReallocationClick(reallocation._id)}
                                  disabled={processingItems.has(reallocation._id)}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reject
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  openHistoryModal(
                                    reallocation._id,
                                    'budget_reallocations',
                                    reallocation.reallocationType || reallocation.reason
                                  )
                                }
                                className="text-xs text-blue-600 hover:text-blue-900 underline"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Purchase Order Modifications Table */}
        {activeTab === 'purchase-order-modifications' && (
          <>
            {loading ? (
              <LoadingTable rows={10} columns={7} showHeader={true} />
            ) : filteredPurchaseOrderModifications.length === 0 ? (
              <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
                <p className="ds-text-secondary mb-4">
                  {searchQuery ? 'No purchase order modifications match your search criteria' : 'No pending purchase order modification approvals'}
                </p>
                <p className="text-sm ds-text-muted">
                  {searchQuery ? 'Try adjusting your search terms' : 'All purchase order modifications have been reviewed'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      {canApprovePurchaseOrderModifications && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              selectedPurchaseOrderModifications.length === filteredPurchaseOrderModifications.length &&
                              filteredPurchaseOrderModifications.length > 0 &&
                              filteredPurchaseOrderModifications.every(o => selectedPurchaseOrderModifications.includes(o._id))
                            }
                            onChange={toggleSelectAllPurchaseOrderModifications}
                            className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Order Number
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Material
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Total Amount
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Modifications
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Modified
                      </th>
                      {canApprovePurchaseOrderModifications && (
                        <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {filteredPurchaseOrderModifications.map((order) => (
                      <tr
                        key={order._id}
                        className={`hover:ds-bg-surface-muted ${
                          selectedPurchaseOrderModifications.includes(order._id)
                            ? 'bg-blue-50'
                            : ''
                        }`}
                      >
                        {canApprovePurchaseOrderModifications && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedPurchaseOrderModifications.includes(order._id)}
                              onChange={() => toggleSelectPurchaseOrderModification(order._id)}
                              className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                              disabled={processingItems.has(order._id)}
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <Link
                            href={`/purchase-orders/${order._id}`}
                            className="text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            {order.orderNumber || 'N/A'}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm ds-text-primary">
                            {order.supplierName || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm ds-text-primary max-w-xs truncate">
                            {order.materialName || order.materialDescription || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium ds-text-primary">
                            {formatCurrency(order.totalAmount || order.totalCost || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm ds-text-secondary max-w-xs truncate">
                            {order.supplierModifications?.notes || 'See details'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-muted">
                            {order.supplierResponseDate
                              ? new Date(order.supplierResponseDate).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        {canApprovePurchaseOrderModifications && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApprovePurchaseOrderModification(order._id)}
                                  disabled={processingItems.has(order._id)}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingItems.has(order._id) ? 'Processing...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleRejectPurchaseOrderModificationClick(order._id)}
                                  disabled={processingItems.has(order._id)}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reject
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  openHistoryModal(
                                    order._id,
                                    'purchase_order_modifications',
                                    order.orderNumber || 'Purchase Order'
                                  )
                                }
                                className="text-xs text-blue-600 hover:text-blue-900 underline"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Contingency Draws Table */}
        {activeTab === 'contingency-draws' && (
          <>
            {loading ? (
              <LoadingTable rows={10} columns={6} showHeader={true} />
            ) : filteredContingencyDraws.length === 0 ? (
              <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
                <p className="ds-text-secondary mb-4">
                  {searchQuery ? 'No contingency draws match your search criteria' : 'No pending contingency draw approvals'}
                </p>
                <p className="text-sm ds-text-muted">
                  {searchQuery ? 'Try adjusting your search terms' : 'All contingency draws have been reviewed'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-4 px-4 py-2 text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      {canApproveContingencyDraws && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              selectedContingencyDraws.length === filteredContingencyDraws.length &&
                              filteredContingencyDraws.length > 0 &&
                              filteredContingencyDraws.every(d => selectedContingencyDraws.includes(d._id))
                            }
                            onChange={toggleSelectAllContingencyDraws}
                            className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Draw Type
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Requested By
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Requested
                      </th>
                      {canApproveContingencyDraws && (
                        <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {filteredContingencyDraws.map((draw) => (
                      <tr
                        key={draw._id}
                        className={`hover:ds-bg-surface-muted ${
                          selectedContingencyDraws.includes(draw._id)
                            ? 'bg-blue-50'
                            : ''
                        }`}
                      >
                        {canApproveContingencyDraws && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedContingencyDraws.includes(draw._id)}
                              onChange={() => toggleSelectContingencyDraw(draw._id)}
                              className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                              disabled={processingItems.has(draw._id)}
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {draw.drawType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium ds-text-primary">
                            {formatCurrency(draw.amount || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm ds-text-primary max-w-xs truncate">
                            {draw.reason || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-primary">
                            {draw.requestedByName || draw.requestedBy?.name || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm ds-text-muted">
                            {draw.requestedAt || draw.createdAt
                              ? new Date(draw.requestedAt || draw.createdAt).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        {canApproveContingencyDraws && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveContingencyDraw(draw._id)}
                                  disabled={processingItems.has(draw._id)}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingItems.has(draw._id) ? 'Processing...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleRejectContingencyDrawClick(draw._id)}
                                  disabled={processingItems.has(draw._id)}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Reject
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  openHistoryModal(
                                    draw._id,
                                    'contingency_draws',
                                    draw.drawType || draw.reason
                                  )
                                }
                                className="text-xs text-blue-600 hover:text-blue-900 underline"
                              >
                                View History
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Approval Metrics */}
        {(materials.length > 0 ||
          expenses.length > 0 ||
          initialExpenses.length > 0 ||
          materialRequests.length > 0 ||
          labourEntries.length > 0 ||
          professionalFees.length > 0 ||
          professionalActivities.length > 0 ||
          budgetReallocations.length > 0 ||
          purchaseOrderModifications.length > 0 ||
          contingencyDraws.length > 0) && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Pending Materials
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {materials.length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Pending Expenses
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {expenses.length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Total Value (Materials)
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {formatCurrency(
                  materials.reduce((sum, m) => sum + (m.totalCost || 0), 0),
                )}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Total Value (Expenses)
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {formatCurrency(
                  expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
                )}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Pending Initial Expenses
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {initialExpenses.length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Total Value (Initial Expenses)
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {formatCurrency(
                  initialExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
                )}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Pending Material Requests
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {materialRequests.length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Total Value (Material Requests)
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {formatCurrency(
                  materialRequests.reduce((sum, r) => sum + (r.estimatedCost || 0), 0),
                )}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Pending Labour Entries
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {labourEntries.length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Total Value (Labour Entries)
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {formatCurrency(
                  labourEntries.reduce((sum, e) => sum + (e.totalCost || 0), 0),
                )}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Pending Professional Fees
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {professionalFees.length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Total Value (Professional Fees)
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {formatCurrency(
                  professionalFees.reduce((sum, f) => sum + (f.amount || 0), 0),
                )}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Pending Professional Activities
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {professionalActivities.length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Total Value (Professional Activities)
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {formatCurrency(
                  professionalActivities.reduce((sum, a) => sum + (a.feesCharged || 0), 0),
                )}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Pending Budget Reallocations
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {budgetReallocations.length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Total Value (Budget Reallocations)
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {formatCurrency(
                  budgetReallocations.reduce((sum, r) => sum + (r.amount || 0), 0),
                )}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Pending PO Modifications
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {purchaseOrderModifications.length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Total Value (PO Modifications)
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {formatCurrency(
                  purchaseOrderModifications.reduce((sum, o) => sum + (o.totalAmount || o.totalCost || 0), 0),
                )}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Pending Contingency Draws
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {contingencyDraws.length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4">
              <h3 className="text-sm font-medium ds-text-muted">
                Total Value (Contingency Draws)
              </h3>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {formatCurrency(
                  contingencyDraws.reduce((sum, d) => sum + (d.amount || 0), 0),
                )}
              </p>
            </div>
          </div>
        )}

        {/* Analytics Toggle and Export */}
        {currentProject && (
          <div className="mt-6 flex items-center justify-between flex-wrap gap-4">
            <button
              onClick={() => {
                setShowAnalytics(!showAnalytics);
                if (!showAnalytics && !analytics) {
                  fetchAnalytics();
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting || (!materials.length && !expenses.length && !initialExpenses.length && !materialRequests.length && !labourEntries.length && !professionalFees.length && !professionalActivities.length && !budgetReallocations.length && !purchaseOrderModifications.length && !contingencyDraws.length)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {exporting ? 'Exporting...' : 'Export to CSV'}
            </button>
          </div>
        )}

        {/* Analytics Section */}
        {showAnalytics && currentProject && (
          <div className="mt-6 ds-bg-surface rounded-lg shadow p-6 border ds-border-subtle">
            <h2 className="text-xl font-semibold ds-text-primary mb-4">Approval Analytics</h2>
            
            {analyticsLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 ds-text-secondary">Loading analytics...</span>
              </div>
            ) : analytics ? (
              <div className="space-y-6">
                {/* Summary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="ds-bg-surface-muted rounded-lg p-4">
                    <h3 className="text-sm font-medium ds-text-muted">Total Pending</h3>
                    <p className="text-2xl font-bold ds-text-primary mt-1">
                      {analytics.metrics.totalPending}
                    </p>
                  </div>
                  <div className="ds-bg-surface-muted rounded-lg p-4">
                    <h3 className="text-sm font-medium ds-text-muted">Total Pending Value</h3>
                    <p className="text-2xl font-bold ds-text-primary mt-1">
                      {formatCurrency(analytics.metrics.totalPendingValue)}
                    </p>
                  </div>
                  <div className="ds-bg-surface-muted rounded-lg p-4">
                    <h3 className="text-sm font-medium ds-text-muted">Avg. Pending Age</h3>
                    <p className="text-2xl font-bold ds-text-primary mt-1">
                      {analytics.metrics.averagePendingAge} days
                    </p>
                  </div>
                </div>

                {/* Bottlenecks */}
                {analytics.bottlenecks.count > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold ds-text-primary mb-3">
                      Bottlenecks ({analytics.bottlenecks.count} items pending &gt; 7 days)
                    </h3>
                    <div className="ds-bg-surface-muted rounded-lg p-4">
                      <div className="space-y-2">
                        {analytics.bottlenecks.items.slice(0, 5).map((item, index) => (
                          <div key={index} className="flex items-center justify-between py-2 border-b ds-border-subtle last:border-b-0">
                            <div className="flex-1">
                              <p className="text-sm font-medium ds-text-primary">
                                {item.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </p>
                              <p className="text-xs ds-text-muted">{item.id}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-red-600">
                                {item.daysPending} days
                              </p>
                              <p className="text-xs ds-text-muted">
                                {formatCurrency(item.amount)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Trends (simplified - could add charts later) */}
                {analytics.trends && analytics.trends.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold ds-text-primary mb-3">
                      Approval Trends (Last {analytics.trends.length} days)
                    </h3>
                    <div className="ds-bg-surface-muted rounded-lg p-4 overflow-x-auto">
                      <div className="min-w-max">
                        <div className="flex gap-2 mb-2">
                          {analytics.trends.slice(-7).map((trend, index) => (
                            <div key={index} className="flex flex-col items-center min-w-[60px]">
                              <div className="w-full bg-blue-200 rounded-t" style={{ height: `${Math.max(10, (trend.count / Math.max(...analytics.trends.map(t => t.count), 1)) * 100)}px` }}></div>
                              <p className="text-xs ds-text-muted mt-1">{trend.count}</p>
                              <p className="text-xs ds-text-muted">{new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="ds-text-muted">No analytics data available</p>
            )}
          </div>
        )}
      </div>

      {/* Bulk Approve Modal with Notes */}
      {showBulkApproveModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => !bulkProcessing && setShowBulkApproveModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative ds-bg-surface rounded-lg shadow-xl max-w-md w-full transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3
                    className="text-lg font-semibold leading-6 ds-text-primary mb-2"
                    id="modal-title"
                  >
                    Approve Items
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm ds-text-muted mb-4">
                      {bulkActionType === 'cross-type-approve'
                        ? `Approve ${getTotalSelectedCount()} item(s) across multiple types?`
                        : bulkActionType === 'materials-approve'
                          ? `Approve ${selectedMaterials.length} material(s)?`
                          : bulkActionType === 'expenses-approve'
                            ? `Approve ${selectedExpenses.length} expense(s)?`
                            : bulkActionType === 'initial-expenses-approve'
                              ? `Approve ${selectedInitialExpenses.length} initial expense(s)?`
                              : bulkActionType === 'material-requests-approve'
                                ? `Approve ${selectedMaterialRequests.length} material request(s)?`
                                : bulkActionType === 'labour-entries-approve'
                                  ? `Approve ${selectedLabourEntries.length} labour entry(ies)?`
                                  : bulkActionType === 'professional-fees-approve'
                                    ? `Approve ${selectedProfessionalFees.length} professional fee(s)?`
                                    : bulkActionType === 'professional-activities-approve'
                                      ? `Approve ${selectedProfessionalActivities.length} professional activity(ies)?`
                                      : bulkActionType === 'budget-reallocations-approve'
                                        ? `Approve ${selectedBudgetReallocations.length} budget reallocation(s)?`
                                        : bulkActionType === 'purchase-order-modifications-approve'
                                          ? `Approve ${selectedPurchaseOrderModifications.length} purchase order modification(s)?`
                                          : bulkActionType === 'contingency-draws-approve'
                                            ? `Approve ${selectedContingencyDraws.length} contingency draw(s)?`
                                            : ''}
                    </p>
                    <label className="block text-sm font-medium ds-text-secondary mb-2">
                      Approval Notes (Optional)
                    </label>
                    <textarea
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Add approval notes..."
                      className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                      disabled={bulkProcessing}
                    />
                  </div>
                </div>
              </div>
              <div className="ds-bg-surface-muted px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-blue-400/60">
                <button
                  type="button"
                  onClick={() => setShowBulkApproveModal(false)}
                  disabled={bulkProcessing}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium ds-text-secondary ds-bg-surface border ds-border-subtle rounded-lg hover:ds-bg-surface-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (bulkActionType === 'materials-approve') {
                      handleBulkApproveMaterials();
                    } else if (bulkActionType === 'expenses-approve') {
                      handleBulkApproveExpenses();
                    } else if (bulkActionType === 'initial-expenses-approve') {
                      handleBulkApproveInitialExpenses();
                    } else if (bulkActionType === 'material-requests-approve') {
                      handleBulkApproveMaterialRequests();
                    } else if (bulkActionType === 'labour-entries-approve') {
                      handleBulkApproveLabourEntries();
                    } else if (bulkActionType === 'professional-fees-approve') {
                      handleBulkApproveProfessionalFees();
                    } else if (bulkActionType === 'professional-activities-approve') {
                      handleBulkApproveProfessionalActivities();
                    } else if (bulkActionType === 'budget-reallocations-approve') {
                      handleBulkApproveBudgetReallocations();
                    } else if (bulkActionType === 'purchase-order-modifications-approve') {
                      handleBulkApprovePurchaseOrderModifications();
                    } else if (bulkActionType === 'contingency-draws-approve') {
                      handleBulkApproveContingencyDraws();
                    }
                  }}
                  disabled={bulkProcessing}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {bulkProcessing ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reject Modal */}
      {showBulkRejectModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => !bulkProcessing && setShowBulkRejectModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative ds-bg-surface rounded-lg shadow-xl max-w-md w-full transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                    <svg
                      className="w-6 h-6 text-yellow-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3
                    className="text-lg font-semibold leading-6 ds-text-primary mb-2"
                    id="modal-title"
                  >
                    Reject Items
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm ds-text-muted mb-4">
                      {bulkActionType === 'cross-type-reject'
                        ? `Reject ${getTotalSelectedCount()} item(s) across multiple types?`
                        : bulkActionType === 'materials-reject'
                          ? `Reject ${selectedMaterials.length} material(s)?`
                          : bulkActionType === 'expenses-reject'
                            ? `Reject ${selectedExpenses.length} expense(s)?`
                            : bulkActionType === 'initial-expenses-reject'
                              ? `Reject ${selectedInitialExpenses.length} initial expense(s)?`
                              : bulkActionType === 'material-requests-reject'
                                ? `Reject ${selectedMaterialRequests.length} material request(s)?`
                                : bulkActionType === 'professional-fees-reject'
                                  ? `Reject ${selectedProfessionalFees.length} professional fee(s)?`
                                  : bulkActionType === 'professional-activities-reject'
                                    ? `Reject ${selectedProfessionalActivities.length} professional activity(ies)?`
                                    : bulkActionType === 'budget-reallocations-reject'
                                      ? `Reject ${selectedBudgetReallocations.length} budget reallocation(s)?`
                                      : bulkActionType === 'purchase-order-modifications-reject'
                                        ? `Reject ${selectedPurchaseOrderModifications.length} purchase order modification(s)?`
                                        : bulkActionType === 'contingency-draws-reject'
                                          ? `Reject ${selectedContingencyDraws.length} contingency draw(s)?`
                                          : ''}
                    </p>
                    <label className="block text-sm font-medium ds-text-secondary mb-2">
                      Reason for Rejection (Required)
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter rejection reason..."
                      className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      rows="4"
                      disabled={bulkProcessing}
                    />
                  </div>
                </div>
              </div>
              <div className="ds-bg-surface-muted px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-yellow-400/60">
                <button
                  type="button"
                  onClick={() => setShowBulkRejectModal(false)}
                  disabled={bulkProcessing}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium ds-text-secondary ds-bg-surface border ds-border-subtle rounded-lg hover:ds-bg-surface-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (bulkActionType === 'materials-reject') {
                      handleBulkRejectMaterials();
                    } else if (bulkActionType === 'expenses-reject') {
                      handleBulkRejectExpenses();
                    } else if (bulkActionType === 'initial-expenses-reject') {
                      handleBulkRejectInitialExpenses();
                    } else if (bulkActionType === 'material-requests-reject') {
                      handleBulkRejectMaterialRequests();
                    } else if (bulkActionType === 'professional-fees-reject') {
                      handleBulkRejectProfessionalFees();
                    } else if (bulkActionType === 'professional-activities-reject') {
                      handleBulkRejectProfessionalActivities();
                    } else if (bulkActionType === 'budget-reallocations-reject') {
                      handleBulkRejectBudgetReallocations();
                    } else if (bulkActionType === 'purchase-order-modifications-reject') {
                      handleBulkRejectPurchaseOrderModifications();
                    } else if (bulkActionType === 'contingency-draws-reject') {
                      handleBulkRejectContingencyDraws();
                    }
                  }}
                  disabled={bulkProcessing || !rejectReason.trim()}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {bulkProcessing ? 'Rejecting...' : 'Reject Items'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Item Reject Modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowRejectModal(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative ds-bg-surface rounded-lg shadow-xl max-w-md w-full transform transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                    <svg
                      className="w-6 h-6 text-yellow-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3
                    className="text-lg font-semibold leading-6 ds-text-primary mb-2"
                    id="modal-title"
                  >
                    Reject{' '}
                    {rejectItemType === 'material'
                      ? 'Material'
                      : rejectItemType === 'expense'
                        ? 'Expense'
                        : rejectItemType === 'initial-expense'
                          ? 'Initial Expense'
                          : rejectItemType === 'material-request'
                            ? 'Material Request'
                            : rejectItemType === 'professional-fee'
                              ? 'Professional Fee'
                                : rejectItemType === 'professional-activity'
                                  ? 'Professional Activity'
                                  : rejectItemType === 'budget-reallocation'
                                    ? 'Budget Reallocation'
                                    : rejectItemType === 'purchase-order-modification'
                                      ? 'Purchase Order Modification'
                                      : rejectItemType === 'contingency-draw'
                                        ? 'Contingency Draw'
                                        : 'Item'}
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm ds-text-muted mb-4">
                      Please provide a reason for rejection:
                    </p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter rejection reason..."
                      className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      rows="4"
                    />
                  </div>
                </div>
              </div>
              <div className="ds-bg-surface-muted px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-yellow-400/60">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                    setRejectItemId(null);
                    setRejectItemType(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium ds-text-secondary ds-bg-surface border ds-border-subtle rounded-lg hover:ds-bg-surface-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!rejectReason.trim()) {
                      toast.showError('Please provide a reason for rejection');
                      return;
                    }
                    if (rejectItemType === 'material') {
                      handleRejectMaterial(rejectItemId, rejectReason);
                    } else if (rejectItemType === 'expense') {
                      handleRejectExpense(rejectItemId, rejectReason);
                    } else if (rejectItemType === 'initial-expense') {
                      handleRejectInitialExpense(rejectItemId, rejectReason);
                    } else if (rejectItemType === 'material-request') {
                      handleRejectMaterialRequest(rejectItemId, rejectReason);
                    } else if (rejectItemType === 'professional-fee') {
                      handleRejectProfessionalFee(rejectItemId, rejectReason);
                    } else if (rejectItemType === 'professional-activity') {
                      handleRejectProfessionalActivity(rejectItemId, rejectReason);
                    } else if (rejectItemType === 'budget-reallocation') {
                      handleRejectBudgetReallocation(rejectItemId, rejectReason);
                    } else if (rejectItemType === 'purchase-order-modification') {
                      handleRejectPurchaseOrderModification(rejectItemId, rejectReason);
                    } else if (rejectItemType === 'contingency-draw') {
                      handleRejectContingencyDraw(rejectItemId, rejectReason);
                    }
                    setShowRejectModal(false);
                    setRejectReason('');
                    setRejectItemId(null);
                    setRejectItemType(null);
                  }}
                  disabled={!rejectReason.trim()}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        {/* Approval History Modal */}
        <ApprovalHistoryModal
          isOpen={showHistoryModal}
          onClose={closeHistoryModal}
          type={historyItemType}
          itemId={historyItemId}
          itemName={historyItemName}
        />
      </AppLayout>
    );
  }
