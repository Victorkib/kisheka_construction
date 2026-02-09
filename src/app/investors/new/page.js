/**
 * Add Investor Page
 * Form for creating new investor entries
 * 
 * Route: /investors/new
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { LoadingOverlay, LoadingButton } from '@/components/loading';

export default function NewInvestorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    investmentType: 'EQUITY',
    totalInvested: '',
    loanTerms: {
      interestRate: '',
      repaymentPeriod: '',
      repaymentSchedule: '',
      startDate: '',
      endDate: '',
    },
    initialContribution: {
      amount: '',
      date: new Date().toISOString().split('T')[0],
      type: 'EQUITY',
      notes: '',
      receiptUrl: '',
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoanTermsChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      loanTerms: { ...prev.loanTerms, [name]: value },
    }));
  };

  const handleInitialContributionChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      initialContribution: { ...prev.initialContribution, [name]: value },
    }));
  };

  const handleDocumentUpload = (url) => {
    if (url) {
      setDocuments((prev) => [
        ...prev,
        {
          fileName: `Document ${prev.length + 1}`,
          fileUrl: url,
          documentType: 'OTHER',
          uploadedAt: new Date(),
        },
      ]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.name || !formData.investmentType || !formData.totalInvested) {
      setError('Name, investment type, and total invested are required');
      setLoading(false);
      return;
    }

    if (parseFloat(formData.totalInvested) <= 0) {
      setError('Total invested must be greater than 0');
      setLoading(false);
      return;
    }

    // If initial contribution amount is not provided, use totalInvested
    const initialContribution = {
      ...formData.initialContribution,
      amount: formData.initialContribution.amount || formData.totalInvested,
      type: formData.initialContribution.type || formData.investmentType,
    };

    try {
      const response = await fetch('/api/investors', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          ...formData,
          totalInvested: parseFloat(formData.totalInvested),
          loanTerms:
            formData.investmentType === 'LOAN' || formData.investmentType === 'MIXED'
              ? {
                  interestRate: formData.loanTerms.interestRate
                    ? parseFloat(formData.loanTerms.interestRate)
                    : null,
                  repaymentPeriod: formData.loanTerms.repaymentPeriod
                    ? parseInt(formData.loanTerms.repaymentPeriod)
                    : null,
                  repaymentSchedule: formData.loanTerms.repaymentSchedule || null,
                  startDate: formData.loanTerms.startDate
                    ? new Date(formData.loanTerms.startDate)
                    : null,
                  endDate: formData.loanTerms.endDate ? new Date(formData.loanTerms.endDate) : null,
                }
              : null,
          documents: documents.length > 0 ? documents : [],
          initialContribution,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create investor');
      }

      // Redirect to investor detail page
      router.push(`/investors/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      console.error('Create investor error:', err);
    } finally {
      setLoading(false);
    }
  };

  const needsLoanTerms = formData.investmentType === 'LOAN' || formData.investmentType === 'MIXED';

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <LoadingOverlay isLoading={loading} message="Creating investor..." fullScreen={false} />
        <div className="mb-6">
          <Link
            href="/investors"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block"
          >
            ← Back to Investors
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Add New Investor</h1>
          <p className="mt-2 text-sm text-gray-700">
            Enter investor details and initial contribution
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Investment Details */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Investment Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Investment Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="investmentType"
                  value={formData.investmentType}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="EQUITY">Equity</option>
                  <option value="LOAN">Loan</option>
                  <option value="MIXED">Mixed (Equity + Loan)</option>
                </select>
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Total Invested (KES) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="totalInvested"
                  value={formData.totalInvested}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Loan Terms (if applicable) */}
          {needsLoanTerms && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Loan Terms</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                      Interest Rate (%)
                    </label>
                    <input
                      type="number"
                      name="interestRate"
                      value={formData.loanTerms.interestRate}
                      onChange={handleLoanTermsChange}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                      Repayment Period (months)
                    </label>
                    <input
                      type="number"
                      name="repaymentPeriod"
                      value={formData.loanTerms.repaymentPeriod}
                      onChange={handleLoanTermsChange}
                      min="0"
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Repayment Schedule
                  </label>
                  <input
                    type="text"
                    name="repaymentSchedule"
                    value={formData.loanTerms.repaymentSchedule}
                    onChange={handleLoanTermsChange}
                    placeholder="e.g., Monthly, Quarterly, Annually"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.loanTerms.startDate}
                      onChange={handleLoanTermsChange}
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.loanTerms.endDate}
                      onChange={handleLoanTermsChange}
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Initial Contribution */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Initial Contribution</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Amount (KES)
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.initialContribution.amount}
                    onChange={handleInitialContributionChange}
                    min="0"
                    step="0.01"
                    placeholder={formData.totalInvested || 'Auto-filled from total'}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.initialContribution.date}
                    onChange={handleInitialContributionChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Type</label>
                <select
                  name="type"
                  value={formData.initialContribution.type}
                  onChange={handleInitialContributionChange}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="EQUITY">Equity</option>
                  <option value="LOAN">Loan</option>
                  <option value="MIXED">Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Notes</label>
                <textarea
                  name="notes"
                  value={formData.initialContribution.notes}
                  onChange={handleInitialContributionChange}
                  rows="3"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Receipt/Proof of Payment
                </label>
                <CloudinaryUploadWidget
                  uploadPreset="Construction_Accountability_System"
                  folder="Kisheka_construction/investors/receipts"
                  label="Receipt/Proof of Payment"
                  value={formData.initialContribution.receiptUrl}
                  onChange={(url) => {
                    setFormData((prev) => ({
                      ...prev,
                      initialContribution: { ...prev.initialContribution, receiptUrl: url },
                    }));
                  }}
                  onDelete={() => {
                    setFormData((prev) => ({
                      ...prev,
                      initialContribution: { ...prev.initialContribution, receiptUrl: null },
                    }));
                  }}
                  maxSizeMB={5}
                  acceptedTypes={['image/*', 'application/pdf']}
                />
                {formData.initialContribution.receiptUrl && (
                  <div className="mt-2">
                    <a
                      href={formData.initialContribution.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View uploaded receipt
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Documents</h2>
            <CloudinaryUploadWidget
              uploadPreset="Construction_Accountability_System"
              folder="Kisheka_construction/investors/documents"
              label="Upload Document"
              onChange={handleDocumentUpload}
              acceptedTypes={['image/*', 'application/pdf']}
            />
            {documents.length > 0 && (
              <div className="mt-4 space-y-2">
                {documents.map((doc, idx) => (
                  <div key={idx} className="text-sm text-gray-600">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {doc.fileName}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Link
              href="/investors"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <LoadingButton
              type="submit"
              isLoading={loading}
              loadingText="Creating..."
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Create Investor
            </LoadingButton>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

