import { NextResponse } from 'next/server';
import { buatDb, cekSiswa } from '../../../../lib/siswaAuth';
import { JENIS_SAH, BATAS_PELANGGARAN, nilaiPelanggaran, tambahCatatan } from '../../../../lib/pelanggaran';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });
const TIDAK_VALID = 'Sesi login tidak valid. Silakan login lagi.';

// Siswa melaporkan satu kejadian: { jenis, detik }. Penilaian "terdeteksi kecurangan" dihitung di server,
// bukan di perangkat siswa, supaya tidak bisa diubah dari browser.
export async function POST(request) {
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap.', 500);
  const siswa = await cekSiswa(db, request);
  if (!siswa) return salah(TIDAK_VALID, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return salah('Permintaan tidak valid.');
  }
  if (!JENIS_SAH.includes(body.jenis)) return salah('Jenis kejadian tidak dikenal.');

  try {
    const { data: u, error: eu } = await db.from('ujian').select('id').eq('status', 'aktif').maybeSingle();
    if (eu) throw new Error(eu.message);
    // Ujian sudah ditutup: kejadian tidak dicatat, dan tidak dianggap galat supaya perangkat siswa berhenti mengirim ulang.
    if (!u) return NextResponse.json({ ok: true, diabaikan: true });

    const { data: sesi, error: es } = await db
      .from('sesi_ujian')
      .select('id, selesai_at, pelanggaran')
      .eq('ujian_id', u.id)
      .eq('nomor_ujian', siswa.nomor_ujian)
      .maybeSingle();
    if (es) throw new Error(es.message);
    if (!sesi || sesi.selesai_at) return NextResponse.json({ ok: true, diabaikan: true });

    const log = tambahCatatan(sesi.pelanggaran, body.jenis, body.detik);
    const hasil = nilaiPelanggaran(log);
    const { error: ee } = await db
      .from('sesi_ujian')
      .update({ pelanggaran: log, curang: hasil.curang, alasan_curang: hasil.alasan })
      .eq('id', sesi.id);
    if (ee) throw new Error(ee.message);

    return NextResponse.json({ ok: true, jumlah: hasil.jumlah, curang: hasil.curang, batas: BATAS_PELANGGARAN });
  } catch (e) {
    return salah('Kejadian belum tercatat.', 500);
  }
}
