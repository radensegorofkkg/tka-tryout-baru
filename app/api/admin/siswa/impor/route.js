import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cekAdmin } from '../../../../../lib/adminAuth';
import { bacaFileSiswa, periksaSiswa } from '../../../../../lib/importSiswa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAKS_BYTE = 4 * 1024 * 1024; // 4 MB
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

// mode "periksa": hanya memeriksa, tidak menyimpan apa pun.
// mode "simpan": memeriksa ulang di server, lalu menambah siswa baru dan memperbarui nama yang berubah.
export async function POST(request) {
  if (!cekAdmin(request)) return salah('Kata sandi admin salah.', 401);
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY).', 500);

  let form;
  try {
    form = await request.formData();
  } catch {
    return salah('Permintaan tidak valid.');
  }
  const file = form.get('file');
  const mode = form.get('mode') === 'simpan' ? 'simpan' : 'periksa';
  if (!file || typeof file === 'string') return salah('Pilih file .xlsx terlebih dahulu.');
  if (!file.name.toLowerCase().endsWith('.xlsx')) return salah('Format file harus .xlsx.');
  if (file.size > MAKS_BYTE) return salah('Ukuran file melebihi 4 MB.', 413);

  try {
    const data = await bacaFileSiswa(Buffer.from(await file.arrayBuffer()));
    const sudahAda = await ambilSemua(() => db.from('students').select('nomor_ujian, nama_lengkap').order('nomor_ujian'));
    const dbNama = new Map(sudahAda.map((s) => [s.nomor_ujian, s.nama_lengkap]));
    const hasil = periksaSiswa(data, dbNama);

    if (mode === 'periksa') return NextResponse.json({ nama_file: file.name, ...hasil });
    if (!hasil.ok) return NextResponse.json({ pesan: 'File masih memiliki error. Perbaiki dulu.', nama_file: file.name, ...hasil }, { status: 422 });

    const baru = hasil.siswa.filter((s) => s.status === 'baru');
    const ubah = hasil.siswa.filter((s) => s.status === 'ubah');
    let ditambah = 0;
    let diperbarui = 0;

    try {
      for (let i = 0; i < baru.length; i += 500) {
        const potong = baru.slice(i, i + 500).map((s) => ({ nomor_ujian: s.nomor_ujian, nama_lengkap: s.nama_lengkap, is_logged_in: false }));
        const { error } = await db.from('students').insert(potong);
        if (error) throw new Error(error.message);
        ditambah += potong.length;
      }
      for (let i = 0; i < ubah.length; i += 10) {
        const kelompok = ubah.slice(i, i + 10);
        const hasilUbah = await Promise.all(
          kelompok.map((s) => db.from('students').update({ nama_lengkap: s.nama_lengkap }).eq('nomor_ujian', s.nomor_ujian))
        );
        const gagal = hasilUbah.find((h) => h.error);
        if (gagal) throw new Error(gagal.error.message);
        diperbarui += kelompok.length;
      }
    } catch (e) {
      return salah(`Penyimpanan terhenti: ${e.message}. Sudah tersimpan: ${ditambah} siswa baru dan ${diperbarui} nama diperbarui. Periksa file lalu simpan ulang; siswa yang sudah masuk tidak akan dobel.`, 500);
    }

    return NextResponse.json({ ok: true, ditambah, diperbarui, dilewati: hasil.siswa.length - baru.length - ubah.length });
  } catch (e) {
    return salah('Terjadi kesalahan di server: ' + e.message, 500);
  }
}
