/**
 * Edit Material Template Page
 * Form for editing an existing template
 * 
 * Route: /material-templates/[id]/edit
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { TemplateForm } from '@/components/material-templates/template-form';

function EditTemplatePageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (params.id) {
      fetchTemplate();
    }
  }, [params.id]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/material-templates/${params.id}`);
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
    try {
      setSaving(true);

      const response = await fetch(`/api/material-templates/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update template');
      }

      toast.showSuccess('Template updated successfully');
      router.push('/material-templates');
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/material-templates');
  };

  if (!canAccess('manage_material_templates')) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to edit templates.</p>
            <Link href="/material-templates" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
              ← Back to Templates
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable rows={5} columns={4} />
        </div>
      </AppLayout>
    );
  }

  if (error || !template) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error || 'Template not found'}
          </div>
          <Link href="/material-templates" className="text-blue-600 hover:text-blue-800">
            ← Back to Templates
          </Link>
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
          <h1 className="text-3xl font-bold text-gray-900">Edit Template</h1>
          <p className="text-gray-600 mt-2">{template.name}</p>
        </div>

        <TemplateForm
          initialData={template}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={saving}
          showUsageStats={true}
        />
      </div>
    </AppLayout>
  );
}

export default function EditTemplatePage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={5} columns={4} />
          </div>
        </AppLayout>
      }
    >
      <EditTemplatePageContent />
    </Suspense>
  );
}

