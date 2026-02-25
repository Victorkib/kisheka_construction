/**
 * useLabourPrerequisites Hook
 * Checks prerequisites for labour-related pages
 * 
 * @param {string} pageType - 'dashboard' | 'entries' | 'entry-new' | 'bulk-new' | 'workers' | 'site-reports'
 * @param {string|null} projectId - Optional project ID for filtering
 * @returns {Object} Prerequisite status and metadata
 */

import { useState, useEffect } from 'react';

export function useLabourPrerequisites(pageType, projectId = null) {
  const [prerequisites, setPrerequisites] = useState({
    hasProjects: false,
    hasPhases: false,
    hasWorkers: false,
    hasWorkItems: false,
    hasIndirectCategories: false,
    hasLabourBudgets: false,
  });
  const [prerequisiteDetails, setPrerequisiteDetails] = useState({});
  const [counts, setCounts] = useState({
    projectsCount: 0,
    phasesCount: 0,
    workersCount: 0,
    workItemsCount: 0,
    indirectCategoriesCount: 0,
    phasesWithBudgetCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canProceed, setCanProceed] = useState(false);
  const [requiredItems, setRequiredItems] = useState([]);
  const [recommendedItems, setRecommendedItems] = useState([]);

  useEffect(() => {
    const checkPrerequisites = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const queryParams = new URLSearchParams({ pageType });
        if (projectId) {
          queryParams.append('projectId', projectId);
        }

        const response = await fetch(`/api/labour/prerequisites?${queryParams}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });

        const data = await response.json();

        if (data.success) {
          const prereqData = data.data;
          
          setPrerequisites({
            hasProjects: prereqData.hasProjects,
            hasPhases: prereqData.hasPhases,
            hasWorkers: prereqData.hasWorkers,
            hasWorkItems: prereqData.hasWorkItems,
            hasIndirectCategories: prereqData.hasIndirectCategories,
            hasLabourBudgets: prereqData.hasLabourBudgets,
          });
          
          setCounts({
            projectsCount: prereqData.projectsCount,
            phasesCount: prereqData.phasesCount,
            workersCount: prereqData.workersCount,
            workItemsCount: prereqData.workItemsCount,
            indirectCategoriesCount: prereqData.indirectCategoriesCount,
            phasesWithBudgetCount: prereqData.phasesWithBudgetCount,
          });
          
          setCanProceed(prereqData.canProceed);
          setRequiredItems(prereqData.requiredItems || []);
          setRecommendedItems(prereqData.recommendedItems || []);
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

  // Get missing items based on required vs recommended
  const missingRequiredItems = requiredItems
    .filter((key) => {
      const map = {
        projects: 'hasProjects',
        phases: 'hasPhases',
        workers: 'hasWorkers',
        workItems: 'hasWorkItems',
        indirectCategories: 'hasIndirectCategories',
        labourBudgets: 'hasLabourBudgets',
      };
      return !prerequisites[map[key]];
    })
    .map((key) => {
      const nameMap = {
        projects: 'Projects',
        phases: 'Phases',
        workers: 'Workers',
        workItems: 'Work Items',
        indirectCategories: 'Indirect Cost Categories',
        labourBudgets: 'Labour Budgets',
      };
      return nameMap[key] || key;
    });

  const missingRecommendedItems = recommendedItems
    .filter((key) => {
      const map = {
        projects: 'hasProjects',
        phases: 'hasPhases',
        workers: 'hasWorkers',
        workItems: 'hasWorkItems',
        indirectCategories: 'hasIndirectCategories',
        labourBudgets: 'hasLabourBudgets',
      };
      return !prerequisites[map[key]];
    })
    .map((key) => {
      const nameMap = {
        projects: 'Projects',
        phases: 'Phases',
        workers: 'Workers',
        workItems: 'Work Items',
        indirectCategories: 'Indirect Cost Categories',
        labourBudgets: 'Labour Budgets',
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
    requiredItems,
    recommendedItems,
    missingRequiredItems,
    missingRecommendedItems,
  };
}
