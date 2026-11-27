import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './types'

type AuthState = { session: Session | null; profile: Profile | null; loading: boolean }

const AuthContext = createContext<AuthState>({ session: null, profile: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, profile: null, loading: true })

  useEffect(() => {
    const load = async (session: Session | null) => {
      if (!session) return setState({ session: null, profile: null, loading: false })
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      setState({ session, profile: (data as Profile) ?? null, loading: false })
    }
    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { load(session) })
    return () => sub.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

// Email sign-in link (Google sign-in can be added later)
export const signIn = (email: string) =>
  supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })

export const signOut = () => supabase.auth.signOut()
