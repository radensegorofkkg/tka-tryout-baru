import { NextResponse } from 'next/server';
import { buatDb, cekSiswa } from '../../../../lib/siswaAuth';
import { bolehIkut, PESAN_TIDAK_TERDAFTAR } from '../../../../lib/peserta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });
const TIDAK_VALID = 'Sesi login tidak valid. Silakan login lagi.';

// Sisa waktu (detik) dihitung dari jam server: waktu mulai + durasi + tambahan dari admin.
function sisaDetik(sesi, ujian) {
  const menit = ujian.durasi_menit + (sesi.tambahan_menit || 0);
  const batas = new Date(sesi.mulai_at).getTime() + menit * 60 * 1000;
  return Math.max(0, Math.floor((batas - Date.now()) / 1000));
}

function acak(daftar) {
  const a = [...daftar];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Soal yang memakai bacaan/gambar yang sama tetap berdampingan (urutan di dalam kelompok dijaga);
// yang diacak adalah urutan kelompoknya.
function urutanAcak(baris) {
  const kelompok = new Map();
  for (const b of baris) {
    const kunci = b.soal?.stimulus_id ? `s${b.soal.stimulus_id}` : `x${b.soal_id}`;
    if (!kelompok.has(kunci)) kelompok.set(kunci, []);
    kelompok.get(kunci).push(b.soal_id);
  }
  return acak([...kelompok.values()]).flat();
}

async function ujianAktif(db) {
  const { data, error } = await db
    .from('ujian')
    .select('id, nama, durasi_menit, ujian_soal(count)')
    .eq('status', 'aktif')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function ambilSesi(db, ujianId, nomor) {
  const { data, error } = await db
    .from('sesi_ujian')
    .select('id, mulai_at, selesai_at, tambahan_menit')
    .eq('ujian_id', ujianId)
    .eq('nomor_ujian', nomor)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/* ---------- GET: ada ujian aktif? bagaimana status siswa ini? ---------- */
export async function GET(request) {
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap.', 500);
  try {
    const [siswa, u] = await Promise.all([cekSiswa(db, request), ujianAktif(db)]);
    if (!siswa) return salah(TIDAK_VALID, 401);
    if (!u) return NextResponse.json({ siswa, ujian: null });

    const [sesi, boleh] = await Promise.all([ambilSesi(db, u.id, siswa.nomor_ujian), bolehIkut(db, u.id, siswa.nomor_ujian)]);
    // Siswa yang sudah punya sesi tidak dikeluarkan di tengah jalan; siswa baru dari sekolah lain ditolak.
    if (!sesi && !boleh) return NextResponse.json({ pesan: PESAN_TIDAK_TERDAFTAR, tidak_terdaftar: true }, { status: 403 });
    let status = 'belum_mulai';
    let sisa = null;
    if (sesi) {
      if (sesi.selesai_at) status = 'selesai';
      else {
        sisa = sisaDetik(sesi, u);
        status = sisa > 0 ? 'berlangsung' : 'waktu_habis';
      }
    }
    return NextResponse.json({
      siswa,
      ujian: { id: u.id, nama: u.nama, durasi_menit: u.durasi_menit, jumlah_soal: u.ujian_soal?.[0]?.count ?? 0 },
      status,
      sisa_detik: sisa,
    });
  } catch (e) {
    return salah('Gagal membaca data ujian.', 500);
  }
}

/* ---------- POST: mulai ujian (atau lanjutkan kalau sudah pernah mulai) ---------- */
export async function POST(request) {
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap.', 500);
  try {
    const [siswa, u] = await Promise.all([cekSiswa(db, request), ujianAktif(db)]);
    if (!siswa) return salah(TIDAK_VALID, 401);
    if (!u) return salah('Ujian belum dibuka oleh admin. Tunggu arahan pengawas.', 409);

    const [sudah, boleh] = await Promise.all([ambilSesi(db, u.id, siswa.nomor_ujian), bolehIkut(db, u.id, siswa.nomor_ujian)]);
    if (!sudah && !boleh) return NextResponse.json({ pesan: PESAN_TIDAK_TERDAFTAR, tidak_terdaftar: true }, { status: 403 });
    if (sudah) {
      if (sudah.selesai_at) {
        return salah('Anda sudah mengumpulkan ujian ini. Hubungi pengawas jika perlu dibuka kembali.', 403);
      }
      return NextResponse.json({ ok: true, lanjut: true });
    }

    const { data: baris, error } = await db
      .from('ujian_soal')
      .select('soal_id, urutan, soal(stimulus_id)')
      .eq('ujian_id', u.id)
      .order('urutan');
    if (error) throw new Error(error.message);
    if (!baris || baris.length === 0) return salah('Ujian ini belum memiliki soal.', 409);

    const { error: ei } = await db.from('sesi_ujian').insert({
      ujian_id: u.id,
      nomor_ujian: siswa.nomor_ujian,
      urutan: urutanAcak(baris),
    });
    // 23505 = sesi sudah dibuat oleh permintaan yang bersamaan (misalnya tombol ditekan dua kali)
    if (ei && ei.code !== '23505') throw new Error(ei.message);

    return NextResponse.json({ ok: true, lanjut: false });
  } catch (e) {
    return salah('Gagal memulai ujian. Coba lagi.', 500);
  }
}
