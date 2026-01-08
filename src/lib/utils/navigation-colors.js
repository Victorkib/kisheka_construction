/**
 * Navigation Color System
 * Modern, vibrant color palette for sidebar navigation
 * Each section gets its own color theme
 */

/**
 * Get color theme for a navigation section
 * @param {string} sectionLabel - Navigation section label
 * @returns {Object} Color theme object
 */
export function getSectionColorTheme(sectionLabel) {
  const label = sectionLabel?.toLowerCase() || '';
  
  // Color themes for each section
  const themes = {
    // Dashboard - Indigo/Blue
    dashboard: {
      active: {
        bg: 'bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50',
        text: 'text-indigo-700',
        icon: 'text-indigo-600',
        border: 'border-indigo-300/60',
        accent: 'bg-indigo-600',
      },
      inactive: {
        bg: 'bg-gradient-to-r from-indigo-50/30 via-blue-50/20 to-indigo-50/30',
        text: 'text-indigo-800/80',
        icon: 'text-indigo-500',
        border: 'border-indigo-200/30',
        hover: {
          bg: 'hover:bg-gradient-to-r hover:from-indigo-100/50 hover:via-blue-100/40 hover:to-indigo-100/50',
          text: 'hover:text-indigo-900',
          icon: 'hover:text-indigo-600',
          border: 'hover:border-indigo-300/50',
        },
      },
    },
    
    // Projects - Purple/Violet
    projects: {
      active: {
        bg: 'bg-gradient-to-r from-purple-50 via-violet-50 to-purple-50',
        text: 'text-purple-700',
        icon: 'text-purple-600',
        border: 'border-purple-300/60',
        accent: 'bg-purple-600',
      },
      inactive: {
        bg: 'bg-gradient-to-r from-purple-50/30 via-violet-50/20 to-purple-50/30',
        text: 'text-purple-800/80',
        icon: 'text-purple-500',
        border: 'border-purple-200/30',
        hover: {
          bg: 'hover:bg-gradient-to-r hover:from-purple-100/50 hover:via-violet-100/40 hover:to-purple-100/50',
          text: 'hover:text-purple-900',
          icon: 'hover:text-purple-600',
          border: 'hover:border-purple-300/50',
        },
      },
    },
    
    // Financial - Green/Emerald
    financial: {
      active: {
        bg: 'bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-50',
        text: 'text-emerald-700',
        icon: 'text-emerald-600',
        border: 'border-emerald-300/60',
        accent: 'bg-emerald-600',
      },
      inactive: {
        bg: 'bg-gradient-to-r from-emerald-50/30 via-green-50/20 to-emerald-50/30',
        text: 'text-emerald-800/80',
        icon: 'text-emerald-500',
        border: 'border-emerald-200/30',
        hover: {
          bg: 'hover:bg-gradient-to-r hover:from-emerald-100/50 hover:via-green-100/40 hover:to-emerald-100/50',
          text: 'hover:text-emerald-900',
          icon: 'hover:text-emerald-600',
          border: 'hover:border-emerald-300/50',
        },
      },
    },
    
    // Operations - Orange/Amber
    operations: {
      active: {
        bg: 'bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50',
        text: 'text-orange-700',
        icon: 'text-orange-600',
        border: 'border-orange-300/60',
        accent: 'bg-orange-600',
      },
      inactive: {
        bg: 'bg-gradient-to-r from-orange-50/30 via-amber-50/20 to-orange-50/30',
        text: 'text-orange-800/80',
        icon: 'text-orange-500',
        border: 'border-orange-200/30',
        hover: {
          bg: 'hover:bg-gradient-to-r hover:from-orange-100/50 hover:via-amber-100/40 hover:to-orange-100/50',
          text: 'hover:text-orange-900',
          icon: 'hover:text-orange-600',
          border: 'hover:border-orange-300/50',
        },
      },
    },
    
    // Professional Services - Teal/Cyan
    'professional services': {
      active: {
        bg: 'bg-gradient-to-r from-teal-50 via-cyan-50 to-teal-50',
        text: 'text-teal-700',
        icon: 'text-teal-600',
        border: 'border-teal-300/60',
        accent: 'bg-teal-600',
      },
      inactive: {
        bg: 'bg-gradient-to-r from-teal-50/30 via-cyan-50/20 to-teal-50/30',
        text: 'text-teal-800/80',
        icon: 'text-teal-500',
        border: 'border-teal-200/30',
        hover: {
          bg: 'hover:bg-gradient-to-r hover:from-teal-100/50 hover:via-cyan-100/40 hover:to-teal-100/50',
          text: 'hover:text-teal-900',
          icon: 'hover:text-teal-600',
          border: 'hover:border-teal-300/50',
        },
      },
    },
    
    // Management - Slate/Indigo
    management: {
      active: {
        bg: 'bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50',
        text: 'text-slate-700',
        icon: 'text-indigo-600',
        border: 'border-slate-300/60',
        accent: 'bg-indigo-600',
      },
      inactive: {
        bg: 'bg-gradient-to-r from-slate-50/30 via-indigo-50/15 to-slate-50/30',
        text: 'text-slate-800/80',
        icon: 'text-slate-500',
        border: 'border-slate-200/30',
        hover: {
          bg: 'hover:bg-gradient-to-r hover:from-slate-100/50 hover:via-indigo-100/30 hover:to-slate-100/50',
          text: 'hover:text-slate-900',
          icon: 'hover:text-indigo-600',
          border: 'hover:border-slate-300/50',
        },
      },
    },
    
    // Analytics - Pink/Rose
    analytics: {
      active: {
        bg: 'bg-gradient-to-r from-pink-50 via-rose-50 to-pink-50',
        text: 'text-pink-700',
        icon: 'text-pink-600',
        border: 'border-pink-300/60',
        accent: 'bg-pink-600',
      },
      inactive: {
        bg: 'bg-gradient-to-r from-pink-50/30 via-rose-50/20 to-pink-50/30',
        text: 'text-pink-800/80',
        icon: 'text-pink-500',
        border: 'border-pink-200/30',
        hover: {
          bg: 'hover:bg-gradient-to-r hover:from-pink-100/50 hover:via-rose-100/40 hover:to-pink-100/50',
          text: 'hover:text-pink-900',
          icon: 'hover:text-pink-600',
          border: 'hover:border-pink-300/50',
        },
      },
    },
    
    // Archive - Gray with subtle color
    archive: {
      active: {
        bg: 'bg-gradient-to-r from-gray-50 via-slate-50 to-gray-50',
        text: 'text-gray-700',
        icon: 'text-gray-600',
        border: 'border-gray-300/60',
        accent: 'bg-gray-600',
      },
      inactive: {
        bg: 'bg-gradient-to-r from-gray-50/30 via-slate-50/20 to-gray-50/30',
        text: 'text-gray-800/80',
        icon: 'text-gray-500',
        border: 'border-gray-200/30',
        hover: {
          bg: 'hover:bg-gradient-to-r hover:from-gray-100/50 hover:via-slate-100/40 hover:to-gray-100/50',
          text: 'hover:text-gray-900',
          icon: 'hover:text-gray-700',
          border: 'hover:border-gray-300/50',
        },
      },
    },
  };
  
  // Match section label to theme
  if (label.includes('dashboard')) return themes.dashboard;
  if (label.includes('project')) return themes.projects;
  if (label.includes('financial') || label.includes('financing') || label.includes('investor')) return themes.financial;
  if (label.includes('operation') || label.includes('material') || label.includes('purchase') || label.includes('stock') || label.includes('approval')) return themes.operations;
  if (label.includes('professional') || label.includes('service') || label.includes('activity') || label.includes('fee')) return themes['professional services'];
  if (label.includes('management') || label.includes('user') || label.includes('supplier') || label.includes('categor') || label.includes('floor')) return themes.management;
  if (label.includes('analytics') || label.includes('wastage') || label.includes('budget')) return themes.analytics;
  if (label.includes('archive')) return themes.archive;
  
  // Default theme - Blue
  return {
    active: {
      bg: 'bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50',
      text: 'text-blue-700',
      icon: 'text-blue-600',
      border: 'border-blue-300/60',
      accent: 'bg-blue-600',
    },
    inactive: {
      bg: 'bg-gradient-to-r from-blue-50/30 via-indigo-50/20 to-blue-50/30',
      text: 'text-blue-800/80',
      icon: 'text-blue-500',
      border: 'border-blue-200/30',
      hover: {
        bg: 'hover:bg-gradient-to-r hover:from-blue-100/50 hover:via-indigo-100/40 hover:to-blue-100/50',
        text: 'hover:text-blue-900',
        icon: 'hover:text-blue-600',
        border: 'hover:border-blue-300/50',
      },
    },
  };
}

/**
 * Get color classes for a navigation item
 * @param {string} sectionLabel - Section label
 * @param {boolean} isActive - Is item active
 * @param {boolean} isParentActive - Is parent active
 * @returns {Object} Color classes object
 */
export function getNavItemColors(sectionLabel, isActive, isParentActive = false) {
  const theme = getSectionColorTheme(sectionLabel);
  
  if (isActive) {
    return {
      container: `${theme.active.bg} ${theme.active.text} font-semibold shadow-sm ${theme.active.border}`,
      icon: theme.active.icon,
      border: theme.active.border,
      accent: theme.active.accent,
    };
  }
  
  if (isParentActive) {
    return {
      container: `${theme.inactive.bg} ${theme.inactive.text} font-medium ${theme.inactive.border} ${theme.inactive.hover.bg} ${theme.inactive.hover.text} ${theme.inactive.hover.border}`,
      icon: `${theme.inactive.icon} ${theme.inactive.hover.icon}`,
      border: theme.inactive.border,
      accent: theme.active.accent,
    };
  }
  
  return {
    container: `${theme.inactive.bg} ${theme.inactive.text} font-medium ${theme.inactive.border} ${theme.inactive.hover.bg} ${theme.inactive.hover.text} ${theme.inactive.hover.border}`,
    icon: `${theme.inactive.icon} ${theme.inactive.hover.icon}`,
    border: theme.inactive.border,
    accent: theme.active.accent,
  };
}





