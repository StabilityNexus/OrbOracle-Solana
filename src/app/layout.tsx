import '@solana/wallet-adapter-react-ui/styles.css'
import './globals.css'
import { Metadata } from 'next'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { WalletProvider } from '@/providers/WalletProvider'

export const metadata: Metadata = {
  title: 'OrbOracle - Decentralized Oracle Platform',
  description: 'A platform for decentralized oracles on Solana.',
  generator: 'Next.js',
  icons: {
    icon: '/OrbOracle.png',
    shortcut: '/OrbOracle.png',
    apple: '/OrbOracle.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      <body className="font-sans">
        <WalletProvider>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableSystem
            disableTransitionOnChange
          >
            <main className="min-h-screen flex flex-col">
              {children}
            </main>
          </ThemeProvider>
        </WalletProvider>
      </body>
    </html>
  )
}
