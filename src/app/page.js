/**
 * Root Landing Page
 *
 * This page serves as the entry point for the application:
 * - If user is authenticated: Redirects to /dashboard
 * - If user is not authenticated: Shows the public landing page
 *
 * This is a Server Component that checks authentication server-side
 * for optimal performance and SEO.
 *
 * SEO Optimizations:
 * - Server-side rendering for better SEO crawlability
 * - Comprehensive metadata in root layout
 * - Structured data for Organization and Software Application
 * - Semantic HTML structure
 * - Mobile-optimized responsive design
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingPageContent from '@/components/landing/landing-page-content';

export default async function Home() {
  // Check if user is authenticated
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If authenticated, redirect to dashboard
  if (session) {
    redirect('/dashboard');
  }

  // If not authenticated, show landing page
  return <LandingPageContent />;
}
