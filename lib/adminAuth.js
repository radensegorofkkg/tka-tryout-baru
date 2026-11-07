import { timingSafeEqual } from 'crypto';

// Memeriksa kata sandi admin yang dikirim lewat header "x-admin-password".
// Kata sandi yang benar disimpan di Vercel sebagai ADMIN_PASSWORD.
export function cekAdmin(request) {
  const sandi = process.env.ADMIN_PASSWORD;
  const kiriman = request.headers.get('x-admin-password');
  if (!sandi || !kiriman) return false;
  const a = Buffer.from(kiriman);
  const b = Buffer.from(sandi);
  return a.length === b.length && timingSafeEqual(a, b);
}
