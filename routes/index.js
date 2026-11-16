'use strict';

const authRoutes = require('./authRoutes');
const publicRoutes = require('./publicRoutes');
const customerRoutes = require('./customerRoutes');
const ownerShopRoutes = require('./ownerShopRoutes');
const adminRoutes = require('./adminRoutes');
const { attachUser } = require('../middlewares/authMiddleware');

/**
 * Single place where every router is mounted, in an explicit order:
 * the global optional-auth middleware first, then the role routers, then the
 * public router (whose generic paths must come last).
 */
function registerRoutes(app) {
  app.use(attachUser);

  app.use(authRoutes);
  app.use(customerRoutes);
  app.use(ownerShopRoutes);
  app.use(adminRoutes);
  app.use(publicRoutes);
}

module.exports = { registerRoutes };
