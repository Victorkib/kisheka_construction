/**
 * Project Switcher Component
 * 
 * Provides a dropdown interface for switching between projects
 * Features: Search, Favorites, Recent Projects, Keyboard Shortcut
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectContext } from '@/contexts/ProjectContext';
import { projectIdsMatch, normalizeProjectId } from '@/lib/utils/project-id-helpers';
import Link from 'next/link';

export function ProjectSwitcher() {
  const {
    currentProject,
    accessibleProjects,
    switchProject,
    refreshAccessibleProjects,
    loading,
    isEmpty,
  } = useProjectContext();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteProjects, setFavoriteProjects] = useState([]);
  const [recentProjects, setRecentProjects] = useState([]);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const router = useRouter();

  // Load favorites and recent projects
  useEffect(() => {
    loadPreferences();
  }, []);

  // Load preferences
  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/user/project-preferences');
      const data = await response.json();
      if (data.success && data.data) {
        setFavoriteProjects(data.data.favoriteProjects || []);
        setRecentProjects(data.data.recentProjects || []);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoadingPreferences(false);
    }
  };

  // Toggle favorite
  const toggleFavorite = async (projectId, e) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      const normalizedProjectId = normalizeProjectId(projectId);
      const isFavorite = favoriteProjects.some(
        (id) => projectIdsMatch(id, normalizedProjectId)
      );

      const newFavorites = isFavorite
        ? favoriteProjects.filter((id) => !projectIdsMatch(id, normalizedProjectId))
        : [...favoriteProjects, normalizedProjectId];

      setFavoriteProjects(newFavorites);

      await fetch('/api/user/project-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favoriteProjects: newFavorites.map((id) => normalizeProjectId(id)).filter(Boolean),
        }),
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // Revert on error
      loadPreferences();
    }
  };

  // Handle project switch
  const handleSwitchProject = async (projectId) => {
    try {
      const normalizedId = normalizeProjectId(projectId);
      if (!normalizedId) {
        console.error('Invalid project ID');
        return;
      }
      
      await switchProject(normalizedId, true);
      setIsOpen(false);
      setSearchQuery('');
      
      // Refresh accessible projects after switch
      if (refreshAccessibleProjects) {
        refreshAccessibleProjects();
      }
      
      // Navigate to project page if not already there
      const currentPath = window.location.pathname;
      if (!currentPath.includes(`/projects/${normalizedId}`)) {
        router.push(`/projects/${normalizedId}`);
      }
    } catch (error) {
      console.error('Error switching project:', error);
    }
  };

  // Filter projects by search query
  const filteredProjects = accessibleProjects.filter((project) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.projectName?.toLowerCase().includes(query) ||
      project.projectCode?.toLowerCase().includes(query) ||
      project.location?.toLowerCase().includes(query)
    );
  });

  // Get favorite projects
  const favoriteProjectsList = accessibleProjects.filter((project) =>
    favoriteProjects.some((id) => projectIdsMatch(id, project._id))
  );

  // Get recent projects (excluding current and favorites)
  const recentProjectsList = accessibleProjects.filter(
    (project) => {
      const projectId = normalizeProjectId(project._id);
      const currentProjectId = normalizeProjectId(currentProject?._id);
      return (
        recentProjects.some((id) => projectIdsMatch(id, project._id)) &&
        !projectIdsMatch(projectId, currentProjectId) &&
        !favoriteProjects.some((id) => projectIdsMatch(id, project._id))
      );
    }
  );

  // Get other projects (not favorite, not recent, not current)
  const otherProjects = filteredProjects.filter(
    (project) => {
      const projectId = normalizeProjectId(project._id);
      const currentProjectId = normalizeProjectId(currentProject?._id);
      return (
        !projectIdsMatch(projectId, currentProjectId) &&
        !favoriteProjects.some((id) => projectIdsMatch(id, project._id)) &&
        !recentProjects.some((id) => projectIdsMatch(id, project._id))
      );
    }
  );

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + K to open switcher
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      planning: 'bg-blue-100 text-blue-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-purple-100 text-purple-800',
      archived: 'ds-bg-surface-muted ds-text-secondary',
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
  };

  // Empty state - only show if truly empty and not loading
  if (isEmpty && !loading && !loadingPreferences) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium ds-text-secondary ds-bg-surface border ds-border-subtle rounded-lg hover:ds-bg-surface-muted transition"
        >
          <span>🏗️</span>
          <span>No Projects</span>
        </button>

        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 mt-2 w-80 ds-bg-surface rounded-lg shadow-lg border ds-border-subtle z-50"
          >
            <div className="p-6 text-center">
              <div className="text-4xl mb-4">🏗️</div>
              <h3 className="text-lg font-semibold ds-text-primary mb-2">
                No Projects Available
              </h3>
              <p className="text-sm ds-text-secondary mb-4">
                Get started by creating your first project
              </p>
              <Link
                href="/projects/new"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition"
                onClick={() => setIsOpen(false)}
              >
                Create Project
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading || loadingPreferences) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium ds-text-muted ds-bg-surface border ds-border-subtle rounded-lg">
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium ds-text-secondary ds-bg-surface border ds-border-subtle rounded-lg hover:ds-bg-surface-muted transition min-w-[200px] justify-between"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span>🏗️</span>
          <span className="truncate">
            {currentProject?.projectName || (isEmpty ? 'No Projects' : 'Select Project')}
          </span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 ds-bg-surface rounded-lg shadow-lg border ds-border-subtle z-[9999] max-h-[600px] flex flex-col">
          {/* Search */}
          <div className="p-3 border-b ds-border-subtle">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 pl-9 text-sm border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ds-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {/* Favorites */}
            {favoriteProjectsList.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-xs font-semibold ds-text-muted uppercase">
                  ⭐ Favorites
                </div>
                {favoriteProjectsList
                  .filter((p) =>
                    !searchQuery ||
                    p.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.projectCode?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((project) => (
                    <ProjectItem
                      key={normalizeProjectId(project._id)}
                      project={project}
                      isCurrent={projectIdsMatch(currentProject?._id, project._id)}
                      isFavorite={true}
                      onSelect={() => handleSwitchProject(project._id)}
                      onToggleFavorite={(e) => toggleFavorite(project._id, e)}
                      formatCurrency={formatCurrency}
                      getStatusColor={getStatusColor}
                    />
                  ))}
              </div>
            )}

            {/* Recent Projects */}
            {recentProjectsList.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-xs font-semibold ds-text-muted uppercase">
                  📋 Recent
                </div>
                {recentProjectsList
                  .filter((p) =>
                    !searchQuery ||
                    p.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.projectCode?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((project) => (
                    <ProjectItem
                      key={normalizeProjectId(project._id)}
                      project={project}
                      isCurrent={projectIdsMatch(currentProject?._id, project._id)}
                      isFavorite={false}
                      onSelect={() => handleSwitchProject(project._id)}
                      onToggleFavorite={(e) => toggleFavorite(project._id, e)}
                      formatCurrency={formatCurrency}
                      getStatusColor={getStatusColor}
                    />
                  ))}
              </div>
            )}

            {/* All Projects */}
            {otherProjects.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-xs font-semibold ds-text-muted uppercase">
                  📁 All Projects
                </div>
                {otherProjects.map((project) => (
                  <ProjectItem
                    key={normalizeProjectId(project._id)}
                    project={project}
                    isCurrent={projectIdsMatch(currentProject?._id, project._id)}
                    isFavorite={favoriteProjects.some(
                      (id) => projectIdsMatch(id, project._id)
                    )}
                    onSelect={() => handleSwitchProject(project._id)}
                    onToggleFavorite={(e) => toggleFavorite(project._id, e)}
                    formatCurrency={formatCurrency}
                    getStatusColor={getStatusColor}
                  />
                ))}
              </div>
            )}

            {/* No Results */}
            {searchQuery && filteredProjects.length === 0 && (
              <div className="p-6 text-center ds-text-muted">
                <p>No projects found matching &quot;{searchQuery}&quot;</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t ds-border-subtle ds-bg-surface-muted">
            <div className="text-xs ds-text-muted text-center">
              Press <kbd className="px-1.5 py-0.5 ds-bg-surface border ds-border-subtle rounded">Cmd/Ctrl + K</kbd> to open
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Project Item Component
function ProjectItem({
  project,
  isCurrent,
  isFavorite,
  onSelect,
  onToggleFavorite,
  formatCurrency,
  getStatusColor,
}) {
  return (
    <div
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 rounded-lg transition cursor-pointer ${
        isCurrent
          ? 'bg-blue-50 border border-blue-400/60'
          : 'hover:ds-bg-surface-muted border border-transparent'
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏗️</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium ds-text-primary truncate">
                {project.projectName}
                {isCurrent && (
                  <span className="ml-2 text-xs text-blue-600">← Current</span>
                )}
              </div>
              {project.projectCode && (
                <div className="text-xs ds-text-muted mt-0.5">
                  {project.projectCode}
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                project.status
              )}`}
            >
              {project.status || 'planning'}
            </span>
            {project.budget?.total > 0 && (
              <span className="text-xs ds-text-secondary">
                {formatCurrency(project.budget.total)}
              </span>
            )}
          </div>
        </div>
        <div
          onClick={onToggleFavorite}
          className="flex-shrink-0 p-1 hover:ds-bg-surface-muted rounded transition cursor-pointer"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggleFavorite(e);
            }
          }}
        >
          <svg
            className={`w-4 h-4 ${
              isFavorite ? 'text-yellow-500 fill-current' : 'ds-text-muted'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

