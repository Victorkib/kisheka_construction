/**
 * Favorites Manager Component
 * Allows users to pin/favorite frequently used navigation items
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star } from 'lucide-react';

const FAVORITES_STORAGE_KEY = 'navigation-favorites';

/**
 * Get user's favorites from localStorage
 */
export function getFavorites() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save favorites to localStorage
 */
export function saveFavorites(favorites) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if an item is favorited
 */
export function isFavorited(href) {
  const favorites = getFavorites();
  return favorites.some(fav => fav.href === href);
}

/**
 * Toggle favorite status
 */
export function toggleFavorite(item) {
  const favorites = getFavorites();
  const index = favorites.findIndex(fav => fav.href === item.href);
  
  if (index >= 0) {
    // Remove from favorites
    favorites.splice(index, 1);
  } else {
    // Add to favorites
    favorites.push({
      href: item.href,
      label: item.label,
      icon: item.icon,
    });
  }
  
  saveFavorites(favorites);
  return favorites;
}

/**
 * Favorites Button Component
 * Shows star icon to toggle favorite status
 */
export function FavoriteButton({ item, className = '' }) {
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    setIsFav(isFavorited(item.href));
  }, [item.href]);

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const newFavorites = toggleFavorite(item);
    setIsFav(newFavorites.some(fav => fav.href === item.href));
    
    // Dispatch custom event for sidebar to update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('favorites-updated'));
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-1 rounded hover:bg-gray-100 transition-colors ${className}`}
      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star
        className={`w-4 h-4 ${
          isFav
            ? 'fill-yellow-400 text-yellow-400'
            : 'text-gray-400 hover:text-yellow-400'
        } transition-colors`}
      />
    </button>
  );
}
