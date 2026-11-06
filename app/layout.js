export const metadata = {
  title: 'Tryout TKA Online',
  description: 'Aplikasi Tryout Tes Kemampuan Akademik',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
