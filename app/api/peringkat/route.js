import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { susunPeringkat } from '../../../lib/peringkat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Halaman publik: tidak ada kata sandi. Hanya mengirim nama yang sudah disamarkan, sekolah, skor, dan nilai.
// Hanya ujian yang peringkatnya dibuka admin yang bisa dilihat.
const CACHE = 'public, s-maxage=30, stale-while-revalidate=60';
const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status, headers: { 'Cache-Control': 'no-store' } });
const ok = (isi) => NextResponse.json(isi, { headers: { 'Cache-Control': CACHE } });

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

// GET                  -> daftar ujian yang peringkatnya dibuka
// GET ?ujian_id=N      -> peringkat siswa dan rata-rata sekolah untuk ujian itu
export async function GET(request) {
  const db = buatDb();
  if (!db) return salah('Layanan belum siap.', 500);

  const param = new URL(request.url).searchParams.get('ujian_id');

  try {
    if (param === null) {
      const { data, error } = await db
        .from('ujian')
        .select('id, nama')
        .eq('peringkat_terbuka', true)
        .order('id', { ascending: false });
      if (error) throw new Error(error.message);
      return ok({ ujian: data });
    }

    const ujianId = Number(param);
    if (!Number.isInteger(ujianId)) return salah('Permintaan tidak valid.');

    const { data: u, error: eu } = await db
      .from('ujian')
      .select('id, nama, peringkat_terbuka')
      .eq('id', ujianId)
      .maybeSingle();
    if (eu) throw new Error(eu.message);
    if (!u || !u.peringkat_terbuka) return salah('Peringkat untuk ujian ini belum dibuka.', 403);

    const { data: bs, error: eb } = await db.from('ujian_soal').select('soal(skor)').eq('ujian_id', ujianId);
    if (eb) throw new Error(eb.message);
    const maks = bs.reduce((a, b) => a + (Number(b.soal?.skor) || 0), 0);

    const siswa = await ambilSemua(() => db.from('students').select('nomor_ujian, nama_lengkap').order('nomor_ujian'));
    const sesi = await ambilSemua(() =>
      db.from('sesi_ujian').select('nomor_ujian, selesai_at, skor').eq('ujian_id', ujianId).not('selesai_at', 'is', null).order('id')
    );
    const { data: dataSekolah } = await db.from('sekolah').select('npsn, nama');
    const namaSekolah = new Map((dataSekolah || []).map((x) => [x.npsn, x.nama]));

    const hasil = susunPeringkat({ siswa, sesi, namaSekolah, maks });
    return ok({ ujian: { id: u.id, nama: u.nama, maks }, ...hasil });
  } catch (e) {
    return salah('Gagal memuat peringkat. Coba lagi sebentar.', 500);
  }
}
