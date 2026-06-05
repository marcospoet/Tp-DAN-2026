import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { PwaRegister } from '@/components/pwa-register'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: 'BudgetBuddy - Finanzas con IA',
  description: 'Rastreador de gastos con IA para la economía argentina. Registrá gastos por texto, foto o audio.',
  metadataBase: new URL('https://finanzas-budget-buddy.vercel.app'),
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BudgetBuddy',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" storageKey="bb_theme" enableSystem={false}>
          <PwaRegister />
          {children}
          <Toaster position="bottom-right" richColors closeButton offset="calc(env(safe-area-inset-bottom, 0px) + 96px)" />
        </ThemeProvider>
      </body>
    </html>
  )
}
