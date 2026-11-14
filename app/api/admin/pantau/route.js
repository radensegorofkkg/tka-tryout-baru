import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cekAdmin } from '../../../../lib/adminAuth';
import { daftarPeserta, npsnDariNomor } from '../../../../lib/peserta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });
const tolak = () => salah('Kata sandi admin salah.', 401);

function buatDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) return null;
  return createClient(url, kunci, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Mengambil semua baris (Supabase membatasi 1000 baris per permintaan).
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

function sisaDetik(sesi, ujian) {
  const menit = ujian.durasi_menit + (sesi.tambahan_menit || 0);
  const batas = new Date(sesi.mulai_at).getTime() + menit * 60 * 1000;
  return Math.max(0, Math.floor((batas - Date.now()) / 1000));
}

/* ---------- GET ?ujian_id=N : daftar siswa beserta statusnya ---------- */
export async function GET(request) {
  if (!cekAdmin(request)) return tolak();
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY).', 500);

  const ujianId = Number(new URL(request.url).searchParams.get('ujian_id'));
  if (!Number.isInteger(ujianId)) return salah('Permintaan tidak valid.');

  try {
    const { data: u, error: eu } = await db
      .from('ujian')
      .select('id, nama, durasi_menit, status, peringkat_terbuka')
      .eq('id', ujianId)
      .maybeSingle();
    if (eu) throw new Error(eu.message);
    if (!u) return salah('Ujian tidak ditemukan.', 404);

    const { data: bs, error: eb } = await db.from('ujian_soal').select('soal(skor)').eq('ujian_id', ujianId);
    if (eb) throw new Error(eb.message);
    const jumlahSoal = bs.length;
    const maks = bs.reduce((a, b) => a + (Number(b.soal?.skor) || 0), 0);

    const pesertaSekolah = await daftarPeserta(db, ujianId); // null = semua sekolah
    const semuaSiswa = await ambilSemua(() =>
      db.from('students').select('nomor_ujian, nama_lengkap, is_logged_in, sesi_token').order('nomor_ujian')
    );
    const siswa = pesertaSekolah ? semuaSiswa.filter((s) => pesertaSekolah.has(npsnDariNomor(s.nomor_ujian))) : semuaSiswa;
    const { data: dataSekolah } = await db.from('sekolah').select('npsn, nama');
    const namaSekolah = new Map((dataSekolah || []).map((x) => [x.npsn, x.nama]));
    const sesi = await ambilSemua(() =>
      db
        .from('sesi_ujian')
        .select('id, nomor_ujian, mulai_at, selesai_at, tambahan_menit, skor, pelanggaran, curang, alasan_curang')
        .eq('ujian_id', ujianId)
        .order('id')
    );
    const ringkasan = await ambilSemua(() => db.rpc('ringkasan_sesi', { p_ujian_id: ujianId }));

    const petaSesi = new Map(sesi.map((s) => [s.nomor_ujian, s]));
    const petaJawab = new Map(ringkasan.map((r) => [r.sesi_id, Number(r.jumlah_jawaban)]));

    const daftar = siswa.map((s) => {
      const se = petaSesi.get(s.nomor_ujian);
      let status = s.is_logged_in ? 'login' : 'belum_login';
      let sisa = null;
      if (se) {
        if (se.selesai_at) status = 'selesai';
        else {
          sisa = sisaDetik(se, u);
          status = sisa > 0 ? 'mengerjakan' : 'waktu_habis';
        }
      }
      return {
        nomor_ujian: s.nomor_ujian,
        nama_lengkap: s.nama_lengkap,
        sekolah: namaSekolah.get(String(s.nomor_ujian).split('-')[0]) || null,
        is_logged_in: s.is_logged_in,
        status,
        sesi_id: se ? se.id : null,
        sisa_detik: sisa,
        tambahan_menit: se ? se.tambahan_menit || 0 : 0,
        dijawab: se ? petaJawab.get(se.id) || 0 : 0,
        skor: se && se.selesai_at ? se.skor : null,
        jumlah_pelanggaran: se && Array.isArray(se.pelanggaran) ? se.pelanggaran.length : 0,
        terkunci: !!s.is_logged_in && typeof s.sesi_token === 'string' && s.sesi_token.startsWith('TERKUNCI-'),
        curang: se ? !!se.curang : false,
        alasan_curang: se ? se.alasan_curang || null : null,
      };
    });

    const hitung = (st) => daftar.filter((d) => d.status === st).length;
    return NextResponse.json({
      ujian: { ...u, jumlah_soal: jumlahSoal, maks, peserta_terbatas: !!pesertaSekolah },
      ringkas: {
        total: daftar.length,
        belum_login: hitung('belum_login'),
        login: hitung('login'),
        mengerjakan: hitung('mengerjakan'),
        waktu_habis: hitung('waktu_habis'),
        selesai: hitung('selesai'),
        curang: daftar.filter((d) => d.curang).length,
      },
      siswa: daftar,
    });
  } catch (e) {
    return salah('Gagal membaca data pantauan: ' + e.message, 500);
  }
}

/* ---------- POST: reset login, buka ulang, tambah waktu ---------- */
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
  await db.from('log_reset').insert({ oleh: 'super', nomor_ujian: nomor, aksi: 'reset_login' }); // catatan, tidak menggagalkan reset
  return NextResponse.json({ ok: true });
}

async function ambilSesiDanUjian(db, sesiId) {
  const { data: se, error } = await db
    .from('sesi_ujian')
    .select('id, ujian_id, nomor_ujian, mulai_at, selesai_at, tambahan_menit')
    .eq('id', sesiId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!se) return {};
  const { data: u, error: eu } = await db.from('ujian').select('id, durasi_menit, status').eq('id', se.ujian_id).maybeSingle();
  if (eu) throw new Error(eu.message);
  return { se, u };
}

async function bukaUlang(db, b) {
  const sesiId = Number(b.sesi_id);
  const menit = Number(b.menit);
  if (!Number.isInteger(sesiId)) return salah('Permintaan tidak valid.');
  if (!Number.isInteger(menit) || menit < 1 || menit > 180) return salah('Waktu harus berupa angka bulat 1 sampai 180 menit.');

  const { se, u } = await ambilSesiDanUjian(db, sesiId);
  if (!se || !u) return salah('Sesi tidak ditemukan.', 404);
  if (!se.selesai_at) return salah('Sesi ini belum dikumpulkan, jadi tidak perlu dibuka ulang.');

  // Waktu tersisa dijadikan paling sedikit "menit" menit. Jika sisa waktunya masih lebih banyak, dibiarkan.
  const sisa = sisaDetik({ ...se, tambahan_menit: se.tambahan_menit || 0 }, u);
  let tambahan = se.tambahan_menit || 0;
  if (sisa < menit * 60) tambahan += Math.ceil((menit * 60 - sisa) / 60);

  const { error: e1 } = await db
    .from('sesi_ujian')
    .update({ selesai_at: null, skor: null, tambahan_menit: tambahan })
    .eq('id', sesiId);
  if (e1) throw new Error(e1.message);

  // Siswa harus login ulang (di depan pengawas), sehingga kartu masuk lama tidak berlaku lagi.
  const { error: e2 } = await db
    .from('students')
    .update({ is_logged_in: false, sesi_token: null })
    .eq('nomor_ujian', se.nomor_ujian);
  if (e2) throw new Error(e2.message);

  return NextResponse.json({
    ok: true,
    ujian_aktif: u.status === 'aktif',
    catatan: u.status === 'aktif' ? '' : 'Ujian sedang tidak aktif. Aktifkan ujian agar siswa bisa melanjutkan.',
  });
}

// Menghapus catatan pelanggaran dan tanda kecurangan satu sesi (bila pengawas yakin itu salah deteksi).
// Siswa yang terlanjur terkunci tetap harus direset loginnya.
async function hapusTanda(db, b) {
  const sesiId = Number(b.sesi_id);
  if (!Number.isInteger(sesiId)) return salah('Permintaan tidak valid.');
  const { data, error } = await db
    .from('sesi_ujian')
    .update({ pelanggaran: [], curang: false, alasan_curang: null })
    .eq('id', sesiId)
    .select('nomor_ujian');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return salah('Sesi tidak ditemukan.', 404);
  await db.from('log_reset').insert({ oleh: 'super', nomor_ujian: data[0].nomor_ujian, aksi: 'hapus_tanda' }); // catatan
  return NextResponse.json({ ok: true });
}

async function tambahWaktu(db, b) {
  const sesiId = Number(b.sesi_id);
  const menit = Number(b.menit);
  if (!Number.isInteger(sesiId)) return salah('Permintaan tidak valid.');
  if (!Number.isInteger(menit) || menit < 1 || menit > 180) return salah('Tambahan waktu harus berupa angka bulat 1 sampai 180 menit.');

  const { se } = await ambilSesiDanUjian(db, sesiId);
  if (!se) return salah('Sesi tidak ditemukan.', 404);
  if (se.selesai_at) return salah('Sesi ini sudah dikumpulkan. Gunakan Buka Ulang.');

  const { error } = await db
    .from('sesi_ujian')
    .update({ tambahan_menit: (se.tambahan_menit || 0) + menit })
    .eq('id', sesiId)
    .is('selesai_at', null);
  if (error) throw new Error(error.message);
  return NextResponse.json({ ok: true });
}

export async function POST(request) {
  if (!cekAdmin(request)) return tolak();
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
      case 'reset_login': return await resetLogin(db, body);
      case 'buka_ulang': return await bukaUlang(db, body);
      case 'tambah_waktu': return await tambahWaktu(db, body);
      case 'hapus_tanda': return await hapusTanda(db, body);
      default: return salah('Aksi tidak dikenal.');
    }
  } catch (e) {
    return salah('Terjadi kesalahan di server: ' + e.message, 500);
  }
}
