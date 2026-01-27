/**
 * Standard API Response Helpers
 * Provides consistent response format for all API routes
 */

import { NextResponse } from 'next/server';

/**
 * Standard API response interface
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the request was successful
 * @property {*} [data] - Response data (if successful)
 * @property {string} [message] - Success message
 * @property {string} [error] - Error message (if failed)
 * @property {string} timestamp - ISO timestamp of the response
 */

/**
 * Creates a successful API response
 * @param {*} data - Response data
 * @param {string} [message] - Optional success message
 * @param {number} [statusCode=200] - HTTP status code
 * @returns {NextResponse<ApiResponse>}
 */
export function successResponse(data, message, statusCode = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

/**
 * Creates an error API response
 * @param {string|Object} error - Error message or error data object
 * @param {string|number} [messageOrStatusCode] - Error message (if error is object) or status code (if error is string)
 * @param {number} [statusCode=400] - HTTP status code (when error and message are both provided)
 * @returns {NextResponse<ApiResponse>}
 */
export function errorResponse(error, messageOrStatusCode = 400, statusCode = 400) {
  // Handle different parameter patterns
  let errorMessage = error;
  let errorData = null;
  let httpStatus = 400;

  if (typeof error === 'object' && error !== null) {
    // Pattern: errorResponse(data, message, statusCode)
    errorData = error;
    errorMessage = typeof messageOrStatusCode === 'string' ? messageOrStatusCode : 'An error occurred';
    httpStatus = typeof statusCode === 'number' ? statusCode : 400;
  } else if (typeof messageOrStatusCode === 'number') {
    // Pattern: errorResponse(message, statusCode)
    errorMessage = error;
    httpStatus = messageOrStatusCode;
  } else {
    // Pattern: errorResponse(message, statusCode, ignored)
    errorMessage = error;
    httpStatus = statusCode;
  }

  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      ...(errorData && { data: errorData }),
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus }
  );
}

