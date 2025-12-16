/**
 * Recently Viewed Component
 * Shows recently accessed projects, requests, orders, etc.
 * Uses localStorage to persist across sessions
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarSection } from '@/components/layout/SidebarSection';

const STORAGE_KEY = 'kisheka_recently_viewed';
const MAX_ITEMS = 5;

/**
 * Item types and their display info
 */
const ITEM_TYPES = {
  project: {
    label: 'Project',
    icon: '🏗️',
    getHref: (id) => `/projects/${id}`,
    getLabel: (item) => item.name || item.projectName || 'Project',
  },
  'material-request': {
    label: 'Material Request',
    icon: '📦',
    getHref: (id) => `/material-requests/${id}`,
    getLabel: (item) => item.name || item.materialName || 'Material Request',
  },
  'purchase-order': {
    label: 'Purchase Order',
    icon: '🛒',
    getHref: (id) => `/purchase-orders/${id}`,
    getLabel: (item) => item.orderNumber || item.code || 'Purchase Order',
  },
  supplier: {
    label: 'Supplier',
    icon: '🏪',
    getHref: (id) => `/suppliers/${id}`,
    getLabel: (item) => item.name || item.supplierName || 'Supplier',
  },
};

/**
 * Get recently viewed items from localStorage
 */
function getRecentlyViewed() {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Error reading recently viewed:', err);
  }
  
  return [];
}

/**
 * Save recently viewed item to localStorage
 */
function saveRecentlyViewed(type, id, data = {}) {
  if (typeof window === 'undefined') return;
  
  try {
    const items = getRecentlyViewed();
    
    // Remove if already exists
    const filtered = items.filter(item => !(item.type === type && item.id === id));
    
    // Add to beginning
    const newItem = {
      type,
      id,
      label: ITEM_TYPES[type]?.getLabel(data) || id,
      data,
      viewedAt: new Date().toISOString(),
    };
    
    filtered.unshift(newItem);
    
    // Keep only MAX_ITEMS
    const limited = filtered.slice(0, MAX_ITEMS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
  } catch (err) {
    console.error('Error saving recently viewed:', err);
  }
}

/**
 * Track current page view
 */
export function trackPageView(type, id, data = {}) {
  if (type && id && ITEM_TYPES[type]) {
    saveRecentlyViewed(type, id, data);
  }
}

/**
 * Recently Viewed Component
 * @param {Object} props
 * @param {boolean} [props.isCollapsed] - Is sidebar collapsed
 */
export function RecentlyViewed({ isCollapsed = false }) {
  const [items, setItems] = useState([]);
  const pathname = usePathname();

  useEffect(() => {
    setItems(getRecentlyViewed());
  }, [pathname]); // Refresh when pathname changes

  if (items.length === 0) {
    return null;
  }

  return (
    <SidebarSection
      id="recently-viewed"
      title="Recently Viewed"
      icon="🕒"
      isCollapsed={isCollapsed}
      variant="secondary"
      collapsible={true}
      defaultCollapsed={false}
      badge={items.length}
      badgeColor="blue"
    >
      <div className="space-y-1">
        {items.map((item, index) => {
          const typeInfo = ITEM_TYPES[item.type];
          if (!typeInfo) return null;
          
          return (
            <Link
              key={`${item.type}-${item.id}-${index}`}
              href={typeInfo.getHref(item.id)}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-gray-100 transition group"
            >
              <span className="text-base flex-shrink-0">{typeInfo.icon}</span>
              <span className="flex-1 truncate text-gray-700 group-hover:text-blue-600 transition">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      {items.length >= MAX_ITEMS && (
        <button
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            setItems([]);
          }}
          className="mt-2 text-xs text-gray-500 hover:text-gray-700 transition"
        >
          Clear history
        </button>
      )}
    </SidebarSection>
  );
}

