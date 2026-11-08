import { NextResponse } from 'next/server';
import { buatDb, cekSiswa } from '../../../../lib/siswaAuth';
import { nilaiSesi } from '../../../../lib/penilaian';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });

// Mengumpulkan ujian: nilai dihitung di server dari jawaban yang sudah tersimpan,
// lalu sesi ditutup. Dipakai juga saat waktu habis. Aman dipanggil berulang.
export async function POST(request) {
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap.', 500);
  const siswa = await cekSiswa(db, request);
  if (!siswa) return salah('Sesi login tidak valid. Silakan login lagi.', 401);

  try {
    const { data: u, error: eu } = await db.from('ujian').select('id').eq('status', 'aktif').maybeSingle();
    if (eu) throw new Error(eu.message);
    if (!u) return salah('Akses ujian sudah ditutup oleh admin.', 403);

    const { data: sesi, error: es } = await db
      .from('sesi_ujian')
      .select('id, selesai_at')
      .eq('ujian_id', u.id)
      .eq('nomor_ujian', siswa.nomor_ujian)
      .maybeSingle();
    if (es) throw new Error(es.message);
    if (!sesi) return salah('Ujian belum dimulai.', 409);
    if (sesi.selesai_at) return NextResponse.json({ ok: true, sudah: true });

    const hasil = await nilaiSesi(db, sesi.id);

    // Hanya menutup kalau belum ditutup (aman kalau tombol ditekan dua kali).
    const { error: ex } = await db
      .from('sesi_ujian')
      .update({ selesai_at: new Date().toISOString(), skor: hasil.total })
      .eq('id', sesi.id)
      .is('selesai_at', null);
    if (ex) throw new Error(ex.message);

    // Nilai sengaja tidak dikirim ke siswa.
    return NextResponse.json({ ok: true });
  } catch (e) {
    return salah('Gagal mengumpulkan ujian. Coba lagi.', 500);
  }
}
