/**
 * Clerk Dashboard
 * Simplified dashboard focused on quick data entry
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingCard } from '@/components/loading';

export default function ClerkDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (!data.success) {
          router.push('/auth/login');
          return;
        }

        setUser(data.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-96"></div>
            </div>
            <LoadingCard count={3} showHeader={true} lines={3} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Clerk Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {user.firstName || user.email}!</p>
        </div>

        {/* Quick Actions - Primary Focus */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/items/new"
              className="p-6 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
            >
              <div className="text-4xl mb-3">📦</div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">Add Material</h3>
              <p className="text-sm text-gray-600">Create new material entry</p>
            </Link>

            <Link
              href="/expenses/new"
              className="p-6 border-2 border-red-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition text-center"
            >
              <div className="text-4xl mb-3">💸</div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">Add Expense</h3>
              <p className="text-sm text-gray-600">Create new expense entry</p>
            </Link>

            <Link
              href="/initial-expenses/new"
              className="p-6 border-2 border-orange-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition text-center"
            >
              <div className="text-4xl mb-3">🏛️</div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">Add Initial Expense</h3>
              <p className="text-sm text-gray-600">Track pre-construction costs</p>
            </Link>
          </div>
        </div>

        {/* Materials Pending Receipt */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Materials Pending Receipt Verification</h2>
          <p className="text-sm text-gray-600 mb-4">Materials that need receipt verification on site</p>
          <Link
            href="/items?status=approved&status=pending_receipt"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            <span>View Pending Receipt Materials</span>
            <span>→</span>
          </Link>
        </div>

        {/* View & Manage Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">View & Manage</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/items"
              className="p-4 border-2 border-green-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📋</div>
                <div>
                  <h3 className="font-semibold text-gray-900">View Materials</h3>
                  <p className="text-sm text-gray-600">Browse all materials</p>
                </div>
              </div>
            </Link>

            <Link
              href="/expenses"
              className="p-4 border-2 border-red-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💸</div>
                <div>
                  <h3 className="font-semibold text-gray-900">View Expenses</h3>
                  <p className="text-sm text-gray-600">Browse all expenses</p>
                </div>
              </div>
            </Link>

            <Link
              href="/projects"
              className="p-4 border-2 border-indigo-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🏗️</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Projects</h3>
                  <p className="text-sm text-gray-600">View project details</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Helpful Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-md font-semibold text-blue-900 mb-2">💡 Quick Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Use the quick action buttons above to quickly add new entries</li>
            <li>• Make sure to upload receipts and invoices when adding materials or expenses</li>
            <li>• All entries require approval before being finalized</li>
            <li>• You can view your submitted entries in the "View & Manage" section</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}

