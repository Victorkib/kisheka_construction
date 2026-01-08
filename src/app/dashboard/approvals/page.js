/**
 * Approval Queue Page
 * Displays all pending approvals for materials and expenses
 * 
 * Route: /dashboard/approvals
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingButton, LoadingOverlay } from '@/components/loading';
import { CapitalBalanceWarning } from '@/components/financial/capital-balance-warning';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';

export default function ApprovalsPage() {
  const toast = useToast();
  const router = useRouter();
  const { canAccess, user } = usePermissions();
  const { currentProject } = useProjectContext();
  const [materials, setMaterials] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [initialExpenses, setInitialExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [selectedInitialExpenses, setSelectedInitialExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState('materials'); // 'materials', 'expenses', or 'initial-expenses'
  const [processingItems, setProcessingItems] = useState(new Set()); // Track items being processed
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState(null); // 'materials-approve', 'materials-reject', etc.
  const [rejectReason, setRejectReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectItemId, setRejectItemId] = useState(null);
  const [rejectItemType, setRejectItemType] = useState(null); // 'material', 'expense', 'initial-expense'

  // Check if user has access to approvals page
  useEffect(() => {
    if (user) {
      const userRole = user.role?.toLowerCase();
      if (userRole === 'clerk' || userRole === 'site_clerk') {
        toast.showError('You do not have permission to view the approvals page');
        router.push('/dashboard/clerk');
        return;
      }
      if (!canAccess('view_approvals')) {
        toast.showError('You do not have permission to view the approvals page');
        router.push('/dashboard');
        return;
      }
    }
  }, [user, canAccess, router, toast]);

  const fetchPendingApprovals = useCallback(async () => {
    if (!currentProject) return; // Don't fetch if no project selected
    
    try {
      setLoading(true);
      setError(null);

      const projectId = normalizeProjectId(currentProject._id);
      const projectIdParam = projectId ? `&projectId=${projectId}` : '';

      // Fetch materials with pending_approval status
      const materialsResponse = await fetch(`/api/materials?status=pending_approval&limit=100${projectIdParam}`);
      const materialsData = await materialsResponse.json();

      if (!materialsData.success) {
        throw new Error(materialsData.error || 'Failed to fetch pending material approvals');
      }

      setMaterials(materialsData.data.materials || []);

      // Fetch expenses with PENDING status
      const expensesResponse = await fetch(`/api/expenses?status=PENDING&limit=100${projectIdParam}`);
      const expensesData = await expensesResponse.json();

      if (!expensesData.success) {
        throw new Error(expensesData.error || 'Failed to fetch pending expense approvals');
      }

      setExpenses(expensesData.data.expenses || []);

      // Fetch initial expenses with pending_approval status
      const initialExpensesResponse = await fetch(`/api/initial-expenses?status=pending_approval&limit=100${projectIdParam}`);
      const initialExpensesData = await initialExpensesResponse.json();

      if (initialExpensesData.success) {
        setInitialExpenses(initialExpensesData.data.expenses || []);
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch approvals error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    if (user && (user.role?.toLowerCase() !== 'clerk' && user.role?.toLowerCase() !== 'site_clerk')) {
      fetchPendingApprovals();
    }
  }, [user, fetchPendingApprovals]);


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
      for (const itemId of selectedMaterials) {
        await handleApproveMaterial(itemId, approvalNotes);
      }
      setSelectedMaterials([]);
      toast.showSuccess(`Approved ${selectedMaterials.length} material(s) successfully!`);
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
      for (const itemId of selectedMaterials) {
        await handleRejectMaterial(itemId, rejectReason);
      }
      setSelectedMaterials([]);
      toast.showSuccess(`Rejected ${selectedMaterials.length} material(s) successfully!`);
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
      for (const itemId of selectedExpenses) {
        await handleApproveExpense(itemId, approvalNotes);
      }
      setSelectedExpenses([]);
      toast.showSuccess(`Approved ${selectedExpenses.length} expense(s) successfully!`);
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
      for (const itemId of selectedExpenses) {
        await handleRejectExpense(itemId, rejectReason);
      }
      setSelectedExpenses([]);
      toast.showSuccess(`Rejected ${selectedExpenses.length} expense(s) successfully!`);
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
        : [...prev, materialId]
    );
  };

  const toggleSelectAllMaterials = () => {
    if (selectedMaterials.length === materials.length) {
      setSelectedMaterials([]);
    } else {
      setSelectedMaterials(materials.map((m) => m._id));
    }
  };

  const toggleSelectExpense = (expenseId) => {
    setSelectedExpenses((prev) =>
      prev.includes(expenseId)
        ? prev.filter((id) => id !== expenseId)
        : [...prev, expenseId]
    );
  };

  const toggleSelectAllExpenses = () => {
    if (selectedExpenses.length === expenses.length) {
      setSelectedExpenses([]);
    } else {
      setSelectedExpenses(expenses.map((e) => e._id));
    }
  };

  const handleApproveInitialExpense = async (initialExpenseId, notes = '') => {
    try {
      const response = await fetch(`/api/initial-expenses/${initialExpenseId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true, notes }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve initial expense');
      }

      setInitialExpenses((prev) => prev.filter((e) => e._id !== initialExpenseId));
      setSelectedInitialExpenses((prev) => prev.filter((id) => id !== initialExpenseId));
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
      const response = await fetch(`/api/initial-expenses/${initialExpenseId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, notes: reason }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject initial expense');
      }

      setInitialExpenses((prev) => prev.filter((e) => e._id !== initialExpenseId));
      setSelectedInitialExpenses((prev) => prev.filter((id) => id !== initialExpenseId));
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
        : [...prev, initialExpenseId]
    );
  };

  const toggleSelectAllInitialExpenses = () => {
    if (selectedInitialExpenses.length === initialExpenses.length) {
      setSelectedInitialExpenses([]);
    } else {
      setSelectedInitialExpenses(initialExpenses.map((e) => e._id));
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
      for (const itemId of selectedInitialExpenses) {
        await handleApproveInitialExpense(itemId, approvalNotes);
      }
      setSelectedInitialExpenses([]);
      toast.showSuccess(`Approved ${selectedInitialExpenses.length} initial expense(s) successfully!`);
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
      for (const itemId of selectedInitialExpenses) {
        await handleRejectInitialExpense(itemId, rejectReason);
      }
      setSelectedInitialExpenses([]);
      toast.showSuccess(`Rejected ${selectedInitialExpenses.length} initial expense(s) successfully!`);
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkProcessing(false);
      setRejectReason('');
    }
  };

  // Check permissions for each type
  const canApproveMaterials = user && ['owner', 'pm', 'project_manager'].includes(user.role?.toLowerCase());
  const canApproveExpenses = user && ['owner', 'pm', 'project_manager', 'accountant'].includes(user.role?.toLowerCase());
  const canApproveInitialExpenses = user && ['owner', 'pm', 'project_manager', 'accountant'].includes(user.role?.toLowerCase());

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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Approval Queue</h1>
          <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">
            Review and approve pending submissions ({materials.length} materials, {expenses.length} expenses, {initialExpenses.length} initial expenses)
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('materials')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'materials'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Materials ({materials.length})
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'expenses'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Expenses ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('initial-expenses')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'initial-expenses'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Initial Expenses ({initialExpenses.length})
            </button>
          </nav>
        </div>

        {/* Bulk Actions - Materials */}
        {canApproveMaterials && activeTab === 'materials' && selectedMaterials.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex justify-between items-center">
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
        {canApproveExpenses && activeTab === 'expenses' && selectedExpenses.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex justify-between items-center">
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
        {canApproveInitialExpenses && activeTab === 'initial-expenses' && selectedInitialExpenses.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex justify-between items-center">
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

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Materials Table */}
        {activeTab === 'materials' && (
          <>
            {/* Capital Balance Warnings for Materials */}
            {!loading && materials.length > 0 && (
              <div className="mb-6 space-y-3">
                {Array.from(new Set(materials.map((m) => m.projectId).filter(Boolean))).map((projectId) => {
                  const projectMaterials = materials.filter((m) => m.projectId === projectId);
                  const totalAmount = projectMaterials.reduce((sum, m) => sum + (m.totalCost || 0), 0);
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
            ) : materials.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-600 mb-4">No pending material approvals</p>
                <p className="text-sm text-gray-500">All materials have been reviewed</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {canApproveMaterials && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedMaterials.length === materials.length && materials.length > 0}
                            onChange={toggleSelectAllMaterials}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Material
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Submitted By
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Total Cost
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Submitted
                      </th>
                      {canApproveMaterials && (
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {materials.map((material) => (
                      <tr
                        key={material._id}
                        className={`hover:bg-gray-50 ${
                          selectedMaterials.includes(material._id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        {canApproveMaterials && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedMaterials.includes(material._id)}
                              onChange={() => toggleSelectMaterial(material._id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div>
                            <Link
                              href={`/items/${material._id}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-900"
                            >
                              {material.name || material.materialName}
                            </Link>
                            {material.description && (
                              <div className="text-sm text-gray-600 truncate max-w-xs mt-1 leading-normal">
                                {material.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {material.submittedBy?.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-600 leading-normal">
                            {material.submittedBy?.email || ''}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {material.quantity || material.quantityPurchased || 0} {material.unit || ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            KES {material.totalCost?.toLocaleString() || '0.00'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {material.supplierName || material.supplier || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500">
                            {material.createdAt
                              ? new Date(material.createdAt).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        {canApproveMaterials && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveMaterial(material._id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectMaterialClick(material._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Expenses Table */}
        {activeTab === 'expenses' && (
          <>
            {/* Capital Balance Warnings for Expenses */}
            {!loading && expenses.length > 0 && (
              <div className="mb-6 space-y-3">
                {Array.from(new Set(expenses.map((e) => e.projectId).filter(Boolean))).map((projectId) => {
                  const projectExpenses = expenses.filter((e) => e.projectId === projectId);
                  const totalAmount = projectExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
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
            ) : expenses.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-600 mb-4">No pending expense approvals</p>
                <p className="text-sm text-gray-500">All expenses have been reviewed</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {canApproveExpenses && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedExpenses.length === expenses.length && expenses.length > 0}
                            onChange={toggleSelectAllExpenses}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Expense Code
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Submitted By
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Date
                      </th>
                      {canApproveMaterials && (
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expenses.map((expense) => (
                      <tr
                        key={expense._id}
                        className={`hover:bg-gray-50 ${
                          selectedExpenses.includes(expense._id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        {canApproveExpenses && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedExpenses.includes(expense._id)}
                              onChange={() => toggleSelectExpense(expense._id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <Link
                            href={`/expenses/${expense._id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-900"
                          >
                            {expense.expenseCode || 'N/A'}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {expense.description || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {expense.category?.replace('_', ' ') || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(expense.amount, expense.currency)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {expense.submittedBy?.name || expense.submittedBy?.email || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500">
                            {expense.date
                              ? new Date(expense.date).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        {canApproveExpenses && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveExpense(expense._id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectExpenseClick(expense._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Initial Expenses Table */}
        {activeTab === 'initial-expenses' && (
          <>
            {/* Capital Balance Warnings for Initial Expenses */}
            {!loading && initialExpenses.length > 0 && (
              <div className="mb-6 space-y-3">
                {Array.from(new Set(initialExpenses.map((e) => e.projectId).filter(Boolean))).map((projectId) => {
                  const projectInitialExpenses = initialExpenses.filter((e) => e.projectId === projectId);
                  const totalAmount = projectInitialExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
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
            ) : initialExpenses.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-600 mb-4">No pending initial expense approvals</p>
                <p className="text-sm text-gray-500">All initial expenses have been reviewed</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {canApproveInitialExpenses && (
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedInitialExpenses.length === initialExpenses.length && initialExpenses.length > 0}
                            onChange={toggleSelectAllInitialExpenses}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Expense Code
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Item Name
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Date Paid
                      </th>
                      {canApproveMaterials && (
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {initialExpenses.map((expense) => (
                      <tr
                        key={expense._id}
                        className={`hover:bg-gray-50 ${
                          selectedInitialExpenses.includes(expense._id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        {canApproveInitialExpenses && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedInitialExpenses.includes(expense._id)}
                              onChange={() => toggleSelectInitialExpense(expense._id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <Link
                            href={`/initial-expenses/${expense._id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-900"
                          >
                            {expense.expenseCode || 'N/A'}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {expense.itemName || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {expense.category?.replace('_', ' ') || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(expense.amount)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500">
                            {expense.datePaid
                              ? new Date(expense.datePaid).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </td>
                        {canApproveInitialExpenses && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveInitialExpense(expense._id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectInitialExpenseClick(expense._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Approval Metrics */}
        {(materials.length > 0 || expenses.length > 0 || initialExpenses.length > 0) && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-500">Pending Materials</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{materials.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-500">Pending Expenses</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{expenses.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-500">Total Value (Materials)</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(
                  materials.reduce((sum, m) => sum + (m.totalCost || 0), 0)
                )}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-500">Total Value (Expenses)</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(
                  expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
                )}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-500">Pending Initial Expenses</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{initialExpenses.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-500">Total Value (Initial Expenses)</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(
                  initialExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Approve Modal with Notes */}
      {showBulkApproveModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={() => !bulkProcessing && setShowBulkApproveModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-2" id="modal-title">
                    Approve Items
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      {bulkActionType === 'materials-approve'
                        ? `Approve ${selectedMaterials.length} material(s)?`
                        : bulkActionType === 'expenses-approve'
                        ? `Approve ${selectedExpenses.length} expense(s)?`
                        : `Approve ${selectedInitialExpenses.length} initial expense(s)?`}
                    </p>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Approval Notes (Optional)
                    </label>
                    <textarea
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Add approval notes..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                      disabled={bulkProcessing}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-blue-200">
                <button
                  type="button"
                  onClick={() => setShowBulkApproveModal(false)}
                  disabled={bulkProcessing}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={() => !bulkProcessing && setShowBulkRejectModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-2" id="modal-title">
                    Reject Items
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      {bulkActionType === 'materials-reject'
                        ? `Reject ${selectedMaterials.length} material(s)?`
                        : bulkActionType === 'expenses-reject'
                        ? `Reject ${selectedExpenses.length} expense(s)?`
                        : `Reject ${selectedInitialExpenses.length} initial expense(s)?`}
                    </p>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Rejection (Required)
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter rejection reason..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      rows="4"
                      disabled={bulkProcessing}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-yellow-200">
                <button
                  type="button"
                  onClick={() => setShowBulkRejectModal(false)}
                  disabled={bulkProcessing}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={() => setShowRejectModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-2" id="modal-title">
                    Reject {rejectItemType === 'material' ? 'Material' : rejectItemType === 'expense' ? 'Expense' : 'Initial Expense'}
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Please provide a reason for rejection:
                    </p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter rejection reason..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      rows="4"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-yellow-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                    setRejectItemId(null);
                    setRejectItemType(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
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
    </AppLayout>
  );
}

