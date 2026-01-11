/**
 * Edit Professional Services Library Entry Page
 * Form for editing a professional in the library
 * 
 * Route: /professional-services-library/[id]/edit
 * Auth: OWNER only
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ProfessionalServicesLibraryForm } from '@/components/professional-services-library/professional-services-library-form';

function EditProfessionalServicesLibraryPageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [professional, setProfessional] = useState(null);

  useEffect(() => {
    fetchProfessional();
  }, [params.id]);

  const fetchProfessional = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/professional-services-library/${params.id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch professional');
      }

      setProfessional(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch professional error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/professional-services-library/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update professional');
      }

      toast.showSuccess('Professional updated successfully');
      router.push('/professional-services-library');
    } catch (err) {
      setError(err.message);
      console.error('Update professional services library error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/professional-services-library');
  };

  if (!canAccess('manage_professional_services_library')) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to manage the professional services library. Only Owners can edit professionals.</p>
          </div>
          <Link href="/professional-services-library" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Library
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !professional) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
          <Link href="/professional-services-library" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Library
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
          <Link href="/professional-services-library" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Library
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
            Edit Professional
          </h1>
          <p className="text-gray-600 mt-2">Update professional information in the library</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <ProfessionalServicesLibraryForm
            initialData={professional}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={submitting}
            error={error}
            isEdit={true}
          />
        </div>
      </div>
    </AppLayout>
  );
}

export default function EditProfessionalServicesLibraryPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        </div>
      </AppLayout>
    }>
      <EditProfessionalServicesLibraryPageContent />
    </Suspense>
  );
}





