/**
 * Supabase Server Client Configuration
 * For use in Server Components, API Routes, and Server Actions only
 * 
 * ⚠️ DO NOT import this in Client Components
 * Use @/lib/supabase/client instead
 * 
 * Note: In Next.js 16, cookies() returns a Promise and must be awaited
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase server client for use in Server Components and API routes
 * Handles cookie management automatically
 * 
 * ⚠️ IMPORTANT: In Next.js 16, this function is async because cookies() returns a Promise
 * Always await this function: const supabase = await createClient();
 * 
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
export async function createClient() {
  // In Next.js 16, cookies() returns a Promise - must await it
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            // Handle setting cookies in Server Components
            // This can fail in certain contexts (e.g., during static generation)
            console.warn('Failed to set cookie:', error.message);
          }
        },
      },
    }
  );
}

