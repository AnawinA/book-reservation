'use strict';

/**
 * Wraps an async route handler so a rejected promise reaches Express' error pipeline.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
