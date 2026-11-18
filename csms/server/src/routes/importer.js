import { Router } from 'express';
import { db } from '../db.js';
import { requireRole, wrap } from '../middleware/auth.js';
import { logAudit } from '../audit.js';
import { dbError } from '../errors.js';

const r = Router();

// Columns accepted from the CSV header row, per table.
const CONFIG = {
  subjects: { fields: ['code', 'name', 'description', 'units', 'type', 'department'], numbers: ['units'], required: ['code', 'name'] },
  instructors: { fields: ['name', 'email', 'department', 'employment_type', 'max_load_hours'], numbers: ['max_load_hours'], required: ['name'] },
  rooms: { fields: ['name', 'building', 'capacity', 'type', 'is_available'], numbers: ['capacity'], bools: ['is_available'], required: ['name'] },
};

function clean(raw, cfg) {
  const row = {};
  for (const f of cfg.fields) {
    const v = raw[f] == null ? '' : String(raw[f]).trim();
    if (v === '') continue; // blank cells fall back to the database default
    if (cfg.numbers?.includes(f)) {
      if (Number.isNaN(Number(v))) throw new Error(`${f} must be a number.`);
      row[f] = Number(v);
    } else if (cfg.bools?.includes(f)) {
      row[f] = /^(true|yes|1)$/i.test(v);
    } else row[f] = v;
  }
  return row;
}

// Imports one row at a time so a bad row never blocks the good ones.
r.post('/:entity', requireRole('admin'), wrap(async (req, res) => {
  const table = req.params.entity;
  const cfg = CONFIG[table];
  if (!cfg) return res.status(404).json({ error: 'You can import subjects, instructors, or rooms.' });
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'The file has no rows to import.' });
  if (rows.length > 500) return res.status(400).json({ error: 'Import up to 500 rows at a time.' });

  let inserted = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      const row = clean(rows[i], cfg);
      const missing = cfg.required.find((k) => !row[k]);
      if (missing) throw new Error(`${missing} is required.`);
      const { error } = await db.from(table).insert(row);
      if (error) throw dbError(error);
      inserted++;
    } catch (e) {
      errors.push({ row: i + 2, message: e.message }); // +2: header row, then 1-based
    }
  }
  await logAudit(req.user, 'import', table, null, null, { inserted, failed: errors.length });
  res.json({ inserted, errors });
}));

export default r;
