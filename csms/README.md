# Class Schedule Management System (CSMS)

Website for managing subjects, instructors, rooms and class schedules.
React Native (Expo, web) + Node.js (Express) + Supabase (PostgreSQL and email auth).

## Roles

- **Admin:** controls the whole process: student roster, sections, subjects, instructors, rooms, schedules, users, audit log.
- **Instructor:** sees only their own published classes (weekly timetable, next class, teaching load) and can download a PDF.
- **Student:** sees only the published schedule of their own section, tied to their verified student record.
- **Not linked** (the database role is still `viewer`): signed up and verified an email, but not linked to a student record yet. Sees nothing except the "Link student record" screen.

Three sign-in entry points (Student, Instructor, Admin) use the same Supabase Auth. The role stored on the server decides which dashboard opens, so picking the wrong entry point grants nothing.

## Setup

1. **Supabase:** create a project. In _SQL Editor_, run `supabase/schema.sql`, then `migration-002-availability.sql` if your schema predates it, then **`migration-003-student-identification.sql`** (always before deploying this version of the code).
   In _Authentication > Providers > Email_, keep "Confirm email" turned on.
   In _Authentication > URL Configuration_, set the Site URL to your client URL (`http://localhost:8081` while developing) and add it to the Redirect URLs. Invitation and password-reset links return there.
2. **API:** `cd server && cp .env.example .env`, fill in your Supabase URL and service role key, then `npm install && npm run dev`. Behind a reverse proxy, set `TRUST_PROXY=1`.
3. **Client:** `cd client && cp .env.example .env`, fill in the API URL, Supabase URL and publishable key, then `npm install && npx expo install --fix && npm run web`.
4. **First admin:** public sign-up can no longer create staff. In the Supabase dashboard open _Authentication > Users > Add user_ (tick "Auto Confirm User"), then run in the SQL editor:
   `update profiles set role = 'admin' where id = (select id from auth.users where email = 'YOU@EXAMPLE.COM');`
5. **More admins and instructors:** add the instructor in the Instructors tab, then Users > **Invite user**. They get an email, choose a password, and sign in through the Instructor or Admin entry point. For real use, configure a custom SMTP server in Supabase (the built-in one allows only a few emails per hour).
6. **Students:** Students tab > **Import roster (CSV)**. Columns: `student_number, full_name, email (optional), course, year_level, section`. Headers such as "Student number" and "Student name" also work. Excel: Save As, CSV UTF-8.

## How a student gets an account

1. The registrar's roster is imported (or students are added one by one). This list is the source of truth.
2. On the Student sign-in screen the student chooses "create an account" and enters name, student number, school email and a password. The server checks the number and email against the roster before the account is created.
3. If the roster has no email for that student, the admin clicks **Issue code** on the Students tab and gives the student the one-time code (valid 14 days, five wrong tries lock it).
4. The student verifies their email with the code Supabase sends.
5. The server links the verified account to that one roster record (one account per student, one student per account) and the student's schedule opens. The link is decided in the database function `claim_student`, using the verified email from the sign-in token, never values typed in the browser.
6. Admins can **Unlink** an account (for example a wrong match); the student can then link again.

Students already registered under the old version are "not linked" until they enter their student number once.

## Decisions to confirm (plan section 10)

- Schedules are **section-based**: every student in a section sees that section's schedule. Individual or irregular student schedules are not supported.
- Roster format is **CSV**.
- Verification uses the **roster school email**, with an **admin-issued code** for students who have none on file.
- Frontend stays **React Native (Expo)**.

## What is built

- CRUD, search and sort for students, sections, subjects, instructors, rooms and class schedules.
- Roster-based student registration, email verification, sign-in and password reset (Supabase Auth).
- Admin-controlled instructor and admin accounts (invitation email, then the user chooses a password).
- Conflict detection (room, instructor, section) in the API, backed by database exclusion constraints.
- Row Level Security and API checks so each role reads only its own data. Students cannot read other students, other sections, the roster, instructors' contact details, or unpublished drafts.
- Phone layout: a three-line menu button holds all tabs; the timetable becomes Mon to Sat day buttons.
- Dashboard counts and conflict alerts, audit log (roster imports, code issuing, claims, unlinking and invitations are logged; codes themselves never are).
- Import CSV (Admin) for students, subjects, instructors and rooms; Search; notification bell; instructor availability.

## Tests

`cd server && npm test` runs helper tests and an end-to-end API test against an in-memory fake of Supabase. It covers wrong email, duplicate claims, locked codes, staff trying to claim, unauthorized reads, schedule scoping and roster import. It does not execute the SQL migration; test that on a copy of your project first (see the checks at the bottom of the migration file).

## Not built yet

Email notifications, soft delete and restore, real-time updates, CSV export, bulk issuing of registration codes, individual (non-section) student schedules.
