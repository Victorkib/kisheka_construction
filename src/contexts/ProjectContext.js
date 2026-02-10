/**
 * Project Context Provider
 * 
 * Provides global project context throughout the application
 * Handles project switching, persistence, and empty state scenarios
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { projectIdsMatch } from '@/lib/utils/project-id-helpers';

const ProjectContext = createContext(null);

export function ProjectContextProvider({ children }) {
  const [currentProject, setCurrentProject] = useState(null);
  const [accessibleProjects, setAccessibleProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dashboardRefreshAttempted = useRef(false);

  // Load project context on mount
  useEffect(() => {
    loadProjectContext();
  }, []);

  // CRITICAL FIX: Refresh project context when navigating to dashboard routes
  // This ensures data is fresh when user navigates to dashboard
  // Note: This effect runs after refreshAccessibleProjects is defined (later in component)
  useEffect(() => {
    // Check if we're on a dashboard route
    const isDashboardRoute = pathname?.startsWith('/dashboard');
    
    // Reset refresh attempt flag when pathname changes away from dashboard
    if (!isDashboardRoute) {
      dashboardRefreshAttempted.current = false;
      return;
    }
    
    // If on dashboard and context is empty (but not loading), refresh
    // This handles cases where user navigates to dashboard but context hasn't loaded yet
    if (isDashboardRoute && !loading && accessibleProjects.length === 0 && !currentProject && !dashboardRefreshAttempted.current) {
      // Only refresh if we're not on a "new" route
      if (pathname !== '/projects/new' && !pathname?.includes('/new')) {
        console.log('Dashboard route detected with empty context, refreshing...');
        dashboardRefreshAttempted.current = true;
        
        // Use a small delay to ensure refreshAccessibleProjects is available
        // (it's defined later in the component, but will be available by the time this runs)
        setTimeout(() => {
          loadProjectContext().catch((err) => {
            console.error('Error refreshing projects on dashboard navigation:', err);
            dashboardRefreshAttempted.current = false; // Allow retry on error
          });
        }, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, loading, accessibleProjects.length, currentProject]);

  // Sync with URL when on project routes or when projectId is in URL params
  // Only sync when we have projects to avoid loops
  // CRITICAL: Never sync on project creation routes (/projects/new) or other "new" routes
  useEffect(() => {
    // CRITICAL FIX: ALWAYS check for "new" routes FIRST - before any other logic
    // These routes should be accessible even with 0 projects and should NEVER trigger redirects
    if (pathname === '/projects/new' || pathname?.includes('/new')) {
      return; // Don't interfere with project creation or other "new" routes - NEVER redirect from these
    }
    
    // Don't sync if loading or no projects (but only AFTER checking for "new" routes)
    if (loading || accessibleProjects.length === 0) {
      return;
    }
    
    // Sync if we're on a project detail route (/projects/[id])
    const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
    if (projectMatch) {
      syncWithURL();
      return;
    }
    
    // Also sync if we're on /projects page and there's a projectId in URL params
    // This handles cases where user navigates to /projects?projectId=xxx
    if (pathname === '/projects' && searchParams) {
      const projectIdFromUrl = searchParams.get('projectId');
      if (projectIdFromUrl) {
        const projectExists = accessibleProjects.some(
          (p) => {
            const pId = p._id?.toString() || p._id;
            return projectIdsMatch(pId, projectIdFromUrl);
          }
        );
        
        if (projectExists) {
          const currentProjectId = currentProject?._id?.toString() || currentProject?._id;
          if (!currentProjectId || !projectIdsMatch(currentProjectId, projectIdFromUrl)) {
            switchProject(projectIdFromUrl, true);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, loading, currentProject, accessibleProjects.length]);

  const loadProjectContext = async () => {
    try {
      setLoading(true);
      setError(null);

      // CRITICAL: Check if we're on a "new" route BEFORE loading projects
      // If on "new" route, we should allow it even with 0 projects
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
      const isOnNewRoute = currentPath === '/projects/new' || currentPath?.includes('/new');
      
      // Load accessible projects first - use returned value to avoid race condition
      const projects = await loadAccessibleProjects();

      // If no projects exist, show empty state and stop loading
      // BUT: If we're on a "new" route, this is OK - don't do anything that might redirect
      if (!projects || projects.length === 0) {
        setCurrentProject(null);
        setAccessibleProjects([]);
        setLoading(false);
        // If on "new" route, we're done - don't try to switch projects
        if (isOnNewRoute) {
          return;
        }
        return;
      }

      const trySwitchProject = async (projectId, updatePreferences) => {
        try {
          await switchProject(projectId, updatePreferences);
          return true;
        } catch (switchError) {
          console.warn('Failed to switch project:', switchError);
          return false;
        }
      };

      // Try to load last project from preferences
      try {
        const response = await fetch('/api/user/project-preferences');
        const data = await response.json();

        if (data.success && data.data?.lastProjectId) {
          // Verify project still exists and is accessible
          const projectExists = projects.some(
            (p) => {
              const projectId = p._id?.toString() || p._id;
              const lastProjectId = data.data.lastProjectId?.toString() || data.data.lastProjectId;
              return projectId === lastProjectId;
            }
          );
          if (projectExists) {
            const switched = await trySwitchProject(data.data.lastProjectId, false);
            if (!switched && projects.length > 0) {
              const fallbackProject = projects.find(
                (p) => !projectIdsMatch(p._id?.toString() || p._id, data.data.lastProjectId)
              ) || projects[0];
              await trySwitchProject(fallbackProject._id, true);
            }
          } else {
            // Last project no longer accessible, use first available
            if (projects.length > 0) {
              await trySwitchProject(projects[0]._id, true);
            }
          }
        } else if (projects.length > 0) {
          // No last project, use first available
          await trySwitchProject(projects[0]._id, true);
        }
      } catch (prefError) {
        console.error('Error loading preferences:', prefError);
        // If preferences fail, use first available project
        if (projects.length > 0) {
          await trySwitchProject(projects[0]._id, true);
        }
      }
    } catch (error) {
      console.error('Error loading project context:', error);
      setError(error.message || 'Failed to load project context');
    } finally {
      setLoading(false);
    }
  };

  const loadAccessibleProjects = async (retryCount = 0) => {
    const MAX_RETRIES = 2;
    
    try {
      // Primary source: dedicated accessible-projects API
      const response = await fetch('/api/projects/accessible', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      const data = await response.json();

      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setAccessibleProjects(data.data);
        return data.data;
      }

      // If we got an empty array but no error, it might be a timing issue
      // Retry once before falling back
      if (data.success && Array.isArray(data.data) && data.data.length === 0 && retryCount < MAX_RETRIES) {
        console.warn(
          `Accessible projects API returned empty array (retry ${retryCount + 1}/${MAX_RETRIES}). Retrying...`,
        );
        // Wait a bit before retry
        await new Promise((resolve) => setTimeout(resolve, 500));
        return loadAccessibleProjects(retryCount + 1);
      }

      console.warn(
        'Accessible projects API returned no projects or failed. Falling back to /api/projects.',
        data.error || null,
      );

      // Fallback: use /api/projects (used by Projects page), which is known
      // to work even in production. This ensures the selector and context
      // stay in sync with what the user actually sees.
      const fallbackResponse = await fetch('/api/projects', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      const fallbackData = await fallbackResponse.json();

      if (fallbackData.success && Array.isArray(fallbackData.data)) {
        // Only set if we got projects, otherwise might be truly empty
        if (fallbackData.data.length > 0) {
          setAccessibleProjects(fallbackData.data);
          return fallbackData.data;
        } else {
          // Both APIs returned empty - might be truly no projects
          console.warn('Both /api/projects/accessible and /api/projects returned empty arrays');
          setAccessibleProjects([]);
          return [];
        }
      }

      console.error(
        'Fallback /api/projects also failed to return projects:',
        fallbackData.error || null,
      );
      setAccessibleProjects([]);
      return [];
    } catch (error) {
      console.error('Error loading accessible projects:', error);
      
      // Retry on network errors
      if (retryCount < MAX_RETRIES) {
        console.warn(`Network error, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return loadAccessibleProjects(retryCount + 1);
      }
      
      setAccessibleProjects([]);
      return [];
    }
  };

  const switchProject = useCallback(async (projectId, updatePreferences = true) => {
    try {
      // Normalize projectId to string for comparison
      const projectIdStr = projectId?.toString();

      // Fetch project details
      const response = await fetch(`/api/projects/${projectIdStr}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Project not found');
      }

      const project = data.data;
      setCurrentProject(project);

      // Update preferences if requested
      if (updatePreferences) {
        try {
          await fetch('/api/user/project-preferences', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lastProjectId: projectIdStr }),
          });

          // Update recent projects
          await updateRecentProjects(projectIdStr);
        } catch (prefError) {
          console.error('Error updating preferences:', prefError);
          // Don't fail the switch if preferences fail
        }
      }

      // Update localStorage
      try {
        localStorage.setItem('currentProjectId', projectIdStr);
      } catch (storageError) {
        console.error('Error saving to localStorage:', storageError);
      }

      return project;
    } catch (error) {
      console.error('Error switching project:', error);
      setError(error.message || 'Failed to switch project');
      throw error;
    }
  }, []);

  const updateRecentProjects = async (projectId) => {
    try {
      await fetch('/api/user/project-preferences/recent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
    } catch (error) {
      console.error('Error updating recent projects:', error);
    }
  };

  const syncWithURL = useCallback(() => {
    // Early return if no projects or no current project
    if (accessibleProjects.length === 0 || !currentProject) {
      return;
    }
    
    // Extract project ID from URL if on project route
    const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      const currentProjectId = currentProject?._id?.toString() || currentProject?._id;
      
      // Only switch if project ID actually changed
      if (currentProjectId && currentProjectId !== projectId) {
        // Check if project is in accessible projects
        const projectExists = accessibleProjects.some(
          (p) => {
            const pId = p._id?.toString() || p._id;
            return pId === projectId;
          }
        );
        
        if (projectExists) {
          switchProject(projectId, true);
        }
      }
    }
  }, [pathname, currentProject, accessibleProjects, switchProject]);

  const refreshAccessibleProjects = useCallback(async () => {
    const projects = await loadAccessibleProjects();
    
    // If no projects exist, clear current project and return early
    if (projects.length === 0) {
      if (currentProject) {
        setCurrentProject(null);
      }
      return projects;
    }
    
    // If current project is no longer accessible, switch to first available
    if (currentProject) {
      const currentProjectId = currentProject._id?.toString() || currentProject._id;
      const stillAccessible = projects.some(
        (p) => {
          const pId = p._id?.toString() || p._id;
          return projectIdsMatch(pId, currentProjectId);
        }
      );
      
      if (!stillAccessible) {
        // Current project no longer accessible, switch to first available
        await switchProject(projects[0]._id, true);
      }
    } else {
      // No current project but projects available, switch to first
      await switchProject(projects[0]._id, true);
    }
    
    return projects;
  }, [currentProject, switchProject]);

  /**
   * Check if there is only one project available
   * @returns {boolean} True if only one project exists
   */
  const isOnlyProject = useCallback(() => {
    return accessibleProjects.length === 1;
  }, [accessibleProjects.length]);

  /**
   * Handle project creation - refresh projects and apply selection logic
   * @param {string} newProjectId - ID of the newly created project
   * @param {Object} options - Options for handling project creation
   * @param {boolean} options.autoSelectIfOnly - Auto-select if this is the only project (default: true)
   * @param {boolean} options.preserveCurrent - Preserve current selection if exists (default: true)
   * @returns {Promise<Object>} Result object with selection info
   */
  const handleProjectCreated = useCallback(async (newProjectId, options = {}) => {
    const {
      autoSelectIfOnly = true,
      preserveCurrent = true,
    } = options;

    try {
      // Refresh accessible projects to include the new one
      const projects = await refreshAccessibleProjects();
      
      if (!projects || projects.length === 0) {
        return {
          success: false,
          error: 'No projects found after refresh',
        };
      }

      const normalizedNewProjectId = newProjectId?.toString();
      const hasCurrentProject = !!currentProject;
      const currentProjectId = currentProject?._id?.toString() || currentProject?._id;
      const isOnly = projects.length === 1;

      let selectedProjectId = null;
      let selectionReason = '';

      // Decision logic:
      // 1. If only one project (the new one), auto-select it
      if (isOnly && autoSelectIfOnly) {
        selectedProjectId = normalizedNewProjectId;
        selectionReason = 'only_project';
        await switchProject(normalizedNewProjectId, true);
      }
      // 2. If there was a current project and we should preserve it
      else if (hasCurrentProject && preserveCurrent) {
        // Verify current project still exists
        const currentStillExists = projects.some(
          (p) => {
            const pId = p._id?.toString() || p._id;
            return projectIdsMatch(pId, currentProjectId);
          }
        );
        
        if (currentStillExists) {
          selectedProjectId = currentProjectId;
          selectionReason = 'preserved_current';
          // Current project is already selected, no need to switch
        } else {
          // Current project no longer exists, select new one
          selectedProjectId = normalizedNewProjectId;
          selectionReason = 'current_invalid';
          await switchProject(normalizedNewProjectId, true);
        }
      }
      // 3. No current project, select the new one
      else {
        selectedProjectId = normalizedNewProjectId;
        selectionReason = 'no_current';
        await switchProject(normalizedNewProjectId, true);
      }

      return {
        success: true,
        selectedProjectId,
        selectionReason,
        isOnlyProject: isOnly,
        hadCurrentProject: hasCurrentProject,
        totalProjects: projects.length,
      };
    } catch (error) {
      console.error('Error handling project creation:', error);
      return {
        success: false,
        error: error.message || 'Failed to handle project creation',
      };
    }
  }, [currentProject, refreshAccessibleProjects, switchProject]);

  const clearProject = useCallback(() => {
    setCurrentProject(null);
    try {
      localStorage.removeItem('currentProjectId');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }, []);

  const value = {
    currentProject,
    accessibleProjects,
    loading,
    error,
    switchProject,
    refreshAccessibleProjects,
    clearProject,
    handleProjectCreated,
    isOnlyProject,
    hasProjects: accessibleProjects.length > 0,
    isEmpty: accessibleProjects.length === 0 && !loading,
    currentProjectId: currentProject?._id?.toString() || currentProject?._id || null,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within ProjectContextProvider');
  }
  return context;
}

