import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { loginWithCredentials, loginWithGoogleProfile } from "@/lib/api"

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
const hasGoogleAuth = Boolean(googleClientId && googleClientSecret)

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(hasGoogleAuth
      ? [
          Google({
            clientId: googleClientId as string,
            clientSecret: googleClientSecret as string,
          }),
        ]
      : []),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim()
        const password = String(credentials?.password ?? "")
        if (!email || !password) return null

        const user = await loginWithCredentials(email, password)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.userId = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
      }

      if (account?.provider === "google" && profile && "email" in profile) {
        const googleProfile = profile as {
          sub?: string
          email?: string
          name?: string | null
          picture?: string | null
        }
        const email = googleProfile.email?.trim()
        const providerAccountId = googleProfile.sub?.trim() || email

        if (email && providerAccountId) {
          const linkedUser = await loginWithGoogleProfile({
            email,
            name: googleProfile.name ?? null,
            image: googleProfile.picture ?? null,
            providerAccountId,
          })

          if (linkedUser) {
            token.userId = linkedUser.id
            token.email = linkedUser.email
            token.name = linkedUser.name
            token.picture = linkedUser.image
          }
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub ?? "")
        session.user.email = token.email ?? session.user.email ?? ""
        session.user.name = (token.name as string | null | undefined) ?? session.user.name ?? null
        session.user.image = (token.picture as string | null | undefined) ?? session.user.image ?? null
      }
      return session
    },
  },
})
