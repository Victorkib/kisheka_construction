/**
 * No Projects Empty State Component
 * Reusable component for displaying empty state when no projects exist
 */

'use client';

import Link from 'next/link';

/**
 * NoProjectsEmptyState Component
 * @param {Object} props
 * @param {boolean} props.canCreate - Whether user can create projects
 * @param {string} props.userName - Optional user name to display
 * @param {string} props.role - Optional role-specific messaging
 */
export function NoProjectsEmptyState({ canCreate = false, userName, role }) {
  const getRoleSpecificMessage = () => {
    switch (role?.toLowerCase()) {
      case 'owner':
      case 'pm':
      case 'project_manager':
        return "Get started by creating your first project. You'll be able to track budgets, phases, materials, and expenses all in one place.";
      case 'accountant':
        return "There are currently no projects in the system. Financial data will be available once projects are created.";
      case 'site_clerk':
      case 'clerk':
        return "There are currently no projects in the system. Please contact a Project Manager or Owner to create a project before you can add materials or expenses.";
      case 'supervisor':
        return "There are currently no projects in the system. Please contact a Project Manager or Owner to create a project.";
      default:
        return "There are currently no projects in the system. Get started by creating your first project.";
    }
  };

  const getFeatureHighlights = () => {
    switch (role?.toLowerCase()) {
      case 'owner':
      case 'pm':
      case 'project_manager':
        return [
          { icon: '📊', title: 'Budget Tracking', description: 'Track project budgets with phase-based allocation and variance analysis' },
          { icon: '🏗️', title: 'Phase Management', description: 'Organize construction into phases with individual budget tracking' },
          { icon: '💰', title: 'Financial Overview', description: 'Monitor spending, forecasts, and risk indicators in real-time' },
        ];
      case 'accountant':
        return [
          { icon: '💰', title: 'Financial Management', description: 'Track all financial transactions and capital allocation' },
          { icon: '📊', title: 'Budget Analysis', description: 'Compare budgets to actual spending with detailed reports' },
          { icon: '✅', title: 'Approval Processing', description: 'Review and approve financial transactions' },
        ];
      case 'site_clerk':
      case 'clerk':
        return [
          { icon: '📦', title: 'Material Entry', description: 'Quickly add materials with receipt verification' },
          { icon: '💸', title: 'Expense Tracking', description: 'Record expenses with invoice uploads' },
          { icon: '📋', title: 'Data Management', description: 'View and manage all your entries' },
        ];
      case 'supervisor':
        return [
          { icon: '👁️', title: 'View & Verify', description: 'View materials, expenses, and projects for verification' },
          { icon: '📊', title: 'Project Oversight', description: 'Monitor project progress and status' },
          { icon: '✅', title: 'Verification', description: 'Verify work completion and quality' },
        ];
      default:
        return [
          { icon: '📊', title: 'Budget Tracking', description: 'Track project budgets with phase-based allocation' },
          { icon: '🏗️', title: 'Phase Management', description: 'Organize construction into phases' },
          { icon: '💰', title: 'Financial Overview', description: 'Monitor spending and forecasts' },
        ];
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-8 mb-8 text-center">
      <div className="max-w-2xl mx-auto">
        <div className="text-6xl mb-4">🏗️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {userName ? `Welcome, ${userName}!` : 'Welcome to Doshaki Construction System!'}
        </h2>
        <p className="text-lg text-gray-700 mb-6">
          {getRoleSpecificMessage()}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {canCreate && (
            <Link
              href="/projects/new"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              Create Your First Project
            </Link>
          )}
          <Link
            href="/projects"
            className="inline-block bg-white hover:bg-gray-50 text-gray-700 font-semibold px-8 py-3 rounded-lg border-2 border-gray-300 transition-colors"
          >
            View All Projects
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {getFeatureHighlights().map((feature, index) => (
            <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">{feature.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default NoProjectsEmptyState;


