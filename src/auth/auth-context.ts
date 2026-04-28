import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthState = {
  user: User | null
  session: Session | null
  accessToken: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ session: Session | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
