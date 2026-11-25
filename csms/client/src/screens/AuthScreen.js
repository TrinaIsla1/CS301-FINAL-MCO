import React, { useState } from 'react'
import { Pressable, ScrollView, View, Text } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { Banner, Btn, Card, Field, H1, Muted } from '../components/ui'
import { PENDING_CLAIM_KEY } from '../config'
import { C, FONT } from '../theme'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Three entry points, one Supabase Auth. After sign-in the API's role decides which dashboard opens,
// so choosing the "wrong" portal never grants anything. Only students can register themselves.
const PORTALS = [
  { id: 'student', label: 'Student', hint: 'Sign in to see your class schedule.' },
  {
    id: 'instructor',
    label: 'Instructor',
    hint: 'Instructor accounts are created by an administrator. Open the invitation email to choose your password, then sign in here.',
  },
  {
    id: 'admin',
    label: 'Admin',
    hint: 'For schedulers and administrators. Accounts are created by an existing administrator.',
  },
]

export default function AuthScreen() {
  const { signIn, signUp, resetPassword, verifyEmail, resendCode } = useAuth()
  const [portal, setPortal] = useState('student')
  const [mode, setMode] = useState('login') // login | register | verify | reset
  const [form, setForm] = useState({
    name: '',
    studentNumber: '',
    email: '',
    password: '',
    regCode: '',
    code: '',
  })
  const [needsCode, setNeedsCode] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const current = PORTALS.find((p) => p.id === portal)
  const student = portal === 'student'

  const pickPortal = (id) => {
    setPortal(id)
    setMode('login')
    setError('')
    setNotice('')
  }
  const goto = (m) => {
    setMode(m)
    setError('')
    setNotice('')
  }

  const submit = async () => {
    setError('')
    setNotice('')
    const email = form.email.trim()
    if (!EMAIL.test(email)) return setError('Enter a valid email address.')
    if ((mode === 'login' || mode === 'register') && form.password.length < 8)
      return setError('Use a password with at least 8 characters.')
    if (mode === 'register' && !form.name.trim())
      return setError('Enter your full name.')
    if (mode === 'register' && !form.studentNumber.trim())
      return setError('Enter your student number.')
    if (mode === 'verify' && !/^\d{6,10}$/.test(form.code.trim()))
      return setError('Enter the code from your email.')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: e } = await signIn(email, form.password)
        if (e) throw e
      } else if (mode === 'register') {
        // 1. Ask the server whether this student number and email are on the school roster.
        const check = await api.post('/public/student-check', {
          student_number: form.studentNumber,
          email,
        })
        if (check.needs_code && !form.regCode.trim()) {
          setNeedsCode(true)
          throw new Error(
            'The school has no email on file for this student number. Enter the registration code the registrar gave you, then continue.',
          )
        }
        // 2. Create the account. 3. Remember the student number for the "link your record" step.
        const { error: e } = await signUp(email, form.password, form.name.trim())
        if (e) throw e
        await AsyncStorage.setItem(
          PENDING_CLAIM_KEY,
          JSON.stringify({
            email: email.toLowerCase(),
            student_number: form.studentNumber.trim(),
            code: form.regCode.trim(),
            at: Date.now(),
          }),
        )
        setNotice('We sent a verification code to your email.')
        setMode('verify')
      } else if (mode === 'verify') {
        const { error: e } = await verifyEmail(email, form.code.trim())
        if (e) throw e
        // On success Supabase signs the user in; the app then links the student record.
      } else {
        const { error: e } = await resetPassword(email)
        if (e) throw e
        setNotice('If that email has an account, a reset link is on its way.')
        setMode('login')
      }
    } catch (e) {
      if (/not confirmed/i.test(e.message)) {
        // Account exists but was never verified: send a fresh code.
        await resendCode(email)
        setMode('verify')
        setNotice('Verify your email first. We sent you a new code.')
      } else {
        setError(e.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setError('')
    setNotice('')
    const { error: e } = await resendCode(form.email.trim())
    if (e) setError(e.message)
    else setNotice('A new code is on its way.')
  }

  const titles = {
    login: `${current.label} sign in`,
    register: 'Create your student account',
    verify: 'Verify your email',
    reset: 'Reset your password',
  }
  const action = {
    login: 'Sign in',
    register: 'Create account',
    verify: 'Verify email',
    reset: 'Send reset link',
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: C.bg,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 440, gap: 16 }}>
        <Text style={[FONT, { fontWeight: '700', fontSize: 17, color: C.blue }]}>
          CSMS
        </Text>

        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: 'row',
            backgroundColor: C.head,
            borderRadius: 10,
            padding: 4,
            gap: 4,
          }}
        >
          {PORTALS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => pickPortal(p.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: p.id === portal }}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: p.id === portal ? '#fff' : 'transparent',
              }}
            >
              <Text
                style={[
                  FONT,
                  {
                    fontSize: 14,
                    fontWeight: p.id === portal ? '700' : '500',
                    color: p.id === portal ? C.blue : C.muted,
                  },
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <H1>{titles[mode]}</H1>
        {mode === 'login' && <Muted>{current.hint}</Muted>}
        {mode === 'register' && (
          <Muted>
            Use the student number and school email on your school record. We
            check them against the school roster.
          </Muted>
        )}
        <Banner>{error}</Banner>
        <Banner kind="ok">{notice}</Banner>

        {mode === 'register' && (
          <>
            <Field
              label="Full name"
              value={form.name}
              onChangeText={set('name')}
              autoComplete="name"
            />
            <Field
              label="Student number"
              value={form.studentNumber}
              onChangeText={set('studentNumber')}
              autoCapitalize="characters"
              placeholder="e.g. 2023-00125"
            />
          </>
        )}
        <Field
          label={mode === 'register' ? 'School email' : 'Email'}
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={mode !== 'verify'}
        />
        {(mode === 'login' || mode === 'register') && (
          <Field
            label="Password"
            value={form.password}
            onChangeText={set('password')}
            secureTextEntry
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onSubmitEditing={submit}
          />
        )}
        {mode === 'register' && needsCode && (
          <Field
            label="Registration code"
            value={form.regCode}
            onChangeText={set('regCode')}
            autoCapitalize="characters"
            placeholder="XXXX-XXXX"
          />
        )}
        {mode === 'verify' && (
          <Field
            label="Verification code"
            value={form.code}
            onChangeText={set('code')}
            keyboardType="number-pad"
            maxLength={10}
            autoComplete="one-time-code"
            onSubmitEditing={submit}
          />
        )}

        <Btn
          kind="primary"
          title={busy ? 'Please wait…' : action[mode]}
          onPress={submit}
          disabled={busy}
        />
        <View style={{ gap: 8 }}>
          {mode === 'verify' && <Btn small title="Resend code" onPress={resend} />}
          {mode !== 'login' && (
            <Btn small title="Back to sign in" onPress={() => goto('login')} />
          )}
          {mode === 'login' && student && (
            <Btn
              small
              title="I'm a new student: create an account"
              onPress={() => goto('register')}
            />
          )}
          {mode === 'login' && (
            <Btn small title="Forgot password?" onPress={() => goto('reset')} />
          )}
        </View>
      </Card>
    </ScrollView>
  )
}
