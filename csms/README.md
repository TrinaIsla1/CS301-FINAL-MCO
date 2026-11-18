# Class Schedule Management System (CSMS)

Website for managing subjects, instructors, rooms and class schedules.
React Native (Expo, web) + Node.js (Express) + Supabase (PostgreSQL and email auth).

## Roles

- **Admin:** controls the whole process: subjects, instructors, rooms, schedules, users, audit log.
- **Instructor:** sees their own published weekly timetable, next class, teaching load, and recent schedule changes, and can download it as a PDF.
- **Viewer / student:** sees the published timetable, subjects and rooms (read-only).

## Setup

1. **Supabase:** create a project. In _SQL Editor_, run `supabase/schema.sql`.
   In _Authentication > Providers > Email_, keep "Confirm email" turned on.
   In _Authentication > URL Configuration_, set the Site URL to your client URL (`http://localhost:8081` while developing).
2. **API:** `cd server && cp .env.example .env`, fill in your Supabase URL and service role key, then `npm install && npm run dev`.
3. **Client:** `cd client && cp .env.example .env`, fill in the API URL, Supabase URL and anon key, then `npm install && npx expo install --fix && npm run web`.
4. **First admin:** sign up in the app, verify your email, then run in the SQL editor:
   `update profiles set role = 'admin' where id = (select id from auth.users where email = 'YOU@EXAMPLE.COM');`
5. **Instructor logins:** add the instructor in the app, have them sign up with the same email, then run:
   `update instructors set user_id = (select id from auth.users where email = 'TEACHER@EXAMPLE.COM') where email = 'TEACHER@EXAMPLE.COM';`
   then set their role to `instructor` on the Users tab.

## What is built

- CRUD, search and sort for subjects, instructors, rooms and class schedules.
- Email sign-up with verification, sign-in and password reset (Supabase Auth).
- Conflict detection (room, instructor, section) in the API, backed by database exclusion constraints.
- One weekly timetable shared by all roles (Admin: everything, Instructor: own classes, Viewer: published classes).
- Phone layout: a three-line menu button in the top right corner holds all tabs, and the timetable becomes Mon to Sat day buttons with that day's classes.
- Dashboard counts and conflict alerts (unavailable rooms, instructors over their hour limit), audit log, role-based access (API and Row Level Security).
- Hooks: `useAuth`, `useResource`, `useDebounce`.

## Added in this version

- **Import CSV** (Admin dashboard): add many subjects, instructors or rooms at once. The first row of the file holds the column names.
- **Search** (Admin header): finds subjects, instructors and rooms, then opens that tab filtered.
- **Notification bell** (Admin): shows classes in unavailable rooms and instructors over their weekly hour limit.
- **My Availability** (Instructor): weekly times they can teach. The schedule builder rejects classes outside those times.
- **View by** on the Admin timetable, and filters above the class schedules table.

If you already ran `schema.sql` before this version, run `supabase/migration-002-availability.sql` once in the Supabase SQL Editor.

## Not built yet

Email notifications, soft delete and restore, real-time updates, CSV export.
