import { NextResponse } from 'next/server';
import { buatDb } from '../../../../lib/siswaAuth';
import { npsnDariRequest } from '../../../../lib/sekolahAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });
const TIDAK_VALID = 'Sesi habis. Silakan masuk lagi.';
const adaTerkunci = (t) => typeof t === 'string' && t.startsWith('TERKUNCI-');

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

/* GET: siswa milik sekolah ini saja (NPSN diambil dari token, bukan dari permintaan). Skor tidak dikirim. */
export async function GET(request) {
  const npsn = npsnDariRequest(request);
  if (!npsn) return salah(TIDAK_VALID, 401);
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap.', 500);

  try {
    const { data: sk } = await db.from('sekolah').select('npsn, nama').eq('npsn', npsn).maybeSingle();
    if (!sk) return salah(TIDAK_VALID, 401);

    const { data: u, error: eu } = await db
      .from('ujian')
      .select('id, nama, durasi_menit')
      .eq('status', 'aktif')
      .maybeSingle();
    if (eu) throw new Error(eu.message);

    const siswa = await ambilSemua(() =>
      db.from('students').select('nomor_ujian, nama_lengkap, is_logged_in, sesi_token').like('nomor_ujian', `${npsn}-%`).order('nomor_ujian')
    );

    let petaSesi = new Map();
    let petaJawab = new Map();
    if (u) {
      const sesi = await ambilSemua(() =>
        db
          .from('sesi_ujian')
          .select('id, nomor_ujian, mulai_at, selesai_at, tambahan_menit, pelanggaran, curang, alasan_curang')
          .eq('ujian_id', u.id)
          .like('nomor_ujian', `${npsn}-%`)
          .order('id')
      );
      petaSesi = new Map(sesi.map((s) => [s.nomor_ujian, s]));
      const ids = sesi.map((s) => s.id);
      if (ids.length) {
        const jw = await ambilSemua(() => db.from('jawaban').select('sesi_id').in('sesi_id', ids).order('sesi_id'));
        for (const j of jw) petaJawab.set(j.sesi_id, (petaJawab.get(j.sesi_id) || 0) + 1);
      }
    }

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
        is_logged_in: s.is_logged_in,
        status,
        sisa_detik: sisa,
        dijawab: se ? petaJawab.get(se.id) || 0 : 0,
        jumlah_pelanggaran: se && Array.isArray(se.pelanggaran) ? se.pelanggaran.length : 0,
        curang: se ? !!se.curang : false,
        alasan_curang: se ? se.alasan_curang || null : null,
        terkunci: !!s.is_logged_in && adaTerkunci(s.sesi_token),
      };
    });

    const hitung = (st) => daftar.filter((d) => d.status === st).length;
    return NextResponse.json({
      sekolah: sk,
      ujian: u ? { id: u.id, nama: u.nama, durasi_menit: u.durasi_menit } : null,
      ringkas: {
        total: daftar.length,
        belum_login: hitung('belum_login'),
        login: hitung('login'),
        mengerjakan: hitung('mengerjakan'),
        waktu_habis: hitung('waktu_habis'),
        selesai: hitung('selesai'),
        terkunci: daftar.filter((d) => d.terkunci).length,
      },
      siswa: daftar,
    });
  } catch (e) {
    return salah('Gagal membaca data pantauan.', 500);
  }
}

/* POST: reset login siswa sekolah ini. Siswa yang terkunci karena kecurangan hanya bisa dibuka super admin. */
export async function POST(request) {
  const npsn = npsnDariRequest(request);
  if (!npsn) return salah(TIDAK_VALID, 401);
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap.', 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return salah('Permintaan tidak valid.');
  }
  if (body.aksi !== 'reset_login') return salah('Aksi tidak dikenal.');
  const nomor = String(body.nomor_ujian ?? '').trim();
  if (!nomor.startsWith(`${npsn}-`)) return salah('Siswa ini bukan dari sekolah Anda.', 403);

  try {
    const { data: s, error } = await db
      .from('students')
      .select('nomor_ujian, nama_lengkap, is_logged_in, sesi_token')
      .eq('nomor_ujian', nomor)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s) return salah('Siswa tidak ditemukan.', 404);
    if (adaTerkunci(s.sesi_token)) {
      return salah('Siswa ini terkunci karena terdeteksi kecurangan. Hubungi super admin pusat untuk membukanya.', 403);
    }
    if (!s.is_logged_in) return salah('Siswa ini sedang tidak login, tidak perlu direset.', 409);

    let q = db.from('students').update({ is_logged_in: false, sesi_token: null }).eq('nomor_ujian', nomor).eq('is_logged_in', true);
    q = s.sesi_token ? q.eq('sesi_token', s.sesi_token) : q;
    const { data: diubah, error: eu } = await q.select('nomor_ujian');
    if (eu) throw new Error(eu.message);
    if (!diubah || diubah.length === 0) return salah('Status siswa baru saja berubah. Muat ulang lalu coba lagi.', 409);

    await db.from('log_reset').insert({ oleh: npsn, nomor_ujian: nomor, aksi: 'reset_login' }); // catatan, tidak menggagalkan reset
    return NextResponse.json({ ok: true });
  } catch (e) {
    return salah('Terjadi kesalahan di server. Coba lagi.', 500);
  }
}
