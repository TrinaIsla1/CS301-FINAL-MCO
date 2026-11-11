import { Router } from 'express';
import { db } from '../db.js';
import { requireRole, wrap } from '../middleware/auth.js';
import { logAudit } from '../audit.js';
import { dbError, pick } from '../errors.js';

const r = Router();
const FIELDS = ['subject_id', 'instructor_id', 'room_id', 'section', 'semester',
  'academic_year', 'day_of_week', 'start_time', 'end_time', 'status'];
const SELECT = '*, subject:subjects(code,name), instructor:instructors(name), room:rooms(name,building,capacity)';
const SORTS = ['day_of_week', 'start_time', 'status', 'section', 'created_at'];
const hm = (t) => String(t).slice(0, 5);

// Returns every clash for a proposed schedule: same room, instructor or section at an overlapping time.
async function findConflicts(s, ignoreId) {
  const problems = [];
  if (!s.start_time || !s.end_time || s.end_time <= s.start_time) {
    return [{ type: 'time', message: 'End time must be later than start time.' }];
  }

  const { data: room } = await db.from('rooms').select('name,is_available').eq('id', s.room_id).maybeSingle();
  if (room && !room.is_available) {
    problems.push({ type: 'room', message: `${room.name} is marked unavailable.` });
  }

  for (const [col, label] of [['room_id', 'Room'], ['instructor_id', 'Instructor'], ['section', 'Section']]) {
    if (!s[col]) continue;
    let q = db.from('schedules').select(SELECT)
      .eq(col, s[col]).eq('day_of_week', s.day_of_week)
      .eq('semester', s.semester).eq('academic_year', s.academic_year)
      .neq('status', 'archived')
      .lt('start_time', s.end_time).gt('end_time', s.start_time);
    if (ignoreId) q = q.neq('id', ignoreId);
    const { data, error } = await q;
    if (error) throw dbError(error);
    for (const d of data) {
      problems.push({
        type: label.toLowerCase(),
        message: `${label} is already booked ${hm(d.start_time)}–${hm(d.end_time)} for ${d.subject?.code || 'another class'}.`,
      });
    }
  }
  return problems;
}

r.get('/', wrap(async (req, res) => {
  const sort = SORTS.includes(req.query.sort) ? req.query.sort : 'day_of_week';
  let q = db.from('schedules').select(SELECT)
    .order(sort, { ascending: req.query.order !== 'desc' })
    .order('start_time');

  for (const key of ['semester', 'academic_year', 'instructor_id', 'room_id', 'section', 'day_of_week']) {
    if (req.query[key]) q = q.eq(key, req.query[key]);
  }
  // Only admins see drafts and archived schedules.
  if (req.user.role !== 'admin') q = q.eq('status', 'published');

  if (req.query.mine === 'true') {
    const { data: me } = await db.from('instructors').select('id').eq('user_id', req.user.id).maybeSingle();
    if (!me) return res.json({ data: [] });
    q = q.eq('instructor_id', me.id);
  }

  const { data, error } = await q;
  if (error) throw dbError(error);
  res.json({ data });
}));

r.post('/check-conflict', requireRole('admin'), wrap(async (req, res) => {
  const conflicts = await findConflicts(req.body, req.body.id);
  res.json({ conflicts });
}));

r.post('/', requireRole('admin'), wrap(async (req, res) => {
  const body = pick(req.body, FIELDS);
  const conflicts = await findConflicts(body);
  if (conflicts.length) return res.status(409).json({ error: conflicts[0].message, conflicts });

  const { data, error } = await db.from('schedules')
    .insert({ ...body, created_by: req.user.id }).select(SELECT).single();
  if (error) throw dbError(error);
  await logAudit(req.user, 'create', 'schedules', data.id, null, data);
  res.status(201).json({ data });
}));

r.put('/:id', requireRole('admin'), wrap(async (req, res) => {
  const body = pick(req.body, FIELDS);
  const { data: before } = await db.from('schedules').select('*').eq('id', req.params.id).single();
  const conflicts = await findConflicts({ ...before, ...body }, req.params.id);
  if (conflicts.length) return res.status(409).json({ error: conflicts[0].message, conflicts });

  const { data, error } = await db.from('schedules')
    .update(body).eq('id', req.params.id).select(SELECT).single();
  if (error) throw dbError(error);
  await logAudit(req.user, 'update', 'schedules', data.id, before, data);
  res.json({ data });
}));

r.delete('/:id', requireRole('admin'), wrap(async (req, res) => {
  const { data: before } = await db.from('schedules').select('*').eq('id', req.params.id).single();
  const { error } = await db.from('schedules').delete().eq('id', req.params.id);
  if (error) throw dbError(error);
  await logAudit(req.user, 'delete', 'schedules', req.params.id, before, null);
  res.json({ ok: true });
}));

export default r;
