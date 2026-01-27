'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * OAuth Sync Component
 * Automatically syncs OAuth users to MongoDB when they authenticate
 * This runs on app load and whenever auth state changes
 */
export function OAuthSync() {
  useEffect(() => {
    const supabase = createClient();

    // Check current user and sync if needed
    async function syncUser() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

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
          }
        }
      } catch (error) {
        console.error('OAuth sync error:', error);
        // Don't throw - this is a background sync
      }
    }

    // Run sync on mount
    syncUser();

    // Also listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // User just signed in, sync immediately
        syncUser();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return null; // This component doesn't render anything
}
