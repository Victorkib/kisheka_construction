/**
 * PrerequisiteGuide
 * Lightweight guidance block for pages with data dependencies.
 */

import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function PrerequisiteGuide({
  title,
  description,
  prerequisites = [],
  actions = [],
  tip,
}) {
  return (
    <Card className="mb-6 border border-blue-100 bg-blue-50/60">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-blue-900">{title}</h2>
          <Badge variant="info">Guided</Badge>
        </div>
        {description && (
          <p className="mt-2 text-sm text-blue-900/80">{description}</p>
        )}

        {prerequisites.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-900/70">
              Prerequisites
            </p>
            <ul className="mt-2 grid gap-1 text-sm text-blue-900/80">
              {prerequisites.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        )}

        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <Link
                key={`${action.href}-${action.label}-${index}`}
                href={action.href}
                className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm ring-1 ring-blue-200 transition hover:bg-blue-100"
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}

        {tip && (
          <p className="mt-3 text-xs text-blue-900/70">
            Tip: {tip}
          </p>
        )}
      </div>
    </Card>
  );
}
