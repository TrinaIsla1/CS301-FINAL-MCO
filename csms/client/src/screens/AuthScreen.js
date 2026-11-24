import React, { useState } from 'react'
import { Platform, Pressable, ScrollView, View, Text } from 'react-native'
import { useAuth } from '../hooks/useAuth'
import {
  Banner,
  Btn,
  Card,
  Field,
  H1,
  Muted,
  PasswordField,
  Select,
} from '../components/ui'
import { C, FONT } from '../theme'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PROGRAMS = ['BSIS', 'BSCS', 'BSIT', 'BSEMC']
const STACKED_FIELD_STYLE = { flexGrow: 0, flexBasis: 'auto' }

function ProgramField({ value, onChange }) {
  const [open, setOpen] = useState(false)

  if (Platform.OS === 'web') {
    return (
      <Select
        label="Program"
        value={value}
        onChange={onChange}
        style={STACKED_FIELD_STYLE}
        options={[
          { value: '', label: 'Select a program' },
          ...PROGRAMS,
        ]}
      />
    )
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={[FONT, { fontSize: 13, fontWeight: '500', color: C.muted }]}>
        Program
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Program"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={{
          height: 44,
          borderWidth: 1,
          borderColor: '#CBD2DC',
          borderRadius: 8,
          paddingHorizontal: 12,
          backgroundColor: '#fff',
          justifyContent: 'center',
        }}
      >
        <Text style={[FONT, { fontSize: 14, color: value ? C.ink : '#8A94A6' }]}>
          {value || 'Select a program'}
        </Text>
      </Pressable>
      {open && (
        <View
          style={{
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 8,
            backgroundColor: '#fff',
            overflow: 'hidden',
          }}
        >
          {PROGRAMS.map((program) => (
            <Pressable
              key={program}
              accessibilityRole="button"
              onPress={() => {
                onChange(program)
                setOpen(false)
              }}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 12,
                borderBottomWidth: program === 'BSEMC' ? 0 : 1,
                borderBottomColor: C.border,
              }}
            >
              <Text style={[FONT, { fontSize: 14, color: C.ink }]}>
                {program}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

export default function AuthScreen() {
  const {
    signIn,
    signUp,
    resetPassword,
    verifyEmail,
    resendCode,
    profileSyncError,
    clearProfileSyncError,
  } = useAuth()
  const [mode, setMode] = useState('login') // login | register | verify | reset
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    program: '',
    section: '',
    code: '',
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    setError('')
    setNotice('')
    clearProfileSyncError()
    if (!EMAIL.test(form.email)) return setError('Enter a valid email address.')
    if ((mode === 'login' || mode === 'register') && form.password.length < 8)
      return setError('Use a password with at least 8 characters.')
    if ((mode === 'login' || mode === 'register') && !form.fullName.trim())
      return setError('Enter your full name.')
    if ((mode === 'login' || mode === 'register') && !form.program)
      return setError('Select your program.')
    if (mode === 'verify' && !/^\d{6,10}$/.test(form.code.trim()))
      return setError('Enter the code from your email.')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: e } = await signIn(form.email, form.password, {
          full_name: form.fullName.trim(),
          program: form.program,
          section: form.section.trim(),
        })
        if (e) throw e
      } else if (mode === 'register') {
        const { error: e } = await signUp(
          form.email,
          form.password,
          form.fullName.trim(),
          {
            program: form.program,
            section: form.section.trim(),
          },
        )
        if (e) throw e
        setNotice('We sent a verification code to your email.')
        setMode('verify')
      } else if (mode === 'verify') {
        const { error: e } = await verifyEmail(
          form.email,
          form.code.trim(),
          {
            full_name: form.fullName.trim(),
            program: form.program,
            section: form.section.trim(),
          },
        )
        if (e) throw e
        // On success Supabase signs the user in; onAuthStateChange takes over.
      } else {
        const { error: e } = await resetPassword(form.email)
        if (e) throw e
        setNotice('If that email has an account, a reset link is on its way.')
        setMode('login')
      }
    } catch (e) {
      if (/not confirmed/i.test(e.message)) {
        // Account exists but was never verified: send a fresh code.
        await resendCode(form.email)
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
    const { error: e } = await resendCode(form.email)
    if (e) setError(e.message)
    else setNotice('A new code is on its way.')
  }

  const titles = {
    login: 'Sign in',
    register: 'Create an account',
    verify: 'Verify your email',
    reset: 'Reset your password',
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
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          gap: mode === 'login' || mode === 'register' ? 6 : 16,
        }}
      >
        <Text
          style={[FONT, { fontWeight: '700', fontSize: 17, color: C.blue }]}
        >
          CSMS
        </Text>
        <H1>{titles[mode]}</H1>
        <Banner>{error || profileSyncError}</Banner>
        <Banner kind="ok">{notice}</Banner>
        {(mode === 'login' || mode === 'register') && (
          <Field
            label="Full Name"
            value={form.fullName}
            onChangeText={set('fullName')}
            autoComplete="name"
            style={STACKED_FIELD_STYLE}
          />
        )}
        <Field
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={mode !== 'verify'}
          style={STACKED_FIELD_STYLE}
        />
        {(mode === 'login' || mode === 'register') && (
          <PasswordField
            label="Password"
            value={form.password}
            onChangeText={set('password')}
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            onSubmitEditing={submit}
            style={STACKED_FIELD_STYLE}
          />
        )}
        {(mode === 'login' || mode === 'register') && (
          <>
            <ProgramField value={form.program} onChange={set('program')} />
            <Field
              label="Section"
              value={form.section}
              onChangeText={set('section')}
              style={STACKED_FIELD_STYLE}
            />
          </>
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
            style={STACKED_FIELD_STYLE}
          />
        )}
        <Btn
          kind="primary"
          title={busy ? 'Please wait…' : titles[mode]}
          onPress={submit}
          disabled={busy}
        />
        <View style={{ gap: 8 }}>
          {mode === 'verify' && (
            <Btn small title="Resend code" onPress={resend} />
          )}
          {mode !== 'login' && (
            <Btn
              small
              title="Back to sign in"
              onPress={() => {
                setMode('login')
                setError('')
                setNotice('')
              }}
            />
          )}
          {mode === 'login' && (
            <Btn
              small
              title="Create an account"
              onPress={() => {
                setMode('register')
                setError('')
              }}
            />
          )}
          {mode === 'login' && (
            <Btn
              small
              title="Forgot password?"
              onPress={() => {
                setMode('reset')
                setError('')
              }}
            />
          )}
        </View>
        <Muted>
          New accounts start as viewers. An admin can change your role.
        </Muted>
      </Card>
    </ScrollView>
  )
}
