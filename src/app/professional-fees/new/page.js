/**
 * Create New Professional Fee Page
 * Form for creating a new professional fee
 * 
 * Route: /professional-fees/new
 * Auth: OWNER/PM/ACCOUNTANT
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ProfessionalFeesForm } from '@/components/professional-fees/professional-fees-form';

export default function NewProfessionalFeePage() {
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [professionalServices, setProfessionalServices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      
      // Fetch professional services (active assignments)
      const servicesResponse = await fetch('/api/professional-services?status=active');
      const servicesData = await servicesResponse.json();
      if (servicesData.success) {
        setProfessionalServices(servicesData.data.assignments || []);
      }

      // Fetch projects
      const projectsResponse = await fetch('/api/projects');
      const projectsData = await projectsResponse.json();
      if (projectsData.success) {
        setProjects(projectsData.data || []);
      }

      // Fetch phases
      const phasesResponse = await fetch('/api/phases');
      const phasesData = await phasesResponse.json();
      if (phasesData.success) {
        setPhases(phasesData.data || []);
      }

      // Fetch activities (for linking)
      const activitiesResponse = await fetch('/api/professional-activities?status=approved');
      const activitiesData = await activitiesResponse.json();
      if (activitiesData.success) {
        setActivities(activitiesData.data.activities || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.showError('Failed to load data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/professional-fees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create fee');
      }

      toast.showSuccess('Professional fee created successfully');
      router.push('/professional-fees');
    } catch (err) {
      setError(err.message);
      console.error('Create professional fee error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/professional-fees');
  };

  if (!canAccess('create_professional_fee')) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to create professional fees. Only OWNER, PM, and ACCOUNTANT can create fees.</p>
          </div>
          <Link href="/professional-fees" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Fees
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (loadingData) {
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/professional-fees" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Fees
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
            Create Professional Fee
          </h1>
          <p className="text-gray-600 mt-2">Create a new professional fee entry</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <ProfessionalFeesForm
            professionalServices={professionalServices}
            projects={projects}
            phases={phases}
            activities={activities}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
            error={error}
            isEdit={false}
          />
        </div>
      </div>
    </AppLayout>
  );
}





