/**
 * Assign Professional to Project Page
 * Form for assigning a professional from library to a project
 * 
 * Route: /professional-services/new
 * Auth: OWNER/PM only
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ProfessionalServicesAssignmentForm } from '@/components/professional-services/professional-services-assignment-form';

export default function NewProfessionalServicePage() {
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      
      // Fetch professionals
      const response = await fetch('/api/professional-services-library?isActive=true', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const professionalsData = await professionalsResponse.json();
      if (professionalsData.success) {
        setProfessionals(professionalsData.data.professionals || []);
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
      const response = await fetch('/api/professional-services', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to assign professional');
      }

      toast.showSuccess('Professional assigned to project successfully');
      router.push('/professional-services');
    } catch (err) {
      setError(err.message);
      console.error('Assign professional service error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/professional-services');
  };

  if (!canAccess('assign_professional_service')) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to assign professionals to projects. Only OWNER and PM can assign professionals.</p>
          </div>
          <Link href="/professional-services" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Assignments
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
          <Link href="/professional-services" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Assignments
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
            Assign Professional to Project
          </h1>
          <p className="text-gray-600 mt-2">Assign a professional from the library to a project with contract details</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <ProfessionalServicesAssignmentForm
            professionals={professionals}
            projects={projects}
            phases={phases}
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





