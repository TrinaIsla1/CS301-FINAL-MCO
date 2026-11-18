import { Router } from 'express';
import { db } from '../db.js';
import { requireRole, wrap } from '../middleware/auth.js';
import { dbError } from '../errors.js';

const r = Router();
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:00)?$/;
const full = (t) => (String(t).length === 5 ? `${t}:00` : String(t));

async function ownInstructorId(userId) {
  const { data } = await db.from('instructors').select('id').eq('user_id', userId).maybeSingle();
  return data?.id;
}

// Instructors manage their own windows. Admins can read and edit any instructor's.
async function targetInstructor(req) {
  if (req.user.role === 'instructor') return ownInstructorId(req.user.id);
  return req.body?.instructor_id || req.query.instructor_id;
}

r.get('/', requireRole('instructor', 'admin'), wrap(async (req, res) => {
  const id = await targetInstructor(req);
  if (!id) return res.json({ data: [] });
  const { data, error } = await db.from('instructor_availability').select('*')
    .eq('instructor_id', id).order('day_of_week').order('start_time');
  if (error) throw dbError(error);
  res.json({ data });
}));

r.post('/', requireRole('instructor', 'admin'), wrap(async (req, res) => {
  const id = await targetInstructor(req);
  if (!id) return res.status(400).json({ error: 'Your login is not linked to an instructor record yet. Ask the Admin.' });
  const { day_of_week, start_time, end_time } = req.body;
  if (!(day_of_week >= 1 && day_of_week <= 6) || !TIME.test(start_time) || !TIME.test(end_time)) {
    return res.status(400).json({ error: 'Choose a day and valid start and end times.' });
  }
  if (full(end_time) <= full(start_time)) return res.status(400).json({ error: 'End time must be later than start time.' });

  const { data: clash } = await db.from('instructor_availability').select('id')
    .eq('instructor_id', id).eq('day_of_week', day_of_week)
    .lt('start_time', full(end_time)).gt('end_time', full(start_time));
  if (clash?.length) return res.status(409).json({ error: 'This overlaps a time you already added for that day.' });

  const { data, error } = await db.from('instructor_availability')
    .insert({ instructor_id: id, day_of_week, start_time, end_time }).select().single();
  if (error) throw dbError(error);
  res.status(201).json({ data });
}));

r.delete('/:id', requireRole('instructor', 'admin'), wrap(async (req, res) => {
  const { data: row } = await db.from('instructor_availability').select('instructor_id').eq('id', req.params.id).maybeSingle();
  if (!row) return res.status(404).json({ error: 'That time was not found.' });
  if (req.user.role === 'instructor' && row.instructor_id !== (await ownInstructorId(req.user.id))) {
    return res.status(403).json({ error: 'You can only change your own availability.' });
  }
  const { error } = await db.from('instructor_availability').delete().eq('id', req.params.id);
  if (error) throw dbError(error);
  res.json({ ok: true });
}));

export default r;
