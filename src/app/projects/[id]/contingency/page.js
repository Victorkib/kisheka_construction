/**
 * Contingency Page
 * Standalone page for contingency reserve management
 * Redirects to cost management page with contingency tab
 * 
 * Route: /projects/[id]/contingency
 */

'use client';

import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { ContingencyTab } from '../costs/components/ContingencyTab';

export default function ContingencyPage() {
  const params = useParams();
  const projectId = params.id;
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: 'Projects', href: '/projects' },
            { label: 'Project Details', href: `/projects/${projectId}` },
            { label: 'Contingency Reserve', href: null },
          ]}
        />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Contingency Reserve</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage contingency reserve budget, draws, and usage
          </p>
        </div>

        {/* Contingency Content */}
        <ContingencyTab projectId={projectId} />
      </div>
    </AppLayout>
  );
}
