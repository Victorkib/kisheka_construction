'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { clearUserCache } from '@/hooks/use-permissions';

/**
 * Protected routes that authenticated users can access
 * Users on these routes should NOT be redirected
 */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/projects',
  '/reports',
  '/admin',
  '/items',
  '/labour',
  '/expenses',
  '/categories',
  '/floors',
  '/investors',
  '/financing',
  '/initial-expenses',
  '/profile',
  '/material-requests',
  '/purchase-orders',
  '/suppliers',
  '/phases',
  '/work-items',
  '/equipment',
  '/analytics',
  '/professional-services',
  '/professional-fees',
  '/professional-activities',
];

/**
 * Pages that should redirect to dashboard after authentication
 * Only redirect from these specific pages, not from all pages
 */
const REDIRECT_FROM_PAGES = [
  '/', // Landing page
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
];

/**
 * OAuth Sync Component
 * Automatically syncs OAuth users to MongoDB when they authenticate
 * Only redirects from specific pages (landing/auth pages), not from protected routes
 */
export function OAuthSync() {
  const router = useRouter();
  const pathname = usePathname();
  const syncInProgressRef = useRef(false);
  const synced = useRef(false);
  const lastSyncedUserIdRef = useRef(null);

  // Check if current pathname is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname?.startsWith(route));
  
  // Check if current pathname should trigger redirect after sync
  const shouldRedirectAfterSync = REDIRECT_FROM_PAGES.includes(pathname || '/');

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    // Check if already synced in this session (using sessionStorage)
    const sessionSyncKey = 'oauth_sync_completed';
    const sessionUserIdKey = 'oauth_sync_user_id';

    // Check current user and sync if needed
    async function syncUser() {
      // Don't sync if already synced or sync in progress
      if (synced.current || syncInProgressRef.current) return;

      // If already on protected route and synced in this session, skip
      if (isProtectedRoute) {
        const syncedUserId = sessionStorage.getItem(sessionUserIdKey);
        if (syncedUserId && sessionStorage.getItem(sessionSyncKey) === 'true') {
          synced.current = true;
          lastSyncedUserIdRef.current = syncedUserId;
          return;
        }
      }

      syncInProgressRef.current = true;

      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (user && !error) {
          // Check if we already synced this user in this session
          const lastSyncedUserId = lastSyncedUserIdRef.current || sessionStorage.getItem(sessionUserIdKey);
          if (lastSyncedUserId === user.id && sessionStorage.getItem(sessionSyncKey) === 'true') {
            synced.current = true;
            syncInProgressRef.current = false;
            
            // Only redirect if on a redirect-from page and not already on protected route
            if (shouldRedirectAfterSync && !isProtectedRoute) {
              router.push('/dashboard');
            }
            return;
          }

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

          // Mark as synced in session storage
          synced.current = true;
          lastSyncedUserIdRef.current = user.id;
          sessionStorage.setItem(sessionSyncKey, 'true');
          sessionStorage.setItem(sessionUserIdKey, user.id);

          // Only redirect if:
          // 1. User is on a page that should redirect (landing/auth pages)
          // 2. User is NOT already on a protected route
          if (shouldRedirectAfterSync && !isProtectedRoute) {
            router.push('/dashboard');
          }
        }
      } catch (error) {
        console.error('OAuth sync error:', error);
        syncInProgressRef.current = false;
        // Don't throw - this is a background sync
      }
    }

    // Run sync on mount (only once per session)
    syncUser();

    // Also listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Only reset sync if this is a different user (actual new sign-in)
        const currentUserId = session.user.id;
        const lastSyncedUserId = lastSyncedUserIdRef.current || sessionStorage.getItem(sessionUserIdKey);
        
        if (currentUserId !== lastSyncedUserId) {
          // This is a new user signing in, reset sync flags
          synced.current = false;
          syncInProgressRef.current = false;
          sessionStorage.removeItem(sessionSyncKey);
          sessionStorage.removeItem(sessionUserIdKey);
          syncUser();
        }
        // If same user, don't re-sync - they're already synced
      } else if (event === 'SIGNED_OUT') {
        // Clear all caches on sign out
        clearUserCache();
        
        // Clear session storage
        sessionStorage.removeItem(sessionSyncKey);
        sessionStorage.removeItem(sessionUserIdKey);
        
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
        lastSyncedUserIdRef.current = null;
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [router, pathname, isProtectedRoute, shouldRedirectAfterSync]);

  return null; // This component doesn't render anything
}

