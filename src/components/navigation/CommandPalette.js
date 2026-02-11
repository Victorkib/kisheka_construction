/**
 * Command Palette Component
 * Unified search and navigation (⌘K / Ctrl+K)
 * Provides instant access to all features
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { getFlatNavigationForRole } from '@/lib/navigation-helpers';
import { Search, Command, ArrowRight, Clock, Star } from 'lucide-react';

const COMMAND_PALETTE_KEY = 'k'; // ⌘K or Ctrl+K

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentItems, setRecentItems] = useState([]);
  const router = useRouter();
  const pathname = usePathname();
  const { user, canAccess } = usePermissions();
  const { currentProject } = useProjectContext();

  // Load recent items from localStorage
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

  // Get all navigation items
  const allNavItems = useMemo(() => {
    if (!user) return [];
    const projectId = currentProject?._id?.toString() || null;
    return getFlatNavigationForRole(user.role, projectId);
  }, [user, currentProject]);

  // Filter and rank items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      // Show recent items when no query
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
        
        // Scoring algorithm
        let score = 0;
        
        // Exact match
        if (labelLower === queryLower) score += 100;
        // Starts with query
        else if (labelLower.startsWith(queryLower)) score += 50;
        // Contains query
        else if (labelLower.includes(queryLower)) score += 25;
        
        // Href match
        if (hrefLower.includes(queryLower)) score += 10;
        
        // Word boundary matches
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Open command palette: ⌘K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === COMMAND_PALETTE_KEY) {
        e.preventDefault();
        setIsOpen(true);
      }
      
      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        setSelectedIndex(0);
      }
      
      // Navigate with arrow keys
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredItems.length - 1 ? prev + 1 : 0
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredItems.length - 1
          );
        } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
          e.preventDefault();
          handleSelect(filteredItems[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  // Save to recent items
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
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, [router, saveToRecent]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Command Palette - Desktop */}
      <div className="hidden lg:block fixed inset-x-0 top-20 mx-auto max-w-2xl z-50">
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search pages, actions, and features..."
              className="flex-1 outline-none text-gray-900 placeholder-gray-400"
              autoFocus
            />
            <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded border border-gray-300">
              <Command className="w-3 h-3" />
              <span>K</span>
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <p>No results found</p>
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
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                      index === selectedIndex ? 'bg-blue-50 border-l-2 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {item.label}
                        </span>
                        {item.isRecent && (
                          <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                      {item.href && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {item.href}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer - Desktop only */}
          <div className="hidden lg:flex px-4 py-2 border-t border-gray-200 bg-gray-50 items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↑↓</kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">↵</kbd>
                <span>Select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded">Esc</kbd>
                <span>Close</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
