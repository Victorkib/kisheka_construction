/**
 * Mobile Command Palette Component
 * Bottom sheet version for mobile devices
 * Provides unified search and navigation on mobile
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { getFlatNavigationForRole } from '@/lib/navigation-helpers';
import { Search, X, ArrowRight, Clock, Star } from 'lucide-react';

const COMMAND_PALETTE_KEY = 'k';

export function CommandPaletteMobile({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentItems, setRecentItems] = useState([]);
  const router = useRouter();
  const pathname = usePathname();
  const { user } = usePermissions();
  const { currentProject } = useProjectContext();

  // Load recent items
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('command-palette-recent');
      if (stored) {
        try {
          setRecentItems(JSON.parse(stored));
        } catch (e) {
          // Invalid data, ignore
        }
      }
    }
  }, []);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Get all navigation items
  const allNavItems = useMemo(() => {
    if (!user) return [];
    const projectId = currentProject?._id?.toString() || null;
    return getFlatNavigationForRole(user.role, projectId);
  }, [user, currentProject]);

  // Filter and rank items
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return recentItems.slice(0, 8).map(item => ({
        ...item,
        isRecent: true,
      }));
    }

    const queryLower = query.toLowerCase();
    const scored = allNavItems
      .map(item => {
        const labelLower = item.label.toLowerCase();
        const hrefLower = item.href?.toLowerCase() || '';
        
        let score = 0;
        if (labelLower === queryLower) score += 100;
        else if (labelLower.startsWith(queryLower)) score += 50;
        else if (labelLower.includes(queryLower)) score += 25;
        if (hrefLower.includes(queryLower)) score += 10;
        
        const words = queryLower.split(' ');
        words.forEach(word => {
          if (labelLower.includes(word)) score += 5;
        });

        return { ...item, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return scored;
  }, [query, allNavItems, recentItems]);

  // Save to recent
  const saveToRecent = useCallback((item) => {
    setRecentItems(prev => {
      const filtered = prev.filter(i => i.href !== item.href);
      const updated = [item, ...filtered].slice(0, 10);
      if (typeof window !== 'undefined') {
        localStorage.setItem('command-palette-recent', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  // Handle item selection
  const handleSelect = useCallback((item) => {
    if (!item.href) return;
    saveToRecent(item);
    router.push(item.href);
    onClose();
    setQuery('');
    setSelectedIndex(0);
  }, [router, saveToRecent, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
        <div className="bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 max-h-[85vh] flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search pages, actions, and features..."
              className="flex-1 outline-none text-gray-900 placeholder-gray-400 text-base"
              autoFocus
            />
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {filteredItems.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                <p className="text-base">No results found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="py-2">
                {query && (
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Results
                  </div>
                )}
                {!query && (
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Recent
                  </div>
                )}
                {filteredItems.map((item, index) => (
                  <button
                    key={item.href || index}
                    onClick={() => handleSelect(item)}
                    className={`w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation ${
                      index === selectedIndex ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate text-base">
                          {item.label}
                        </span>
                        {item.isRecent && (
                          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                      {item.href && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {item.href}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
