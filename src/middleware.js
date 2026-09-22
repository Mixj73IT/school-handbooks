'use strict';

const crypto = require('crypto');
const users = require('./users');

// Resolve the logged-in user from the session on every request and expose it
// to templates. This must set res.locals here — req.user is not yet resolved
// when the earlier locals middleware runs.
function attachUser(req, res, next) {
  if (req.session.userId) {
    req.user = users.findById(req.session.userId);
  }
  res.locals.user = req.user || null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/auth/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect('/auth/login');
  if (req.user.role !== 'admin') {
    return res.status(403).render('error', { title: 'Not allowed', message: 'Only administrators can do that.' });
  }
  next();
}

// Minimal CSRF defense: per-session token embedded in every form and checked
// on non-GET requests. Combined with SameSite=Lax cookies this blocks the
// realistic cross-site form-post attacks for an app like this.
function csrfInit(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(16).toString('hex');
  res.locals.csrf = req.session.csrf;
  next();
}

function csrfCheck(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.body && req.body._csrf === req.session.csrf) return next();
  res.status(403).render('error', { title: 'Session expired', message: 'Your form session expired. Please go back and try again.' });
}

module.exports = { attachUser, requireAuth, requireAdmin, csrfInit, csrfCheck };
