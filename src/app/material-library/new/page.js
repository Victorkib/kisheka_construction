/**
 * Create New Material Library Entry Page
 * Form for adding a new material to the library
 * 
 * Route: /material-library/new
 * Auth: OWNER only
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { MaterialLibraryForm } from '@/components/material-library/material-library-form';

export default function NewMaterialLibraryPage() {
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/material-library', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create material');
      }

      toast.showSuccess('Material added to library successfully');
      router.push('/material-library');
    } catch (err) {
      setError(err.message);
      console.error('Create material library error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/material-library');
  };

  if (!canAccess('manage_material_library')) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to manage the material library. Only Owners can add materials.</p>
          </div>
          <Link href="/material-library" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Material Library
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
          <Link href="/material-library" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Material Library
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
            Add New Material to Library
          </h1>
          <p className="text-gray-600 mt-2">Create a new material entry for quick access in bulk requests</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <MaterialLibraryForm
            categories={categories}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
            error={error}
            isEdit={false}
          />
        </div>
      </div>
    </AppLayout>
  );
}

