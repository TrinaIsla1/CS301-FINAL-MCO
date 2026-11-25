// In-memory stand-in for Supabase's REST + auth endpoints, for testing the API wiring.
// It mirrors the SQL migration's behavior (normalization triggers, unique rules, claim_student),
// but it is NOT Postgres: the SQL itself is verified separately by reading it.
import { randomUUID, createHash } from 'node:crypto'

export const tables = { profiles: [], students: [], sections: [], schedules: [], instructors: [], subjects: [], rooms: [], audit_logs: [], instructor_availability: [] }
export const users = {} // token -> auth user
export const calls = []  // every outbound request, to assert nothing unexpected happened
const realFetch = globalThis.fetch

const err = (status, code, message) => new Response(JSON.stringify({ code, message, details: message }), { status, headers: { 'content-type': 'application/json' } })
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = '' } else cur += ch } if (cur) out.push(cur); return out }
const FK = { section: ['sections', 'section_id'], subject: ['subjects', 'subject_id'], instructor: ['instructors', 'instructor_id'], room: ['rooms', 'room_id'] }

function applyFilter(rows, key, val) {
  const m = val.match(/^(not\.)?(eq|neq|is|in|ilike|lt|gt)\.(.*)$/s)
  if (!m) return rows
  const [, neg, op, arg] = m
  const test = (r) => {
    const v = r[key]
    if (op === 'eq') return String(v) === arg
    if (op === 'neq') return String(v) !== arg
    if (op === 'is') return arg === 'null' ? v == null : true
    if (op === 'in') return arg.slice(1, -1).split(',').includes(String(v))
    if (op === 'lt') return String(v) < arg
    if (op === 'gt') return String(v) > arg
    if (op === 'ilike') return new RegExp('^' + arg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i').test(String(v ?? ''))
  }
  return rows.filter((r) => (neg ? !test(r) : test(r)))
}

function project(row, select) {
  if (!select) return { ...row }
  const out = {}
  for (const part of splitTop(select)) {
    const p = part.trim()
    const emb = p.match(/^(\w+):(\w+)\((.*)\)$/)
    if (emb) {
      const [, alias, tbl, cols] = emb
      const [, fk] = FK[alias] || [tbl, alias + '_id']
      const target = tables[tbl].find((t) => t.id === row[fk])
      out[alias] = target ? project(target, cols) : null
    } else if (p === '*') Object.assign(out, row)
    else if (p) out[p] = row[p]
  }
  return out
}

function normalize(table, row) {
  if (table === 'students') {
    row.student_number = row.student_number.trim().toUpperCase()
    row.email = (row.email ?? '').trim().toLowerCase() || null
    row.claim_failed_attempts ??= 0
    for (const k of ['course', 'year_level', 'section_id', 'profile_id', 'claim_code_hash', 'claim_code_expires_at', 'claimed_at']) row[k] ??= null
  }
  if (table === 'sections') row.section_name = row.section_name.trim().replace(/\s+/g, ' ')
}
function checkUnique(table, row, selfId) {
  const others = tables[table].filter((r) => r.id !== selfId)
  if (table === 'students') {
    if (others.some((r) => r.student_number === row.student_number)) return 'duplicate key value violates unique constraint "students_student_number_key"'
    if (row.email && others.some((r) => r.email === row.email)) return 'duplicate key value violates unique constraint "students_email_key"'
    if (row.profile_id && others.some((r) => r.profile_id === row.profile_id)) return 'duplicate key value violates unique constraint "students_profile_id_key"'
  }
  if (table === 'sections' && others.some((r) => r.section_name.toLowerCase() === row.section_name.toLowerCase())) return 'duplicate key value violates unique constraint "sections_name_key"'
  return null
}

// JS mirror of public.claim_student()
function claimStudent({ p_user_id, p_email, p_student_number, p_code_hash }) {
  const prof = tables.profiles.find((p) => p.id === p_user_id)
  if (!prof) return 'no_profile'
  if (!['viewer', 'student'].includes(prof.role)) return 'wrong_role'
  const s = tables.students.find((x) => x.student_number === String(p_student_number).trim().toUpperCase())
  if (!s) return 'not_found'
  if (s.profile_id === p_user_id) return 'ok'
  const email = String(p_email || '').trim().toLowerCase()
  if (s.email) { if (!email || email !== s.email) return 'email_mismatch' }
  else {
    if (!s.claim_code_hash) return 'no_code_issued'
    if (!p_code_hash) return 'code_required'
    if (s.claim_failed_attempts >= 5) return 'locked'
    if (s.claim_code_expires_at && new Date(s.claim_code_expires_at) < new Date()) return 'code_expired'
    if (p_code_hash !== s.claim_code_hash) { s.claim_failed_attempts++; return 'bad_code' }
  }
  if (s.profile_id) return 'taken'
  if (tables.students.some((x) => x.profile_id === p_user_id)) return 'already_linked'
  Object.assign(s, { profile_id: p_user_id, claimed_at: new Date().toISOString(), claim_code_hash: null, claim_code_expires_at: null, claim_failed_attempts: 0 })
  prof.role = 'student'; prof.full_name = s.full_name
  return 'ok'
}

async function handle(req) {
  const url = new URL(req.url)
  const auth = req.headers.get('authorization') || ''
  calls.push(`${req.method} ${url.pathname}`)

  if (url.pathname === '/auth/v1/user') {
    const u = users[auth.replace('Bearer ', '')]
    return u ? json(u) : err(401, 'bad_jwt', 'invalid')
  }
  if (url.pathname === '/auth/v1/invite') {
    const body = await req.json()
    if (Object.values(users).some((u) => u.email === body.email && u.email_confirmed_at)) return err(422, 'email_exists', 'A user with this email address has already been registered')
    const u = { id: randomUUID(), email: body.email, user_metadata: body.data }
    tables.profiles.push({ id: u.id, role: 'viewer', full_name: body.data?.full_name || '' })
    return json(u)
  }
  const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/)
  if (rpc) return json(rpc[1] === 'claim_student' ? claimStudent(await req.json()) : null)

  const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/)
  if (!m) throw new Error('fake supabase: unhandled ' + req.method + ' ' + url.pathname)
  const table = m[1]
  if (!tables[table]) return err(404, '42P01', 'no table ' + table)
  const q = url.searchParams
  const filtered = () => {
    let rows = tables[table]
    for (const [k, v] of q) {
      if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue
      if (k === 'or') {
        const conds = splitTop(v.slice(1, -1))
        rows = rows.filter((r) => conds.some((c) => { const [col, ...rest] = c.split('.'); return applyFilter([r], col, rest.join('.')).length }))
      } else rows = applyFilter(rows, k, v)
    }
    return rows
  }
  const wantObject = (req.headers.get('accept') || '').includes('vnd.pgrst.object')
  const reply = (rows, status = 200, extra = {}) => {
    const out = rows.map((r) => project(r, q.get('select')))
    if (wantObject) return out.length === 1 ? json(out[0], status) : err(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned')
    return json(out, status, extra)
  }

  if (req.method === 'GET') {
    let rows = [...filtered()]
    for (const o of (q.get('order') || '').split(',').filter(Boolean).reverse()) {
      const [col, dir] = o.split('.')
      rows.sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : String(a[col] ?? '') > String(b[col] ?? '') ? 1 : 0) * (dir === 'desc' ? -1 : 1))
    }
    const total = rows.length
    const off = Number(q.get('offset') || 0), lim = q.get('limit') ? Number(q.get('limit')) : rows.length
    rows = rows.slice(off, off + lim)
    return reply(rows, 200, { 'content-range': `${off}-${off + rows.length - 1}/${total}` })
  }
  if (req.method === 'POST') {
    const body = await req.json()
    const list = Array.isArray(body) ? body : [body]
    const staged = []
    const upsert = (req.headers.get('prefer') || '').includes('merge-duplicates')
    if (upsert) { // PostgREST upsert: merge into an existing row with the same key
      const out = []
      for (const b of list) {
        const hit = tables[table].find((r) => r.id === b.id)
        if (hit) { Object.assign(hit, b); out.push(hit) } else { const row = { created_at: new Date().toISOString(), ...b }; tables[table].push(row); out.push(row) }
      }
      return reply(out, 201)
    }
    for (const b of list) {
      const row = { id: randomUUID(), created_at: new Date().toISOString(), ...b }
      normalize(table, row)
      const dup = checkUnique(table, row) || (staged.find((s) => checkUnique(table, row) || (table === 'students' && s.student_number === row.student_number)) && 'duplicate key value violates unique constraint "students_student_number_key"')
      if (dup) return err(409, '23505', dup)
      staged.push(row)
    }
    tables[table].push(...staged)
    return reply(staged, 201)
  }
  if (req.method === 'PATCH') {
    const body = await req.json()
    const rows = filtered()
    for (const r of rows) {
      const next = { ...r, ...body }; normalize(table, next)
      const dup = checkUnique(table, next, r.id)
      if (dup) return err(409, '23505', dup)
      Object.assign(r, next)
    }
    return reply(rows)
  }
  if (req.method === 'DELETE') {
    const rows = filtered(); tables[table] = tables[table].filter((r) => !rows.includes(r)); return json([])
  }
  throw new Error('fake supabase: unhandled method ' + req.method)
}

globalThis.fetch = async (input, init) => {
  const req = new Request(input, init)
  const host = new URL(req.url).hostname
  if (host === 'localhost' || host === '127.0.0.1') return realFetch(input, init)
  if (host === 'fake.supabase.co') return handle(req)
  throw new Error('unexpected outbound request to ' + req.url)
}
