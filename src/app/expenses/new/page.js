/**
 * Add Expense Page
 * Form for creating new expense entries
 * 
 * Route: /expenses/new
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { LoadingOverlay, LoadingButton } from '@/components/loading';

function NewExpensePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams?.get('projectId');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);

  const [formData, setFormData] = useState({
    projectId: '',
    amount: '',
    category: '',
    description: '',
    vendor: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    referenceNumber: '',
    receiptFileUrl: null,
    notes: '',
    currency: 'KES',
  });

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Update projectId if provided in URL
  useEffect(() => {
    if (projectIdFromUrl) {
      setFormData((prev) => ({ ...prev, projectId: projectIdFromUrl }));
    }
  }, [projectIdFromUrl]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
        // Auto-select first project if available
        if (data.data && data.data.length > 0 && !formData.projectId) {
          setFormData((prev) => ({ ...prev, projectId: data.data[0]._id }));
        }
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.projectId || !formData.amount || !formData.category || !formData.description || !formData.vendor) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (parseFloat(formData.amount) <= 0) {
      setError('Amount must be greater than 0');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create expense');
      }

      // Redirect to expense detail page
      router.push(`/expenses/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      console.error('Create expense error:', err);
    } finally {
      setLoading(false);
    }
  };

  const expenseCategories = [
    { value: 'equipment_rental', label: 'Equipment Rental' },
    { value: 'transport', label: 'Transport' },
    { value: 'accommodation', label: 'Accommodation' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'safety', label: 'Safety' },
    { value: 'permits', label: 'Permits' },
    { value: 'training', label: 'Training' },
    { value: 'excavation', label: 'Excavation' },
    { value: 'earthworks', label: 'Earthworks' },
    { value: 'construction_services', label: 'Construction Services' },
    { value: 'other', label: 'Other' },
  ];

  const paymentMethods = [
    { value: 'CASH', label: 'Cash' },
    { value: 'M_PESA', label: 'M-Pesa' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'CHEQUE', label: 'Cheque' },
  ];

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <LoadingOverlay isLoading={loading} message="Creating expense..." fullScreen={false} />
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/expenses"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Expenses
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Add New Expense</h1>
          <p className="text-gray-600 mt-2">Create a new expense entry</p>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-semibold mb-1">💡 When to use Expenses vs Materials:</p>
            <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
              <li><strong>Use Expenses</strong> for services, work performed, rentals, and operational costs (e.g., excavation, equipment rental, transport, utilities)</li>
              <li><strong>Use Materials</strong> for physical items you purchase with quantities (e.g., cement, steel, tiles, paint)</li>
              <li>Expenses are deducted from your <strong>Contingency Budget</strong></li>
            </ul>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
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
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectName || project.projectCode}
                </option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className="text-sm text-gray-600 mt-1 leading-normal">
                No projects found. Please create a project first.
              </p>
            )}
          </div>

          {/* Amount and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                >
                  <option value="KES">KES</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                  className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              >
                <option value="">Select category</option>
                {expenseCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Describe the expense..."
              required
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
            />
          </div>

          {/* Vendor and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Vendor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="vendor"
                value={formData.vendor}
                onChange={handleChange}
                placeholder="Vendor name"
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Payment Method and Reference */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Payment Method
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Reference Number
              </label>
              <input
                type="text"
                name="referenceNumber"
                value={formData.referenceNumber}
                onChange={handleChange}
                placeholder="Payment reference (optional)"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Receipt Upload */}
          <div>
            <CloudinaryUploadWidget
              uploadPreset="Construction_Accountability_System"
              folder={formData.projectId ? `Kisheka_construction/expenses/${formData.projectId}` : 'Kisheka_construction/expenses'}
              label="Receipt Photo/Document"
              value={formData.receiptFileUrl}
              onChange={(url) => setFormData((prev) => ({ ...prev, receiptFileUrl: url }))}
              onDelete={() => setFormData((prev) => ({ ...prev, receiptFileUrl: null }))}
              maxSizeMB={5}
              acceptedTypes={['image/*', 'application/pdf']}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
              Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Link
              href="/expenses"
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <LoadingButton
              type="submit"
              isLoading={loading}
              loadingText="Creating..."
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Create Expense
            </LoadingButton>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewExpensePage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <NewExpensePageContent />
    </Suspense>
  );
}

