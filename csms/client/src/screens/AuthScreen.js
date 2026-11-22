import React, { useState } from 'react'
import { ScrollView, View, Text } from 'react-native'
import { useAuth } from '../hooks/useAuth'
import { Banner, Btn, Card, Field, H1, Muted } from '../components/ui'
import { C, FONT } from '../theme'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthScreen() {
  const { signIn, signUp, resetPassword, verifyEmail, resendCode } = useAuth()
  const [mode, setMode] = useState('login') // login | register | verify | reset
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    code: '',
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    setError('')
    setNotice('')
    if (!EMAIL.test(form.email)) return setError('Enter a valid email address.')
    if ((mode === 'login' || mode === 'register') && form.password.length < 8)
      return setError('Use a password with at least 8 characters.')
    if (mode === 'register' && !form.name.trim())
      return setError('Enter your full name.')
    if (mode === 'verify' && !/^\d{6,10}$/.test(form.code.trim()))
      return setError('Enter the code from your email.')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: e } = await signIn(form.email, form.password)
        if (e) throw e
      } else if (mode === 'register') {
        const { error: e } = await signUp(
          form.email,
          form.password,
          form.name.trim(),
        )
        if (e) throw e
        setNotice('We sent a verification code to your email.')
        setMode('verify')
      } else if (mode === 'verify') {
        const { error: e } = await verifyEmail(form.email, form.code.trim())
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
      <Card style={{ width: '100%', maxWidth: 420, gap: 16 }}>
        <Text
          style={[FONT, { fontWeight: '700', fontSize: 17, color: C.blue }]}
        >
          CSMS
        </Text>
        <H1>{titles[mode]}</H1>
        <Banner>{error}</Banner>
        <Banner kind="ok">{notice}</Banner>
        {mode === 'register' && (
          <Field
            label="Full name"
            value={form.name}
            onChangeText={set('name')}
            autoComplete="name"
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
        />
        {(mode === 'login' || mode === 'register') && (
          <Field
            label="Password"
            value={form.password}
            onChangeText={set('password')}
            secureTextEntry
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            onSubmitEditing={submit}
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
