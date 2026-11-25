import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // The role (and the student or instructor record) always comes from the API, never from the browser.
  const refreshProfile = useCallback(
    () =>
      api
        .get('/api/me')
        .then((r) => {
          setProfile(r.data)
          return r.data
        })
        .catch(() => {
          setProfile(null)
          return null
        }),
    [],
  )

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    refreshProfile()
  }, [session?.user?.id])

  // Invited instructors and admins arrive without a password; so do password-reset links.
  const needsPassword =
    !!session && (recovery || session.user?.user_metadata?.needs_password === true)

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      needsPassword,
      refreshProfile,
      signIn: (email, password) =>
        supabase.auth.signInWithPassword({ email, password }),
      signUp: (email, password, fullName) =>
        supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        }),
      resetPassword: (email) => supabase.auth.resetPasswordForEmail(email),
      setPassword: async (password) => {
        const res = await supabase.auth.updateUser({
          password,
          data: { needs_password: false },
        })
        if (!res.error) setRecovery(false)
        return res
      },
      verifyEmail: (email, token) =>
        supabase.auth.verifyOtp({ email, token, type: 'email' }),
      resendCode: (email) => supabase.auth.resend({ type: 'signup', email }),
      signOut: () => supabase.auth.signOut(),
    }),
    [session, profile, loading, needsPassword, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
