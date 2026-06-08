"use client"

import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

type AppProviderProps = {
  children: React.ReactNode
  session: Session | null
}

export function AppProvider({ children, session }: AppProviderProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>
}
