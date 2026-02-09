/**
 * Edit Supplier Page
 * Form for editing an existing supplier
 * 
 * Route: /suppliers/[id]/edit
 * Auth: OWNER, PM only
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';

function EditSupplierPageContent() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params?.id;
  const { canAccess, user } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [canEdit, setCanEdit] = useState(false);

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
    specialties: [],
    rating: '',
    notes: '',
    status: 'active'
  });

  const [newSpecialty, setNewSpecialty] = useState('');

  useEffect(() => {
    if (user) {
      const hasPermission = canAccess('edit_supplier');
      setCanEdit(hasPermission);
      if (!hasPermission) {
        setError('You do not have permission to edit suppliers. Only OWNER and PM can edit suppliers.');
      }
      if (supplierId && hasPermission) {
        fetchSupplier();
      }
    }
  }, [user, canAccess, supplierId]);

  const fetchSupplier = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/suppliers/${supplierId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch supplier');
      }

      const supplier = data.data.supplier;
      setFormData({
        name: supplier.name || '',
        contactPerson: supplier.contactPerson || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        alternatePhone: supplier.alternatePhone || '',
        alternateEmail: supplier.alternateEmail || '',
        businessType: supplier.businessType || '',
        taxId: supplier.taxId || '',
        address: supplier.address || '',
        preferredContactMethod: supplier.preferredContactMethod || 'all',
        emailEnabled: supplier.emailEnabled !== false,
        smsEnabled: supplier.smsEnabled !== false,
        pushNotificationsEnabled: supplier.pushNotificationsEnabled !== false,
        specialties: supplier.specialties || [],
        rating: supplier.rating?.toString() || '',
        notes: supplier.notes || '',
        status: supplier.status || 'active'
      });
    } catch (err) {
      setError(err.message);
      console.error('Fetch supplier error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAddSpecialty = () => {
    if (newSpecialty.trim() && !formData.specialties.includes(newSpecialty.trim())) {
      setFormData((prev) => ({
        ...prev,
        specialties: [...prev.specialties, newSpecialty.trim()],
      }));
      setNewSpecialty('');
    }
  };

  const handleRemoveSpecialty = (index) => {
    setFormData((prev) => ({
      ...prev,
      specialties: prev.specialties.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Validation
    if (!formData.name || formData.name.trim().length === 0) {
      setError('Supplier name is required');
      setSubmitting(false);
      return;
    }

    if (!formData.email || formData.email.trim().length === 0) {
      setError('Email is required');
      setSubmitting(false);
      return;
    }

    if (!formData.phone || formData.phone.trim().length === 0) {
      setError('Phone number is required');
      setSubmitting(false);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError('Invalid email format');
      setSubmitting(false);
      return;
    }

    try {
      const updateResponse = await fetch(`/api/suppliers/${supplierId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          ...formData,
          rating: formData.rating ? parseFloat(formData.rating) : null
        }),
      });

      const data = await updateResponse.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update supplier');
      }

      toast.showSuccess('Supplier updated successfully');
      router.push(`/suppliers/${supplierId}`);
    } catch (err) {
      setError(err.message);
      console.error('Update supplier error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-900 font-medium">Loading supplier...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!canEdit && user) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border-2 border-yellow-300 text-yellow-900 px-4 py-3 rounded mb-6">
            <p className="font-bold">Access Denied</p>
            <p className="font-medium">You do not have permission to edit suppliers. Only OWNER and PM can edit suppliers.</p>
          </div>
          <Link href="/suppliers" className="text-blue-600 hover:text-blue-800 underline font-semibold">
            ← Back to Suppliers
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/suppliers/${supplierId}`} className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block font-semibold underline">
            ← Back to Supplier
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Edit Supplier</h1>
          <p className="text-gray-700 mt-2 font-medium">Update supplier information</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-300 text-red-900 px-4 py-3 rounded mb-6 flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-bold">Error</p>
              <p className="font-medium">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-700 hover:text-red-900 font-bold text-xl">
              ×
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Supplier Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., ABC Construction Supplies"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  placeholder="e.g., John Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="supplier@example.com"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Phone <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+254712345678"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Alternate Phone
                </label>
                <input
                  type="tel"
                  name="alternatePhone"
                  value={formData.alternatePhone}
                  onChange={handleChange}
                  placeholder="+254712345679"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Alternate Email
                </label>
                <input
                  type="email"
                  name="alternateEmail"
                  value={formData.alternateEmail}
                  onChange={handleChange}
                  placeholder="alternate@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Business Details */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Business Type
                </label>
                <input
                  type="text"
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleChange}
                  placeholder="e.g., Limited Company, Sole Proprietor"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Tax ID
                </label>
                <input
                  type="text"
                  name="taxId"
                  value={formData.taxId}
                  onChange={handleChange}
                  placeholder="e.g., P123456789X"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Physical address..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Communication Preferences */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Communication Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Preferred Contact Method
                </label>
                <select
                  name="preferredContactMethod"
                  value={formData.preferredContactMethod}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="all">All Methods</option>
                  <option value="email">Email Only</option>
                  <option value="sms">SMS Only</option>
                  <option value="push">Push Notifications Only</option>
                  <option value="email_sms">Email + SMS</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="emailEnabled"
                    checked={formData.emailEnabled}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-900">Enable Email Notifications</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="smsEnabled"
                    checked={formData.smsEnabled}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-900">Enable SMS Notifications</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="pushNotificationsEnabled"
                    checked={formData.pushNotificationsEnabled}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-900">Enable Push Notifications</span>
                </label>
              </div>
            </div>
          </div>

          {/* Specialties */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Specialties (Optional)</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSpecialty();
                    }
                  }}
                  placeholder="e.g., Concrete, Steel, Electrical"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddSpecialty}
                  className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 font-semibold"
                >
                  Add
                </button>
              </div>

              {formData.specialties.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.specialties.map((specialty, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm font-semibold"
                    >
                      {specialty}
                      <button
                        type="button"
                        onClick={() => handleRemoveSpecialty(index)}
                        className="text-blue-700 hover:text-blue-900 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Rating (1-5)
                </label>
                <input
                  type="number"
                  name="rating"
                  value={formData.rating}
                  onChange={handleChange}
                  min="1"
                  max="5"
                  step="0.1"
                  placeholder="e.g., 4.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-900 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Additional notes about this supplier..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Link href={`/suppliers/${supplierId}`} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900 font-semibold">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md"
            >
              {submitting ? 'Updating...' : 'Update Supplier'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function EditSupplierPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-900 font-medium">Loading...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <EditSupplierPageContent />
    </Suspense>
  );
}
