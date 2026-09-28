import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Entre Brisas',
  description: 'Jogo multiplayer de associação de palavras',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}