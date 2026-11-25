import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normNumber, normEmail, generateClaimCode, formatCode, normCode, hashCode,
  rosterRow, parseYearLevel, headerKey, sectionKey, CLAIM_REPLIES,
} from '../src/lib/students.js'

test('student numbers and emails normalize like the database trigger', () => {
  assert.equal(normNumber('  2023-00125 '), '2023-00125')
  assert.equal(normNumber('ab-12'), 'AB-12')
  assert.equal(normEmail(' Juan@School.EDU '), 'juan@school.edu')
})

test('claim codes: 8 chars, no ambiguous letters, format/hash are input-insensitive', () => {
  for (let i = 0; i < 200; i++) {
    const c = generateClaimCode()
    assert.match(c, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
  }
  const c = 'ABCD2345'
  assert.equal(formatCode(c), 'ABCD-2345')
  assert.equal(hashCode('abcd-2345'), hashCode('ABCD 2345'))
  assert.equal(hashCode(formatCode(c)), hashCode(c))
  assert.notEqual(hashCode('ABCD2346'), hashCode(c))
  assert.match(hashCode(c), /^[0-9a-f]{64}$/)
  assert.equal(normCode(' ab-cd '), 'ABCD')
  assert.equal(new Set(Array.from({ length: 50 }, generateClaimCode)).size, 50)
})

test('registrar-style headers are understood', () => {
  assert.equal(headerKey('Student number'), 'student_number')
  assert.equal(headerKey(' Year Level '), 'year_level')
  const r = rosterRow({
    'student number': '2023-00125', 'student name': 'Juan  Dela Cruz', course: 'BSIT',
    'year level': '3', section: ' BSIT  3A ', email: 'Juan@School.edu',
  })
  assert.deepEqual(r, {
    student_number: '2023-00125', full_name: 'Juan Dela Cruz', email: 'juan@school.edu',
    course: 'BSIT', year_level: 3, section: 'BSIT 3A',
  })
})

test('roster validation messages', () => {
  assert.throws(() => rosterRow({ full_name: 'X' }), /Student number is required/)
  assert.throws(() => rosterRow({ student_number: '1', }), /Student name is required/)
  assert.throws(() => rosterRow({ student_number: 'bad number!', full_name: 'X' }), /not a valid student number/)
  assert.throws(() => rosterRow({ student_number: '1', full_name: 'X', email: 'nope' }), /not a valid email/)
  assert.throws(() => rosterRow({ student_number: '1', full_name: 'X', year: 'third' }), /Year level/)
  assert.equal(rosterRow({ student_number: '1', full_name: 'X' }).year_level, null)
})

test('year level parsing', () => {
  assert.equal(parseYearLevel('3rd year'), 3)
  assert.equal(parseYearLevel(''), null)
  assert.throws(() => parseYearLevel('0'))
  assert.throws(() => parseYearLevel('11'))
})

test('sections match regardless of case and spacing', () => {
  assert.equal(sectionKey(' bsit   3a '), sectionKey('BSIT 3A'))
})

test('every status the SQL function can return has a reply', () => {
  const sql = ['not_found','email_mismatch','no_code_issued','code_required','bad_code','code_expired','locked','taken','already_linked','wrong_role','no_profile']
  for (const s of sql) assert.ok(CLAIM_REPLIES[s], s)
  // not_found and email_mismatch must be indistinguishable to the caller
  assert.deepEqual(CLAIM_REPLIES.not_found, CLAIM_REPLIES.email_mismatch)
})
