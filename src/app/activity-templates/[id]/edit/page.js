/**
 * Edit Activity Template Page
 * Form for editing an activity template
 * 
 * Route: /activity-templates/[id]/edit
 * Auth: OWNER/PM
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ActivityTemplateForm } from '@/components/activity-templates/activity-template-form';

function EditActivityTemplatePageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [template, setTemplate] = useState(null);

  useEffect(() => {
    if (params.id) {
      fetchTemplate();
    }
  }, [params.id]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/activity-templates/${params.id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch template');
      }

      setTemplate(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch template error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/activity-templates/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update template');
      }

      toast.showSuccess('Activity template updated successfully');
      router.push('/activity-templates');
    } catch (err) {
      setError(err.message);
      console.error('Update activity template error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/activity-templates');
  };

  if (!canAccess('manage_activity_templates')) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to edit activity templates. Only OWNER and PM can edit templates.</p>
          </div>
          <Link href="/activity-templates" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Activity Templates
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

  if (error && !template) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
          <Link href="/activity-templates" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Activity Templates
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
          <Link href="/activity-templates" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Activity Templates
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
            Edit Activity Template
          </h1>
          <p className="text-gray-600 mt-2">Update activity template details</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <ActivityTemplateForm
            initialData={template}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={submitting}
            showUsageStats={true}
          />
        </div>
      </div>
    </AppLayout>
  );
}

export default function EditActivityTemplatePage() {
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
      <EditActivityTemplatePageContent />
    </Suspense>
  );
}





