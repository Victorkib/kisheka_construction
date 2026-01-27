'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * OAuth Sync Component
 * Automatically syncs OAuth users to MongoDB when they authenticate
 * and redirects to dashboard after successful login
 */
export function OAuthSync() {
  const router = useRouter();

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
            return;
          }

          // Check if we're on an auth page (login/register)
          const currentPath = window.location.pathname;
          const isAuthPage = currentPath?.includes('/auth/');

          // If on auth page, redirect to dashboard
          if (isAuthPage) {
            router.push('/dashboard');
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
        // User just signed in, sync immediately and redirect
        syncUser();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  return null; // This component doesn't render anything
}

