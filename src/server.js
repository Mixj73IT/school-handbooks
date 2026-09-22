'use strict';

const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('../config');
const content = require('./content');
const { attachUser, csrfInit, requireAdmin } = require('./middleware');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.disable('x-powered-by');

// Sensible hardening headers for a public-facing site. CSP allows only our
// own scripts and styles; styles are permitted inline for the export view.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'self'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(
  session({
    name: 'handbooks.sid',
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: config.SESSION_MAX_AGE_MS,
      secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== '1',
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(csrfInit);

// Everything the templates need, on every render.
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.schoolName = config.SCHOOL_NAME;
  res.locals.siteName = config.SITE_NAME;
  res.locals.currentYear = content.getYear(req.session.yearId) || null;
  res.locals.query = typeof req.query.q === 'string' ? req.query.q : '';
  res.locals.params = req.query;
  next();
});
app.use(attachUser);

// Health endpoint for Docker/uptime monitors.
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/', require('./routes/public'));
app.use('/auth', require('./routes/auth'));
app.use('/admin', requireAdmin, require('./routes/admin'));

// Exported for tests; listens only when run directly (node src/server.js).
if (require.main === module) {
  app.listen(config.PORT, config.HOST, () => {
    console.log(`${config.SITE_NAME} running at http://localhost:${config.PORT}`);
  });
}

// 404
app.use((req, res) => {
  res.status(404).render('error', { title: 'Page not found', message: 'The page you are looking for does not exist.' });
});

// 500
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : String(err.message || err),
  });
});

module.exports = { app };
