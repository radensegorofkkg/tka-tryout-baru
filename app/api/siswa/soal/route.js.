import { NextResponse } from 'next/server';
import { buatDb, cekSiswa } from '../../../../lib/siswaAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });
const TIDAK_VALID = 'Sesi login tidak valid. Silakan login lagi.';

function sisaDetik(sesi, ujian) {
  const menit = ujian.durasi_menit + (sesi.tambahan_menit || 0);
  const batas = new Date(sesi.mulai_at).getTime() + menit * 60 * 1000;
  return Math.max(0, Math.floor((batas - Date.now()) / 1000));
}

// Mengirim soal ujian untuk siswa ini, sesuai urutan acaknya.
// PENTING: kunci jawaban dan pembahasan TIDAK pernah dikirim ke siswa
// (keduanya ada di tabel kunci_soal yang tidak dibaca di sini).
export async function GET(request) {
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap.', 500);
  const siswa = await cekSiswa(db, request);
  if (!siswa) return salah(TIDAK_VALID, 401);

  try {
    const { data: u, error: eu } = await db
      .from('ujian')
      .select('id, nama, durasi_menit')
      .eq('status', 'aktif')
      .maybeSingle();
    if (eu) throw new Error(eu.message);
    if (!u) return salah('Ujian sedang tidak aktif. Tunggu arahan pengawas.', 409);

    const { data: sesi, error: es } = await db
      .from('sesi_ujian')
      .select('id, mulai_at, selesai_at, tambahan_menit, urutan')
      .eq('ujian_id', u.id)
      .eq('nomor_ujian', siswa.nomor_ujian)
      .maybeSingle();
    if (es) throw new Error(es.message);
    if (!sesi) return salah('Ujian belum dimulai. Tekan tombol mulai terlebih dahulu.', 409);
    if (sesi.selesai_at) return salah('Anda sudah mengumpulkan ujian ini.', 403);

    const sisa = sisaDetik(sesi, u);
    if (sisa <= 0) return NextResponse.json({ waktu_habis: true });

    const urutan = Array.isArray(sesi.urutan) ? sesi.urutan : [];
    if (urutan.length === 0) return salah('Data soal sesi ini kosong. Hubungi pengawas.', 500);

    const { data: baris, error: eb } = await db
      .from('soal')
      .select('id, tipe, pertanyaan, opsi, stimulus(id, isi, url_gambar)')
      .in('id', urutan);
    if (eb) throw new Error(eb.message);
    const peta = new Map(baris.map((b) => [b.id, b]));

    const soal = urutan
      .map((id) => peta.get(id))
      .filter(Boolean)
      .map((b, i) => ({
        nomor: i + 1,
        id: b.id,
        tipe: b.tipe,
        pertanyaan: b.pertanyaan,
        opsi: b.opsi,
        stimulus: b.stimulus ? { id: b.stimulus.id, isi: b.stimulus.isi, url_gambar: b.stimulus.url_gambar } : null,
      }));

    const { data: tersimpan, error: ej } = await db
      .from('jawaban')
      .select('soal_id, jawaban')
      .eq('sesi_id', sesi.id);
    if (ej) throw new Error(ej.message);
    const jawaban = Object.fromEntries(tersimpan.map((j) => [j.soal_id, j.jawaban]));

    return NextResponse.json({
      ujian: { nama: u.nama, durasi_menit: u.durasi_menit },
      sisa_detik: sisa,
      soal,
      jawaban,
    });
  } catch (e) {
    return salah('Gagal mengambil soal. Coba muat ulang halaman.', 500);
  }
}
