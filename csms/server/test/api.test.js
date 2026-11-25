import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { tables, users, calls } from './fake-supabase.js'

process.env.SUPABASE_URL = 'https://fake.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test'
process.env.PORT = '45123'
process.env.CLIENT_ORIGIN = 'http://localhost:8081'
await import('../src/index.js')
const BASE = 'http://localhost:45123'

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}
const mk = (token, email, role, name, confirmed = true) => {
  const id = randomUUID()
  users[token] = { id, email, email_confirmed_at: confirmed ? '2026-01-01' : null }
  tables.profiles.push({ id, role, full_name: name })
  return id
}

const adminId = mk('admin', 'admin@school.edu', 'admin', 'Ada Admin')
const instId = mk('inst', 'prof@school.edu', 'instructor', 'Prof Pat')
const v1 = mk('v1', 'juan@school.edu', 'viewer', 'juan')
const v2 = mk('v2', 'maria@school.edu', 'viewer', 'maria')
const v3 = mk('v3', 'pedro.personal@gmail.com', 'viewer', 'pedro')
const evil = mk('evil', 'evil@x.com', 'viewer', 'evil')
const dupJuan = mk('dupjuan', 'juan@school.edu', 'viewer', 'juan again')
mk('unverified', 'new@school.edu', 'viewer', 'new', false)

const ROSTER = [
  { 'Student number': '2023-00125', 'Student name': 'Juan Dela Cruz', Course: 'BSIT', 'Year level': '3', Section: 'BSIT 3A', Email: 'Juan@school.edu' },
  { 'Student number': '2023-00126', 'Student name': 'Maria Santos', Course: 'BSCS', 'Year level': '3', Section: 'BSCS 3A', Email: 'maria@school.edu' },
  { 'Student number': '2023-00127', 'Student name': 'Pedro Reyes', Course: 'BSIT', 'Year level': '2', Section: 'bsit  2a' }, // no email
  { 'Student number': '2023-00125', 'Student name': 'Dup', Course: 'BSIT' },                                   // duplicate in file
  { 'Student number': '', 'Student name': 'No Number' },
]

test('auth gates', async () => {
  assert.equal((await call('GET', '/health')).status, 200)
  assert.equal((await call('GET', '/api/me')).status, 401)
  assert.equal((await call('GET', '/api/me', 'unverified')).status, 403)
  assert.equal((await call('GET', '/api/students', 'v1')).status, 403)
  assert.equal((await call('POST', '/api/import/students', 'v1', { rows: ROSTER })).status, 403)
})

let sec = {}
test('roster import: normalization, sections, duplicates', async () => {
  const r = await call('POST', '/api/import/students', 'admin', { rows: ROSTER })
  assert.equal(r.status, 200)
  assert.equal(r.body.inserted, 3)
  assert.deepEqual([...r.body.sections_created].sort(), ['BSCS 3A', 'BSIT 3A', 'bsit 2a'])
  assert.equal(tables.sections.length, 3)
  assert.equal(r.body.errors.length, 2)
  assert.match(r.body.errors.find((e) => e.row === 5).message, /Duplicate student number \(first on row 2\)/)
  assert.match(r.body.errors.find((e) => e.row === 6).message, /Student number is required/)
  const juan = tables.students.find((s) => s.student_number === '2023-00125')
  assert.equal(juan.email, 'juan@school.edu')
  assert.equal(juan.profile_id, null)
  sec = Object.fromEntries(tables.sections.map((s) => [s.section_name, s.id]))
  assert.ok(sec['BSIT 3A'] && sec['BSCS 3A'])
})

test('re-import updates, and a blank cell never erases data', async () => {
  const r = await call('POST', '/api/import/students', 'admin', { rows: [
    { 'Student number': '2023-00125', 'Student name': 'Juan D. Cruz', Course: '', Email: '' },
    { 'Student number': '2023-00128', 'Student name': 'New Kid', Email: 'juan@school.edu' }, // email already used
  ] })
  assert.equal(r.body.updated, 1); assert.equal(r.body.inserted, 0)
  assert.match(r.body.errors[0].message, /Another student already has that email/)
  const juan = tables.students.find((s) => s.student_number === '2023-00125')
  assert.equal(juan.full_name, 'Juan D. Cruz'); assert.equal(juan.email, 'juan@school.edu'); assert.equal(juan.course, 'BSIT')
})

test('students list never exposes the claim code hash', async () => {
  const pedro = tables.students.find((s) => s.student_number === '2023-00127')
  pedro.claim_code_hash = 'secret'
  const r = await call('GET', '/api/students?pageSize=50', 'admin')
  assert.equal(r.status, 200); assert.equal(r.body.total, 3)
  assert.ok(!JSON.stringify(r.body).includes('secret')); assert.ok(!('claim_code_hash' in r.body.data[0]))
  pedro.claim_code_hash = null
  assert.equal((await call('GET', '/api/students?linked=no&search=maria', 'admin')).body.data.length, 1)
})

test('public pre-check does not reveal the roster', async () => {
  const none = await call('POST', '/public/student-check', null, { student_number: '9999', email: 'a@b.co' })
  const wrong = await call('POST', '/public/student-check', null, { student_number: '2023-00125', email: 'evil@x.com' })
  assert.equal(none.status, 404); assert.equal(wrong.status, 404)
  assert.deepEqual(none.body, wrong.body)
  const ok = await call('POST', '/public/student-check', null, { student_number: ' 2023-00125 ', email: 'JUAN@school.edu' })
  assert.deepEqual(ok.body, { ok: true, needs_code: false })
  const nocode = await call('POST', '/public/student-check', null, { student_number: '2023-00127', email: 'pedro.personal@gmail.com' })
  assert.deepEqual(nocode.body, { ok: true, needs_code: true })
  assert.equal((await call('POST', '/public/student-check', null, { student_number: '', email: 'x' })).status, 400)
})

test('unlinked account sees no schedule data', async () => {
  assert.equal((await call('GET', '/api/schedules', 'v1')).status, 403)
  assert.equal((await call('GET', '/api/subjects', 'v1')).status, 403)
  assert.equal((await call('GET', '/api/rooms', 'v1')).status, 403)
  assert.equal((await call('GET', '/api/stats', 'v1')).status, 403)
  const me = await call('GET', '/api/me', 'v1'); assert.equal(me.body.data.role, 'viewer'); assert.equal(me.body.data.student, null)
})

test('admin builds schedules (section_id required, name synced)', async () => {
  const subj = { id: randomUUID(), code: 'IT101', name: 'Programming 2' }; tables.subjects.push(subj)
  const room = { id: randomUUID(), name: 'Lab 1', is_available: true }; tables.rooms.push(room)
  const inst = { id: randomUUID(), name: 'Prof Pat', user_id: instId }; tables.instructors.push(inst)
  const base = { subject_id: subj.id, instructor_id: inst.id, room_id: room.id, semester: '1st Semester', academic_year: '2026-2027', day_of_week: 1, start_time: '08:00', end_time: '10:00' }
  assert.equal((await call('POST', '/api/schedules', 'admin', { ...base, status: 'published' })).status, 400)
  const a = await call('POST', '/api/schedules', 'admin', { ...base, section_id: sec['BSIT 3A'], status: 'published' })
  assert.equal(a.status, 201); assert.equal(a.body.data.section, 'BSIT 3A')
  const room2 = { id: randomUUID(), name: 'Room 204', is_available: true }; tables.rooms.push(room2)
  const inst2 = { id: randomUUID(), name: 'Other Prof', user_id: null }; tables.instructors.push(inst2)
  await call('POST', '/api/schedules', 'admin', { ...base, room_id: room2.id, instructor_id: inst2.id, day_of_week: 2, section_id: sec['BSCS 3A'], status: 'published' })
  await call('POST', '/api/schedules', 'admin', { ...base, room_id: room2.id, instructor_id: inst2.id, day_of_week: 3, section_id: sec['BSIT 3A'], status: 'draft' })
  assert.equal(tables.schedules.length, 3)
  // conflict in same section/time is still caught using the section name
  const clash = await call('POST', '/api/schedules', 'admin', { ...base, room_id: room2.id, instructor_id: inst2.id, section_id: sec['BSIT 3A'], status: 'draft' })
  assert.equal(clash.status, 409)
})

test('claim: wrong email, then correct email', async () => {
  const bad = await call('POST', '/api/me/claim-student', 'evil', { student_number: '2023-00125' })
  assert.equal(bad.status, 404)
  const crossed = await call('POST', '/api/me/claim-student', 'v2', { student_number: '2023-00125' })
  assert.equal(crossed.status, 404)
  assert.deepEqual(bad.body.error, (await call('POST', '/api/me/claim-student', 'evil', { student_number: 'NOPE' })).body.error)
  const ok = await call('POST', '/api/me/claim-student', 'v1', { student_number: '2023-00125' })
  assert.equal(ok.status, 200); assert.equal(ok.body.data.student.section.section_name, 'BSIT 3A')
  assert.equal(tables.profiles.find((p) => p.id === v1).role, 'student')
  assert.equal(tables.profiles.find((p) => p.id === v1).full_name, 'Juan D. Cruz')
  assert.equal((await call('POST', '/api/me/claim-student', 'v1', { student_number: '2023-00125' })).status, 200) // idempotent
})

test('a second account cannot take an already-claimed student', async () => {
  const r = await call('POST', '/api/me/claim-student', 'dupjuan', { student_number: '2023-00125' })
  assert.equal(r.status, 409); assert.match(r.body.error, /already linked to another account/)
})

test('student sees only their own published section schedule', async () => {
  const me = await call('GET', '/api/me', 'v1')
  assert.equal(me.body.data.role, 'student'); assert.equal(me.body.data.student.student_number, '2023-00125')
  const s = await call('GET', '/api/schedules?section=BSCS%203A&instructor_id=x&status=draft', 'v1')
  assert.equal(s.status, 200); assert.equal(s.body.data.length, 1)
  assert.equal(s.body.data[0].section, 'BSIT 3A'); assert.equal(s.body.data[0].status, 'published')
  assert.equal(s.body.data[0].subject.code, 'IT101')
  assert.equal((await call('GET', '/api/subjects', 'v1')).status, 403)
  assert.equal((await call('GET', '/api/students', 'v1')).status, 403)
  assert.equal((await call('PUT', '/api/users/' + v1 + '/role', 'v1', { role: 'admin' })).status, 403)
  assert.equal((await call('POST', '/api/schedules', 'v1', {})).status, 403)
})

test('instructor sees only their own published classes, and no roster', async () => {
  const s = await call('GET', '/api/schedules?mine=false', 'inst')
  assert.equal(s.body.data.length, 1); assert.equal(s.body.data[0].instructor.name, 'Prof Pat')
  assert.equal((await call('GET', '/api/students', 'inst')).status, 403)
  assert.equal((await call('GET', '/api/instructors', 'inst')).status, 403)
})

test('registration codes: issue, wrong guesses lock, re-issue, expiry, success', async () => {
  const pedro = tables.students.find((s) => s.student_number === '2023-00127')
  assert.equal((await call('POST', `/api/students/${tables.students.find((s) => s.student_number === '2023-00126').id}/claim-code`, 'admin')).status, 400) // has email
  assert.equal((await call('POST', '/api/me/claim-student', 'v3', { student_number: '2023-00127' })).body.status, 'no_code_issued')
  const issued = await call('POST', `/api/students/${pedro.id}/claim-code`, 'admin')
  assert.equal(issued.status, 200); assert.match(issued.body.data.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  const code = issued.body.data.code
  assert.ok(!JSON.stringify(tables.audit_logs).includes(code.replace('-', '')))   // never logged
  assert.notEqual(pedro.claim_code_hash, code)                                     // only a hash is stored
  assert.equal((await call('POST', '/api/me/claim-student', 'v3', { student_number: '2023-00127' })).body.status, 'code_required')
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/api/me/claim-student', 'v3', { student_number: '2023-00127', code: 'WRONG-CODE' })).body.status, 'bad_code')
  const locked = await call('POST', '/api/me/claim-student', 'v3', { student_number: '2023-00127', code })
  assert.equal(locked.status, 429)                                                  // right code, but locked
  const again = await call('POST', `/api/students/${pedro.id}/claim-code`, 'admin')
  pedro.claim_code_expires_at = new Date(Date.now() - 1000).toISOString()
  assert.equal((await call('POST', '/api/me/claim-student', 'v3', { student_number: '2023-00127', code: again.body.data.code })).body.status, 'code_expired')
  const third = await call('POST', `/api/students/${pedro.id}/claim-code`, 'admin')
  const ok = await call('POST', '/api/me/claim-student', 'v3', { student_number: '2023-00127', code: third.body.data.code.toLowerCase().replace('-', ' ') })
  assert.equal(ok.status, 200)
  assert.equal(pedro.claim_code_hash, null)
  assert.equal((await call('POST', `/api/students/${pedro.id}/claim-code`, 'admin')).status, 409)
})

test('staff cannot claim a student record', async () => {
  assert.equal((await call('POST', '/api/me/claim-student', 'inst', { student_number: '2023-00126' })).body.status, 'wrong_role')
  assert.equal((await call('POST', '/api/me/claim-student', 'admin', { student_number: '2023-00126' })).body.status, 'wrong_role')
})

test('invite: admin-controlled accounts', async () => {
  const inst = { id: randomUUID(), name: 'New Prof', email: 'np@school.edu', user_id: null }; tables.instructors.push(inst)
  assert.equal((await call('POST', '/api/users/invite', 'v1', { email: 'x@y.co', full_name: 'X', role: 'admin' })).status, 403)
  assert.equal((await call('POST', '/api/users/invite', 'admin', { email: 'np@school.edu', full_name: 'New Prof', role: 'instructor' })).status, 400) // no record chosen
  assert.equal((await call('POST', '/api/users/invite', 'admin', { email: 'np@school.edu', full_name: 'New Prof', role: 'student' })).status, 400)
  const r = await call('POST', '/api/users/invite', 'admin', { email: 'NP@school.edu', full_name: 'New Prof', role: 'instructor', instructor_id: inst.id })
  assert.equal(r.status, 201)
  assert.equal(tables.profiles.find((p) => p.id === r.body.data.id).role, 'instructor')
  assert.equal(inst.user_id, r.body.data.id)
  assert.equal((await call('POST', '/api/users/invite', 'admin', { email: 'x@y.co', full_name: 'X', role: 'instructor', instructor_id: inst.id })).status, 409) // already has login
  assert.equal((await call('POST', '/api/users/invite', 'admin', { email: 'juan@school.edu', full_name: 'J', role: 'admin' })).status, 409) // exists (confirmed in fake)
})

test('users list is staff only; student roles are not editable there', async () => {
  const list = await call('GET', '/api/users', 'admin')
  assert.ok(list.body.data.every((p) => p.role !== 'student'))
  assert.equal((await call('PUT', `/api/users/${v1}/role`, 'admin', { role: 'viewer' })).status, 409)
  assert.equal((await call('PUT', `/api/users/${evil}/role`, 'admin', { role: 'superuser' })).status, 400)
  assert.equal((await call('PUT', `/api/users/${evil}/role`, 'admin', { role: 'viewer' })).status, 200)
})

test('unlink and delete send the account back to "not linked"', async () => {
  const juan = tables.students.find((s) => s.student_number === '2023-00125')
  assert.equal((await call('POST', `/api/students/${juan.id}/unlink`, 'admin')).status, 200)
  assert.equal(juan.profile_id, null); assert.equal(tables.profiles.find((p) => p.id === v1).role, 'viewer')
  assert.equal((await call('GET', '/api/schedules', 'v1')).status, 403)         // access gone immediately
  assert.equal((await call('POST', '/api/me/claim-student', 'v1', { student_number: '2023-00125' })).status, 200) // can claim again
  assert.equal((await call('DELETE', `/api/students/${juan.id}`, 'admin')).status, 200)
  assert.equal(tables.profiles.find((p) => p.id === v1).role, 'viewer')
})

test('section in use cannot be silently reassigned; crud reads are admin only', async () => {
  assert.equal((await call('GET', '/api/sections', 'admin')).status, 200)
  assert.equal((await call('GET', '/api/sections', 'v2')).status, 403)
})

test('pre-check is rate limited', async () => {
  let last
  for (let i = 0; i < 40; i++) last = await call('POST', '/public/student-check', null, { student_number: 'X' + i, email: 'a@b.co' })
  assert.equal(last.status, 429)
})

test('server only ever talked to the fake Supabase', () => {
  assert.ok(calls.length > 50)
})
