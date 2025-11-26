/**
 * Supabase Client Configuration (Client-Side Only)
 * For use in Client Components only
 * 
 * ⚠️ DO NOT import this in Server Components or API routes
 * Use @/lib/supabase/server instead
 */

'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase browser client for use in Client Components
 * This is safe to use in components with 'use client' directive
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Alias for createClient (for backward compatibility)
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createBrowserSupabaseClient() {
  return createClient();
}
