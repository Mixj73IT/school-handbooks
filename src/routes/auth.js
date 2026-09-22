'use strict';

const express = require('express');
const users = require('../users');
const { requireAuth } = require('../middleware');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/admin');
  res.render('auth/login', { title: 'Sign in', error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.verifyCredentials(username, password);
  if (!user) {
    return res.status(401).render('auth/login', { title: 'Sign in', error: 'Incorrect username or password.' });
  }
  req.session.userId = user.id;
  res.redirect('/admin');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

router.get('/password', requireAuth, (req, res) => {
  res.render('auth/password', { title: 'Change password', error: null, success: null });
});

router.post('/password', requireAuth, (req, res) => {
  const { current, next, confirm } = req.body;
  if (next !== confirm) {
    return res.status(400).render('auth/password', { title: 'Change password', error: 'New passwords do not match.', success: null });
  }
  try {
    users.changePassword(req.user.id, current, next);
    res.render('auth/password', { title: 'Change password', error: null, success: 'Password updated.' });
  } catch (err) {
    res.status(400).render('auth/password', { title: 'Change password', error: err.message, success: null });
  }
});

module.exports = router;
