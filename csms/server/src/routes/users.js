import { Router } from 'express';
import { db } from '../db.js';
import { requireRole, wrap } from '../middleware/auth.js';
import { logAudit } from '../audit.js';
import { dbError } from '../errors.js';
import { EMAIL, normEmail, normName, UUID } from '../lib/students.js';

const r = Router();
const fail = (status, message) => Object.assign(new Error(message), { status });

// Staff and unlinked accounts. Students are managed from the Students tab.
r.get('/', requireRole('admin'), wrap(async (_req, res) => {
  const { data, error } = await db.from('profiles').select('*').neq('role', 'student').order('created_at');
  if (error) throw dbError(error);
  res.json({ data });
}));

// Admin-controlled account creation: sends an invitation email and sets the role on the server.
// Public sign-up can never produce an instructor or admin.
r.post('/invite', requireRole('admin'), wrap(async (req, res) => {
  const email = normEmail(req.body.email);
  const full_name = normName(req.body.full_name);
  const role = req.body.role;
  if (!EMAIL.test(email)) throw fail(400, 'Enter a valid email address.');
  if (!full_name) throw fail(400, 'Enter the full name.');
  if (!['instructor', 'admin'].includes(role)) throw fail(400, 'Choose Instructor or Admin.');

  let instructorId = null;
  if (role === 'instructor') {
    instructorId = req.body.instructor_id;
    if (!UUID.test(instructorId || '')) throw fail(400, 'Choose which instructor record this login belongs to.');
    const { data: inst } = await db.from('instructors').select('id,user_id').eq('id', instructorId).maybeSingle();
    if (!inst) throw fail(404, 'That instructor record was not found.');
    if (inst.user_id) throw fail(409, 'That instructor already has a login.');
  }

  const redirectTo = (process.env.CLIENT_ORIGIN || '').split(',')[0].trim() || undefined;
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    data: { full_name, needs_password: true }, // the app asks them to choose a password on first visit
    redirectTo,
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      throw fail(409, 'An account with that email already exists. Change its role from the list instead.');
    }
    throw fail(502, `The invitation could not be sent: ${error.message}`);
  }
  const uid = data.user.id;
  const { error: e1 } = await db.from('profiles').upsert({ id: uid, role, full_name }, { onConflict: 'id' });
  if (e1) throw dbError(e1);
  if (instructorId) {
    const { error: e2 } = await db.from('instructors').update({ user_id: uid }).eq('id', instructorId).is('user_id', null);
    if (e2) throw dbError(e2);
  }
  await logAudit(req.user, 'invite', 'profiles', uid, null, { email, role });
  res.status(201).json({ data: { id: uid, email, role } });
}));

r.put('/:id/role', requireRole('admin'), wrap(async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'instructor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin, instructor or viewer.' });
  }
  const { data: target } = await db.from('profiles').select('role').eq('id', req.params.id).maybeSingle();
  if (!target) return res.status(404).json({ error: 'That user was not found.' });
  if (target.role === 'student') {
    return res.status(409).json({ error: 'Student accounts are managed from the Students tab.' });
  }
  const { data, error } = await db.from('profiles').update({ role }).eq('id', req.params.id).select().single();
  if (error) throw dbError(error);
  await logAudit(req.user, 'update', 'profiles', data.id, null, { role });
  res.json({ data });
}));

export default r;
