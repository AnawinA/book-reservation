'use strict';

class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, AppError);
  }

  static badRequest(message = 'Bad request', details) {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }

  static validation(details, message = 'Validation failed') {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Insufficient permissions') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(entity = 'Resource') {
    return new AppError(404, 'NOT_FOUND', `${entity} not found`);
  }

  static conflict(code = 'CONFLICT', message = 'Value already exists') {
    return new AppError(409, code, message);
  }

  static insufficientPoints(message = 'Not enough points for this reward') {
    return new AppError(400, 'INSUFFICIENT_POINTS', message);
  }

  static outOfStock(message = 'Reward is out of stock') {
    return new AppError(409, 'OUT_OF_STOCK', message);
  }
}

module.exports = AppError;
