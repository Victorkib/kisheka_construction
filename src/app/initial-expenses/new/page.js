/**
 * Add Initial Expense Page
 * Multi-step form for creating new initial expense entries
 * 
 * Route: /initial-expenses/new
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { LoadingOverlay, LoadingButton } from '@/components/loading';

export default function NewInitialExpensePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [receiptFileUrl, setReceiptFileUrl] = useState(null);
  const [supportingDocuments, setSupportingDocuments] = useState([]);

  const [formData, setFormData] = useState({
    projectId: '',
    category: '',
    itemName: '',
    amount: '',
    supplier: '',
    receiptNumber: '',
    datePaid: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

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

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.projectId || !formData.category) {
          setError('Please select a project and category');
          return false;
        }
        break;
      case 2:
        if (!formData.itemName || !formData.amount || !formData.datePaid) {
          setError('Please fill in all required fields');
          return false;
        }
        if (parseFloat(formData.amount) <= 0) {
          setError('Amount must be greater than 0');
          return false;
        }
        break;
      default:
        return true;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!validateStep(2)) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/initial-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          receiptFileUrl,
          supportingDocuments,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create initial expense');
      }

      // Show success message based on status
      const needsApproval = parseFloat(formData.amount) >= 100000;
      const message = needsApproval
        ? 'Initial expense created and requires approval (amount >= 100k)'
        : 'Initial expense created and auto-approved';

      // Redirect to expense detail page
      router.push(`/initial-expenses/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      console.error('Create initial expense error:', err);
    } finally {
      setLoading(false);
    }
  };

  const initialExpenseCategories = [
    { value: 'land', label: 'Land Purchase' },
    { value: 'transfer_fees', label: 'Transfer Fees' },
    { value: 'county_fees', label: 'County Fees' },
    { value: 'permits', label: 'Permits' },
    { value: 'approvals', label: 'Approvals' },
    { value: 'boreholes', label: 'Boreholes' },
    { value: 'electricity', label: 'Electricity' },
    { value: 'other', label: 'Other' },
  ];

  const needsApproval = parseFloat(formData.amount) >= 100000;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <LoadingOverlay isLoading={loading} message="Creating initial expense..." fullScreen={false} />
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/initial-expenses"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Initial Expenses
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Add Initial Expense</h1>
          <p className="text-gray-600 mt-2">Track pre-construction expenses</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      currentStep >= step
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {step}
                  </div>
                  <div className="mt-2 text-xs text-center text-gray-600">
                    {step === 1 && 'Project & Category'}
                    {step === 2 && 'Details'}
                    {step === 3 && 'Documents'}
                    {step === 4 && 'Review'}
                  </div>
                </div>
                {step < 4 && (
                  <div
                    className={`h-1 flex-1 mx-2 ${
                      currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
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
          {/* Step 1: Project & Category */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Step 1: Project & Category</h2>
              
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
                  <p className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                    ⚠️ No projects found. Please <Link href="/projects/new" className="underline font-medium">create a project first</Link>.
                  </p>
                )}
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
                  <option value="">Select a category</option>
                  {initialExpenseCategories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Item Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Step 2: Item Details</h2>
              
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="itemName"
                  value={formData.itemName}
                  onChange={handleChange}
                  placeholder="e.g., Land Purchase - Plot 123"
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Amount (KES) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
                {needsApproval && (
                  <p className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                    ⚠️ This expense requires approval (amount &gt;= 100,000 KES)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Supplier/Agency
                </label>
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  placeholder="e.g., County Government"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Receipt Number
                </label>
                <input
                  type="text"
                  name="receiptNumber"
                  value={formData.receiptNumber}
                  onChange={handleChange}
                  placeholder="e.g., REC-2024-001"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Date Paid <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="datePaid"
                  value={formData.datePaid}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Notes
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

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-6 py-2 rounded-lg transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Documents */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Step 3: Documents</h2>
              
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                  Receipt/Invoice
                </label>
                <CloudinaryUploadWidget
                  uploadPreset="Construction_Accountability_System"
                  folder="Kisheka_construction/initial-expenses/receipts"
                  label="Receipt/Invoice"
                  value={receiptFileUrl}
                  onChange={(url) => setReceiptFileUrl(url)}
                  onDelete={() => setReceiptFileUrl(null)}
                  maxSizeMB={5}
                  acceptedTypes={['image/*', 'application/pdf']}
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                  Supporting Documents (Optional)
                </label>
                <p className="text-sm text-gray-600 mb-2 leading-normal">
                  Upload additional documents like contracts, agreements, etc.
                </p>
                <CloudinaryUploadWidget
                  uploadPreset="Construction_Accountability_System"
                  folder="Kisheka_construction/initial-expenses/supporting"
                  label="Supporting Documents"
                  onChange={(url) => {
                    if (url) {
                      setSupportingDocuments((prev) => [...prev, { fileUrl: url, uploadedAt: new Date().toISOString() }]);
                    }
                  }}
                  maxSizeMB={10}
                  acceptedTypes={['image/*', 'application/pdf']}
                />
                {supportingDocuments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {supportingDocuments.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm text-gray-700">Document {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSupportingDocuments((prev) => prev.filter((_, i) => i !== index));
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-6 py-2 rounded-lg transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Step 4: Review & Submit</h2>
              
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Project</p>
                    <p className="font-medium">
                      {projects.find((p) => p._id === formData.projectId)?.projectName || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Category</p>
                    <p className="font-medium">
                      {initialExpenseCategories.find((c) => c.value === formData.category)?.label || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Item Name</p>
                    <p className="font-medium">{formData.itemName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Amount</p>
                    <p className="font-medium text-lg">
                      {new Intl.NumberFormat('en-KE', {
                        style: 'currency',
                        currency: 'KES',
                      }).format(parseFloat(formData.amount) || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Supplier</p>
                    <p className="font-medium">{formData.supplier || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date Paid</p>
                    <p className="font-medium">
                      {new Date(formData.datePaid).toLocaleDateString('en-KE')}
                    </p>
                  </div>
                </div>
                {needsApproval && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm text-yellow-800">
                      ⚠️ This expense will require approval (amount &gt;= 100,000 KES)
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium px-6 py-2 rounded-lg transition"
                >
                  ← Back
                </button>
                <LoadingButton
                  type="submit"
                  isLoading={loading}
                  loadingText="Creating..."
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium px-6 py-2 rounded-lg transition"
                >
                  Create Initial Expense
                </LoadingButton>
              </div>
            </div>
          )}
        </form>
      </div>
    </AppLayout>
  );
}

