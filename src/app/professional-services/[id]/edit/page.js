/**
 * Edit Professional Service Assignment Page
 * Form for editing a professional service assignment
 * 
 * Route: /professional-services/[id]/edit
 * Auth: OWNER/PM only
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ProfessionalServicesAssignmentForm } from '@/components/professional-services/professional-services-assignment-form';

function EditProfessionalServicePageContent() {
  const router = useRouter();
  const params = useParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);

  useEffect(() => {
    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch assignment
      const assignmentResponse = await fetch(`/api/professional-services/${params.id}`);
      const assignmentData = await assignmentResponse.json();
      if (!assignmentData.success) {
        throw new Error(assignmentData.error || 'Failed to fetch assignment');
      }
      setAssignment(assignmentData.data);

      // Fetch professionals
      const professionalsResponse = await fetch('/api/professional-services-library?isActive=true');
      const professionalsData = await professionalsResponse.json();
      if (professionalsData.success) {
        setProfessionals(professionalsData.data.professionals || []);
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
      const response = await fetch(`/api/professional-services/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update assignment');
      }

      toast.showSuccess('Professional service assignment updated successfully');
      router.push('/professional-services');
    } catch (err) {
      setError(err.message);
      console.error('Update professional service assignment error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/professional-services');
  };

  if (!canAccess('edit_professional_service_assignment')) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to edit professional service assignments. Only OWNER and PM can edit assignments.</p>
          </div>
          <Link href="/professional-services" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Professional Services
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

  if (error && !assignment) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
          <Link href="/professional-services" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Professional Services
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
          <Link href="/professional-services" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Professional Services
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
            Edit Professional Service Assignment
          </h1>
          <p className="text-gray-600 mt-2">Update professional service assignment details</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <ProfessionalServicesAssignmentForm
            initialData={assignment}
            professionals={professionals}
            projects={projects}
            phases={phases}
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

export default function EditProfessionalServicePage() {
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
      <EditProfessionalServicePageContent />
    </Suspense>
  );
}





