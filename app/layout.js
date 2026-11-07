export const metadata = {
  title: 'Tryout TKA',
  description: 'Aplikasi Tryout TKA Online',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
