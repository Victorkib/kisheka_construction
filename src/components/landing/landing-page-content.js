/**
 * Landing Page Content Component
 * Public-facing landing page for unauthenticated users
 * Displays system overview, features, and call-to-action buttons
 *
 * SEO Optimized:
 * - Semantic HTML structure with proper heading hierarchy
 * - Structured data for rich snippets
 * - Meta descriptions in page metadata
 * - Proper alt text for images
 * - Mobile-optimized responsive design
 */

'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function LandingPageContent() {
  // Inject JSON-LD structured data for SEO
  useEffect(() => {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Doshaki Construction System?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Doshaki Construction Accountability System is a comprehensive project management platform designed for construction companies to track materials, expenses, labour, and project budgets in real-time.',
          },
        },
        {
          '@type': 'Question',
          name: 'How can construction managers benefit from this system?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Construction managers can streamline operations, improve transparency, optimize costs, track materials and labour efficiently, and maintain detailed audit trails for accountability.',
          },
        },
      ],
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(faqSchema);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen ds-bg-app">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-5xl md:text-6xl font-extrabold ds-text-primary leading-tight">
            Doshaki Construction
            <span className="block ds-text-accent-primary mt-2">
              Accountability System
            </span>
          </h1>

          <p className="text-xl md:text-2xl ds-text-secondary max-w-3xl mx-auto leading-relaxed">
            Streamline your construction project management with real-time
            tracking of materials, expenses, and labour. Ensure transparency,
            optimize costs, and drive project success.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
            <Link
              href="/auth/login"
              className="w-full sm:w-auto px-8 py-4 ds-bg-accent-primary hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              aria-label="Sign in to Doshaki Construction"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="w-full sm:w-auto px-8 py-4 ds-bg-surface hover:ds-bg-surface-muted ds-text-accent-primary font-semibold rounded-lg border-2 ds-border-strong shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              aria-label="Create a new account"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section
        className="container mx-auto px-4 py-16"
        aria-labelledby="features-heading"
      >
        <div className="max-w-6xl mx-auto">
          <h2
            id="features-heading"
            className="text-3xl md:text-4xl font-bold text-center ds-text-primary mb-12"
          >
            Powerful Features for Construction Management
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Card 1 */}
            <article className="ds-bg-surface p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-200">
              <div className="text-4xl mb-4" aria-hidden="true">
                📦
              </div>
              <h3 className="text-xl font-semibold ds-text-primary mb-2">
                Material Tracking
              </h3>
              <p className="ds-text-secondary">
                Monitor every material from purchase to usage, track wastage,
                and manage inventory efficiently.
              </p>
            </article>

            {/* Feature Card 2 */}
            <article className="ds-bg-surface p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-200">
              <div className="text-4xl mb-4" aria-hidden="true">
                ✅
              </div>
              <h3 className="text-xl font-semibold ds-text-primary mb-2">
                Approval Workflows
              </h3>
              <p className="ds-text-secondary">
                Implement multi-level approval processes for all critical
                transactions with full audit trails.
              </p>
            </article>

            {/* Feature Card 3 */}
            <article className="ds-bg-surface p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-200">
              <div className="text-4xl mb-4" aria-hidden="true">
                📊
              </div>
              <h3 className="text-xl font-semibold ds-text-primary mb-2">
                Comprehensive Reports
              </h3>
              <p className="ds-text-secondary">
                Generate detailed reports on expenses, materials, and labour
                with real-time analytics.
              </p>
            </article>

            {/* Feature Card 4 */}
            <article className="ds-bg-surface p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-200">
              <div className="text-4xl mb-4" aria-hidden="true">
                📋
              </div>
              <h3 className="text-xl font-semibold ds-text-primary mb-2">
                Stock Management
              </h3>
              <p className="ds-text-secondary">
                Track inventory levels, monitor stock movements, and receive low
                stock alerts automatically.
              </p>
            </article>

            {/* Feature Card 5 */}
            <article className="ds-bg-surface p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-200">
              <div className="text-4xl mb-4" aria-hidden="true">
                🔒
              </div>
              <h3 className="text-xl font-semibold ds-text-primary mb-2">
                Role-Based Security
              </h3>
              <p className="ds-text-secondary">
                Secure access control with role-based permissions ensuring data
                integrity and compliance.
              </p>
            </article>

            {/* Feature Card 6 */}
            <article className="ds-bg-surface p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-200">
              <div className="text-4xl mb-4" aria-hidden="true">
                📈
              </div>
              <h3 className="text-xl font-semibold ds-text-primary mb-2">
                Budget Analytics
              </h3>
              <p className="ds-text-secondary">
                Monitor budget variance, track spending patterns, and forecast
                project completion costs.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Call-to-Action Section */}
      <section
        className="container mx-auto px-4 py-16"
        aria-labelledby="cta-heading"
      >
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-12 text-center text-white shadow-2xl">
          <h2 id="cta-heading" className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Transform Your Construction Management?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Join the Doshaki system today and experience seamless project
            accountability.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="px-8 py-4 ds-bg-surface ds-text-accent-primary font-semibold rounded-lg hover:ds-bg-surface-muted transition-colors duration-200 shadow-lg"
              aria-label="Create account to get started"
            >
              Create Account
            </Link>
            <Link
              href="/auth/login"
              className="px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:ds-bg-surface hover:ds-text-accent-primary transition-all duration-200"
              aria-label="Sign in to existing account"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer
        className="container mx-auto px-4 py-8 border-t ds-border-subtle"
        role="contentinfo"
      >
        <div className="max-w-6xl mx-auto text-center ds-text-secondary">
          <p className="text-sm">
            © {new Date().getFullYear()} Doshaki Construction Accountability
            System. All rights reserved.
          </p>
          <nav className="mt-4 space-x-6 text-sm" aria-label="Footer links">
            <Link href="#privacy" className="ds-text-secondary hover:ds-text-accent-primary">
              Privacy Policy
            </Link>
            <Link href="#terms" className="ds-text-secondary hover:ds-text-accent-primary">
              Terms of Service
            </Link>
            <Link href="#contact" className="ds-text-secondary hover:ds-text-accent-primary">
              Contact Us
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
