/**
 * Assign Professional to Project Page
 * Form for assigning a professional from library to a project
 * 
 * Route: /professional-services/new
 * Auth: OWNER/PM only
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ProfessionalServicesAssignmentForm } from '@/components/professional-services/professional-services-assignment-form';
import { PrerequisiteBlock } from '@/components/help/PrerequisiteBlock';
import { useProfessionalPrerequisites } from '@/hooks/use-professional-prerequisites';
import { useProjectContext } from '@/contexts/ProjectContext';

function NewProfessionalServicePageContent() {
  const router = useRouter();
  // Use useSearchParams to ensure Suspense boundary is recognized
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const { currentProjectId } = useProjectContext();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const presetLibraryId = searchParams.get('libraryId') || '';

  // Check prerequisites
  const {
    canProceed,
    prerequisiteDetails,
    loading: prereqLoading,
    error: prereqError,
  } = useProfessionalPrerequisites('assignments', currentProjectId);

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
      const professionalsData = await response.json();
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
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
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
          <div className="ds-bg-warning/10 border ds-border-warning/40 ds-text-warning px-4 py-3 rounded mb-6 text-sm sm:text-base">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to assign professionals to projects. Only OWNER and PM can assign professionals.</p>
          </div>
          <Link href="/professional-services" className="ds-text-accent-primary hover:ds-text-accent-hover underline text-sm sm:text-base transition-colors touch-manipulation">
            ← Back to Assignments
          </Link>
        </div>
      </AppLayout>
    );
  }

  // Show blocking UI if prerequisites not met
  if (!prereqLoading && !canProceed) {
    return (
      <AppLayout>
        <PrerequisiteBlock
          title="Cannot Create Assignment"
          description="You need to set up the required prerequisites before creating a professional service assignment."
          missingItems={Object.entries(prerequisiteDetails)
            .filter(([_, item]) => !item.completed)
            .map(([_, item]) => item.message)}
          prerequisites={prerequisiteDetails}
          actions={[
            { href: '/professional-services-library/new', label: 'Add to Library', icon: '📚' },
            { href: '/projects/new', label: 'Create Project', icon: '🏗️' },
            { href: '/professional-services', label: 'View Assignments', icon: '←' },
          ]}
          onRetry={() => window.location.reload()}
        />
      </AppLayout>
    );
  }

  if (loadingData || prereqLoading) {
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
        <div className="mb-6 sm:mb-8">
          <Link href="/professional-services" className="ds-text-accent-primary hover:ds-text-accent-hover text-sm sm:text-base mb-4 inline-block transition-colors touch-manipulation">
            ← Back to Assignments
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">
            Assign Professional to Project
          </h1>
          <p className="text-sm sm:text-base ds-text-secondary mt-2">Assign a professional from the library to a project with contract details</p>
        </div>

        {/* Form */}
        <div className="ds-bg-surface rounded-lg shadow border ds-border-subtle p-4 sm:p-6">
          <ProfessionalServicesAssignmentForm
            professionals={professionals}
            projects={projects}
            phases={phases}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
            error={error}
            isEdit={false}
            presetLibraryId={presetLibraryId}
          />
        </div>
      </div>
    </AppLayout>
  );
}

export default function NewProfessionalServicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center ds-bg-app">
        <div className="text-center">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      </div>
    }>
      <NewProfessionalServicePageContent />
    </Suspense>
  );
}
