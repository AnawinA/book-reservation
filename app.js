'use strict';

const path = require('path');
const os = require('os');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const config = require('./configs/env');
const db = require('./configs/db');
const { registerRoutes } = require('./routes');
const asyncHandler = require('./utils/asyncHandler');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
});

/** Renders a stored UTC timestamp as e.g. "09 Nov 2026" for the EJS tables. */
function formatDate(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : DATE_FORMAT.format(date);
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(helmet());

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use(
    express.static(path.join(__dirname, 'public'), {
      maxAge: config.isProd ? '1d' : 0
    })
  );

  app.use((req, res, next) => {
    res.locals.currentUser = null;
    res.locals.currentPath = req.path;
    res.locals.formatDate = formatDate;
    next();
  });

  app.get(
    '/api/health',
    asyncHandler(async (req, res) => {
      const dbUp = await db.ping();
      const payload = {
        status: dbUp ? 'ok' : 'degraded',
        db: dbUp ? 'up' : 'down',
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        freeMem: os.freemem(),
        totalMem: os.totalmem(),
        processUptime: process.uptime(),
        nodeVersion: process.version
      };

      if (!dbUp) {
        return res.status(500).json({
          success: false,
          data: payload,
          error: { code: 'INTERNAL_ERROR', message: 'Database is unreachable' }
        });
      }
      return res.status(200).json({ success: true, data: payload });
    })
  );

  registerRoutes(app);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
