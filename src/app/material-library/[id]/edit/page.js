/**
 * Edit Material Library Entry Page
 * Form for editing an existing library material
 * 
 * Route: /material-library/[id]/edit
 * Auth: OWNER only
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { MaterialLibraryForm } from '@/components/material-library/material-library-form';

function EditMaterialLibraryPageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (params.id) {
      fetchMaterial();
      fetchCategories();
    }
  }, [params.id]);

  const fetchMaterial = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/material-library/${params.id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch material');
      }

      setMaterial(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch material error:', err);
    } finally {
      setLoading(false);
    }
  };

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
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/material-library/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update material');
      }

      toast.showSuccess('Material updated successfully');
      router.push('/material-library');
    } catch (err) {
      setError(err.message);
      console.error('Update material library error:', err);
    } finally {
      setSaving(false);
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
            <p>You do not have permission to manage the material library. Only Owners can edit materials.</p>
          </div>
          <Link href="/material-library" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Material Library
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable rows={5} columns={2} />
        </div>
      </AppLayout>
    );
  }

  if (error && !material) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
          <Link href="/material-library" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Material Library
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!material) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Material Not Found</p>
            <p>The material you're looking for doesn't exist or has been deleted.</p>
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
            Edit Material: {material.name}
          </h1>
          <p className="text-gray-600 mt-2">Update material details in the library</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <MaterialLibraryForm
            initialData={material}
            categories={categories}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={saving}
            error={error}
            isEdit={true}
          />
        </div>
      </div>
    </AppLayout>
  );
}

export default function EditMaterialLibraryPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={5} columns={2} />
          </div>
        </AppLayout>
      }
    >
      <EditMaterialLibraryPageContent />
    </Suspense>
  );
}

