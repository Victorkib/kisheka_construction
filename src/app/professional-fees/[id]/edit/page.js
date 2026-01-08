/**
 * Edit Professional Fee Page
 * Form for editing a professional fee
 * 
 * Route: /professional-fees/[id]/edit
 * Auth: OWNER/PM/ACCOUNTANT
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ProfessionalFeesForm } from '@/components/professional-fees/professional-fees-form';

function EditProfessionalFeePageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fee, setFee] = useState(null);
  const [professionalServices, setProfessionalServices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch fee
      const feeResponse = await fetch(`/api/professional-fees/${params.id}`);
      const feeData = await feeResponse.json();
      if (!feeData.success) {
        throw new Error(feeData.error || 'Failed to fetch fee');
      }
      setFee(feeData.data);

      // Fetch professional services
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

      // Fetch activities
      const activitiesResponse = await fetch('/api/professional-activities?status=approved');
      const activitiesData = await activitiesResponse.json();
      if (activitiesData.success) {
        setActivities(activitiesData.data.activities || []);
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
      const response = await fetch(`/api/professional-fees/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update fee');
      }

      toast.showSuccess('Professional fee updated successfully');
      router.push('/professional-fees');
    } catch (err) {
      setError(err.message);
      console.error('Update professional fee error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/professional-fees');
  };

  if (!canAccess('edit_professional_fee')) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to edit professional fees. Only OWNER, PM, and ACCOUNTANT can edit fees.</p>
          </div>
          <Link href="/professional-fees" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Professional Fees
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

  if (error && !fee) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
          <Link href="/professional-fees" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Professional Fees
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
          <Link href="/professional-fees" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Professional Fees
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
            Edit Professional Fee
          </h1>
          <p className="text-gray-600 mt-2">Update professional fee details</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <ProfessionalFeesForm
            initialData={fee}
            professionalServices={professionalServices}
            projects={projects}
            phases={phases}
            activities={activities}
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

export default function EditProfessionalFeePage() {
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
      <EditProfessionalFeePageContent />
    </Suspense>
  );
}





