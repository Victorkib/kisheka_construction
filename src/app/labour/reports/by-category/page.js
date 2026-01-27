/**
 * By Category/Skill Report Page
 *
 * Route: /labour/reports/by-category
 */

'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { ReportGenerator } from '@/components/labour/report-generator';
import { VALID_SKILL_TYPES } from '@/lib/constants/labour-constants';

export default function ByCategoryReportPage() {
  const [categoryOptions, setCategoryOptions] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories?type=work_items');
        const data = await response.json();
        if (data.success) {
          const options = (data.data || []).map((category) => ({
            value: category._id,
            label: category.categoryName || category.name || 'Unnamed category',
          }));
          setCategoryOptions(options);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();
  }, []);

  const skillOptions = VALID_SKILL_TYPES.map((skill) => ({
    value: skill,
    label: skill.replace(/_/g, ' '),
  }));

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportGenerator
          reportType="by-category"
          apiEndpoint="/api/labour/reports/by-category"
          title="Category & Skill Labour Report"
          description="Break down labour costs by work item category or skill type"
          showGroupBy={false}
          extraFilters={[
            {
              key: 'categoryId',
              label: 'Work Item Category',
              type: 'select',
              placeholder: 'Select category',
              options: categoryOptions,
            },
            {
              key: 'skillType',
              label: 'Skill Type',
              type: 'select',
              placeholder: 'Select skill',
              options: skillOptions,
            },
          ]}
        />
      </div>
    </AppLayout>
  );
}
