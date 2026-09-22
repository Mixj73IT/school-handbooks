# School Handbooks — Complete Usage Documentation

Everything a staff member needs to run the handbook site day to day: reading it as a
parent, editing it as staff, and rolling it over each school year.

- [1. Concepts](#1-concepts)
- [2. First-time setup](#2-first-time-setup)
- [3. For parents: using the public site](#3-for-parents-using-the-public-site)
- [4. For staff: signing in](#4-for-staff-signing-in)
- [5. The admin dashboard](#5-the-admin-dashboard)
- [6. Writing and editing pages](#6-writing-and-editing-pages)
- [7. School years: the yearly workflow](#7-school-years-the-yearly-workflow)
- [8. Staff accounts and settings](#8-staff-accounts-and-settings)
- [9. Printing and exporting](#9-printing-and-exporting)
- [10. URL reference](#10-url-reference)
- [11. Backups and where content lives](#11-backups-and-where-content-lives)
- [12. Troubleshooting](#12-troubleshooting)
- [13. Configuration reference](#13-configuration-reference)

---

## 1. Concepts

Four ideas explain the whole system:

| Concept | What it is |
| --- | --- |
| **Handbook** | One of the three books: **Parent & Student**, **Employee**, **Athletics**. Each has its own table of contents and URL space. |
| **Page** | One section of a handbook — e.g. "Attendance & Absences". Written in markdown, ordered within the handbook. |
| **School year** | A complete snapshot of all three handbooks (e.g. `2026-2027`). Each year can be a **draft** (staff-only by navigation) or **published** (on the public site). |
| **Staff account** | A username + password for the admin area. Roles: `admin` (everything) and `editor` (see §4). |

Content is plain markdown files on disk under `data/` — no database. Back it up by
copying the folder.

---

## 2. First-time setup

```bash
npm install
npm run seed     # creates the admin user and sample content (first run only)
npm start        # serves http://localhost:4321
```

`npm run seed` prints a **generated password for the `admin` user** — copy it
somewhere safe. (Set `ADMIN_PASSWORD` before first run to choose your own.)

Sample content: 9 realistic pages across the three handbooks, so the site is never
empty. Replace or delete them as you write your real handbooks.

**Do this before real use:**

1. Sign in as `admin` and change the password (header → **Password**).
2. Delete or repurpose the sample `editor` / `editor-pass-123` account.
3. Set `SESSION_SECRET` (any long random string) so logins survive restarts — see §13.

---

## 3. For parents: using the public site

No account is needed. Parents land on the home page, which lists every handbook with
its sections and an **Open handbook →** button.

**Finding things**

- **Search** — the box in the header (and the big box on the home page). Searches all
  published handbooks for the selected school year. It matches partial words
  (typing "attend" finds "attendance"), and matches in titles rank first. Results show
  a highlighted excerpt so you can see the context before clicking.
- **Table of contents** — every handbook page shows the full sidebar list of that
  handbook's sections (the current one highlighted), plus an **"On this page"**
  outline linking to each heading within the page.
- **Year switcher** — the Year dropdown in the header. After August, last year's
  handbooks stay browsable here; the newest published year is shown by default.

**On a phone** the sidebar stacks above the article and scrolls away naturally;
nothing overlaps. The layout is checked automatically from 360px phones to 1280px
desktops.

**Paper copies** — see §9.

---

## 4. For staff: signing in

Sign in at **`/auth/login`** (the **Sign in** link in the header).

| Role | Can do |
| --- | --- |
| `admin` | Everything: edit pages, manage school years, manage staff accounts, school settings, export. |
| `editor` | Intended for content-only staff. **Current limitation:** the admin area requires an `admin` account, so an `editor` account can sign in but has no separate editing interface yet. Until that changes, give anyone who needs to edit pages the `admin` role. |

After signing in you land on the admin dashboard. Header links become
**Admin · Password · Sign out**.

**Change your password:** header → **Password** → enter current + new password twice.

Sessions last 12 hours (`SESSION_MAX_AGE_HOURS`).

---

## 5. The admin dashboard

`/admin` is one page with everything:

**Top left — three handbook cards.** Each card lists that handbook's pages in order,
with, per page:

- the **title** (click to edit),
- the public URL under it,
- **↑ ↓** to reorder (this changes the sidebar/table-of-contents order),
- **View** to open the live public page in a new tab,
- **Delete** (asks for confirmation — this cannot be undone),
- **+ New page** to add a section to that handbook.

**Right column — School years.** Every year with its status badge
(`published` / `draft`), and per year:

- **Publish / Unpublish** — the public-site switch (§7),
- **Duplicate → 2027-2028** — copies every page into the next year as a draft (§7),
- **×** — delete the year and all its pages (not available for the year you're
  currently working on; asks for confirmation),

plus a form to create a year from scratch.

**Working on (top right).** The year selector. Everything you edit applies to this
year. Switch here before making summer edits to next year's draft — it stays sticky
as you move around the admin area.

**Staff access.** Add staff accounts, change roles, remove people (§8).

**Settings & export.** School name for the header/footer, plus the print/PDF and
single-file export links for the working year (§9).

Every action confirms itself with a green banner telling you what happened and what
comes next; banners auto-dismiss after a few seconds.

---

## 6. Writing and editing pages

**Create:** dashboard → *+ New page* on the right handbook.
**Edit:** click the page title in the dashboard.

The editor has two columns.

### Left — the content

- **Page title** — required. Appears in the table of contents, search results,
  browser tab, and as the page's main heading.
- **Toolbar** — select text (or just place the cursor) and click:

| Button | What it does |
| --- | --- |
| **H2** | Section heading (shows in the "On this page" outline) |
| **H3** | Sub-heading (also in the outline) |
| **B** | **Bold** |
| *I* | *Italic* |
| • list | Bullet item |
| 1. list | Numbered item |
| ❝ | Block quote — good for pull-quote policy statements |
| table | Inserts a table skeleton you can fill in |
| 🔗 | Turns selected text into `[text](https://…)` |

- **Content** — the markdown body. The essentials:

```markdown
## Section heading          ← becomes a clickable anchor
**bold**  *italic*
- bullet        1. numbered
[link text](https://example.com)
![caption](https://example.com/photo.jpg)
> A quoted statement.
| Column | Column |
| --- | --- |
| cell | cell |
```

You never touch HTML. The public page updates the moment you save.

### Right — publishing

- **URL slug** — the page's address, e.g. `/handbook/parent-student/attendance`.
  Leave blank and it's generated from the title. Slugs must be **unique across all
  three handbooks within the year** (the form rejects duplicates). Keep slugs stable:
  they're what people bookmark and what search engines index. Renaming a page's title
  is fine; changing its slug changes its URL.
- **Position in handbook** — lower numbers appear first. Usually leave it blank
  (goes last) and use the dashboard's **↑ ↓** instead.
- **Save changes / Create page.**
- **Preview** — *Open public page ↗* to see exactly what parents will see.

---

## 7. School years: the yearly workflow

Each school year is a separate, complete set of handbooks. The intended rhythm:

**Spring — start next year**

1. Dashboard → *School years* → **Duplicate → 2027-2028**.
2. Every page is copied into the new year. The copy is a **draft**: it does not
   appear in the public year switcher or on the home page.

**Summer — revise**

3. Set **Working on** to the new draft year.
4. Edit pages, update dates and policies, add and delete sections, reorder — nothing
   you do affects what parents currently see.

**August — publish**

5. Click **Publish** on the new year. Parents immediately see it in the year
   switcher, and it becomes the default year for everyone. The previous year stays
   published and browsable via the switcher — old links keep working.

**Anytime**

- **Unpublish** pulls a year off the public site without deleting anything.
- **Create year** (instead of Duplicate) makes an empty year.
- **×** deletes a year and all its pages permanently.

**Two things worth knowing**

- Draft years are *hidden* from public navigation, not password-protected: anyone
  who knows (or guesses) a draft URL like `/handbook/athletics/eligibility?year=2027-2028`
  can view it. Don't put truly confidential material in a draft on the public site —
  keep that in a separate unpublished document until publishing.
- Search, home page, and handbooks all follow the visitor's selected year, which
  defaults to the newest **published** year.

---

## 8. Staff accounts and settings

*(Admin only.)* Dashboard → **Staff access**.

**Add a person:** full name, username, a temporary password (8+ characters), role →
**Create user**. Share the temporary password privately; the person should change it
via **Password** in the header after first sign-in.

**Change a role:** dropdown on the person's row → **Save**.
**Remove someone:** **×** on their row (you can't remove yourself, and the last
admin can't be deleted or demoted — the app blocks both).

**School name:** *Settings & export* → set the name shown in the header and footer.
Note: the value set here is for the running session; to persist it across restarts,
also set the `SCHOOL_NAME` environment variable (§13).

---

## 9. Printing and exporting

Three paper-friendly outputs, all for the **working year** chosen on the dashboard,
and only for **published** years:

| Where | What you get |
| --- | --- |
| **Print / PDF view** (`/print/<year>`) | All three handbooks on one web page with clean print styling. Use the browser's **Print → Save as PDF** to make the official PDF archive. |
| **Download single-file HTML** (`/export/<year>`) | The same thing as one portable `.html` file — open it anywhere, email it, or drop it in your website's archive folder. No server needed to read it. |
| **Any handbook page** | Parents (and you) can print a single section straight from the page — the print stylesheet strips navigation automatically. |

---

## 10. URL reference

| URL | What it is |
| --- | --- |
| `/` | Public home — handbook cards for the selected year |
| `/handbook/<handbook>` | First page of a handbook |
| `/handbook/<handbook>/<slug>` | A specific page |
| `/search?q=…` | Search results (add `&year=YYYY-YYYY` to target a year) |
| `/print/<year>` | Full-year print/PDF view (published years only) |
| `/export/<year>` | Single-file HTML download (published years only) |
| `/auth/login` · `/auth/password` | Sign in · change password |
| `/admin` | Dashboard (admin role) |
| `/admin/pages/<handbook>` | Page list for one handbook |
| `/api/health` | JSON health check for uptime monitors |

Handbook IDs: `parent-student`, `employee`, `athletics`.

---

## 11. Backups and where content lives

```
data/
  users/users.json                    # staff accounts (bcrypt-hashed passwords)
  years/
    2026-2027/
      settings.json                   # title, published, archived flags
      handbooks/
        parent-student/0001-xxxx.md   # one markdown file per page
        employee/0002-xxxx.md
        athletics/0001-xxxx.md
  export/                             # generated single-file exports
```

**To back up: copy the `data/` folder.** That's everything — accounts, pages, year
statuses. Restoring is copying it back. Because pages are plain markdown, you can
also diff them in git, sync them with your file server, or read them with any text
editor in an emergency.

The numeric filename prefix is the page's order; the dashboard's ↑↓ buttons manage
it for you.

---

## 12. Troubleshooting

**"Incorrect username or password"** — Passwords don't reset themselves. If the
admin password is truly lost: stop the app, delete `data/users/users.json`, run
`npm run seed` — a new admin password is printed and existing content is untouched.
(All staff accounts are recreated empty, so only do this if needed.)

**"Your form session expired"** — The form's security token went stale (long idle,
or the server restarted under a different `SESSION_SECRET`). Go back, reload the
page, and submit again. Setting a fixed `SESSION_SECRET` avoids the restart case.

**My changes aren't on the public site** — Three usual causes:
1. You edited a **draft** year while the public sees the published one — check the
   **Working on** selector and the year badges.
2. You're viewing the wrong **year** in the public header switcher.
3. The page you edited is fine but you're looking at a bookmarked **print/export**
   file — regenerate it (§9). (The live site always reflects saved pages instantly.)

**Publish did nothing visible** — Publish affects the *year switcher and home page*
for everyone; visitors who had an older year selected in their session keep seeing
it until they switch. New visitors get the newest published year.

**Forgot to change a slug but links are already circulating** — Re-set the slug to
the old value (it must be unique) or accept that the old link will 404. There is no
redirect table; avoid changing slugs after publishing.

**Page titles show odd characters in URLs** — Slugs are lowercased and
dashes-ified automatically; if you typed one by hand keep it to letters, numbers,
and dashes.

**Port 4321 already in use** — Start on another port: `PORT=5000 npm start`.

**Editor signed in but sees "Only administrators can do that"** — That's the §4
limitation: switch the account's role to `admin` on the dashboard.

**Something else** — check the server console; errors are logged there. In
production mode visitors see a generic message; in development they see the detail.

---

## 13. Configuration reference

All optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4321` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `./data` | Where all content and accounts live |
| `SESSION_SECRET` | random per start | **Set in production** — keeps logins working across restarts |
| `SESSION_MAX_AGE_HOURS` | `12` | Staff session lifetime |
| `ADMIN_PASSWORD` | random, printed once | Password for the seeded `admin` account (first run only) |
| `SCHOOL_NAME` | `Sample Private School` | Header/footer branding |
| `SITE_NAME` | `School Handbooks` | Secondary branding text |
| `NODE_ENV` | — | Set to `production` for secure session cookies |
| `COOKIE_INSECURE` | — | Set to `1` only when serving plain HTTP (local testing) |

**Production checklist:** fixed `SESSION_SECRET` · `NODE_ENV=production` · TLS at
your reverse proxy (nginx/Caddy) forwarding to the app port · `data/` on a backup
schedule · seeded passwords changed.

**Docker:** `SESSION_SECRET=… docker compose up -d --build` — content lives in the
`handbook-data` volume and survives rebuilds.

**Self-maintenance:** `npm test` (13 integration tests) and
`npm run audit:responsive` (layout checks at six device widths; needs local
Chrome/Edge) are safe to run anytime and never touch your `data/`.
