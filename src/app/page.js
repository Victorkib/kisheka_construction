/**
 * Root Landing Page
 * 
 * This page serves as the entry point for the application:
 * - If user is authenticated: Redirects to /dashboard
 * - If user is not authenticated: Shows the public landing page
 * 
 * This is a Server Component that checks authentication server-side
 * for optimal performance and SEO.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingPageContent from '@/components/landing/landing-page-content';

export default async function Home() {
  // Check if user is authenticated
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // If authenticated, redirect to dashboard
  if (session) {
    redirect('/dashboard');
  }

  // If not authenticated, show landing page
  return <LandingPageContent />;
}
