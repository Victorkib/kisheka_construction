/**
 * DateInput Component
 * Enhanced date input with visible calendar icon
 * Makes it clear to users that a date picker is available
 */

'use client';

import { useRef } from 'react';

export function DateInput({
  value,
  onChange,
  name,
  id,
  required = false,
  min,
  max,
  className = '',
  placeholder,
  disabled = false,
  ...props
}) {
  const inputRef = useRef(null);

  const handleIconClick = () => {
    if (inputRef.current && !disabled) {
      inputRef.current.showPicker?.();
      inputRef.current.focus();
    }
  };

  // Base classes for the input
  const baseInputClasses = 'w-full pr-10 pl-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer';
  
  // Combine with custom classes
  const inputClasses = `${baseInputClasses} ${className}`.trim();

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="date"
        name={name}
        id={id}
        value={value || ''}
        onChange={onChange}
        required={required}
        min={min}
        max={max}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClasses}
        {...props}
      />
      {/* Visible Calendar Icon on the Right */}
      <button
        type="button"
        onClick={handleIconClick}
        disabled={disabled}
        className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-auto cursor-pointer hover:bg-gray-50 rounded-r-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Open date picker"
        tabIndex={-1}
      >
        <svg
          className="w-5 h-5 text-gray-500 hover:text-blue-600 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>
    </div>
  );
}

export default DateInput;
