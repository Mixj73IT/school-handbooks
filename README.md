# School Handbooks

Self-hosted handbook publishing for a private K-12 school. Maintain three
handbooks — **Parent & Student**, **Employee**, and **Athletics** — with
markdown editing, a live clickable table of contents, full-text search, and
per-school-year versioning. Parents read a clean, searchable, read-only site;
staff sign in to edit.

No database, no build step: content is plain markdown files on disk, so it
backs up, syncs, and diffs like any other file.

> 📖 **Complete usage documentation for staff lives in [docs/USAGE.md](docs/USAGE.md)**
> — the parent-facing site, the editor, the school-year workflow, accounts,
> printing/export, troubleshooting, and configuration.

## Quick start

```bash
npm install
npm run seed        # creates users + sample content on first run
npm start           # http://localhost:4321
```

The first `npm run seed` prints a generated password for the `admin` user
(override with `ADMIN_PASSWORD` before first run). A sample `editor` user is
also created — change or remove both before real use.

## Features

- **Three handbooks** (parent/student, employee, athletics), each a separate
  section with its own table of contents and public URL space
- **Markdown editor** with a formatting toolbar (headings, bold/italic,
  lists, quotes, tables, links) — no HTML required
- **Live clickable TOC** in the sidebar plus an "on this page" outline with
  anchored headings on long pages
- **Full-text search** across all handbooks with highlighted excerpts,
  prefix matching ("attend" finds "attendance"), and title boosting
- **School-year versioning** — duplicate this year into next, edit over the
  summer as a draft, then flip it to published. Old years stay browsable.
- **Public read-only site** for parents — no accounts, mobile friendly,
  print stylesheet, and a one-file HTML export for offline/PDF archiving
- **Staff roles** — `admin` manages users, years, and settings; `editor`
  writes content
- **Durable storage** — every page is a markdown file under `data/`; back it
  up by copying the folder

## How content is stored

```
data/
  users/users.json                      # staff accounts (bcrypt hashes)
  years/
    2026-2027/
      settings.json                     # title, published, archived
      handbooks/
        parent-student/0001-<id>.md     # one file per page
        employee/0002-<id>.md
        athletics/0001-<id>.md
```

Each page file is markdown with a two-line front matter (title, slug). The
slug is unique across the whole year and drives the public URL
(`/handbook/athletics/eligibility`), so links stay stable. Ordering is a
numeric prefix on the filename; the dashboard's ↑↓ buttons swap it for you.

## Year workflow

1. In spring, open the dashboard and click **Duplicate → 2027-2028**.
2. The copy starts **unpublished** — only staff can preview it.
3. Edit pages all summer (add, reorder, rewrite).
4. In August, click **Publish**. Parents immediately see the new year; the
   old year remains available via the year switcher in the header.

## Configuration (environment variables)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4321` | HTTP port |
| `DATA_DIR` | `./data` | Where all content lives |
| `SESSION_SECRET` | random | Set this in production for stable logins |
| `SESSION_MAX_AGE_HOURS` | `12` | Admin session lifetime |
| `ADMIN_PASSWORD` | random | Seed password for the first admin |
| `SCHOOL_NAME` / `SITE_NAME` | sample values | Header branding |

## Deployment

### Docker

```bash
SESSION_SECRET=some-long-random-string docker compose up -d --build
```

The compose file mounts a `handbook-data` volume, so content survives
rebuilds. Behind a reverse proxy, terminate TLS there and forward to :4321.

### Bare Node

```bash
npm ci --omit=dev
SESSION_SECRET=... PORT=80 node src/server.js
```

Run behind nginx/Apache with TLS for anything internet-facing. Set
`NODE_ENV=production` to enable the secure session cookie (or
`COOKIE_INSECURE=1` if you must serve plain HTTP).

## Development

```bash
npm run dev                # restart on file changes
npm test                   # 13 integration tests (public, admin, search, years)
npm run audit:responsive   # layout audit at 6 device widths (needs local Chrome/Edge)
```

Tests use a throwaway data directory and do not touch `./data`.

The responsive audit drives headless Chrome over puppeteer-core and checks
every key page (public + admin, logged in) at 360–1280px for horizontal
overflow, offending elements, and sticky-sidebar regressions. It exits 1 if
any problem is found, so it can gate CI. Set `AUDIT_ADMIN_PASS` to include
the admin area, `BROWSER_PATH` for a non-standard browser location.

## Project layout

```
config.js              env-driven settings, path bootstrap
seed.js                idempotent first-run seeding
src/server.js          express app + middleware wiring
src/content.js         markdown content store, year mgmt, HTML export
src/search.js          in-memory inverted-index search
src/users.js           user store, bcrypt auth
src/middleware.js      auth guards + CSRF
src/routes/            public, auth, admin routers
views/                 EJS templates (public site + admin)
public/                css and the editor toolbar script
test/app.test.js       node:test integration suite
```
