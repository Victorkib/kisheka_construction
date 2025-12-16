/**
 * Create Material Template Page
 * Form for creating a new material template
 * 
 * Route: /material-templates/new
 */

'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { TemplateForm } from '@/components/material-templates/template-form';

function NewTemplatePageContent() {
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);

      const response = await fetch('/api/material-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create template');
      }

      toast.showSuccess('Template created successfully');
      router.push('/material-templates');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/material-templates');
  };

  if (!canAccess('create_material_template')) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to create templates.</p>
            <Link href="/material-templates" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
              ← Back to Templates
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/material-templates" className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block">
            ← Back to Templates
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create Material Template</h1>
          <p className="text-gray-600 mt-2">Save a combination of materials for quick reuse</p>
        </div>

        <TemplateForm onSubmit={handleSubmit} onCancel={handleCancel} loading={loading} />
      </div>
    </AppLayout>
  );
}

export default function NewTemplatePage() {
  return (
    <Suspense fallback={<AppLayout><div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">Loading...</div></AppLayout>}>
      <NewTemplatePageContent />
    </Suspense>
  );
}

