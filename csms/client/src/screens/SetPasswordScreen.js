import React, { useState } from 'react'
import { ScrollView, Text } from 'react-native'
import { useAuth } from '../hooks/useAuth'
import { Banner, Btn, Card, Field, H1, Muted } from '../components/ui'
import { C, FONT } from '../theme'

// Shown after an invitation link or a password-reset link, before anything else.
export default function SetPasswordScreen() {
  const { setPassword, signOut } = useAuth()
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError('')
    if (pw.length < 8) return setError('Use a password with at least 8 characters.')
    if (pw !== again) return setError('The two passwords do not match.')
    setBusy(true)
    const { error: e } = await setPassword(pw)
    setBusy(false)
    if (e) setError(e.message)
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
        <Text style={[FONT, { fontWeight: '700', fontSize: 17, color: C.blue }]}>
          CSMS
        </Text>
        <H1>Choose your password</H1>
        <Muted>You will use it to sign in from now on.</Muted>
        <Banner>{error}</Banner>
        <Field
          label="New password"
          value={pw}
          onChangeText={setPw}
          secureTextEntry
          autoComplete="new-password"
        />
        <Field
          label="Confirm password"
          value={again}
          onChangeText={setAgain}
          secureTextEntry
          autoComplete="new-password"
          onSubmitEditing={submit}
        />
        <Btn kind="primary" title={busy ? 'Saving…' : 'Save password'} onPress={submit} disabled={busy} />
        <Btn small title="Sign out" onPress={signOut} />
      </Card>
    </ScrollView>
  )
}
