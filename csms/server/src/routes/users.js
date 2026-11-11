import { Router } from 'express';
import { db } from '../db.js';
import { requireRole, wrap } from '../middleware/auth.js';
import { logAudit } from '../audit.js';
import { dbError } from '../errors.js';

const r = Router();

r.get('/', requireRole('admin'), wrap(async (_req, res) => {
  const { data, error } = await db.from('profiles').select('*').order('created_at');
  if (error) throw dbError(error);
  res.json({ data });
}));

r.put('/:id/role', requireRole('admin'), wrap(async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'instructor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin, instructor or viewer.' });
  }
  const { data, error } = await db.from('profiles').update({ role }).eq('id', req.params.id).select().single();
  if (error) throw dbError(error);
  await logAudit(req.user, 'update', 'profiles', data.id, null, { role });
  res.json({ data });
}));

export default r;
