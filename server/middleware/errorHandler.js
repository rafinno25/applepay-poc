import { v4 as uuidv4 } from 'uuid';
import config from '../config/applepay.js';

/**
 * Error handling middleware
 * Formats errors with detailed information for POC debugging
 */
export const errorHandler = (err, req, res, next) => {
  // Generate unique request ID for tracking
  const requestId = req.id || uuidv4();
  
  // Determine error type
  let errorType = 'ApplicationError';
  let statusCode = err.statusCode || err.status || 500;
  let errorCode = err.code || 'INTERNAL_ERROR';

  if (err.name === 'ValidationError' || err.type === 'validation') {
    errorType = 'ValidationError';
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.response) {
    // API error (from axios/HTTP requests)
    errorType = 'APIError';
    statusCode = err.response.status || 500;
    errorCode = err.response.data?.code || 'API_ERROR';
  } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    errorType = 'NetworkError';
    statusCode = 503;
    errorCode = 'NETWORK_ERROR';
  } else if (err.code === 'ENOENT') {
    errorType = 'FileError';
    statusCode = 500;
    errorCode = 'FILE_NOT_FOUND';
  }

  // Build detailed error response
  const errorResponse = {
    error: {
      message: err.message || 'An unexpected error occurred',
      code: errorCode,
      type: errorType,
      timestamp: new Date().toISOString(),
      requestId: requestId,
      context: {
        endpoint: req.path,
        method: req.method,
        userId: req.body?.userId || req.query?.userId || undefined,
      },
    },
  };

  // Add detailed error information
  if (err.details) {
    errorResponse.error.details = err.details;
  }

  // Add field-level validation errors
  if (err.fields) {
    errorResponse.error.details = {
      fields: err.fields,
    };
  }

  // Add stack trace in development mode
  if (config.isDevelopment && err.stack) {
    errorResponse.error.stack = err.stack;
  }

  // Add original error from external services
  if (err.originalError) {
    errorResponse.error.originalError = err.originalError;
  }

  // Add Authorize.Net specific error details
  if (err.authorizeNetError) {
    errorResponse.error.authorizeNetError = err.authorizeNetError;
  }

  // Add Apple Pay specific error details
  if (err.applePayError) {
    errorResponse.error.applePayError = err.applePayError;
  }

  // Log error to console
  console.error(`[${requestId}] Error:`, {
    type: errorType,
    code: errorCode,
    message: err.message,
    stack: config.isDevelopment ? err.stack : undefined,
  });

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Request ID middleware
 * Adds unique request ID to each request
 */
export const requestIdMiddleware = (req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

