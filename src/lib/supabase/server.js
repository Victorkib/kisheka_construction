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
            cookiesToSet.forEach(({ name, value, options }) => {
              // CRITICAL FIX: Set explicit cookie options for OAuth/PKCE flow
              // These options ensure cookies work correctly in production
              // CRITICAL: Preserve original options but ensure critical settings are correct
              const cookieOptions = {
                ...options,
                // SameSite must be 'lax' or 'none' for OAuth redirects
                // 'lax' works for same-site redirects (recommended for OAuth)
                // Use 'none' only if cross-site redirects are needed (requires Secure)
                sameSite: options?.sameSite || 'lax',
                // Secure should be true in production (HTTPS required)
                // But preserve original secure setting if explicitly set
                secure: options?.secure !== undefined 
                  ? options.secure 
                  : (process.env.NODE_ENV === 'production' ? true : false),
                // HttpOnly for session cookies (security)
                // But code verifier cookies may need to be accessible to JS
                httpOnly: options?.httpOnly !== undefined ? options.httpOnly : true,
                // Path should be root to ensure cookies are available everywhere
                path: options?.path || '/',
                // Domain should match the application domain
                // Don't set domain in development (localhost), set in production if needed
                // CRITICAL: Only set domain if explicitly provided, don't override
                ...(options?.domain ? { domain: options.domain } : {}),
                // MaxAge for session persistence
                maxAge: options?.maxAge || 60 * 60 * 24 * 365, // 1 year default
              };
              cookieStore.set(name, value, cookieOptions);
            });
          } catch (error) {
            // Handle setting cookies in Server Components
            // This can fail in certain contexts (e.g., during static generation)
            console.warn('[Supabase Server] Failed to set cookie:', error.message);
          }
        },
      },
    }
  );
}

