/**
 * Project Health Dashboard Page
 * Detailed health metrics and recommendations for a project
 * 
 * Route: /projects/[id]/health
 */

'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { ProjectHealthDashboard } from '@/components/project-health/ProjectHealthDashboard';
import { LoadingCard } from '@/components/loading';

function ProjectHealthPageContent() {
  const params = useParams();
  const projectId = params.id;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2 inline-block"
          >
            ← Back to Project
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
            Project Health Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Comprehensive health metrics, analysis, and recommendations
          </p>
        </div>

        {/* Health Dashboard Component */}
        <ProjectHealthDashboard projectId={projectId} />

        {/* Additional Actions */}
        <div className="mt-6 bg-white rounded-lg shadow p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href={`/projects/${projectId}/finances`}
              className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💰</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Financial Overview</h3>
                  <p className="text-sm text-gray-600">View detailed finances</p>
                </div>
              </div>
            </Link>

            <Link
              href={`/projects/${projectId}/costs`}
              className="p-4 border-2 border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📊</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Cost Management</h3>
                  <p className="text-sm text-gray-600">Review budget and costs</p>
                </div>
              </div>
            </Link>

            <Link
              href={`/projects/${projectId}`}
              className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🏗️</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Project Overview</h3>
                  <p className="text-sm text-gray-600">Return to project details</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function ProjectHealthPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="space-y-6">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-96"></div>
              </div>
              <LoadingCard count={2} showHeader={true} lines={4} />
            </div>
          </div>
        </AppLayout>
      }
    >
      <ProjectHealthPageContent />
    </Suspense>
  );
}
