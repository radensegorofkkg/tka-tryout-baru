import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cekAdmin } from '../../../../lib/adminAuth';
import { normalisasiSiswa } from '../../../../lib/importSiswa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });

function buatDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) return null;
  return createClient(url, kunci, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ambilSemua(buatQuery) {
  const hasil = [];
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await buatQuery().range(dari, dari + 999);
    if (error) throw new Error(error.message);
    hasil.push(...data);
    if (data.length < 1000) break;
  }
  return hasil;
}

/* ---------- GET: daftar seluruh siswa ---------- */
export async function GET(request) {
  if (!cekAdmin(request)) return salah('Kata sandi admin salah.', 401);
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY).', 500);
  try {
    const siswa = await ambilSemua(() =>
      db.from('students').select('nomor_ujian, nama_lengkap, is_logged_in').order('nomor_ujian')
    );
    return NextResponse.json({ siswa });
  } catch (e) {
    return salah('Gagal membaca data siswa: ' + e.message, 500);
  }
}

/* ---------- POST: tambah, hapus, reset login ---------- */
async function tambah(db, b) {
  const n = normalisasiSiswa({ npsn: b.npsn, absen: b.absen, nama: b.nama });
  if (n.galat.length) return salah(n.galat.join(' '));
  const { error } = await db.from('students').insert({ nomor_ujian: n.nomor, nama_lengkap: n.nama, is_logged_in: false });
  if (error) {
    if (error.code === '23505') return salah(`Nomor ujian ${n.nomor} sudah terdaftar.`, 409);
    throw new Error(error.message);
  }
  return NextResponse.json({ ok: true, nomor_ujian: n.nomor });
}

async function hapus(db, b) {
  const nomor = String(b.nomor_ujian ?? '').trim();
  if (!nomor) return salah('Permintaan tidak valid.');
  const { data, error } = await db.from('students').delete().eq('nomor_ujian', nomor).select('nomor_ujian');
  if (error) {
    if (error.code === '23503') return salah('Siswa ini sudah memiliki data ujian, jadi tidak bisa dihapus.', 409);
    throw new Error(error.message);
  }
  if (!data || data.length === 0) return salah('Siswa tidak ditemukan.', 404);
  return NextResponse.json({ ok: true });
}

async function resetLogin(db, b) {
  const nomor = String(b.nomor_ujian ?? '').trim();
  if (!nomor) return salah('Permintaan tidak valid.');
  const { data, error } = await db
    .from('students')
    .update({ is_logged_in: false, sesi_token: null })
    .eq('nomor_ujian', nomor)
    .select('nomor_ujian');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return salah('Siswa tidak ditemukan.', 404);
  return NextResponse.json({ ok: true });
}

export async function POST(request) {
  if (!cekAdmin(request)) return salah('Kata sandi admin salah.', 401);
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY).', 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return salah('Permintaan tidak valid.');
  }

  try {
    switch (body.aksi) {
      case 'tambah': return await tambah(db, body);
      case 'hapus': return await hapus(db, body);
      case 'reset_login': return await resetLogin(db, body);
      default: return salah('Aksi tidak dikenal.');
    }
  } catch (e) {
    return salah('Terjadi kesalahan di server: ' + e.message, 500);
  }
}
