import { Router } from 'express';
import { db } from '../db.js';
import { requireRole, wrap } from '../middleware/auth.js';
import { logAudit } from '../audit.js';
import { dbError, studentDbError } from '../errors.js';
import { rosterRow, sectionKey } from '../lib/students.js';

const r = Router();

// Columns accepted from the CSV header row, per table.
const CONFIG = {
  subjects: { fields: ['code', 'name', 'description', 'units', 'type', 'department'], numbers: ['units'], required: ['code', 'name'] },
  instructors: { fields: ['name', 'email', 'department', 'employment_type', 'max_load_hours', 'employee_number'], numbers: ['max_load_hours'], required: ['name'] },
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

async function allSections() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('sections').select('id,section_name').order('id').range(from, from + 999);
    if (error) throw dbError(error);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

// Roster import. New student numbers are added; existing ones get their roster fields updated
// (blank cells keep the current value). Accounts and claim codes are never touched.
// Missing sections are created from the file.
async function importStudents(req, res) {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'The file has no rows to import.' });
  if (rows.length > 2000) return res.status(400).json({ error: 'Import up to 2000 students at a time.' });

  const errors = [];
  const parsed = [];
  const seen = new Map();
  rows.forEach((raw, i) => {
    const rowNo = i + 2; // header row, then 1-based
    try {
      const d = rosterRow(raw);
      if (seen.has(d.student_number)) {
        throw new Error(`Duplicate student number (first on row ${seen.get(d.student_number)}).`);
      }
      seen.set(d.student_number, rowNo);
      parsed.push({ rowNo, d });
    } catch (e) { errors.push({ row: rowNo, message: e.message }); }
  });

  // Sections named in the file: reuse or create.
  const sections = new Map((await allSections()).map((x) => [sectionKey(x.section_name), x.id]));
  const created = [];
  for (const p of parsed) {
    if (!p.d.section) continue;
    const key = sectionKey(p.d.section);
    if (!sections.has(key)) {
      const { data, error } = await db.from('sections')
        .insert({ section_name: p.d.section, course: p.d.course || null, year_level: p.d.year_level })
        .select('id,section_name').single();
      if (error) { p.fail = `Could not create section "${p.d.section}": ${dbError(error).message}`; continue; }
      sections.set(key, data.id);
      created.push(data.section_name);
    }
    p.d.section_id = sections.get(key);
  }

  const ok = parsed.filter((p) => !p.fail);
  for (const p of parsed) if (p.fail) errors.push({ row: p.rowNo, message: p.fail });

  const existing = new Map();
  const numbers = ok.map((p) => p.d.student_number);
  for (let i = 0; i < numbers.length; i += 200) {
    const { data, error } = await db.from('students').select('id,student_number').in('student_number', numbers.slice(i, i + 200));
    if (error) throw dbError(error);
    for (const s of data) existing.set(s.student_number, s.id);
  }

  // Only columns with a value are sent, so a blank cell never erases data.
  const toInsert = [];
  const toUpdate = [];
  for (const p of ok) {
    const payload = { student_number: p.d.student_number, full_name: p.d.full_name };
    if (p.d.email) payload.email = p.d.email;
    if (p.d.course) payload.course = p.d.course;
    if (p.d.year_level != null) payload.year_level = p.d.year_level;
    if (p.d.section_id) payload.section_id = p.d.section_id;
    const id = existing.get(p.d.student_number);
    (id ? toUpdate : toInsert).push({ rowNo: p.rowNo, id, payload });
  }

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500);
    const { error } = await db.from('students').insert(chunk.map((c) => c.payload));
    if (!error) { inserted += chunk.length; continue; }
    for (const c of chunk) { // one bad row (for example a duplicate email) must not block the rest
      const { error: e1 } = await db.from('students').insert(c.payload);
      if (e1) errors.push({ row: c.rowNo, message: studentDbError(e1).message }); else inserted++;
    }
  }

  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += 15) {
    await Promise.all(toUpdate.slice(i, i + 15).map(async (c) => {
      const { student_number, ...fields } = c.payload;
      if (!Object.keys(fields).length) { updated++; return; }
      const { error } = await db.from('students').update(fields).eq('id', c.id);
      if (error) errors.push({ row: c.rowNo, message: studentDbError(error).message }); else updated++;
    }));
  }

  errors.sort((a, b) => a.row - b.row);
  await logAudit(req.user, 'import', 'students', null, null, { inserted, updated, failed: errors.length, sections_created: created.length });
  res.json({ inserted, updated, errors, sections_created: created });
}

// Imports one row at a time so a bad row never blocks the good ones.
r.post('/:entity', requireRole('admin'), wrap(async (req, res) => {
  const table = req.params.entity;
  if (table === 'students') return importStudents(req, res);
  const cfg = CONFIG[table];
  if (!cfg) return res.status(404).json({ error: 'You can import students, subjects, instructors, or rooms.' });
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
