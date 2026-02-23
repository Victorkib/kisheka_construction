/**
 * useProfessionalPrerequisites Hook
 * Checks prerequisites for professional services pages
 * 
 * @param {string} pageType - 'assignments' | 'activities' | 'fees'
 * @param {string|null} projectId - Optional project ID for filtering
 * @returns {Object} Prerequisite status and metadata
 */

import { useState, useEffect } from 'react';

export function useProfessionalPrerequisites(pageType, projectId = null) {
  const [prerequisites, setPrerequisites] = useState({
    hasLibrary: false,
    hasAssignments: false,
    hasProjects: false,
  });
  const [prerequisiteDetails, setPrerequisiteDetails] = useState({});
  const [counts, setCounts] = useState({
    libraryCount: 0,
    assignmentsCount: 0,
    projectsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkPrerequisites = async () => {
      setLoading(true);
      setError(null);
      
      try {
        let endpoint = '';
        if (pageType === 'assignments') {
          endpoint = '/api/professional-services/prerequisites';
        } else if (pageType === 'activities') {
          endpoint = `/api/professional-activities/prerequisites${projectId ? `?projectId=${projectId}` : ''}`;
        } else if (pageType === 'fees') {
          endpoint = `/api/professional-fees/prerequisites${projectId ? `?projectId=${projectId}` : ''}`;
        } else {
          setError('Invalid page type');
          setLoading(false);
          return;
        }

        const response = await fetch(endpoint, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });

        const data = await response.json();

        if (data.success) {
          const prereqData = data.data;
          
          // Set prerequisites based on page type
          if (pageType === 'assignments') {
            setPrerequisites({
              hasLibrary: prereqData.hasLibrary,
              hasAssignments: false, // Not needed for assignments
              hasProjects: prereqData.hasProjects,
            });
            setCounts({
              libraryCount: prereqData.libraryCount,
              assignmentsCount: 0,
              projectsCount: prereqData.projectsCount,
            });
          } else {
            setPrerequisites({
              hasLibrary: false, // Not needed for activities/fees
              hasAssignments: prereqData.hasAssignments,
              hasProjects: prereqData.hasProjects,
            });
            setCounts({
              libraryCount: 0,
              assignmentsCount: prereqData.assignmentsCount,
              projectsCount: prereqData.projectsCount,
            });
          }
          
          setPrerequisiteDetails(prereqData.prerequisites || {});
        } else {
          setError(data.error || 'Failed to check prerequisites');
        }
      } catch (err) {
        console.error('Error checking prerequisites:', err);
        setError(err.message || 'Failed to check prerequisites');
      } finally {
        setLoading(false);
      }
    };

    checkPrerequisites();
  }, [pageType, projectId]);

  // Calculate if user can proceed based on page type
  let canProceed = false;
  if (pageType === 'assignments') {
    // For assignments, need library and projects
    canProceed = prerequisites.hasLibrary && prerequisites.hasProjects;
  } else {
    // For activities and fees, need assignments and projects
    canProceed = prerequisites.hasAssignments && prerequisites.hasProjects;
  }
  
  // Get missing items (only check relevant prerequisites for page type)
  const relevantPrerequisites = pageType === 'assignments'
    ? { hasLibrary: prerequisites.hasLibrary, hasProjects: prerequisites.hasProjects }
    : { hasAssignments: prerequisites.hasAssignments, hasProjects: prerequisites.hasProjects };
  
  const missingItems = Object.entries(relevantPrerequisites)
    .filter(([_, value]) => !value)
    .map(([key]) => {
      // Map internal keys to user-friendly names
      const nameMap = {
        hasLibrary: 'Library entries',
        hasAssignments: 'Active assignments',
        hasProjects: 'Projects',
      };
      return nameMap[key] || key;
    });

  return {
    prerequisites,
    prerequisiteDetails,
    counts,
    loading,
    error,
    canProceed,
    missingItems,
  };
}
