-- =====================================================================
-- CSMS migration 003: student identification and role-based access
-- Implements "Student Identification & Class Schedule System" plan.
--
-- Run ONCE in Supabase > SQL Editor, BEFORE deploying the new server and
-- client code. It is safe to run again (every statement is idempotent).
--
-- Part A  data model     sections, students (roster), schedules.section_id,
--                        instructors.employee_number, profiles.email, 'student' role
-- Part B  server logic   claim_student() and the role-protection trigger
-- Part C  security       Row Level Security rebuilt for every app table
--
-- NOTE ON PART C: it DROPS every existing policy on the tables listed there
-- and recreates a known set. The app itself is not affected, because the API
-- uses the service-role key, which bypasses RLS. Skip Part C only if you
-- manage those policies yourself, and then review them against the plan.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- "BSIT  3a " and "bsit 3A" are the same section.
create or replace function public.csms_norm_name(t text)
returns text language sql immutable as $$
  select lower(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')))
$$;

-- The role of the signed-in user ('admin', 'instructor', 'student', 'viewer').
create or replace function public.csms_role()
returns text language sql stable security definer set search_path = public as $$
  select role::text from public.profiles where id = auth.uid()
$$;

-- The Postgres role the current API request runs as:
-- 'authenticated' / 'anon' for browser tokens, 'service_role' for the server,
-- NULL in the SQL Editor.
create or replace function public.csms_request_role()
returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role', '')
  )
$$;


-- ---------------------------------------------------------------------
-- PART A. Data model
-- ---------------------------------------------------------------------

-- A1. Add the 'student' role. 'viewer' stays and now means:
--     "signed up and verified an email, but not linked to a student record yet".
--     A viewer has no access to any schedule data.
do $$
declare
  v_type text;
  v_udt  text;
  c      record;
begin
  select data_type, udt_name into v_type, v_udt
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'role';

  if v_type = 'USER-DEFINED' then
    -- role is an enum type
    execute format('alter type public.%I add value if not exists %L', v_udt, 'student');
  else
    -- role is text with a CHECK constraint: replace it
    for c in
      select conname from pg_constraint
      where conrelid = 'public.profiles'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%role%'
    loop
      execute format('alter table public.profiles drop constraint %I', c.conname);
    end loop;
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'instructor', 'student', 'viewer'));
  end if;
end $$;

-- A2. profiles.email (plan section 4)
alter table public.profiles add column if not exists email text;

update public.profiles p
   set email = lower(u.email)
  from auth.users u
 where u.id = p.id and p.email is null;

create or replace function public.csms_profiles_fill_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null then
    select lower(email) into new.email from auth.users where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists csms_profiles_fill_email on public.profiles;
create trigger csms_profiles_fill_email
  before insert on public.profiles
  for each row execute function public.csms_profiles_fill_email();

-- A3. sections
create table if not exists public.sections (
  id           uuid primary key default gen_random_uuid(),
  section_name text not null,
  course       text,
  year_level   int  check (year_level is null or year_level between 1 and 10),
  created_at   timestamptz not null default now(),
  constraint sections_name_not_blank check (btrim(section_name) <> '')
);
create unique index if not exists sections_name_key
  on public.sections (public.csms_norm_name(section_name));

create or replace function public.csms_sections_normalize()
returns trigger language plpgsql as $$
begin
  new.section_name := btrim(regexp_replace(new.section_name, '\s+', ' ', 'g'));
  return new;
end $$;

drop trigger if exists csms_sections_normalize on public.sections;
create trigger csms_sections_normalize
  before insert or update of section_name on public.sections
  for each row execute function public.csms_sections_normalize();

-- A4. schedules.section_id (foreign key) next to the existing text column.
--     The text column stays because conflict detection and your existing
--     exclusion constraints use it. A trigger keeps it equal to the section's name.
alter table public.schedules
  add column if not exists section_id uuid references public.sections(id) on delete restrict;
create index if not exists schedules_section_id_idx on public.schedules (section_id);

-- Turn every section name already used by a schedule into a sections row...
insert into public.sections (section_name)
select distinct on (public.csms_norm_name(section)) btrim(regexp_replace(section, '\s+', ' ', 'g'))
  from public.schedules
 where section is not null and btrim(section) <> ''
on conflict do nothing;

-- ...and point those schedules at it.
update public.schedules s
   set section_id = sec.id
  from public.sections sec
 where s.section_id is null
   and public.csms_norm_name(s.section) = public.csms_norm_name(sec.section_name);

create or replace function public.csms_sync_schedule_section()
returns trigger language plpgsql as $$
begin
  if new.section_id is not null then
    select section_name into new.section from public.sections where id = new.section_id;
  end if;
  return new;
end $$;

drop trigger if exists csms_sync_schedule_section on public.schedules;
create trigger csms_sync_schedule_section
  before insert or update on public.schedules
  for each row execute function public.csms_sync_schedule_section();

-- Renaming a section updates the text on its schedules.
create or replace function public.csms_propagate_section_rename()
returns trigger language plpgsql as $$
begin
  if new.section_name is distinct from old.section_name then
    update public.schedules set section = new.section_name where section_id = new.id;
  end if;
  return null;
end $$;

drop trigger if exists csms_propagate_section_rename on public.sections;
create trigger csms_propagate_section_rename
  after update of section_name on public.sections
  for each row execute function public.csms_propagate_section_rename();

-- A5. students: the official roster. A row exists BEFORE the student has an
--     account; profile_id stays NULL until the student claims it.
create table if not exists public.students (
  id                     uuid primary key default gen_random_uuid(),
  student_number         text not null,
  full_name              text not null,
  email                  text,                       -- school email from the roster, if any
  course                 text,
  year_level             int  check (year_level is null or year_level between 1 and 10),
  section_id             uuid references public.sections(id) on delete restrict,
  profile_id             uuid unique references public.profiles(id) on delete set null,
  claim_code_hash        text,                       -- SHA-256 of an admin-issued code (roster rows with no email)
  claim_code_expires_at  timestamptz,
  claim_failed_attempts  int not null default 0,
  claimed_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint students_student_number_key unique (student_number),
  constraint students_number_not_blank   check (btrim(student_number) <> ''),
  constraint students_name_not_blank     check (btrim(full_name) <> '')
);
create index if not exists students_section_id_idx on public.students (section_id);
-- Two roster rows must never share an email, or one mailbox could claim both.
create unique index if not exists students_email_key
  on public.students (email) where email is not null;

create or replace function public.csms_students_normalize()
returns trigger language plpgsql as $$
begin
  new.student_number := upper(btrim(new.student_number));
  new.full_name      := btrim(regexp_replace(new.full_name, '\s+', ' ', 'g'));
  new.email          := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.updated_at     := now();
  return new;
end $$;

drop trigger if exists csms_students_normalize on public.students;
create trigger csms_students_normalize
  before insert or update on public.students
  for each row execute function public.csms_students_normalize();

-- A6. instructors: employee number, and one login per instructor record.
alter table public.instructors add column if not exists employee_number text;
create unique index if not exists instructors_employee_number_key
  on public.instructors (employee_number) where employee_number is not null;

do $$
begin
  if exists (
    select 1 from public.instructors where user_id is not null
    group by user_id having count(*) > 1
  ) then
    raise notice 'instructors.user_id has duplicates, so the unique index was skipped. Fix them, then run this migration again.';
  else
    create unique index if not exists instructors_user_id_key
      on public.instructors (user_id) where user_id is not null;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- PART B. Trusted server-side logic
-- ---------------------------------------------------------------------

-- B1. Role protection: nobody can change a role with a browser token, not
--     even their own. Roles change only through the API (service role) or
--     the SQL Editor.
create or replace function public.csms_guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and coalesce(public.csms_request_role(), '') in ('anon', 'authenticated') then
    raise exception 'Roles can only be changed by an administrator through the server.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists csms_guard_profile_role on public.profiles;
create trigger csms_guard_profile_role
  before update of role on public.profiles
  for each row execute function public.csms_guard_profile_role();

-- B2. claim_student(): links a verified Supabase account to ONE roster row.
--
--   * Called only by the API (service role), with the user id and email taken
--     from the verified token, never from the request body.
--   * Roster row has an email  -> the account's verified email must match it.
--   * Roster row has no email  -> an admin-issued, expiring code is required
--                                 (5 wrong tries lock the code).
--   * Check + link run in one transaction with the row locked, so two people
--     cannot claim the same student at the same time.
--   * Returns a status text instead of raising, so the failed-attempt counter
--     is saved.
create or replace function public.claim_student(
  p_user_id        uuid,
  p_email          text,
  p_student_number text,
  p_code_hash      text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  s       public.students%rowtype;
begin
  select role::text into v_role from public.profiles where id = p_user_id;
  if v_role is null then return 'no_profile'; end if;
  if v_role not in ('viewer', 'student') then return 'wrong_role'; end if;

  select * into s
    from public.students
   where student_number = upper(btrim(coalesce(p_student_number, '')))
   for update;
  if not found then return 'not_found'; end if;

  -- Already linked to this very account: nothing to do.
  if s.profile_id = p_user_id then return 'ok'; end if;

  -- Prove identity.
  if s.email is not null then
    if v_email = '' or v_email <> s.email then return 'email_mismatch'; end if;
  else
    if s.claim_code_hash is null then return 'no_code_issued'; end if;
    if p_code_hash is null then return 'code_required'; end if;
    if s.claim_failed_attempts >= 5 then return 'locked'; end if;
    if s.claim_code_expires_at is not null and s.claim_code_expires_at < now() then
      return 'code_expired';
    end if;
    if p_code_hash <> s.claim_code_hash then
      update public.students
         set claim_failed_attempts = claim_failed_attempts + 1
       where id = s.id;
      return 'bad_code';
    end if;
  end if;

  -- Identity proven. One record per account, one account per record.
  if s.profile_id is not null then return 'taken'; end if;
  if exists (select 1 from public.students where profile_id = p_user_id) then
    return 'already_linked';
  end if;

  update public.students
     set profile_id = p_user_id,
         claimed_at = now(),
         claim_code_hash = null,
         claim_code_expires_at = null,
         claim_failed_attempts = 0
   where id = s.id;

  -- The roster is the source of truth for the student's name.
  update public.profiles
     set role = 'student', full_name = s.full_name
   where id = p_user_id;

  return 'ok';
end;
$$;

-- Without this, any signed-in user could call it for any user id through the REST API.
revoke all on function public.claim_student(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_student(uuid, text, text, text) to service_role;


-- ---------------------------------------------------------------------
-- PART C. Row Level Security
-- ---------------------------------------------------------------------
-- Admin: everything. Instructor: own row and own published classes.
-- Student: own student record, own section, published classes of that section.
-- Viewer (unlinked) and anon: nothing.

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'profiles', 'students', 'sections', 'subjects', 'instructors', 'rooms',
    'schedules', 'instructor_availability', 'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- profiles: read your own row. Writes happen through the API only.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.csms_role() = 'admin') with check (public.csms_role() = 'admin');

-- students: a student reads only their own linked record.
create policy students_select_own on public.students
  for select to authenticated using (profile_id = auth.uid());
create policy students_admin_all on public.students
  for all to authenticated
  using (public.csms_role() = 'admin') with check (public.csms_role() = 'admin');

-- sections: a student reads only their own section.
create policy sections_select_own on public.sections
  for select to authenticated
  using (id = (select section_id from public.students where profile_id = auth.uid()));
create policy sections_admin_all on public.sections
  for all to authenticated
  using (public.csms_role() = 'admin') with check (public.csms_role() = 'admin');

-- subjects, rooms: admin only (schedules carry the names students need).
create policy subjects_admin_all on public.subjects
  for all to authenticated
  using (public.csms_role() = 'admin') with check (public.csms_role() = 'admin');
create policy rooms_admin_all on public.rooms
  for all to authenticated
  using (public.csms_role() = 'admin') with check (public.csms_role() = 'admin');

-- instructors: an instructor reads their own row.
create policy instructors_select_own on public.instructors
  for select to authenticated using (user_id = auth.uid());
create policy instructors_admin_all on public.instructors
  for all to authenticated
  using (public.csms_role() = 'admin') with check (public.csms_role() = 'admin');

-- instructor_availability: an instructor reads their own windows.
create policy availability_select_own on public.instructor_availability
  for select to authenticated
  using (instructor_id in (select id from public.instructors where user_id = auth.uid()));
create policy availability_admin_all on public.instructor_availability
  for all to authenticated
  using (public.csms_role() = 'admin') with check (public.csms_role() = 'admin');

-- schedules: published classes only, and only the caller's own.
create policy schedules_student_read on public.schedules
  for select to authenticated
  using (
    status = 'published'
    and section_id = (select section_id from public.students where profile_id = auth.uid())
  );
create policy schedules_instructor_read on public.schedules
  for select to authenticated
  using (
    status = 'published'
    and instructor_id in (select id from public.instructors where user_id = auth.uid())
  );
create policy schedules_admin_all on public.schedules
  for all to authenticated
  using (public.csms_role() = 'admin') with check (public.csms_role() = 'admin');

-- audit_logs: admins read. Rows are written by the API.
create policy audit_admin_read on public.audit_logs
  for select to authenticated using (public.csms_role() = 'admin');


-- ---------------------------------------------------------------------
-- Checks you can run afterwards (they only read data)
-- ---------------------------------------------------------------------
-- Policies in place:
--   select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;
-- Schedules that did not get a section (should be 0 rows):
--   select id, section from public.schedules where section_id is null;
-- Roster rows already claimed:
--   select student_number, profile_id, claimed_at from public.students where profile_id is not null;
