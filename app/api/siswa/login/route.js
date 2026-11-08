import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const jeda = (ms) => new Promise((r) => setTimeout(r, ms));
const rapikan = (t) => String(t ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

// Login siswa. Dijalankan di server, jadi aturan "satu akun hanya bisa login satu kali"
// tidak bisa dilewati dari browser.
export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunciServer = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunciServer) {
    return NextResponse.json({ pesan: 'Konfigurasi server belum lengkap.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ pesan: 'Permintaan tidak valid.' }, { status: 400 });
  }

  const nomor = String(body.nomor_ujian ?? '').trim().toUpperCase();
  const nama = rapikan(body.nama_lengkap);
  if (!nomor || !nama || nomor.length > 50 || nama.length > 150) {
    return NextResponse.json({ pesan: 'Isi nomor ujian dan nama lengkap.' }, { status: 400 });
  }

  const db = createClient(url, kunciServer, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: siswa, error } = await db
    .from('students')
    .select('nomor_ujian, nama_lengkap, is_logged_in')
    .eq('nomor_ujian', nomor)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ pesan: 'Gagal memeriksa data peserta.' }, { status: 500 });
  }

  if (!siswa || rapikan(siswa.nama_lengkap) !== nama) {
    await jeda(600); // memperlambat tebak-tebakan
    return NextResponse.json({ pesan: 'Nomor ujian atau nama lengkap tidak cocok.' }, { status: 401 });
  }

  const SUDAH_LOGIN = {
    pesan: 'Akun ini sudah login. Hubungi pengawas agar admin membuka kembali akun Anda.',
  };
  if (siswa.is_logged_in) {
    return NextResponse.json(SUDAH_LOGIN, { status: 403 });
  }

  // Menandai sudah login hanya jika belum login (aman kalau ada dua permintaan bersamaan).
  const token = randomBytes(32).toString('hex');
  const { data: diubah, error: eu } = await db
    .from('students')
    .update({ is_logged_in: true, sesi_token: token })
    .eq('nomor_ujian', nomor)
    .eq('is_logged_in', false)
    .select('nomor_ujian');
  if (eu) {
    return NextResponse.json({ pesan: 'Gagal memproses login. Coba lagi.' }, { status: 500 });
  }
  if (!diubah || diubah.length === 0) {
    return NextResponse.json(SUDAH_LOGIN, { status: 403 });
  }

  return NextResponse.json({ ok: true, token, nomor_ujian: siswa.nomor_ujian, nama_lengkap: siswa.nama_lengkap });
}
