/**
 * Quick Actions Component
 * Fast access to common tasks
 */

'use client';

import Link from 'next/link';

export function QuickActions({ pendingApprovals = 0 }) {
  const actions = [
    {
      icon: '🏗️',
      title: 'Create Project',
      description: 'Start a new construction project',
      href: '/projects/new',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: '📋',
      title: 'All Projects',
      description: 'View and manage all projects',
      href: '/projects',
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      icon: '✅',
      title: 'Approvals',
      description: `${pendingApprovals} pending approval${pendingApprovals !== 1 ? 's' : ''}`,
      href: '/dashboard/approvals',
      color: 'from-yellow-500 to-yellow-600',
      badge: pendingApprovals > 0 ? pendingApprovals : null,
    },
    {
      icon: '💰',
      title: 'Financing',
      description: 'Manage capital and finances',
      href: '/financing',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: '👥',
      title: 'Users',
      description: 'Manage team members',
      href: '/dashboard/users',
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: '📊',
      title: 'Analytics',
      description: 'View reports and insights',
      href: '/dashboard/analytics/wastage',
      color: 'from-pink-500 to-pink-600',
    },
    {
      icon: '📦',
      title: 'Materials',
      description: 'Manage materials and inventory',
      href: '/items',
      color: 'from-orange-500 to-orange-600',
    },
    {
      icon: '👷',
      title: 'Labour',
      description: 'Track labour entries',
      href: '/labour/entries',
      color: 'from-teal-500 to-teal-600',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action, idx) => (
          <Link
            key={idx}
            href={action.href}
            className={`relative group bg-gradient-to-br ${action.color} p-6 rounded-lg text-white hover:shadow-xl transition-all transform hover:scale-105`}
          >
            <div className="flex flex-col items-center text-center">
              <span className="text-4xl mb-2">{action.icon}</span>
              <h3 className="font-semibold text-white mb-1">{action.title}</h3>
              <p className="text-xs text-white/90">{action.description}</p>
              {action.badge && action.badge > 0 && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {action.badge}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;
