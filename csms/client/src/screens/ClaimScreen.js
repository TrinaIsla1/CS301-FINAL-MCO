import React, { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { Banner, Btn, Card, Field, H1, Muted } from '../components/ui'
import { PENDING_CLAIM_KEY } from '../config'
import { C } from '../theme'

const DAY = 24 * 60 * 60 * 1000

// For a verified account that is not linked to a student record yet. Right after registration the
// student number is already known, so the link happens by itself. Otherwise the student types it.
// The server decides: the number must be on the roster AND match the verified email (or a code).
export default function ClaimScreen() {
  const { session, refreshProfile } = useAuth()
  const [number, setNumber] = useState('')
  const [code, setCode] = useState('')
  const [auto, setAuto] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (n, c) => {
    setBusy(true)
    setError('')
    try {
      await api.post('/api/me/claim-student', { student_number: n, code: c })
      await refreshProfile() // role is now "student": the schedule opens
    } catch (e) {
      setError(e.message)
      setBusy(false)
      return false
    }
    return true
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_CLAIM_KEY)
        if (raw) {
          await AsyncStorage.removeItem(PENDING_CLAIM_KEY) // one attempt only
          const p = JSON.parse(raw)
          const mine = p.email === (session?.user?.email || '').toLowerCase()
          if (mine && p.student_number && Date.now() - p.at < DAY) {
            setNumber(p.student_number)
            setCode(p.code || '')
            await run(p.student_number, p.code || '')
          }
        }
      } catch (_) {
        /* fall through to the form */
      }
      if (!cancelled) setAuto(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (auto) {
    return (
      <View style={{ alignItems: 'center', gap: 12, padding: 32 }}>
        <ActivityIndicator color={C.blue} />
        <Muted>Linking your student record…</Muted>
      </View>
    )
  }

  return (
    <View style={{ gap: 20, maxWidth: 520 }}>
      <H1>Link your student record</H1>
      <Muted>
        Your account is verified but not linked to a student record yet. Enter your student number.
        It must match the school roster and the email you signed up with ({session?.user?.email}).
        If the school has no email on file for you, enter the registration code the registrar gave you.
      </Muted>
      <Card style={{ gap: 14 }}>
        <Banner>{error}</Banner>
        <Field
          label="Student number"
          value={number}
          onChangeText={setNumber}
          autoCapitalize="characters"
          placeholder="e.g. 2023-00125"
        />
        <Field
          label="Registration code (only if the registrar gave you one)"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="XXXX-XXXX"
        />
        <Btn
          kind="primary"
          title={busy ? 'Checking…' : 'Link my record'}
          disabled={busy || !number.trim()}
          onPress={() => run(number, code)}
        />
      </Card>
      <Muted>Instructors and administrators: ask an administrator to send you an invitation.</Muted>
    </View>
  )
}
