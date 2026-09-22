'use strict';

// One-time seeding: creates users and sample handbook content only when the
// data directory is empty. Safe to run repeatedly (and on container boot).

const config = require('./config');
const content = require('./src/content');
const users = require('./src/users');

function existingUsers() {
  try {
    return require('fs').readFileSync(require('path').join(config.USERS_DIR, 'users.json'), 'utf8');
  } catch {
    return null;
  }
}

function main() {
  if (!existingUsers()) {
    const password = config.ADMIN_PASSWORD || require('crypto').randomBytes(9).toString('base64url');
    const admin = users.createUser({
      username: 'admin',
      name: 'Handbook Admin',
      password,
      role: 'admin',
    });
    users.createUser({ username: 'editor', name: 'Sample Editor', password: 'editor-pass-123', role: 'editor' });
    console.log('\n  Created admin user "admin" with password: ' + password);
    console.log('  (also created editor "editor" / "editor-pass-123" — change these before real use)\n');
    void admin;
  }

  const yearId = content.currentYearId();
  if (content.yearExists(yearId)) {
    console.log(`  Year ${yearId} already exists — content unchanged.`);
    return;
  }

  content.createYear(yearId, `${yearId} School Year`);
  const y = yearId;

  const pages = [
    ['parent-student', 'Welcome from the Head of School', 'welcome', `A warm welcome to the ${y} school year!

## Our mission

We partner with families to develop curious, compassionate, and courageous learners. Every policy in this handbook exists to keep our classrooms safe, joyful places to learn.

## How to use this handbook

- Search for any topic using the box at the top of every page.
- Sections are grouped logically — use the sidebar to jump around.
- Questions? Contact the front office at (555) 010-0100.

> Please review this handbook as a family during the first week of school.`],

    ['parent-student', 'Attendance & Absences', 'attendance', `Regular attendance is the strongest predictor of student success. School begins at **8:00 AM**; students arriving after 8:15 are marked tardy.

## Reporting an absence

1. Call the attendance line at (555) 010-0110 before 7:30 AM.
2. Include your student's name, grade, and reason.
3. Follow up with a written note within three days.

## Excused vs. unexcused

| Type | Examples |
| --- | --- |
| Excused | Illness, medical appointments, family emergency, religious observance |
| Unexcused | Oversleeping, transportation (non-bus), vacations during term |

## Extended absences

Families planning absences of **three or more days** must notify the division office two weeks in advance. Teachers are not required to prepare work in advance for unexcused travel.`],

    ['parent-student', 'Dress Code', 'dress-code', `Our dress code exists so students can focus on learning, not outfits.

## Daily dress

- Tops must have sleeves and cover the torso.
- Bottoms must reach mid-thigh or longer.
- Footwear must be closed-toe and secure.

## Spirit days

On announced spirit days, school-appropriate themed attire replaces the daily dress code.

## What happens if a student is out of dress code

1. First instance: gentle reminder and a change of clothes if needed.
2. Repeated instances: a conversation with the grade-level dean and a call home.`],

    ['employee', 'Employment Overview & At-Will Statement', 'employment-overview', `This handbook summarizes employment policies for all faculty and staff. It does **not** constitute a contract of employment.

## Employment categories

| Category | Definition |
| --- | --- |
| Full-time faculty | Instructional staff working 1.0 FTE |
| Part-time faculty | Instructional staff under 1.0 FTE |
| Staff | Non-instructional employees |

## Background checks

All employees complete background screening and safeguarding training **before** their first day, renewed every three years.`],

    ['employee', 'Leave & Time Off', 'leave', `## Sick leave

Full-time employees accrue **10 sick days** per year; unused days accrue up to 60.

## Personal leave

- 3 personal days per year, requested in the HR portal at least 48 hours ahead.
- Personal leave may not be taken on the first or last week of school without division-head approval.

## Family & medical leave

Employees may be eligible for FMLA leave consistent with federal law. Contact HR for details and eligibility.`],

    ['employee', 'Code of Conduct', 'code-of-conduct', `Employees are professionals and role models at all times on campus and in the community.

## Core expectations

1. Treat every student with dignity and patience.
2. Maintain appropriate boundaries — never be alone with a student behind a closed door.
3. Protect student privacy; student records and photos are confidential (FERPA).
4. Report suspected abuse or neglect immediately and directly to the Head of School.

## Social media

Personal accounts must not include current students as contacts. Public posts about school matters require communications-office approval.`],

    ['athletics', 'Philosophy & Participation', 'philosophy', `Athletics at our school are **educational**: every athlete competes, grows, and represents the community with class.

## No-cut policy

We keep every student who wants to play. Teams are balanced for development, with competitive placement by ability.

## Commitment

- Attend all practices and games; absences are communicated to coaches in advance.
- Academics come first — a student on academic support may be limited to one sport per season.`],

    ['athletics', 'Eligibility & Physicals', 'eligibility', `## Academic eligibility

Students must maintain a **2.0 GPA** with no more than one course below C-. Eligibility is checked at each interim and quarter end.

## Pre-participation physical

A current physical (valid 13 months) must be on file with the athletic trainer before the first practice. Forms are available in the front office or from the coach.

## Concussion protocol

Any suspected concussion removes the athlete from play immediately. Return-to-play requires written clearance from a licensed medical provider, following our five-step protocol.`],

    ['athletics', 'Transportation & Equipment', 'transportation', `## Team travel

- Athletes ride school transportation to and from away contests.
- A parent may sign their own student out after an event; students may **not** ride with other families without a signed travel release.

## Equipment

Issued uniforms and equipment are the athlete's responsibility. Loss or damage is billed at replacement cost. Return everything within one week of the season's end.`],
  ];

  for (const [handbookId, title, slug, body] of pages) {
    content.createPage(yearId, handbookId, { title, slug, body });
  }
  console.log(`  Seeded ${pages.length} sample pages into ${yearId}.`);
}

main();
