/**
 * Edit Worker Form Skeleton Loader
 * Skeleton loader for edit worker drawer form
 */

'use client';

export function EditWorkerSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Form Fields Skeleton */}
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-10 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>

      {/* Skills Section Skeleton */}
      <div>
        <div className="h-4 bg-gray-200 rounded w-20 mb-4"></div>
        <div className="border border-gray-300 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditWorkerSkeleton;
