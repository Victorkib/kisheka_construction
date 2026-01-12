/**
 * Enhanced Worker Selector Component
 * Searchable dropdown with visual indicators and smart suggestions
 */

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, User, UserPlus, CheckCircle, X } from 'lucide-react';

export function EnhancedWorkerSelector({
  value,
  onChange,
  availableWorkers = [],
  suggestedWorkers = [],
  placeholder = 'Select or type worker name...',
  onWorkerSelected,
  onNewWorker,
  workerName = '', // External workerName for new workers
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Determine if current value is an existing worker
  const selectedWorker = useMemo(() => {
    if (!value) return null;
    return availableWorkers.find((w) => (w.userId || w._id) === value);
  }, [value, availableWorkers]);

  // Filter workers based on search term
  const filteredWorkers = useMemo(() => {
    if (!searchTerm.trim()) {
      // Show suggested workers first, then all workers
      const suggestedIds = new Set(suggestedWorkers.map(w => w.userId || w._id));
      const otherWorkers = availableWorkers.filter(w => !suggestedIds.has(w.userId || w._id));
      return [...suggestedWorkers, ...otherWorkers];
    }

    const term = searchTerm.toLowerCase();
    return availableWorkers.filter((worker) => {
      const name = (worker.workerName || '').toLowerCase();
      const employeeId = (worker.employeeId || '').toLowerCase();
      return name.includes(term) || employeeId.includes(term);
    });
  }, [searchTerm, availableWorkers, suggestedWorkers]);

  // Check if search term matches a new worker name
  const isNewWorker = useMemo(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) return false;
    const term = searchTerm.toLowerCase().trim();
    return !availableWorkers.some((worker) => {
      const name = (worker.workerName || '').toLowerCase();
      return name === term;
    });
  }, [searchTerm, availableWorkers]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const maxIndex = filteredWorkers.length + (isNewWorker ? 1 : 0) - 1;
          return prev < maxIndex ? prev + 1 : prev;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0) {
          if (highlightedIndex < filteredWorkers.length) {
            handleSelectWorker(filteredWorkers[highlightedIndex]);
          } else if (isNewWorker) {
            handleNewWorker();
          }
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, filteredWorkers, highlightedIndex, isNewWorker]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('[data-worker-item]');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelectWorker = (worker) => {
    const workerId = worker.userId || worker._id;
    onChange(workerId);
    if (onWorkerSelected) {
      onWorkerSelected(worker);
    }
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleNewWorker = () => {
    if (onNewWorker) {
      onNewWorker(searchTerm.trim());
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);

    // If user clears selection, clear the value
    if (!newValue && value) {
      onChange('');
      if (onNewWorker) {
        onNewWorker(''); // Clear new worker name too
      }
    } else if (newValue && !selectedWorker) {
      // User is typing a new worker name
      if (onNewWorker) {
        onNewWorker(newValue.trim());
      }
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
  };

  // Use workerName if provided (for new workers), otherwise use selectedWorker or searchTerm
  const displayValue = selectedWorker
    ? `${selectedWorker.workerName}${selectedWorker.employeeId ? ` (${selectedWorker.employeeId})` : ''}`
    : (workerName || searchTerm || '');
  
  // Sync searchTerm with workerName when it changes externally
  useEffect(() => {
    if (workerName && !selectedWorker && searchTerm !== workerName) {
      setSearchTerm(workerName);
    }
  }, [workerName, selectedWorker]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={displayValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Visual Indicator Badge */}
        {selectedWorker && (
          <div className="absolute -top-2 right-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
              <CheckCircle className="w-3 h-3" />
              Existing
            </span>
          </div>
        )}

        {/* Dropdown */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
          >
            {/* Suggested Workers Section */}
            {!searchTerm.trim() && suggestedWorkers.length > 0 && (
              <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
                <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                  Suggested Workers
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Workers who have worked on this phase/project
                </p>
              </div>
            )}

            {/* Filtered Workers List */}
            {filteredWorkers.length > 0 && (
              <div className="py-1">
                {filteredWorkers.map((worker, index) => {
                  const workerId = worker.userId || worker._id;
                  const isHighlighted = index === highlightedIndex;
                  const isSuggested = suggestedWorkers.some((w) => (w.userId || w._id) === workerId);

                  return (
                    <div
                      key={workerId}
                      data-worker-item
                      onClick={() => handleSelectWorker(worker)}
                      className={`px-3 py-2 cursor-pointer flex items-center justify-between ${
                        isHighlighted ? 'bg-blue-50' : 'hover:bg-gray-50'
                      } ${isSuggested && !searchTerm.trim() ? 'border-l-2 border-blue-500' : ''}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {worker.workerName}
                            </span>
                            {isSuggested && !searchTerm.trim() && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                Suggested
                              </span>
                            )}
                          </div>
                          {worker.employeeId && (
                            <span className="text-xs text-gray-500">{worker.employeeId}</span>
                          )}
                          {worker.defaultHourlyRate && (
                            <span className="text-xs text-gray-500 ml-2">
                              {worker.defaultHourlyRate.toLocaleString()} KES/hr
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full ml-2 flex-shrink-0">
                        <CheckCircle className="w-3 h-3" />
                        Existing
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* New Worker Option */}
            {isNewWorker && (
              <div
                data-worker-item
                onClick={handleNewWorker}
                className={`px-3 py-2 cursor-pointer flex items-center gap-2 border-t border-gray-200 ${
                  highlightedIndex === filteredWorkers.length ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <UserPlus className="w-4 h-4 text-blue-500" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      Create new worker: "{searchTerm.trim()}"
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      <UserPlus className="w-3 h-3" />
                      New
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    Worker profile will be created automatically
                  </span>
                </div>
              </div>
            )}

            {/* No Results */}
            {filteredWorkers.length === 0 && !isNewWorker && searchTerm.trim() && (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                No workers found. Type a name to create a new worker.
              </div>
            )}

            {/* Empty State */}
            {filteredWorkers.length === 0 && !isNewWorker && !searchTerm.trim() && (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                Start typing to search workers or create a new one.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
