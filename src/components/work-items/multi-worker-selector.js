/**
 * Multi Worker Selector Component
 * Allows selecting multiple workers for work item assignment
 * Supports search, filtering by skill type, and suggestions
 */

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, User, X, CheckCircle, Users } from 'lucide-react';

export function MultiWorkerSelector({
  value = [], // Array of worker IDs
  onChange,
  projectId = null,
  phaseId = null,
  category = null, // Work item category for suggestions
  placeholder = 'Search and select workers...',
  className = '',
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch workers
  useEffect(() => {
    fetchWorkers();
  }, [projectId, phaseId]);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({ status: 'active' });
      if (projectId) {
        queryParams.append('projectId', projectId);
      }
      
      const response = await fetch(`/api/labour/workers?${queryParams}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setWorkers(data.data?.workers || []);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get selected workers
  const selectedWorkers = useMemo(() => {
    if (!Array.isArray(value) || value.length === 0) return [];
    return workers.filter(w => {
      const workerId = w.userId || w._id;
      return value.includes(workerId?.toString());
    });
  }, [value, workers]);

  // Get suggested workers (matching category/skill type)
  const suggestedWorkers = useMemo(() => {
    if (!category) return [];
    
    // Map work item categories to skill types
    const categoryToSkillMap = {
      'electrical': 'electrician',
      'plumbing': 'plumber',
      'carpentry': 'carpenter',
      'masonry': 'mason',
      'painting': 'painter',
      'roofing': 'roofer',
      'concrete': 'concrete_worker',
      'steel': 'steel_worker',
      'tiling': 'tiler',
      'plastering': 'plasterer'
    };
    
    const skillType = categoryToSkillMap[category?.toLowerCase()];
    if (!skillType) return [];
    
    return workers.filter(w => {
      const skills = Array.isArray(w.skillTypes) ? w.skillTypes : [w.skillType];
      return skills.some(s => s?.toLowerCase() === skillType);
    }).slice(0, 5); // Limit to 5 suggestions
  }, [category, workers]);

  // Filter workers based on search term
  const filteredWorkers = useMemo(() => {
    if (!searchTerm.trim()) {
      // Show suggested workers first, then all workers (excluding selected)
      const selectedIds = new Set(value.map(id => id.toString()));
      const suggestedIds = new Set(suggestedWorkers.map(w => (w.userId || w._id)?.toString()));
      const otherWorkers = workers.filter(w => {
        const id = (w.userId || w._id)?.toString();
        return !selectedIds.has(id) && !suggestedIds.has(id);
      });
      return [...suggestedWorkers, ...otherWorkers];
    }

    const term = searchTerm.toLowerCase();
    const selectedIds = new Set(value.map(id => id.toString()));
    return workers.filter((worker) => {
      const id = (worker.userId || worker._id)?.toString();
      if (selectedIds.has(id)) return false; // Don't show already selected
      
      const name = (worker.workerName || '').toLowerCase();
      const employeeId = (worker.employeeId || '').toLowerCase();
      return name.includes(term) || employeeId.includes(term);
    });
  }, [searchTerm, workers, value, suggestedWorkers]);

  // Handle worker selection
  const handleSelectWorker = (worker) => {
    const workerId = (worker.userId || worker._id)?.toString();
    if (!workerId) return;
    
    const currentValue = Array.isArray(value) ? [...value] : [];
    
    if (currentValue.includes(workerId)) {
      // Deselect
      const newValue = currentValue.filter(id => id !== workerId);
      onChange(newValue);
    } else {
      // Select
      const newValue = [...currentValue, workerId];
      onChange(newValue);
    }
    
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  // Handle remove selected worker
  const handleRemoveWorker = (workerId, e) => {
    e.stopPropagation();
    const currentValue = Array.isArray(value) ? [...value] : [];
    const newValue = currentValue.filter(id => id !== workerId);
    onChange(newValue);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredWorkers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelectWorker(filteredWorkers[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="block text-sm font-semibold text-gray-900 mb-2">
        Assign Workers <span className="text-gray-500 text-xs font-normal">(Optional)</span>
      </label>
      
      {/* Selected Workers Display */}
      {selectedWorkers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          {selectedWorkers.map((worker) => {
            const workerId = (worker.userId || worker._id)?.toString();
            return (
              <span
                key={workerId}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm font-medium"
              >
                <User className="w-3 h-3" />
                {worker.workerName}
                {worker.employeeId && <span className="text-xs">({worker.employeeId})</span>}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemoveWorker(workerId, e)}
                    className="ml-1 hover:text-blue-600 focus:outline-none"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full pl-10 pr-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setHighlightedIndex(-1);
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto"
          >
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading workers...</div>
            ) : filteredWorkers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No workers found</div>
            ) : (
              <>
                {suggestedWorkers.length > 0 && !searchTerm && (
                  <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-200 text-xs font-semibold text-yellow-800">
                    ✨ Suggested Workers (matching {category || 'category'})
                  </div>
                )}
                {filteredWorkers.map((worker, index) => {
                  const workerId = (worker.userId || worker._id)?.toString();
                  const isSelected = value.includes(workerId);
                  const isHighlighted = index === highlightedIndex;
                  
                  return (
                    <button
                      key={workerId}
                      type="button"
                      onClick={() => handleSelectWorker(worker)}
                      className={`w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors flex items-center justify-between ${
                        isHighlighted ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {worker.workerName}
                          </div>
                          {worker.employeeId && (
                            <div className="text-xs text-gray-500">
                              {worker.employeeId}
                            </div>
                          )}
                          {worker.skillType && (
                            <div className="text-xs text-gray-400">
                              {worker.skillType}
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-gray-600 mt-1">
        {selectedWorkers.length > 0 
          ? `${selectedWorkers.length} worker${selectedWorkers.length > 1 ? 's' : ''} selected`
          : 'Select one or more workers for this work item'}
      </p>
    </div>
  );
}
