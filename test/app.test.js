'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(require('os').tmpdir(), 'handbooks-test-'));
process.env.ADMIN_PASSWORD = 'test-admin-pass-123';
process.env.SESSION_SECRET = 'test-secret';

const config = require('../config');
const content = require('../src/content');
const users = require('../src/users');
require('../seed.js');
const { app } = require('../src/server');

// EJS escapes "&" in HTML, so assert against the escaped form.
const NAMES = {
  parent: 'Parent &amp; Student Handbook',
  employee: 'Employee Handbook',
  athletics: 'Athletics Handbook',
};

let server;
let baseUrl;
let adminCookie;
let csrfToken;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

async function get(pathname, headers = {}) {
  const res = await fetch(baseUrl + pathname, { redirect: 'manual', headers });
  return { status: res.status, text: await res.text(), headers: res.headers };
}

async function post(pathname, body, headers = {}) {
  const res = await fetch(baseUrl + pathname, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(body).toString(),
  });
  return { status: res.status, text: await res.text(), headers: res.headers };
}

function cookieFrom(res) {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

// One-time admin login; caches the session cookie and a CSRF token.
async function loginAdmin() {
  if (adminCookie) return;
  const login = await post('/auth/login', { username: 'admin', password: 'test-admin-pass-123' });
  assert.equal(login.status, 302);
  adminCookie = cookieFrom(login);
  const page = await get('/admin/pages/athletics/new', { cookie: adminCookie });
  const m = page.text.match(/name="_csrf" value="([0-9a-f]+)"/);
  assert.ok(m, 'admin form should contain a CSRF token');
  csrfToken = m[1];
}

// POST to an admin route with the session cookie and CSRF token attached.
async function postAdmin(pathname, body) {
  await loginAdmin();
  return post(pathname, { ...body, _csrf: csrfToken }, { cookie: adminCookie });
}

test('seed created users and sample content', () => {
  assert.ok(users.findByUsername('admin'));
  assert.ok(users.findByUsername('editor'));
  const yearId = content.currentYearId();
  assert.ok(content.listPages(yearId, 'parent-student').length >= 3);
  assert.ok(content.listPages(yearId, 'employee').length >= 3);
  assert.ok(content.listPages(yearId, 'athletics').length >= 3);
});

test('public home lists all three handbooks', async () => {
  const { status, text } = await get('/');
  assert.equal(status, 200);
  for (const name of Object.values(NAMES)) {
    assert.ok(text.includes(name), `home should mention ${name}`);
  }
});

test('public page renders markdown with heading anchors and TOC', async () => {
  const { status, text } = await get('/handbook/parent-student/attendance');
  assert.equal(status, 200);
  assert.ok(text.includes('Reporting an absence'));
  assert.ok(text.includes('id="reporting-an-absence"'), 'headings should get anchor ids');
  assert.ok(text.includes('On this page'), 'sidebar should show page outline');
});

test('slug collisions across handbooks are rejected', () => {
  const yearId = content.currentYearId();
  assert.throws(() => content.createPage(yearId, 'employee', { title: 'Attendance', slug: 'attendance', body: 'x' }));
});

test('search finds pages by keyword with highlighting', async () => {
  const { status, text } = await get('/search?q=concussion');
  assert.equal(status, 200);
  assert.ok(text.includes('Eligibility'));
  assert.ok(text.includes('<mark>concussion</mark>'), 'terms should be highlighted');
});

test('search with no query shows empty state', async () => {
  const { status } = await get('/search');
  assert.equal(status, 200);
});

test('admin area requires login', async () => {
  const res = await get('/admin');
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').startsWith('/auth/login'));
});

test('login works and admin dashboard loads', async () => {
  await loginAdmin();
  const dash = await get('/admin', { cookie: adminCookie });
  assert.equal(dash.status, 200);
  assert.ok(dash.text.includes('Handbook dashboard'));
  assert.ok(dash.text.includes('Staff access'));
});

test('admin can create, update, move, and delete a page', async () => {
  const yearId = content.currentYearId();

  const created = await postAdmin('/admin/pages/athletics/new', {
    title: 'Test Sportsmanship',
    slug: '',
    body: '## Be kind\nPlay hard.',
  });
  assert.equal(created.status, 302);

  const page = content.getPageBySlug(yearId, 'test-sportsmanship');
  assert.ok(page, 'page should exist after creation');
  assert.equal(page.slug, 'test-sportsmanship', 'slug should be generated from title');

  const updated = await postAdmin(`/admin/pages/athletics/${page.id}/edit`, {
    title: 'Sportsmanship Policy',
    slug: 'sportsmanship',
    body: 'Updated body.',
  });
  assert.equal(updated.status, 302);
  const updatedPage = content.getPage(yearId, 'athletics', page.id);
  assert.equal(updatedPage.slug, 'sportsmanship');
  assert.equal(updatedPage.body, 'Updated body.');

  const moved = await postAdmin(`/admin/pages/athletics/${page.id}/move`, { direction: 'up' });
  assert.equal(moved.status, 302);

  const deleted = await postAdmin(`/admin/pages/athletics/${page.id}/delete`, {});
  assert.equal(deleted.status, 302);
  assert.equal(content.getPage(yearId, 'athletics', page.id), null);
});

test('duplicate year copies pages and starts unpublished', () => {
  const source = content.currentYearId();
  const target = '2030-2031';
  const copy = content.duplicateYear(source, target);
  assert.equal(copy.published, false);
  const original = content.listPages(source, 'parent-student').length;
  assert.equal(content.listPages(target, 'parent-student').length, original, 'pages should be copied');
  assert.ok(content.listPages(target, 'employee').length > 0);
  content.deleteYear(target);
});

test('print export contains all handbooks', async () => {
  const { status, text } = await get(`/print/${content.currentYearId()}`);
  assert.equal(status, 200);
  for (const name of Object.values(NAMES)) {
    assert.ok(text.includes(name), `print view should include ${name}`);
  }
});

test('CSRF blocks forged posts from a logged-in session', async () => {
  await loginAdmin();
  const res = await post('/admin/years', { yearId: '2099-2100' }, { cookie: adminCookie });
  assert.equal(res.status, 403);
});

test('editor role cannot open admin area', async () => {
  const login = await post('/auth/login', { username: 'editor', password: 'editor-pass-123' });
  const cookie = cookieFrom(login);
  const res = await get('/admin', { cookie });
  assert.equal(res.status, 403);
  void config;
});
