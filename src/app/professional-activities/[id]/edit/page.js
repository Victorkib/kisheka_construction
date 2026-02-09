/**
 * Edit Professional Activity Page
 * Form for editing a professional activity
 * 
 * Route: /professional-activities/[id]/edit
 * Auth: OWNER/PM/CLERK
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { QuickActivityForm } from '@/components/professional-activities/quick-activity-form';

function EditProfessionalActivityPageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activity, setActivity] = useState(null);
  const [professionalServices, setProfessionalServices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);

  useEffect(() => {
    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch activity
      const response = await fetch(`/api/professional-activities/${params.id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const activityData = await activityResponse.json();
      if (!activityData.success) {
        throw new Error(activityData.error || 'Failed to fetch activity');
      }
      setActivity(activityData.data);

      // Fetch professional services
      const servicesResponse = await fetch('/api/professional-services?status=active', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const servicesData = await servicesResponse.json();
      if (servicesData.success) {
        setProfessionalServices(servicesData.data.assignments || []);
      }

      // Fetch projects
      const projectsResponse = await fetch('/api/projects', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const projectsData = await projectsResponse.json();
      if (projectsData.success) {
        setProjects(projectsData.data || []);
      }

      // Fetch phases
      const phasesResponse = await fetch('/api/phases', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const phasesData = await phasesResponse.json();
      if (phasesData.success) {
        setPhases(phasesData.data || []);
      }

      // Fetch floors
      const floorsResponse = await fetch('/api/floors', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const floorsData = await floorsResponse.json();
      if (floorsData.success) {
        setFloors(floorsData.data || []);
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/professional-activities/${params.id}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update activity');
      }

      toast.showSuccess('Activity updated successfully');
      router.push('/professional-activities');
    } catch (err) {
      setError(err.message);
      console.error('Update professional activity error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/professional-activities');
  };

  if (!canAccess('edit_professional_activity')) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to edit professional activities. Only OWNER, PM, and CLERK can edit activities.</p>
          </div>
          <Link href="/professional-activities" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Professional Activities
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

  if (error && !activity) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
          <Link href="/professional-activities" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Professional Activities
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
          <Link href="/professional-activities" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Professional Activities
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
            Edit Professional Activity
          </h1>
          <p className="text-gray-600 mt-2">Update professional activity details</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <QuickActivityForm
            initialData={activity}
            professionalServices={professionalServices}
            projects={projects}
            phases={phases}
            floors={floors}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={submitting}
            error={error}
            isEdit={true}
          />
        </div>
      </div>
    </AppLayout>
  );
}

export default function EditProfessionalActivityPage() {
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
      <EditProfessionalActivityPageContent />
    </Suspense>
  );
}





