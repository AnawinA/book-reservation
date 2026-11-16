'use strict';

const { signAccessToken } = require('../../configs/jwt');

function cookieFor({ id = 1, role = 'Customer', shopId = null } = {}) {
  return `token=${signAccessToken({ id, role, shopId })}`;
}

function customerCookie(id = 5) {
  return cookieFor({ id, role: 'Customer', shopId: null });
}

function ownerCookie(shopId = 1, id = 2) {
  return cookieFor({ id, role: 'OwnerShop', shopId });
}

function adminCookie(id = 1) {
  return cookieFor({ id, role: 'Admin', shopId: null });
}

module.exports = { cookieFor, customerCookie, ownerCookie, adminCookie };
