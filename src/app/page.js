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

    const checkAuth = async () => {
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
      } catch (error) {
        // Fail open: if auth check fails, just show landing page
        console.error('Home auth check failed:', error);
      } finally {
        if (isMounted) {
          setCheckingAuth(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // While checking auth, we can still show the landing page;
  // the router.replace will take over for authenticated users.
  return <LandingPageContent />;
}

