'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { clearUserCache } from '@/hooks/use-permissions';

/**
 * OAuth Sync Component
 * Automatically syncs OAuth users to MongoDB when they authenticate
 * CRITICAL: This component does NOT redirect - it only syncs users silently
 * Redirects should ONLY happen from login form or auth callback
 */
export function OAuthSync() {
  const syncInProgressRef = useRef(false);
  const synced = useRef(false);
  const lastSyncedUserIdRef = useRef(null);

  // REMOVED: All redirect logic from OAuthSync
  // OAuthSync should ONLY sync users to MongoDB silently
  // Redirects should ONLY happen from login form or auth callback, NOT from sync

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    // Check if already synced in this session (using sessionStorage)
    const sessionSyncKey = 'oauth_sync_completed';
    const sessionUserIdKey = 'oauth_sync_user_id';

    // Check current user and sync if needed
    // CRITICAL: This function ONLY syncs users to MongoDB - NO REDIRECTS
    // Redirects should ONLY happen from login form or auth callback
    async function syncUser() {
      // Don't sync if already synced or sync in progress
      if (synced.current || syncInProgressRef.current) return;

      // If already synced in this session, skip
      const syncedUserId = sessionStorage.getItem(sessionUserIdKey);
      if (syncedUserId && sessionStorage.getItem(sessionSyncKey) === 'true') {
        synced.current = true;
        lastSyncedUserIdRef.current = syncedUserId;
        return;
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
            return; // Already synced, no redirect
          }

          // User is authenticated, sync to MongoDB silently
          // NO REDIRECTS - let the user stay where they are
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

          // NO REDIRECT - sync is complete, user stays where they are
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
    // CRITICAL: NO REDIRECTS - just sync silently
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
          
          // Sync silently - NO REDIRECTS
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
  }, []); // Empty deps - sync only runs once on mount and on auth state changes

  return null; // This component doesn't render anything
}

