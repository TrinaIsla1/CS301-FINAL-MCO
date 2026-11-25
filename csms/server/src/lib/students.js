// Pure helpers for student identification. No database access here, so they can be tested alone.
import { createHash, randomInt } from 'node:crypto'

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Same rules as the database trigger, so the API and the database agree.
export const normNumber = (v) => String(v ?? '').trim().toUpperCase()
export const normEmail = (v) => String(v ?? '').trim().toLowerCase()
export const normName = (v) => String(v ?? '').trim().replace(/\s+/g, ' ')

// ---- Registration codes (roster rows with no school email) ----
// No 0/O, 1/I/L: codes get read aloud and typed by hand.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_DAYS = 14

export function generateClaimCode() {
  let code = ''
  for (let i = 0; i < 8; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)]
  return code
}
export const formatCode = (c) => `${c.slice(0, 4)}-${c.slice(4)}`
export const normCode = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
// Only the hash is stored. Typing "abcd efgh" or "ABCD-EFGH" gives the same hash.
export const hashCode = (v) => createHash('sha256').update(normCode(v)).digest('hex')

// ---- What the claim_student() database function can answer, as HTTP replies ----
const NOT_MATCHED =
  "We couldn't match that student number to the email you signed up with. Use your school email, or ask the registrar for a registration code."
export const CLAIM_REPLIES = {
  not_found: [404, NOT_MATCHED],
  email_mismatch: [404, NOT_MATCHED],
  no_code_issued: [400, 'No registration code has been issued for that student number yet. Ask the registrar for one.'],
  code_required: [400, 'Enter the registration code from your school.'],
  bad_code: [400, 'That registration code is not correct.'],
  code_expired: [400, 'That registration code has expired. Ask the registrar for a new one.'],
  locked: [429, 'Too many incorrect codes. Ask the registrar for a new registration code.'],
  taken: [409, 'That student number is already linked to another account. If that was not you, contact the registrar.'],
  already_linked: [409, 'Your account is already linked to a student record.'],
  wrong_role: [403, 'Only student accounts can be linked to a student record.'],
  no_profile: [500, 'Your account is not fully set up yet. Sign out, sign in again, and retry.'],
}

// ---- Roster CSV rows ----
// Registrar files use headers like "Student number" and "Student name". Accept those.
const ALIASES = {
  student_number: ['student_number', 'student_no', 'student_num', 'student_id', 'id_number', 'id_no', 'studentnumber'],
  full_name: ['full_name', 'student_name', 'name', 'fullname'],
  email: ['email', 'school_email', 'student_email', 'email_address'],
  course: ['course', 'program', 'degree_program'],
  year_level: ['year_level', 'year', 'yearlevel', 'year_lvl'],
  section: ['section', 'section_name', 'class_section'],
}
export const headerKey = (h) =>
  String(h).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export function parseYearLevel(v) {
  const text = String(v ?? '').trim()
  if (!text) return null
  const m = text.match(/\d+/) // "3", "3rd", "3rd year"
  const n = m ? Number(m[0]) : NaN
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    throw new Error('Year level must be a number from 1 to 10, for example 3.')
  }
  return n
}

// Turns one raw CSV row into clean roster fields, or throws a message for the admin.
export function rosterRow(raw) {
  const keyed = {}
  for (const [k, v] of Object.entries(raw || {})) keyed[headerKey(k)] = v
  const get = (field) => {
    for (const name of ALIASES[field]) {
      const v = keyed[name]
      if (v != null && String(v).trim() !== '') return String(v).trim()
    }
    return ''
  }

  const student_number = normNumber(get('student_number'))
  if (!student_number) throw new Error('Student number is required.')
  if (student_number.length > 40 || !/^[A-Z0-9][A-Z0-9._/-]*$/.test(student_number)) {
    throw new Error(`"${student_number}" is not a valid student number. Use letters, digits, - . _ / only.`)
  }
  const full_name = normName(get('full_name'))
  if (!full_name) throw new Error('Student name is required.')
  const email = normEmail(get('email'))
  if (email && !EMAIL.test(email)) throw new Error(`"${email}" is not a valid email address.`)

  return {
    student_number,
    full_name,
    email,
    course: get('course'),
    year_level: parseYearLevel(get('year_level')),
    section: normName(get('section')),
  }
}

// Section names match without regard to case or extra spaces.
export const sectionKey = (name) => normName(name).toLowerCase()
