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

const adaObjek = (j) => j !== null && typeof j === 'object' && !Array.isArray(j);

// Memeriksa bentuk jawaban sesuai tipe soal, supaya data yang masuk database selalu rapi.
// Hasil: { ok: true, nilai } (nilai null = jawaban dikosongkan) atau { ok: false }.
function validasi(soal, j) {
  if (j === null || j === undefined) return { ok: true, nilai: null };
  const o = soal.opsi;

  if (soal.tipe === 'PG') {
    if (typeof j === 'string' && o.some((x) => x.k === j)) return { ok: true, nilai: j };
  } else if (soal.tipe === 'PG_KOMPLEKS') {
    if (Array.isArray(j) && new Set(j).size === j.length && j.every((v) => o.some((x) => x.k === v))) {
      return { ok: true, nilai: j.length ? [...j].sort() : null };
    }
  } else if (soal.tipe === 'BENAR_SALAH') {
    if (adaObjek(j)) {
      const ks = Object.keys(j);
      if (ks.every((k) => o.some((x) => x.k === k) && typeof j[k] === 'boolean')) {
        return { ok: true, nilai: ks.length ? j : null };
      }
    }
  } else if (soal.tipe === 'JODOH') {
    if (adaObjek(j)) {
      const ks = Object.keys(j);
      if (ks.every((k) => o.kiri.some((x) => x.k === k) && o.kanan.some((x) => x.k === j[k]))) {
        return { ok: true, nilai: ks.length ? j : null };
      }
    }
  }
  return { ok: false };
}

// Menyimpan jawaban satu soal. Dipanggil setiap kali siswa memilih atau mengubah jawaban.
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
  const soalId = Number(body.soal_id);
  if (!Number.isInteger(soalId)) return salah('Permintaan tidak valid.');

  try {
    const { data: u, error: eu } = await db
      .from('ujian')
      .select('id, durasi_menit')
      .eq('status', 'aktif')
      .maybeSingle();
    if (eu) throw new Error(eu.message);
    if (!u) return salah('Akses ujian sudah ditutup oleh admin.', 403);

    const { data: sesi, error: es } = await db
      .from('sesi_ujian')
      .select('id, mulai_at, selesai_at, tambahan_menit, urutan')
      .eq('ujian_id', u.id)
      .eq('nomor_ujian', siswa.nomor_ujian)
      .maybeSingle();
    if (es) throw new Error(es.message);
    if (!sesi) return salah('Ujian belum dimulai.', 409);
    if (sesi.selesai_at) return salah('Ujian ini sudah dikumpulkan.', 403);
    if (sisaDetik(sesi, u) <= 0) return NextResponse.json({ pesan: 'Waktu habis.', waktu_habis: true }, { status: 403 });
    if (!Array.isArray(sesi.urutan) || !sesi.urutan.includes(soalId)) {
      return salah('Soal tidak termasuk dalam ujian Anda.', 400);
    }

    const { data: soal, error: eq } = await db.from('soal').select('id, tipe, opsi').eq('id', soalId).maybeSingle();
    if (eq) throw new Error(eq.message);
    if (!soal) return salah('Soal tidak ditemukan.', 404);

    const cek = validasi(soal, body.jawaban);
    if (!cek.ok) return salah('Bentuk jawaban tidak sesuai dengan tipe soal.', 400);

    if (cek.nilai === null) {
      const { error: ed } = await db.from('jawaban').delete().eq('sesi_id', sesi.id).eq('soal_id', soalId);
      if (ed) throw new Error(ed.message);
    } else {
      const { error: ej } = await db
        .from('jawaban')
        .upsert(
          { sesi_id: sesi.id, soal_id: soalId, jawaban: cek.nilai, updated_at: new Date().toISOString() },
          { onConflict: 'sesi_id,soal_id' }
        );
      if (ej) throw new Error(ej.message);
    }

    return NextResponse.json({ ok: true, sisa_detik: sisaDetik(sesi, u) });
  } catch (e) {
    return salah('Jawaban belum tersimpan. Coba lagi.', 500);
  }
}
