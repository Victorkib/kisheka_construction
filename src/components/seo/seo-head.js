/**
 * SEO Component
 * Injects structured data and meta tags into page head
 *
 * Usage:
 * import { SeoHead } from '@/components/seo/seo-head';
 *
 * <SeoHead
 *   title="Page Title"
 *   description="Page description"
 *   jsonLd={schema}
 * />
 */

'use client';

import { useEffect } from 'react';
import { ORGANIZATION_SCHEMA, SOFTWARE_APP_SCHEMA } from '@/lib/seo';

export function SeoHead({
  title,
  description,
  jsonLd,
  canonical,
  robots,
  ogImage,
  ogType = 'website',
}) {
  useEffect(() => {
    // Inject JSON-LD schemas
    const schemas = [ORGANIZATION_SCHEMA, SOFTWARE_APP_SCHEMA];

    if (jsonLd) {
      schemas.push(jsonLd);
    }

    schemas.forEach((schema) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    });
  }, [jsonLd]);

  return null;
}

/**
 * Breadcrumb SEO Component
 * Displays breadcrumb navigation and injects schema
 */
export function SeoBreadcrumb({ items }) {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [items]);

  return (
    <nav aria-label="breadcrumb" className="mb-4">
      <ol className="flex flex-wrap gap-2 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <a href={item.url} className="text-blue-600 hover:underline">
              {item.name}
            </a>
            {index < items.length - 1 && (
              <span className="text-gray-400">/</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * FAQ Item Component with SEO
 */
export function SeofaqItem({ question, answer, isOpen, onToggle }) {
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={onToggle}
        className="w-full text-left py-4 font-semibold text-gray-900 hover:text-blue-600 flex justify-between items-center"
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        <span>{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="pb-4 text-gray-700">
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}
