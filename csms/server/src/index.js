import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { db } from './db.js';
import { requireAuth, requireRole, wrap } from './middleware/auth.js';
import { crudRouter } from './routes/crud.js';
import schedules from './routes/schedules.js';
import users from './routes/users.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Everything below requires a signed-in, email-verified user.
app.use('/api', requireAuth);

// Current user, plus the instructor record when this login is linked to one.
app.get('/api/me', wrap(async (req, res) => {
  let instructor = null;
  if (req.user.role === 'instructor') {
    const { data } = await db.from('instructors').select('id,name,max_load_hours').eq('user_id', req.user.id).maybeSingle();
    instructor = data;
  }
  res.json({ data: { ...req.user, instructor } });
}));

// Dashboard alerts: classes in unavailable rooms, and instructors over their weekly hour limit.
app.get('/api/alerts', requireRole('admin'), wrap(async (_req, res) => {
  const { data, error } = await db.from('schedules')
    .select('instructor_id,start_time,end_time,room:rooms(name,is_available),instructor:instructors(name,max_load_hours),subject:subjects(code)')
    .neq('status', 'archived');
  if (error) throw error;
  const mins = (t) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);
  const alerts = [];
  const load = {};
  for (const s of data) {
    if (s.room && !s.room.is_available) {
      alerts.push({ type: 'room', message: `${s.room.name} is marked unavailable, but ${s.subject?.code} is scheduled there.` });
    }
    const l = (load[s.instructor_id] ||= { name: s.instructor?.name, max: s.instructor?.max_load_hours, hrs: 0 });
    l.hrs += (mins(s.end_time) - mins(s.start_time)) / 60;
  }
  for (const l of Object.values(load)) {
    if (l.max && l.hrs > l.max) {
      alerts.push({ type: 'instructor', message: `${l.name} has ${l.hrs} hours a week. The maximum is ${l.max}.` });
    }
  }
  res.json({ data: alerts });
}));

app.get('/api/stats', wrap(async (_req, res) => {
  const count = async (t) => (await db.from(t).select('*', { count: 'exact', head: true })).count ?? 0;
  const [subjects, instructors, rooms, schedules] = await Promise.all(
    ['subjects', 'instructors', 'rooms', 'schedules'].map(count)
  );
  res.json({ data: { subjects, instructors, rooms, schedules } });
}));

app.use('/api/subjects', crudRouter('subjects', {
  fields: ['code', 'name', 'description', 'units', 'type', 'department'],
  searchCols: ['code', 'name', 'department'],
  sortCols: ['code', 'name', 'units', 'department', 'created_at'],
  defaultSort: 'code',
}));

app.use('/api/instructors', crudRouter('instructors', {
  fields: ['name', 'email', 'department', 'employment_type', 'max_load_hours', 'user_id'],
  searchCols: ['name', 'email', 'department'],
  sortCols: ['name', 'department', 'max_load_hours', 'created_at'],
  defaultSort: 'name',
}));

app.use('/api/rooms', crudRouter('rooms', {
  fields: ['name', 'building', 'capacity', 'type', 'is_available'],
  searchCols: ['name', 'building', 'type'],
  sortCols: ['name', 'building', 'capacity', 'created_at'],
  defaultSort: 'name',
}));

app.use('/api/schedules', schedules);
app.use('/api/users', users);

app.get('/api/audit-logs', requireRole('admin'), wrap(async (_req, res) => {
  const { data, error } = await db.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  res.json({ data });
}));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`CSMS API listening on :${port}`));
