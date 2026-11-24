import React, { useState } from 'react'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useAuth } from '../hooks/useAuth'
import {
  Banner,
  Btn,
  Card,
  Field,
  H1,
  PasswordField,
  Select,
} from '../components/ui'
import { C, FONT } from '../theme'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PROGRAMS = ['BSIS', 'BSCS', 'BSIT', 'BSEMC']
const STACKED_FIELD_STYLE = { flexGrow: 0, flexBasis: 'auto' }

export default function ViewerLoginScreen() {
  const { signIn, profileSyncError, clearProfileSyncError } = useAuth()
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    password: '',
    program: '',
    section: '',
  })
  const [programOpen, setProgramOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key) => (value) =>
    setForm((current) => ({ ...current, [key]: value }))

  const submit = async () => {
    setError('')
    clearProfileSyncError()
    const email = form.email.trim()
    const fullName = form.fullName.trim()
    if (!EMAIL.test(email)) return setError('Enter a valid email address.')
    if (!fullName) return setError('Enter your full name.')
    if (form.password.length < 8)
      return setError('Use a password with at least 8 characters.')
    if (!form.program) return setError('Select your program.')

    const metadata = {
      full_name: fullName,
      program: form.program,
      section: form.section.trim(),
    }

    setBusy(true)
    try {
      const { error: authError } = await signIn(
        email,
        form.password,
        metadata,
      )
      if (authError) throw authError
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
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
      <Card style={{ width: '100%', maxWidth: 420, gap: 6 }}>
        <Text
          style={[FONT, { fontWeight: '700', fontSize: 17, color: C.blue }]}
        >
          CSMS
        </Text>
        <H1>Viewer sign in</H1>
        <Field
          label="Full Name"
          value={form.fullName}
          onChangeText={set('fullName')}
          autoComplete="name"
          style={STACKED_FIELD_STYLE}
        />
        <Field
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={STACKED_FIELD_STYLE}
        />
        <PasswordField
          label="Password"
          value={form.password}
          onChangeText={set('password')}
          autoComplete="current-password"
          onSubmitEditing={submit}
          style={STACKED_FIELD_STYLE}
        />
        {Platform.OS === 'web' ? (
          <Select
            label="Program"
            value={form.program}
            onChange={set('program')}
            style={STACKED_FIELD_STYLE}
            options={[
              { value: '', label: 'Select a program' },
              ...PROGRAMS,
            ]}
          />
        ) : (
          <View style={{ gap: 6 }}>
            <Text
              style={[
                FONT,
                { fontSize: 13, fontWeight: '500', color: C.muted },
              ]}
            >
              Program
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Program"
              accessibilityState={{ expanded: programOpen }}
              onPress={() => setProgramOpen((open) => !open)}
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
              <Text
                style={[
                  FONT,
                  { fontSize: 14, color: form.program ? C.ink : '#8A94A6' },
                ]}
              >
                {form.program || 'Select a program'}
              </Text>
            </Pressable>
            {programOpen && (
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
                      set('program')(program)
                      setProgramOpen(false)
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
        )}
        <Field
          label="Section"
          value={form.section}
          onChangeText={set('section')}
          style={STACKED_FIELD_STYLE}
        />
        <Banner>{error || profileSyncError}</Banner>
        <Btn
          kind="primary"
          title={busy ? 'Please wait…' : 'Sign in'}
          onPress={submit}
          disabled={busy}
        />
      </Card>
    </ScrollView>
  )
}
