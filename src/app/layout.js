import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { ToastProvider } from '@/components/toast';
import { ServiceWorkerRegister } from '@/components/push-notifications/service-worker-register';
import { NotificationPermissionRequest } from '@/components/push-notifications/notification-permission-request';
import { ProjectContextProvider } from '@/contexts/ProjectContext';
import { OAuthSync } from '@/components/auth/oauth-sync';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
};

export const metadata = {
  title:
    'Doshaki Construction Accountability System | Project Management Software',
  description:
    'Comprehensive construction project management system with real-time material tracking, expense management, labour tracking, and financial analytics. Streamline procurement, optimize budgets, and ensure project accountability.',
  keywords:
    'construction management, project management, material tracking, expense tracking, labour management, construction accountability, budget tracking, supplier management',
  authors: [{ name: 'Doshaki Construction' }],
  creator: 'Doshaki Construction',
  publisher: 'Doshaki Construction',
  applicationName: 'Doshaki Construction Accountability System',
  category: 'Business Software',
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
    },
  },
  openGraph: {
    title: 'Doshaki Construction Accountability System',
    description:
      'Professional construction project management platform for materials, expenses, labour, and financial tracking',
    url: 'https://doshaki.netlify.app',
    siteName: 'Doshaki Construction',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: 'https://doshaki.netlify.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Doshaki Construction Accountability System',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Doshaki Construction Accountability System',
    description: 'Professional construction project management platform',
    creator: '@doshaki_construction',
    images: ['https://doshaki.netlify.app/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Doshaki Construction',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: 'any',
      },
      {
        url: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: 'https://doshaki.netlify.app',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
    yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || '',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to improve performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* DNS Prefetch for external services */}
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />

        {/* Structured Data - Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Kisheka Construction',
              url: 'https://doshaki.netlify.app',
              logo: 'https://doshaki.netlify.app/logo.png',
              description:
                'Professional construction project management and accountability system',
              sameAs: [
                'https://www.facebook.com/kisheka.construction',
                'https://www.linkedin.com/company/kisheka-construction',
              ],
            }),
          }}
        />

        {/* Structured Data - Software Application Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Kisheka Construction Accountability System',
              description:
                'Comprehensive construction project management system with material tracking, expense management, and labour tracking',
              url: 'https://doshaki.netlify.app',
              applicationCategory: 'BusinessApplication',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                ratingCount: '150',
              },
            }),
          }}
        />

        {/* Meta tags for search engines */}
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Kisheka" />

      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <ProjectContextProvider>
              <OAuthSync />
              <ServiceWorkerRegister />
              <NotificationPermissionRequest />
              {children}
            </ProjectContextProvider>
          </Suspense>
        </ToastProvider>
      </body>
    </html>
  );
}
