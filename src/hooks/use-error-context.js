/**
 * Error Context Hook
 * Collects contextual information for error reporting
 */

'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function useErrorContext() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [context, setContext] = useState({
    url: '',
    userAgent: '',
    timestamp: '',
    screenSize: '',
    online: true,
    user: null,
    project: null,
  });

  useEffect(() => {
    const collectContext = async () => {
      const url = window.location.href;
      const userAgent = navigator.userAgent;
      const timestamp = new Date().toISOString();
      const screenSize = `${window.innerWidth}x${window.innerHeight}`;
      const online = navigator.onLine;

      // Get user info if available
      let user = null;
      try {
        const userResponse = await fetch('/api/auth/me', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.success) {
            user = {
              id: userData.data?.id || userData.data?._id,
              email: userData.data?.email,
              role: userData.data?.role,
              name: userData.data?.firstName || userData.data?.name,
            };
          }
        }
      } catch (e) {
        // Silently fail - user might not be logged in
      }

      // Get project context if available
      let project = null;
      try {
        const projectId = searchParams?.get('projectId') || 
                         localStorage.getItem('currentProjectId') ||
                         sessionStorage.getItem('currentProjectId');
        if (projectId) {
          project = { id: projectId };
        }
      } catch (e) {
        // Silently fail
      }

      setContext({
        url,
        userAgent,
        timestamp,
        screenSize,
        online,
        user,
        project,
      });
    };

    collectContext();
  }, [pathname, searchParams]);

  return context;
}

/**
 * Get error data from session storage (set by error boundary)
 */
export function getStoredError() {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = sessionStorage.getItem('lastError');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to get stored error:', e);
  }
  
  return null;
}

/**
 * Clear stored error
 */
export function clearStoredError() {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.removeItem('lastError');
  } catch (e) {
    console.error('Failed to clear stored error:', e);
  }
}
