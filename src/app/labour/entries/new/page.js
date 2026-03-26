/**
 * New Labour Entry Page - ENHANCED
 * Context-aware labour entry with auto-population
 *
 * Route: /labour/entries/new
 */

'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { EnhancedLabourEntryForm } from '@/components/labour/EnhancedLabourEntryForm';

function NewLabourEntryPageContent() {
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold ds-text-primary">
            New Labour Entry
          </h1>
          <p className="text-sm ds-text-secondary mt-1">
            Log labour hours for workers, equipment operators, or professional services
          </p>
        </div>

        {/* Enhanced Form */}
        <EnhancedLabourEntryForm />
      </div>
    </AppLayout>
  );
}

export default function NewLabourEntryPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-5xl mx-auto px-4 py-8">
            <LoadingSpinner size="lg" />
          </div>
        </AppLayout>
      }
    >
      <NewLabourEntryPageContent />
    </Suspense>
  );
}
