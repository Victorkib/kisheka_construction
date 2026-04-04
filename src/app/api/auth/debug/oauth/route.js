/**
 * OAuth Diagnostics Endpoint
 * GET /api/auth/debug/oauth
 *
 * This endpoint helps diagnose OAuth/session issues in production.
 * It returns information about the current session state without requiring authentication.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Get all incoming cookies
    const allCookies = request.cookies.getAll();

    // Check for Supabase session cookies
    const supabaseCookies = allCookies.filter(c =>
      c.name.includes('sb-') ||
      c.name.includes('supabase') ||
      c.name.includes('auth')
    );

    // Check for code verifier cookie
    const hasCodeVerifier = allCookies.some(c =>
      c.name.includes('code-verifier') ||
      c.name.includes('code_verifier') ||
      c.name.includes('pkce')
    );

    // Try to get Supabase session
    let sessionInfo = { exists: false, error: null, user: null };
    try {
      const supabase = await createClient();
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        sessionInfo = { exists: false, error: error.message, user: null };
      } else if (session) {
        sessionInfo = {
          exists: true,
          error: null,
          user: {
            id: session.user?.id?.substring(0, 8) + '...',
            email: session.user?.email,
            provider: session.user?.app_metadata?.provider,
          },
          expiresAt: session.expires_at,
        };
      }
    } catch (sessionError) {
      sessionInfo = { exists: false, error: sessionError.message, user: null };
    }

    const diagnostics = {
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      cookies: {
        total: allCookies.length,
        names: allCookies.map(c => c.name),
        hasCodeVerifier,
        supabaseCookies: supabaseCookies.map(c => ({
          name: c.name,
          valuePreview: c.value?.substring(0, 20) + '...',
        })),
      },
      session: sessionInfo,
      environment: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        supabaseUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
      },
    };

    return NextResponse.json({
      success: true,
      data: diagnostics,
    });
  } catch (error) {
    console.error('[OAuth Debug] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
