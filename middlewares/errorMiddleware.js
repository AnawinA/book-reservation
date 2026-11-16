'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../configs/env');
const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(AppError.notFound('Route'));
}

function normalizeError(err) {
  if (err instanceof AppError) return err;

  const mysqlCode = err && err.code;
  if (mysqlCode === 'ER_DUP_ENTRY') {
    return new AppError(409, 'CONFLICT', 'Value already exists');
  }
  if (mysqlCode === 'ER_NO_REFERENCED_ROW_2' || mysqlCode === 'ER_NO_REFERENCED_ROW') {
    return new AppError(400, 'VALIDATION_ERROR', 'Referenced record does not exist');
  }
  if (mysqlCode === 'ER_ROW_IS_REFERENCED_2' || mysqlCode === 'ER_ROW_IS_REFERENCED') {
    return new AppError(409, 'CONFLICT', 'Record is still referenced by other data');
  }
  if (err && err.type === 'entity.parse.failed') {
    return new AppError(400, 'VALIDATION_ERROR', 'Malformed JSON body');
  }
  if (err && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || err.name === 'NotBeforeError')) {
    return new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  if (err && err.name === 'ValidationError') {
    return new AppError(400, 'VALIDATION_ERROR', err.message);
  }
  return new AppError(500, 'INTERNAL_ERROR', (err && err.message) || 'Internal server error');
}

function logServerError(err, req) {
  if (config.isTest) return;
  const line = [
    new Date().toISOString(),
    req.method,
    req.originalUrl,
    (err && err.stack) || String(err)
  ].join(' | ') + '\n';
  fs.promises
    .mkdir(path.join(__dirname, '..', 'logs'), { recursive: true })
    .then(() => fs.promises.appendFile(path.join(__dirname, '..', 'logs', 'error.log'), line))
    .catch(() => {});
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const appError = normalizeError(err);
  let { statusCode, code, message, details } = appError;

  if (statusCode >= 500) {
    logServerError(err, req);
    if (config.isProd) message = 'Internal server error';
  }

  const isApi = String(req.originalUrl || req.url || '').startsWith('/api');
  const wantsHtml = typeof req.accepts === 'function' ? req.accepts('html') : false;

  if (isApi || !wantsHtml) {
    const body = { success: false, error: { code, message } };
    if (details && details.length) body.error.details = details;
    return res.status(statusCode).json(body);
  }

  return res.status(statusCode).render('pages/error', {
    title: 'Error',
    statusCode,
    message,
    pageScript: null,
    currentUser: (res.locals && res.locals.currentUser) || null
  });
}

module.exports = { notFound, errorHandler };
