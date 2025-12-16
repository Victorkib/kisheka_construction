/**
 * Supplier Delivery Notes Page
 * DEPRECATED: Suppliers no longer have direct system access
 * This page shows a deprecation notice
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';

export default function SupplierDeliveryNotesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login after showing message
    const timer = setTimeout(() => {
      router.push('/auth/login');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-medium text-yellow-800 mb-2">
                Supplier Delivery Notes Page No Longer Available
              </h3>
              <div className="text-sm text-yellow-700 space-y-2">
                <p>
                  This page is no longer accessible. Suppliers no longer have direct system access.
                </p>
                <p>
                  <strong>For delivery notes and order fulfillment:</strong>
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Delivery notes should be submitted through the purchase order response link</li>
                  <li>When you receive a purchase order notification, use the provided link to respond</li>
                  <li>You can upload delivery notes and fulfill orders through the response interface</li>
                  <li>Contact the project manager directly if you need assistance</li>
                </ul>
                <p className="mt-4 font-semibold">
                  You will be redirected to the login page in a few seconds...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
