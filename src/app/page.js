'use client';

/**
 * Root Landing Page
 *
 * This page serves as the public entry point for the application.
 * - In production, we previously used a server-side redirect here for
 *   authenticated users (`redirect('/dashboard')`).
 * - However, that SSR redirect can be triggered by RSC prefetch requests
 *   (e.g. `/?_rsc=...`) while the user is on other pages like
 *   `/projects/new`, which caused unexpected client-side navigation back
 *   to `/dashboard` in production.
 *
 * To avoid production-only redirect glitches while keeping behaviour
 * intuitive, we now:
 * - Render the marketing/landing content by default.
 * - Perform an optional *client-side* check to see if the user is
 *   authenticated, and if so, navigate them to `/dashboard`.
 *
 * This ensures that:
 * - Background RSC prefetches to `/` never cause hard redirects.
 * - Users visiting `/` directly after login can still be taken to
 *   their dashboard.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LandingPageContent from '@/components/landing/landing-page-content';

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelays = [500, 1000, 2000]; // Exponential backoff

    const checkAuth = async (retryDelay = 0) => {
      // Add delay for retries to allow session cookies to propagate
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      if (!isMounted) return;

      try {
        // Lightweight client-side auth check
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });

        if (!isMounted) return;

        if (response.ok) {
          const data = await response.json();
          if (data?.success && data.data) {
            // Authenticated – send to dashboard
            router.replace('/dashboard');
            return;
          }
        }

        // CRITICAL FIX: Retry auth check if it fails
        // This handles race conditions where session cookies aren't set yet
        // Common after OAuth callback, especially on mobile devices
        if (retryCount < maxRetries && response.status !== 401) {
          retryCount++;
          const delay = retryDelays[retryCount - 1] || 2000;
          checkAuth(delay);
          return;
        }
      } catch (error) {
        // Retry on network errors
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = retryDelays[retryCount - 1] || 2000;
          checkAuth(delay);
          return;
        }
        // Fail open: if auth check fails after retries, just show landing page
        console.error('Home auth check failed after retries:', error);
      } finally {
        if (isMounted && retryCount >= maxRetries) {
          setCheckingAuth(false);
        }
      }
    };

    // Initial check with no delay
    checkAuth(0);

    return () => {
      isMounted = false;
    };
  }, [router]);

  // While checking auth, we can still show the landing page;
  // the router.replace will take over for authenticated users.
  return <LandingPageContent />;
}

