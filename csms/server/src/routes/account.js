import { Router } from 'express'
import { db } from '../db.js'
import { wrap } from '../middleware/auth.js'
import { logAudit } from '../audit.js'
import { dbError } from '../errors.js'
import { rateLimit } from '../ratelimit.js'
import {
  EMAIL, CLAIM_REPLIES, normNumber, normEmail, normCode, hashCode,
} from '../lib/students.js'

const NOT_MATCHED =
  "We couldn't match that student number and email to the school roster. Check them, or ask the registrar."

// ---- Public: used by the registration form BEFORE an account exists ----
// This is a convenience check only. The real proof of identity happens in claim_student(),
// after the email is verified, so skipping this endpoint gains an attacker nothing.
export const publicRouter = Router()

publicRouter.post(
  '/student-check',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }),
  wrap(async (req, res) => {
    const number = normNumber(req.body?.student_number)
    const email = normEmail(req.body?.email)
    if (!number || !EMAIL.test(email)) {
      return res.status(400).json({ error: 'Enter your student number and a valid email address.' })
    }
    const { data: s, error } = await db
      .from('students')
      .select('email,profile_id')
      .eq('student_number', number)
      .maybeSingle()
    if (error) throw dbError(error)
    // Same answer for "no such number" and "wrong email", so this cannot be used to browse the roster.
    if (!s || (s.email && s.email !== email)) return res.status(404).json({ error: NOT_MATCHED })
    if (s.profile_id) {
      return res.status(409).json({
        error: 'That student number already has an account. Sign in, or use "Forgot password".',
      })
    }
    res.json({ ok: true, needs_code: !s.email })
  }),
)

// ---- Signed in and email-verified: link this account to a roster row ----
// The user id and email come from the verified token, never from the request body.
export const claimStudent = [
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, key: (req) => req.user.id }),
  wrap(async (req, res) => {
    const number = normNumber(req.body?.student_number)
    if (!number) return res.status(400).json({ error: 'Enter your student number.' })
    const codeHash = normCode(req.body?.code) ? hashCode(req.body.code) : null

    const { data: status, error } = await db.rpc('claim_student', {
      p_user_id: req.user.id,
      p_email: req.user.email,
      p_student_number: number,
      p_code_hash: codeHash,
    })
    if (error) throw dbError(error)

    if (status !== 'ok') {
      await logAudit(req.user, 'claim-failed', 'students', null, null, { status })
      const [http, message] = CLAIM_REPLIES[status] || [500, 'Something went wrong. Try again.']
      return res.status(http).json({ error: message, status })
    }
    const { data: student, error: e2 } = await db
      .from('students')
      .select('id,student_number,full_name,course,year_level,section_id,section:sections(id,section_name)')
      .eq('profile_id', req.user.id)
      .single()
    if (e2) throw dbError(e2)
    await logAudit(req.user, 'claim', 'students', student.id, null, { student_number: student.student_number })
    res.json({ data: { student } })
  }),
]
