import { Router } from 'express'
import { db } from '../db.js'
import { requireRole, wrap } from '../middleware/auth.js'
import { logAudit } from '../audit.js'
import { studentDbError, pick } from '../errors.js'
import {
  EMAIL, UUID, CODE_DAYS, normNumber, normEmail, normName, parseYearLevel,
  generateClaimCode, formatCode, hashCode,
} from '../lib/students.js'

// Admin only. The roster is the source of truth for who may claim a student account.
// claim_code_hash is never selected, so it can never reach the browser or the audit log.
const r = Router()
r.use(requireRole('admin'))

const COLS =
  'id,student_number,full_name,email,course,year_level,section_id,profile_id,claimed_at,claim_code_expires_at,claim_failed_attempts,created_at,updated_at'
const SELECT = `${COLS}, section:sections(id,section_name)`
const FIELDS = ['student_number', 'full_name', 'email', 'course', 'year_level', 'section_id']
const SORTS = ['student_number', 'full_name', 'course', 'year_level', 'created_at']
const fail = (status, message) => Object.assign(new Error(message), { status })

// Cleans and validates the fields the admin typed. Only fields that were sent are returned.
function clean(body, { creating }) {
  const b = pick(body || {}, FIELDS)
  if (creating || b.student_number !== undefined) {
    b.student_number = normNumber(b.student_number)
    if (!b.student_number) throw fail(400, 'Student number is required.')
  }
  if (creating || b.full_name !== undefined) {
    b.full_name = normName(b.full_name)
    if (!b.full_name) throw fail(400, 'Student name is required.')
  }
  if (b.email !== undefined) {
    b.email = b.email ? normEmail(b.email) : null
    if (b.email && !EMAIL.test(b.email)) throw fail(400, 'Enter a valid email address.')
  }
  if (b.course !== undefined) b.course = String(b.course || '').trim() || null
  if (b.year_level !== undefined) {
    try { b.year_level = parseYearLevel(b.year_level) } catch (e) { throw fail(400, e.message) }
  }
  if (b.section_id !== undefined) {
    b.section_id = b.section_id || null
    if (b.section_id && !UUID.test(b.section_id)) throw fail(400, 'Choose a valid section.')
  }
  return b
}

r.get('/', wrap(async (req, res) => {
  const sort = SORTS.includes(req.query.sort) ? req.query.sort : 'student_number'
  const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '50', 10) || 50, 1), 200)
  const search = String(req.query.search || '').replace(/[,()%*]/g, '').trim()

  let q = db.from('students').select(SELECT, { count: 'exact' })
    .order(sort, { ascending: req.query.order !== 'desc' })
  if (sort !== 'student_number') q = q.order('student_number')
  if (search) {
    q = q.or(`student_number.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (UUID.test(req.query.section_id || '')) q = q.eq('section_id', req.query.section_id)
  if (req.query.linked === 'yes') q = q.not('profile_id', 'is', null)
  if (req.query.linked === 'no') q = q.is('profile_id', null)

  const from = (page - 1) * pageSize
  const { data, error, count } = await q.range(from, from + pageSize - 1)
  if (error) throw studentDbError(error)
  res.json({ data, total: count, page, pageSize })
}))

r.post('/', wrap(async (req, res) => {
  const body = clean(req.body, { creating: true })
  const { data, error } = await db.from('students').insert(body).select(SELECT).single()
  if (error) throw studentDbError(error)
  await logAudit(req.user, 'create', 'students', data.id, null, data)
  res.status(201).json({ data })
}))

r.put('/:id', wrap(async (req, res) => {
  const body = clean(req.body, { creating: false })
  const { data: before } = await db.from('students').select(COLS).eq('id', req.params.id).maybeSingle()
  if (!before) throw fail(404, 'That student was not found.')
  const { data, error } = await db.from('students').update(body).eq('id', req.params.id).select(SELECT).single()
  if (error) throw studentDbError(error)
  await logAudit(req.user, 'update', 'students', data.id, before, data)
  res.json({ data })
}))

r.delete('/:id', wrap(async (req, res) => {
  const { data: before } = await db.from('students').select(COLS).eq('id', req.params.id).maybeSingle()
  if (!before) throw fail(404, 'That student was not found.')
  const { error } = await db.from('students').delete().eq('id', req.params.id)
  if (error) throw studentDbError(error)
  // The account no longer has a student record, so it goes back to "not linked".
  if (before.profile_id) {
    await db.from('profiles').update({ role: 'viewer' }).eq('id', before.profile_id).eq('role', 'student')
  }
  await logAudit(req.user, 'delete', 'students', req.params.id, before, null)
  res.json({ ok: true })
}))

// Issue a one-time registration code for a roster row that has no school email.
r.post('/:id/claim-code', wrap(async (req, res) => {
  const { data: s } = await db.from('students').select(COLS).eq('id', req.params.id).maybeSingle()
  if (!s) throw fail(404, 'That student was not found.')
  if (s.profile_id) throw fail(409, 'This student already has an account linked.')
  if (s.email) {
    throw fail(400, 'This student has a school email on file, so no code is needed. They register with that email. To use a code instead, remove the email from their roster record first.')
  }
  const code = generateClaimCode()
  const expires = new Date(Date.now() + CODE_DAYS * 86400000).toISOString()
  const { error } = await db.from('students')
    .update({ claim_code_hash: hashCode(code), claim_code_expires_at: expires, claim_failed_attempts: 0 })
    .eq('id', s.id).is('profile_id', null)
  if (error) throw studentDbError(error)
  await logAudit(req.user, 'issue-code', 'students', s.id, null, { student_number: s.student_number }) // never the code
  res.json({ data: { code: formatCode(code), expires_at: expires } })
}))

// Detach the account (wrong person, lost access). The student can claim again.
r.post('/:id/unlink', wrap(async (req, res) => {
  const { data: s } = await db.from('students').select(COLS).eq('id', req.params.id).maybeSingle()
  if (!s) throw fail(404, 'That student was not found.')
  if (!s.profile_id) throw fail(409, 'This student has no linked account.')
  const { error } = await db.from('students')
    .update({ profile_id: null, claimed_at: null }).eq('id', s.id)
  if (error) throw studentDbError(error)
  await db.from('profiles').update({ role: 'viewer' }).eq('id', s.profile_id).eq('role', 'student')
  await logAudit(req.user, 'unlink', 'students', s.id, { profile_id: s.profile_id }, null)
  res.json({ ok: true })
}))

export default r
