import { timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Membuat koneksi database tingkat server (service role). Hanya dipakai di route server.
export function buatDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) return null;
  return createClient(url, kunci, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Memastikan permintaan benar-benar dari siswa yang sedang login.
// Browser siswa mengirim header "x-nomor-ujian" dan "x-sesi-token".
// Mengembalikan data siswa kalau cocok, atau null kalau tidak.
export async function cekSiswa(db, request) {
  const nomor = String(request.headers.get('x-nomor-ujian') ?? '').trim().toUpperCase();
  const token = String(request.headers.get('x-sesi-token') ?? '');
  if (!nomor || !token) return null;

  const { data: siswa } = await db
    .from('students')
    .select('nomor_ujian, nama_lengkap, is_logged_in, sesi_token')
    .eq('nomor_ujian', nomor)
    .maybeSingle();
  if (!siswa || !siswa.is_logged_in || !siswa.sesi_token) return null;

  const a = Buffer.from(token);
  const b = Buffer.from(siswa.sesi_token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { nomor_ujian: siswa.nomor_ujian, nama_lengkap: siswa.nama_lengkap };
}
