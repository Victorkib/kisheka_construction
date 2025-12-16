/**
 * Hook to track page views for Recently Viewed
 */

'use client';

import { useEffect } from 'react';
import { usePathname, useParams, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/components/navigation/RecentlyViewed';

/**
 * Hook to automatically track page views
 * Call this in page components to track views
 */
export function useTrackPageView(type, getData = null) {
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (type) {
      // Extract ID from pathname or params
      let id = null;
      
      if (params?.id) {
        id = params.id;
      } else {
        // Try to extract from pathname
        const match = pathname.match(/\/([^/]+)$/);
        if (match && match[1] !== 'new' && match[1] !== 'edit') {
          id = match[1];
        }
      }

      if (id) {
        // Fetch data if getData function provided
        if (getData) {
          getData(id).then(data => {
            trackPageView(type, id, data);
          }).catch(err => {
            console.error('Error fetching data for tracking:', err);
            trackPageView(type, id, {});
          });
        } else {
          trackPageView(type, id, {});
        }
      }
    }
  }, [pathname, params, type, getData]);
}

