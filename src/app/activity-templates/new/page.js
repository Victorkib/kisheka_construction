/**
 * Create New Activity Template Page
 * Form for creating a new activity template
 * 
 * Route: /activity-templates/new
 * Auth: OWNER/PM
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ActivityTemplateForm } from '@/components/activity-templates/activity-template-form';

export default function NewActivityTemplatePage() {
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/activity-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create template');
      }

      toast.showSuccess('Activity template created successfully');
      router.push('/activity-templates');
    } catch (err) {
      setError(err.message);
      console.error('Create activity template error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/activity-templates');
  };

  if (!canAccess('create_activity_template')) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to create activity templates. Only OWNER and PM can create templates.</p>
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
            Create Activity Template
          </h1>
          <p className="text-gray-600 mt-2">Create a reusable template for quick activity entry</p>
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
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
            showUsageStats={false}
          />
        </div>
      </div>
    </AppLayout>
  );
}





