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
 * @param {string} error - Error message
 * @param {number} [statusCode=400] - HTTP status code
 * @returns {NextResponse<ApiResponse>}
 */
export function errorResponse(error, statusCode = 400) {
  return NextResponse.json(
    {
      success: false,
      error,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
}

