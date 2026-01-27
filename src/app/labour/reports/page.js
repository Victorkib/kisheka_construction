/**
 * Labour Reports Main Page
 * Central hub for accessing all labour reports
 * 
 * Route: /labour/reports
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  Building2,
  Layers,
  DollarSign,
  AlertTriangle,
  Briefcase,
  FileText,
  PieChart,
} from 'lucide-react';

export default function LabourReportsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      if (result.success) {
        setProjects(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const reportCategories = [
    {
      title: 'Overview Reports',
      reports: [
        {
          id: 'by-project',
          name: 'By Project',
          description: 'View labour costs and hours across all projects',
          icon: Building2,
          color: 'blue',
          path: '/labour/reports/by-project',
        },
        {
          id: 'by-phase',
          name: 'By Phase',
          description: 'Analyze labour costs by project phase',
          icon: Layers,
          color: 'purple',
          path: '/labour/reports/by-phase',
        },
        {
          id: 'by-time-period',
          name: 'By Time Period',
          description: 'Track labour trends over time (daily, weekly, monthly)',
          icon: Calendar,
          color: 'green',
          path: '/labour/reports/by-time-period',
        },
      ],
    },
    {
      title: 'Detailed Analysis',
      reports: [
        {
          id: 'by-worker',
          name: 'By Worker',
          description: 'Individual worker performance and costs',
          icon: Users,
          color: 'orange',
          path: '/labour/reports/by-worker',
        },
        {
          id: 'by-category',
          name: 'By Category/Skill',
          description: 'Breakdown by skill type and category',
          icon: Briefcase,
          color: 'indigo',
          path: '/labour/reports/by-category',
        },
        {
          id: 'by-floor',
          name: 'By Floor',
          description: 'Labour costs per floor level',
          icon: Building2,
          color: 'teal',
          path: '/labour/reports/by-floor',
        },
      ],
    },
    {
      title: 'Financial Reports',
      reports: [
        {
          id: 'budget-variance',
          name: 'Budget Variance',
          description: 'Compare actual vs budgeted labour costs',
          icon: AlertTriangle,
          color: 'red',
          path: '/labour/reports/budget-variance',
        },
        {
          id: 'cost-summary',
          name: 'Cost Summary',
          description: 'Comprehensive labour cost summaries',
          icon: DollarSign,
          color: 'green',
          path: '/labour/reports/cost-summary',
        },
        {
          id: 'subcontractor-labour',
          name: 'Subcontractor Labour',
          description: 'Separate direct vs subcontractor labour analysis',
          icon: FileText,
          color: 'blue',
          path: '/labour/reports/subcontractor-labour',
        },
      ],
    },
    {
      title: 'Performance Reports',
      reports: [
        {
          id: 'productivity',
          name: 'Productivity Analysis',
          description: 'Worker productivity metrics and ratings',
          icon: TrendingUp,
          color: 'purple',
          path: '/labour/reports/productivity',
        },
        {
          id: 'professional-services',
          name: 'Professional Services',
          description: 'Architects, engineers, and consultants tracking',
          icon: Briefcase,
          color: 'indigo',
          path: '/labour/reports/professional-services',
        },
      ],
    },
  ];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" text="Loading reports..." />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Labour Reports</h1>
          <p className="text-gray-600">
            Comprehensive labour analytics and reporting for your construction projects
          </p>
        </div>

        <PrerequisiteGuide
          title="Reports rely on labour entries"
          description="Generate accurate reports after entries, workers, and phases are in place."
          prerequisites={[
            'Workers are added',
            'Labour entries are logged',
            'Project phases exist',
          ]}
          actions={[
            { href: '/labour/workers', label: 'View Workers' },
            { href: '/labour/entries', label: 'View Entries' },
            { href: '/phases', label: 'View Phases' },
          ]}
          tip="Start with Cost Summary for a quick overview."
        />

        {/* Report Categories */}
        <div className="space-y-8">
          {reportCategories.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{category.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.reports.map((report) => {
                  const Icon = report.icon;
                  const colorClasses = {
                    blue: 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100',
                    purple: 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100',
                    green: 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100',
                    orange: 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100',
                    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100',
                    teal: 'bg-teal-50 border-teal-200 text-teal-600 hover:bg-teal-100',
                    red: 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100',
                  };

                  return (
                    <Link
                      key={report.id}
                      href={report.path}
                      className={`block p-6 rounded-lg border-2 transition-all duration-200 ${colorClasses[report.color]}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg bg-white ${colorClasses[report.color].replace('bg-', 'bg-').replace('-50', '-100')}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{report.name}</h3>
                          <p className="text-sm text-gray-600">{report.description}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-12 bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/labour"
              className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">Labour Dashboard</p>
                <p className="text-sm text-gray-600">View today's summary</p>
              </div>
            </Link>
            <Link
              href="/labour/entries/new"
              className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-green-300 hover:shadow-md transition-all"
            >
              <FileText className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">New Entry</p>
                <p className="text-sm text-gray-600">Add labour entry</p>
              </div>
            </Link>
            <Link
              href="/labour/batches/new"
              className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all"
            >
              <Users className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-medium text-gray-900">Bulk Entry</p>
                <p className="text-sm text-gray-600">Create batch entry</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

