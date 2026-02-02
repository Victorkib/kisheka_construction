/**
 * Approval Queue Page
 * Server wrapper that renders the client-only Approvals UI
 * Route: /dashboard/approvals
 */

export const revalidate = 60;

import ApprovalsClient from './approvals-client';

export default function ApprovalsPage() {
  // This is a server component; all client logic lives in `approvals-client.js`
  return <ApprovalsClient />;
}


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


