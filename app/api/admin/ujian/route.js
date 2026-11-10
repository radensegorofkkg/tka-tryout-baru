import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cekAdmin } from '../../../../lib/adminAuth';
import { nilaiSesi } from '../../../../lib/penilaian';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // penilaian banyak siswa sekaligus butuh waktu

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

const jumlahSoalDari = (u) => u.ujian_soal?.[0]?.count ?? 0;

// Menutup dan menilai semua sesi yang belum dikumpulkan (jawaban yang sudah terkirim tetap dihitung).
async function tutupSesiBelumSelesai(db, ujianId) {
  const sesi = await ambilSemua(() =>
    db.from('sesi_ujian').select('id').eq('ujian_id', ujianId).is('selesai_at', null).order('id')
  );
  let berhasil = 0;
  let gagal = 0;
  for (let i = 0; i < sesi.length; i += 8) {
    const kelompok = sesi.slice(i, i + 8);
    const hasil = await Promise.all(
      kelompok.map(async (s) => {
        try {
          const nilai = await nilaiSesi(db, s.id);
          const { error } = await db
            .from('sesi_ujian')
            .update({ selesai_at: new Date().toISOString(), skor: nilai.total })
            .eq('id', s.id)
            .is('selesai_at', null);
          if (error) throw new Error(error.message);
          return true;
        } catch {
          return false;
        }
      })
    );
    hasil.forEach((ok) => (ok ? berhasil++ : gagal++));
  }
  return { berhasil, gagal };
}

/* ---------- GET: daftar ujian + file impor yang bisa dipilih ---------- */
export async function GET(request) {
  if (!cekAdmin(request)) return tolak();
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY).', 500);

  try {
    const { data: mapel, error: e1 } = await db.from('mapel').select('id, nama').order('nama');
    if (e1) throw new Error(e1.message);

    const { data: ujian, error: e2 } = await db
      .from('ujian')
      .select('id, nama, durasi_menit, status, mapel_id, created_at, ujian_soal(count)')
      .order('id', { ascending: false });
    if (e2) throw new Error(e2.message);

    const { data: batch, error: e3 } = await db
      .from('impor_batch')
      .select('id, nama_file, created_at')
      .eq('status', 'tersimpan')
      .order('id', { ascending: false });
    if (e3) throw new Error(e3.message);

    const soal = await ambilSemua(() =>
      db.from('soal').select('id, batch_id, mapel_id').is('diarsipkan_at', null).order('id')
    );
    const hitung = {};
    for (const s of soal) {
      const k = `${s.batch_id}:${s.mapel_id}`;
      hitung[k] = (hitung[k] || 0) + 1;
    }

    return NextResponse.json({
      mapel,
      ujian: ujian.map(({ ujian_soal, ...u }) => ({ ...u, jumlah_soal: jumlahSoalDari({ ujian_soal }) })),
      batch: batch.map((b) => ({
        ...b,
        per_mapel: mapel
          .map((m) => ({ mapel_id: m.id, jumlah: hitung[`${b.id}:${m.id}`] || 0 }))
          .filter((x) => x.jumlah > 0),
      })),
    });
  } catch (e) {
    return salah('Gagal membaca data: ' + e.message, 500);
  }
}

/* ---------- POST: buat, ubah status, ubah durasi, hapus ---------- */
async function buat(db, b) {
  const nama = String(b.nama ?? '').trim();
  const durasi = Number(b.durasi_menit);
  const mapelId = Number(b.mapel_id);
  const batchIds = Array.isArray(b.batch_ids) ? b.batch_ids.map(Number).filter(Number.isInteger) : [];

  if (!nama || nama.length > 100) return salah('Nama ujian wajib diisi (maksimal 100 huruf).');
  if (!Number.isInteger(durasi) || durasi < 1 || durasi > 600) return salah('Durasi harus berupa angka bulat 1 sampai 600 menit.');
  if (!Number.isInteger(mapelId)) return salah('Pilih mata pelajaran.');
  if (batchIds.length === 0) return salah('Pilih minimal satu file impor.');

  const { data: m, error: em } = await db.from('mapel').select('id').eq('id', mapelId).maybeSingle();
  if (em) throw new Error(em.message);
  if (!m) return salah('Mata pelajaran tidak ditemukan.');

  const soal = await ambilSemua(() =>
    db.from('soal').select('id').in('batch_id', batchIds).eq('mapel_id', mapelId).is('diarsipkan_at', null).order('batch_id').order('id')
  );
  if (soal.length === 0) return salah('File impor yang dipilih tidak memiliki soal untuk mapel ini.');

  const { data: u, error: eu } = await db
    .from('ujian')
    .insert({ nama, durasi_menit: durasi, mapel_id: mapelId, status: 'draft' })
    .select('id')
    .single();
  if (eu) throw new Error(eu.message);

  const baris = soal.map((s, i) => ({ ujian_id: u.id, soal_id: s.id, urutan: i + 1 }));
  for (let i = 0; i < baris.length; i += 500) {
    const { error: es } = await db.from('ujian_soal').insert(baris.slice(i, i + 500));
    if (es) {
      await db.from('ujian').delete().eq('id', u.id); // batalkan agar tidak ada ujian setengah jadi
      throw new Error(es.message);
    }
  }
  return NextResponse.json({ ok: true, id: u.id, jumlah_soal: soal.length });
}

async function ubahStatus(db, b) {
  const id = Number(b.id);
  const baru = b.status;
  if (!Number.isInteger(id) || !['aktif', 'selesai'].includes(baru)) return salah('Permintaan tidak valid.');

  const { data: u, error } = await db.from('ujian').select('id, status, ujian_soal(count)').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!u) return salah('Ujian tidak ditemukan.', 404);

  if (baru === 'aktif') {
    if (u.status === 'aktif') return salah('Ujian ini sudah aktif.');
    if (jumlahSoalDari(u) === 0) return salah('Ujian ini belum memiliki soal.');
  } else if (u.status !== 'aktif') {
    return salah('Hanya ujian yang sedang aktif yang bisa diselesaikan.');
  }

  const { error: eu } = await db.from('ujian').update({ status: baru }).eq('id', id);
  if (eu) {
    if (eu.code === '23505') return salah('Masih ada ujian lain yang aktif. Selesaikan dulu ujian itu.', 409);
    throw new Error(eu.message);
  }
  if (baru === 'selesai') {
    // Ujian sudah ditutup (siswa tidak bisa menyimpan jawaban lagi); sekarang sesi yang belum dikumpulkan dinilai.
    const tutup = await tutupSesiBelumSelesai(db, id);
    // Setelah ujian ditutup dan dinilai, semua siswa dikeluarkan dari status "sudah login"
    // supaya bisa login lagi untuk ujian berikutnya. Selama ujian aktif, aturan satu-kali-login tetap berlaku.
    const { data: direset, error: er } = await db
      .from('students')
      .update({ is_logged_in: false, sesi_token: null })
      .eq('is_logged_in', true)
      .select('nomor_ujian');
    if (er) return NextResponse.json({ ok: true, ...tutup, catatan_login: 'Ujian ditutup, tetapi reset login otomatis gagal. Gunakan tombol Reset Semua Login di tab Database Siswa.' });
    return NextResponse.json({ ok: true, ...tutup, login_direset: direset ? direset.length : 0 });
  }
  return NextResponse.json({ ok: true });
}

async function tutupSesi(db, b) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) return salah('Permintaan tidak valid.');
  const { data: u, error } = await db.from('ujian').select('id, status').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!u) return salah('Ujian tidak ditemukan.', 404);
  if (u.status !== 'selesai') return salah('Ujian ini belum diselesaikan. Tekan Selesai dulu.');
  const tutup = await tutupSesiBelumSelesai(db, id);
  return NextResponse.json({ ok: true, ...tutup });
}

async function ubahDurasi(db, b) {
  const id = Number(b.id);
  const durasi = Number(b.durasi_menit);
  if (!Number.isInteger(id)) return salah('Permintaan tidak valid.');
  if (!Number.isInteger(durasi) || durasi < 1 || durasi > 600) return salah('Durasi harus berupa angka bulat 1 sampai 600 menit.');

  const { data: u, error } = await db.from('ujian').select('id, status').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!u) return salah('Ujian tidak ditemukan.', 404);
  if (u.status === 'aktif') return salah('Durasi tidak bisa diubah saat ujian sedang aktif.');

  const { error: eu } = await db.from('ujian').update({ durasi_menit: durasi }).eq('id', id);
  if (eu) throw new Error(eu.message);
  return NextResponse.json({ ok: true });
}

async function hapus(db, b) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) return salah('Permintaan tidak valid.');

  const { data: u, error } = await db.from('ujian').select('id, status').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!u) return salah('Ujian tidak ditemukan.', 404);
  if (u.status === 'aktif') return salah('Ujian yang sedang aktif tidak bisa dihapus. Tekan Selesai dulu.');

  // Ujian yang sudah dilaksanakan: hapus dulu sesi siswa (jawaban ikut terhapus otomatis), baru ujiannya.
  // Data ini tidak bisa dikembalikan, jadi hasilnya harus sudah diunduh ke Excel.
  if (u.status === 'selesai') {
    const { error: es } = await db.from('sesi_ujian').delete().eq('ujian_id', id);
    if (es) throw new Error('Gagal menghapus sesi siswa: ' + es.message);
  }

  const { error: eu } = await db.from('ujian').delete().eq('id', id);
  if (eu) throw new Error(eu.message);
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
      case 'buat': return await buat(db, body);
      case 'status': return await ubahStatus(db, body);
      case 'durasi': return await ubahDurasi(db, body);
      case 'tutup_sesi': return await tutupSesi(db, body);
      case 'hapus': return await hapus(db, body);
      default: return salah('Aksi tidak dikenal.');
    }
  } catch (e) {
    return salah('Terjadi kesalahan di server: ' + e.message, 500);
  }
}
