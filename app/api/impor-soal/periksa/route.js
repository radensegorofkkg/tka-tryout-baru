import { NextResponse } from 'next/server';
import { cekAdmin } from '../../../../lib/adminAuth';
import { periksaFile } from '../../../../lib/importSoal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAKS_BYTE = 4 * 1024 * 1024; // 4 MB

// Memeriksa file Excel TANPA menyimpan apa pun ke database.
export async function POST(request) {
  if (!cekAdmin(request)) {
    return NextResponse.json({ pesan: 'Kata sandi admin salah.' }, { status: 401 });
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ pesan: 'Permintaan tidak valid.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ pesan: 'Pilih file .xlsx terlebih dahulu.' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ pesan: 'Format file harus .xlsx.' }, { status: 400 });
  }
  if (file.size > MAKS_BYTE) {
    return NextResponse.json({ pesan: 'Ukuran file melebihi 4 MB.' }, { status: 413 });
  }
  const hasil = await periksaFile(Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ nama_file: file.name, ...hasil });
}
