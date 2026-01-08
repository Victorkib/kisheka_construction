/**
 * Create New Professional Services Library Entry Page
 * Form for adding a new professional to the library
 * 
 * Route: /professional-services-library/new
 * Auth: OWNER only
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ProfessionalServicesLibraryForm } from '@/components/professional-services-library/professional-services-library-form';

export default function NewProfessionalServicesLibraryPage() {
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/professional-services-library', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create professional');
      }

      toast.showSuccess('Professional added to library successfully');
      router.push('/professional-services-library');
    } catch (err) {
      setError(err.message);
      console.error('Create professional services library error:', err);
    } finally {
      setLoading(false);
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
            <p>You do not have permission to manage the professional services library. Only Owners can add professionals.</p>
          </div>
          <Link href="/professional-services-library" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Professional Services Library
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
            ← Back to Professional Services Library
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
            Add New Professional to Library
          </h1>
          <p className="text-gray-600 mt-2">Create a new professional entry for quick assignment to projects</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <ProfessionalServicesLibraryForm
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





