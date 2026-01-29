'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { clearUserCache } from '@/hooks/use-permissions';

/**
 * OAuth Sync Component
 * Automatically syncs OAuth users to MongoDB when they authenticate
 * and redirects to dashboard after successful login
 */
export function OAuthSync() {
  const router = useRouter();
  const pathname = usePathname();
  const syncInProgressRef = useRef(false);
  const synced = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    // Check current user and sync if needed
    async function syncUser() {
      // Don't sync if already synced or sync in progress
      if (synced.current || syncInProgressRef.current) return;

      // Don't sync if already on protected page (likely already synced)
      if (pathname?.startsWith('/dashboard')) {
        synced.current = true;
        return;
      }

      syncInProgressRef.current = true;

      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (user && !error) {
          // User is authenticated, sync to MongoDB
          const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supabaseId: user.id,
              email: user.email,
              firstName: user.user_metadata?.first_name || user.user_metadata?.given_name || '',
              lastName: user.user_metadata?.last_name || user.user_metadata?.family_name || '',
            }),
          });

          if (!response.ok) {
            console.error('Failed to sync user:', await response.text());
            syncInProgressRef.current = false;
            return;
          }

          synced.current = true;

          // If user is logged in and NOT on dashboard, redirect to dashboard
          // This handles both:
          // 1. Coming from /auth/* pages after login
          // 2. OAuth redirects to root (/) after authentication
          if (pathname !== '/dashboard' && !pathname?.startsWith('/dashboard/')) {
            router.push('/dashboard');
          }
        }
      } catch (error) {
        console.error('OAuth sync error:', error);
        syncInProgressRef.current = false;
        // Don't throw - this is a background sync
      }
    }

    // Run sync on mount (only once)
    syncUser();

    // Also listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Reset sync flag on new sign in and sync immediately
        synced.current = false;
        syncInProgressRef.current = false;
        syncUser();
      } else if (event === 'SIGNED_OUT') {
        // Clear all caches on sign out
        clearUserCache();
        
        // Clear service worker cache
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const registration of registrations) {
              caches.keys().then((cacheNames) => {
                cacheNames.forEach(name => caches.delete(name));
              });
            }
          });
        }
        
        // Reset sync flags
        synced.current = false;
        syncInProgressRef.current = false;
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [router, pathname]);

  return null; // This component doesn't render anything
}

