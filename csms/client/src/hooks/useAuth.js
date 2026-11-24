import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

const AuthContext = createContext(null)

async function updateUserMetadata(metadata) {
  const { error } = await supabase.auth.updateUser({ data: metadata })
  if (!error) return null

  const { error: signOutError } = await supabase.auth.signOut()
  return signOutError
    ? new Error(`${error.message} Sign out failed: ${signOutError.message}`)
    : error
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileSyncError, setProfileSyncError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    )
    return () => sub.subscription.unsubscribe()
  }, [])

  // Load the user's role from the API whenever the signed-in user changes.
  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    api
      .get('/api/me')
      .then((r) => setProfile(r.data))
      .catch(() => setProfile(null))
  }, [session?.user?.id])

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      profileSyncError,
      clearProfileSyncError: () => setProfileSyncError(''),
      signIn: async (email, password, metadata) => {
        const result = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (result.error || !metadata) return result

        const error = await updateUserMetadata(metadata)
        if (!error) {
          setProfileSyncError('')
          return result
        }

        setProfileSyncError(`Your profile details could not be saved: ${error.message}`)
        return { error }
      },
      signUp: (email, password, fullName, metadata = {}) =>
        supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, ...metadata } },
        }),
      resetPassword: (email) => supabase.auth.resetPasswordForEmail(email),
      verifyEmail: async (email, token, metadata) => {
        const result = await supabase.auth.verifyOtp({
          email,
          token,
          type: 'email',
        })
        if (result.error || !metadata) return result

        const error = await updateUserMetadata(metadata)
        if (error) {
          setProfileSyncError(
            `Your profile details could not be saved: ${error.message}`,
          )
          return { error }
        }
        setProfileSyncError('')
        return result
      },
      resendCode: (email) => supabase.auth.resend({ type: 'signup', email }),
      signOut: () => supabase.auth.signOut(),
    }),
    [
      session,
      profile,
      loading,
      profileSyncError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
