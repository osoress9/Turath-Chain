import type { Metadata } from "next"
import { auth } from "@/auth"
import { AppProvider } from "@/components/app-provider"
import "./globals.css"

export const metadata: Metadata = {
  title: "Turath Chain",
  description: "Penelusuran rantai intelektual teks Islam klasik",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()

  return (
    <html lang="id">
      <body>
        <AppProvider session={session}>{children}</AppProvider>
      </body>
    </html>
  )
}
