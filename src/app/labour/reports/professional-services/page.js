/**
 * Professional Services Report Page
 *
 * Route: /labour/reports/professional-services
 */

'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { ReportGenerator } from '@/components/labour/report-generator';
import { VALID_SERVICE_TYPES } from '@/lib/constants/labour-constants';

export default function ProfessionalServicesReportPage() {
  const serviceTypeOptions = VALID_SERVICE_TYPES.map((service) => ({
    value: service,
    label: service.replace(/_/g, ' '),
  }));

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportGenerator
          reportType="professional-services"
          apiEndpoint="/api/labour/reports/professional-services"
          title="Professional Services Report"
          description="Track architects, engineers, and consultants by profession and service type"
          showGroupBy={false}
          extraFilters={[
            {
              key: 'profession',
              label: 'Profession',
              type: 'text',
              placeholder: 'e.g. Architect, Engineer',
            },
            {
              key: 'serviceType',
              label: 'Service Type',
              type: 'select',
              placeholder: 'Select service type',
              options: serviceTypeOptions,
            },
          ]}
        />
      </div>
    </AppLayout>
  );
}
