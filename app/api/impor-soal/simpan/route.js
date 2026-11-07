import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cekAdmin } from '../../../../lib/adminAuth';
import { periksaFile } from '../../../../lib/importSoal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAKS_BYTE = 4 * 1024 * 1024; // 4 MB

// Memeriksa ulang file di server, lalu menyimpannya sekaligus (semua atau tidak sama sekali).
export async function POST(request) {
  if (!cekAdmin(request)) {
    return NextResponse.json({ pesan: 'Kata sandi admin salah.' }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunciServer = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunciServer) {
    return NextResponse.json({ pesan: 'Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY).' }, { status: 500 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ pesan: 'Permintaan tidak valid.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ pesan: 'Pilih file .xlsx terlebih dahulu.' }, { status: 400 });
  }
  if (file.size > MAKS_BYTE) {
    return NextResponse.json({ pesan: 'Ukuran file melebihi 4 MB.' }, { status: 413 });
  }

  const hasil = await periksaFile(Buffer.from(await file.arrayBuffer()));
  if (!hasil.ok) {
    return NextResponse.json({ pesan: 'File masih memiliki error. Perbaiki dulu.', ...hasil }, { status: 422 });
  }

  const supabase = createClient(url, kunciServer, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc('simpan_impor', {
    p_nama_file: file.name,
    p_stimulus: hasil.stimulus,
    p_soal: hasil.soal.map(({ _baris, ...s }) => s),
  });
  if (error) {
    return NextResponse.json({ pesan: 'Gagal menyimpan ke database: ' + error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, batch_id: data, jumlah_soal: hasil.soal.length });
}
