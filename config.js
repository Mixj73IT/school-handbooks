'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const EXPORT_DIR = process.env.EXPORT_DIR || path.join(DATA_DIR, 'export');

for (const dir of [DATA_DIR, path.join(DATA_DIR, 'users'), path.join(DATA_DIR, 'years'), EXPORT_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

module.exports = {
  ROOT,
  DATA_DIR,
  EXPORT_DIR,
  USERS_DIR: path.join(DATA_DIR, 'users'),
  YEARS_DIR: path.join(DATA_DIR, 'years'),
  PORT: parseInt(process.env.PORT, 10) || 4321,
  HOST: process.env.HOST || '0.0.0.0',
  // Change this via SESSION_SECRET env var in production. A random fallback keeps
  // a default install from sharing one well-known secret.
  SESSION_SECRET: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  SESSION_MAX_AGE_MS: parseInt(process.env.SESSION_MAX_AGE_HOURS || '12', 10) * 3600 * 1000,
  SCHOOL_NAME: process.env.SCHOOL_NAME || 'Sample Private School',
  SITE_NAME: process.env.SITE_NAME || 'School Handbooks',
  // Seed admin password. ADMIN_PASSWORD env var wins; otherwise a random password
  // is printed to the console by seed.js so it is never committed to disk.
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || null,
  // Truncate long search extracts so results stay scannable.
  SEARCH_EXCERPT_CHARS: 220,
};
