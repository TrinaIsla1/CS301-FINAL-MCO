import { Router } from 'express';
import { db } from '../db.js';
import { requireRole, wrap } from '../middleware/auth.js';
import { logAudit } from '../audit.js';
import { dbError, pick } from '../errors.js';

// Generic CRUD router with sort, search and pagination.
// Anyone signed in can read; only admins can create, update or delete.
export function crudRouter(table, { fields, searchCols = [], sortCols = [], defaultSort = 'created_at' }) {
  const r = Router();

  r.get('/', wrap(async (req, res) => {
    const sort = sortCols.includes(req.query.sort) ? req.query.sort : defaultSort;
    const ascending = req.query.order !== 'desc';
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(parseInt(req.query.pageSize || '50', 10), 200);
    const search = String(req.query.search || '').replace(/[,()%*]/g, '').trim();

    let q = db.from(table).select('*', { count: 'exact' }).order(sort, { ascending });
    if (search && searchCols.length) {
      q = q.or(searchCols.map((c) => `${c}.ilike.%${search}%`).join(','));
    }
    const from = (page - 1) * pageSize;
    const { data, error, count } = await q.range(from, from + pageSize - 1);
    if (error) throw dbError(error);
    res.json({ data, total: count, page, pageSize });
  }));

  r.post('/', requireRole('admin'), wrap(async (req, res) => {
    const { data, error } = await db.from(table).insert(pick(req.body, fields)).select().single();
    if (error) throw dbError(error);
    await logAudit(req.user, 'create', table, data.id, null, data);
    res.status(201).json({ data });
  }));

  r.put('/:id', requireRole('admin'), wrap(async (req, res) => {
    const { data: before } = await db.from(table).select('*').eq('id', req.params.id).single();
    const { data, error } = await db
      .from(table).update(pick(req.body, fields)).eq('id', req.params.id).select().single();
    if (error) throw dbError(error);
    await logAudit(req.user, 'update', table, data.id, before, data);
    res.json({ data });
  }));

  r.delete('/:id', requireRole('admin'), wrap(async (req, res) => {
    const { data: before } = await db.from(table).select('*').eq('id', req.params.id).single();
    const { error } = await db.from(table).delete().eq('id', req.params.id);
    if (error) throw dbError(error);
    await logAudit(req.user, 'delete', table, req.params.id, before, null);
    res.json({ ok: true });
  }));

  return r;
}
