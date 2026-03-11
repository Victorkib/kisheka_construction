/**
 * Create New Professional Activity Page
 * Quick entry form for logging professional activities
 * 
 * Route: /professional-activities/new
 * Auth: OWNER/PM/CLERK
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { QuickActivityForm } from '@/components/professional-activities/quick-activity-form';
import { PrerequisiteBlock } from '@/components/help/PrerequisiteBlock';
import { useProfessionalPrerequisites } from '@/hooks/use-professional-prerequisites';
import { useProjectContext } from '@/contexts/ProjectContext';

export default function NewProfessionalActivityPage() {
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const { currentProjectId } = useProjectContext();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [professionalServices, setProfessionalServices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Check prerequisites
  const {
    canProceed,
    prerequisiteDetails,
    loading: prereqLoading,
  } = useProfessionalPrerequisites('activities', currentProjectId);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      
      // Fetch professional services (active assignments)
      const response = await fetch('/api/professional-services?status=active', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const servicesData = await response.json();
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
      const response = await fetch('/api/professional-activities', {
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
        throw new Error(data.error || 'Failed to create activity');
      }

      toast.showSuccess('Activity logged successfully');
      router.push('/professional-activities');
    } catch (err) {
      setError(err.message);
      console.error('Create professional activity error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/professional-activities');
  };

  if (!canAccess('create_professional_activity')) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-400/60 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to create professional activities. Only OWNER, PM, and CLERK can log activities.</p>
          </div>
          <Link href="/professional-activities" className="ds-text-accent-primary hover:ds-text-accent-hover underline">
            ← Back to Professional Activities
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
          title="Cannot Create Activity"
          description="You need active professional assignments before logging activities."
          missingItems={Object.entries(prerequisiteDetails)
            .filter(([_, item]) => !item.completed)
            .map(([_, item]) => item.message)}
          prerequisites={prerequisiteDetails}
          actions={[
            { href: '/professional-services/new', label: 'Create Assignment', icon: '➕' },
            { href: '/professional-services', label: 'View Assignments', icon: '📋' },
            { href: '/professional-activities', label: 'Back to Activities', icon: '←' },
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
        <div className="mb-8">
          <Link href="/professional-activities" className="ds-text-accent-primary hover:ds-text-accent-hover text-sm mb-4 inline-block">
            ← Back to Professional Activities
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold ds-text-primary leading-tight">
            Log Professional Activity
          </h1>
          <p className="ds-text-secondary mt-2">Quick entry form for logging architect and engineer activities</p>
        </div>

        {/* Form */}
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <QuickActivityForm
            professionalServices={professionalServices}
            projects={projects}
            phases={phases}
            floors={floors}
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





