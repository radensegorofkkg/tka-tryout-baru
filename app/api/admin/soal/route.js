import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cekAdmin } from '../../../../lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });
const MAKS_HALAMAN = 50;

function buatDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) return null;
  return createClient(url, kunci, { auth: { persistSession: false, autoRefreshToken: false } });
}

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

const potong = (arr, n) => {
  const h = [];
  for (let i = 0; i < arr.length; i += n) h.push(arr.slice(i, i + n));
  return h;
};

// Ujian mana saja yang memakai soal-soal ini. Hasil: Map(soal_id -> [{ id, nama, status }])
async function pemakaian(db, soalIds) {
  const peta = new Map();
  for (const bagian of potong(soalIds, 200)) {
    const { data, error } = await db.from('ujian_soal').select('soal_id, ujian(id, nama, status)').in('soal_id', bagian);
    if (error) throw new Error(error.message);
    for (const r of data) {
      if (!r.ujian) continue;
      if (!peta.has(r.soal_id)) peta.set(r.soal_id, []);
      peta.get(r.soal_id).push(r.ujian);
    }
  }
  return peta;
}

const namaUjian = (daftar) => [...new Set(daftar.map((u) => `"${u.nama}"`))].join(', ');

/* ---------- GET: daftar soal (dengan filter) + daftar mapel dan batch impor ---------- */
export async function GET(request) {
  if (!cekAdmin(request)) return salah('Kata sandi admin salah.', 401);
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY).', 500);

  const p = new URL(request.url).searchParams;
  const mapelId = Number(p.get('mapel_id'));
  const batchId = Number(p.get('batch_id'));
  const q = String(p.get('q') ?? '').trim().slice(0, 100);
  const offset = Math.max(0, Number(p.get('offset')) || 0);

  try {
    let kueri = db
      .from('soal')
      .select('id, mapel_id, batch_id, tipe, pertanyaan, opsi, skor, kunci_soal(kunci, pembahasan), stimulus(id, kode, isi, url_gambar)', { count: 'exact' })
      .order('batch_id', { ascending: false })
      .order('id', { ascending: true });
    if (Number.isInteger(mapelId) && mapelId > 0) kueri = kueri.eq('mapel_id', mapelId);
    if (Number.isInteger(batchId) && batchId > 0) kueri = kueri.eq('batch_id', batchId);
    if (q) kueri = kueri.ilike('pertanyaan', `%${q}%`);
    const { data: soal, error, count } = await kueri.range(offset, offset + MAKS_HALAMAN - 1);
    if (error) throw new Error(error.message);

    const pakai = await pemakaian(db, soal.map((s) => s.id));
    const daftar = soal.map((s) => {
      const k = Array.isArray(s.kunci_soal) ? s.kunci_soal[0] : s.kunci_soal;
      const { kunci_soal, ...sisa } = s;
      return { ...sisa, kunci: k ? k.kunci : null, pembahasan: k ? k.pembahasan : null, dipakai: pakai.get(s.id) || [] };
    });

    const { data: mapel, error: em } = await db.from('mapel').select('id, nama').order('nama');
    if (em) throw new Error(em.message);
    const { data: batch, error: eb } = await db
      .from('impor_batch')
      .select('id, nama_file, created_at')
      .eq('status', 'tersimpan')
      .order('id', { ascending: false })
      .limit(60);
    if (eb) throw new Error(eb.message);
    const batchLengkap = await Promise.all(
      batch.map(async (b) => {
        const { count: jumlah } = await db.from('soal').select('id', { count: 'exact', head: true }).eq('batch_id', b.id);
        return { ...b, jumlah: jumlah || 0 };
      })
    );

    return NextResponse.json({ soal: daftar, total: count ?? daftar.length, mapel, batch: batchLengkap, per_halaman: MAKS_HALAMAN });
  } catch (e) {
    return salah('Gagal membaca bank soal: ' + e.message, 500);
  }
}

/* ---------- POST ---------- */
const teksSah = (v, maks) => typeof v === 'string' && v.trim().length > 0 && v.length <= maks;

async function ubah(db, b) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) return salah('Permintaan tidak valid.');
  const { data: s, error } = await db.from('soal').select('id, tipe, opsi').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) return salah('Soal tidak ditemukan.', 404);

  const pakai = (await pemakaian(db, [id])).get(id) || [];
  const aktif = pakai.filter((u) => u.status === 'aktif');
  if (aktif.length) return salah(`Soal ini dipakai di ujian yang sedang aktif (${namaUjian(aktif)}). Selesaikan ujian itu dulu.`, 409);

  const upd = {};
  const kUpd = {};
  let opsiBaru = s.opsi;

  if (b.pertanyaan !== undefined) {
    if (!teksSah(b.pertanyaan, 5000)) return salah('Pertanyaan wajib diisi (maksimal 5000 huruf).');
    upd.pertanyaan = b.pertanyaan.trim();
  }

  if (b.opsi_teks !== undefined) {
    if (!['PG', 'PG_KOMPLEKS', 'BENAR_SALAH'].includes(s.tipe) || !Array.isArray(s.opsi)) {
      return salah('Teks pilihan untuk tipe soal ini belum bisa diubah dari sini. Gunakan impor ulang.');
    }
    const t = b.opsi_teks;
    if (!t || typeof t !== 'object' || Array.isArray(t)) return salah('Permintaan tidak valid.');
    opsiBaru = s.opsi.map((o) => {
      const v = t[o.k];
      return v === undefined ? o : { ...o, teks: v };
    });
    for (const o of opsiBaru) if (!teksSah(o.teks, 1000)) return salah(`Teks pilihan ${o.k} wajib diisi (maksimal 1000 huruf).`);
    upd.opsi = opsiBaru;
  }

  if (b.skor !== undefined) {
    const skor = Number(b.skor);
    if (!Number.isFinite(skor) || skor <= 0 || skor > 100) return salah('Skor harus angka lebih dari 0 dan paling besar 100.');
    upd.skor = skor;
  }

  if (b.kunci !== undefined) {
    const kunciOpsi = Array.isArray(opsiBaru) ? opsiBaru.map((o) => o.k) : [];
    if (s.tipe === 'PG') {
      if (typeof b.kunci !== 'string' || !kunciOpsi.includes(b.kunci)) return salah('Kunci pilihan ganda harus salah satu pilihan yang ada.');
      kUpd.kunci = [b.kunci];
    } else if (s.tipe === 'PG_KOMPLEKS') {
      const k = b.kunci;
      if (!Array.isArray(k) || k.length === 0 || new Set(k).size !== k.length || !k.every((x) => kunciOpsi.includes(x))) {
        return salah('Kunci pilihan ganda kompleks harus berisi minimal satu pilihan yang ada.');
      }
      kUpd.kunci = [...k].sort();
    } else if (s.tipe === 'BENAR_SALAH') {
      const k = b.kunci;
      if (!Array.isArray(k) || k.length !== kunciOpsi.length || !k.every((x) => typeof x === 'boolean')) {
        return salah('Kunci benar-salah harus diisi untuk setiap pernyataan.');
      }
      kUpd.kunci = k;
    } else {
      return salah('Kunci untuk tipe soal ini belum bisa diubah dari sini. Gunakan impor ulang.');
    }
  }

  if (b.pembahasan !== undefined) {
    if (b.pembahasan !== null && (typeof b.pembahasan !== 'string' || b.pembahasan.length > 5000)) return salah('Pembahasan terlalu panjang (maksimal 5000 huruf).');
    kUpd.pembahasan = b.pembahasan && b.pembahasan.trim() ? b.pembahasan.trim() : null;
  }

  if (Object.keys(upd).length === 0 && Object.keys(kUpd).length === 0) return salah('Tidak ada yang diubah.');

  if (Object.keys(upd).length) {
    const { error: e1 } = await db.from('soal').update(upd).eq('id', id);
    if (e1) throw new Error(e1.message);
  }
  if (Object.keys(kUpd).length) {
    const { error: e2 } = await db.from('kunci_soal').update(kUpd).eq('soal_id', id);
    if (e2) throw new Error(e2.message);
  }
  return NextResponse.json({ ok: true });
}

async function ubahStimulus(db, b) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) return salah('Permintaan tidak valid.');
  const { data: st, error } = await db.from('stimulus').select('id').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!st) return salah('Bacaan tidak ditemukan.', 404);

  const soal = await ambilSemua(() => db.from('soal').select('id').eq('stimulus_id', id).order('id'));
  const pakai = await pemakaian(db, soal.map((s) => s.id));
  const aktif = [...pakai.values()].flat().filter((u) => u.status === 'aktif');
  if (aktif.length) return salah(`Bacaan ini dipakai di ujian yang sedang aktif (${namaUjian(aktif)}). Selesaikan ujian itu dulu.`, 409);

  const upd = {};
  if (b.isi !== undefined) {
    if (typeof b.isi !== 'string' || b.isi.length > 20000) return salah('Isi bacaan terlalu panjang (maksimal 20000 huruf).');
    upd.isi = b.isi.trim() || null;
  }
  if (b.url_gambar !== undefined) {
    const mentah = b.url_gambar === null ? '' : String(b.url_gambar).trim();
    if (mentah) {
      const bagian = mentah.split(',').map((x) => x.trim()).filter(Boolean);
      if (!bagian.every((x) => /^https?:\/\/\S+$/.test(x))) return salah('Alamat gambar harus diawali https:// dan tanpa spasi. Beberapa gambar dipisah koma.');
      upd.url_gambar = bagian.join(',');
    } else upd.url_gambar = null;
  }
  if (Object.keys(upd).length === 0) return salah('Tidak ada yang diubah.');
  const { error: eu } = await db.from('stimulus').update(upd).eq('id', id);
  if (eu) throw new Error(eu.message);
  return NextResponse.json({ ok: true });
}

async function hapusSoal(db, b) {
  const id = Number(b.id);
  if (!Number.isInteger(id)) return salah('Permintaan tidak valid.');
  const { data: s, error } = await db.from('soal').select('id, stimulus_id').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) return salah('Soal tidak ditemukan.', 404);

  const pakai = (await pemakaian(db, [id])).get(id) || [];
  if (pakai.length) return salah(`Soal ini dipakai di ujian ${namaUjian(pakai)}, jadi tidak bisa dihapus. Hapus ujian itu dulu, atau cukup ubah isi soalnya.`, 409);

  const { error: ed } = await db.from('soal').delete().eq('id', id);
  if (ed) throw new Error(ed.message);

  // Bacaan yang tidak dipakai soal lain ikut dibersihkan.
  if (s.stimulus_id) {
    const { count } = await db.from('soal').select('id', { count: 'exact', head: true }).eq('stimulus_id', s.stimulus_id);
    if (!count) await db.from('stimulus').delete().eq('id', s.stimulus_id);
  }
  return NextResponse.json({ ok: true });
}

async function hapusBatch(db, b) {
  const batchId = Number(b.batch_id);
  if (!Number.isInteger(batchId)) return salah('Permintaan tidak valid.');
  const { data: bt, error } = await db.from('impor_batch').select('id, nama_file').eq('id', batchId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!bt) return salah('File impor tidak ditemukan.', 404);

  const soal = await ambilSemua(() => db.from('soal').select('id').eq('batch_id', batchId).order('id'));
  const pakai = await pemakaian(db, soal.map((s) => s.id));
  const semuaPakai = [...pakai.values()].flat();
  if (semuaPakai.length) return salah(`Sebagian soal dari file ini dipakai di ujian ${namaUjian(semuaPakai)}, jadi tidak bisa dihapus. Hapus ujian itu dulu.`, 409);

  const { error: e1 } = await db.from('soal').delete().eq('batch_id', batchId);
  if (e1) throw new Error('Gagal menghapus soal: ' + e1.message);
  const { error: e2 } = await db.from('stimulus').delete().eq('batch_id', batchId);
  if (e2) throw new Error('Soal terhapus, tetapi bacaan gagal dihapus: ' + e2.message);
  const { error: e3 } = await db.from('impor_batch').delete().eq('id', batchId);
  if (e3) throw new Error('Soal terhapus, tetapi catatan impor gagal dihapus: ' + e3.message);
  return NextResponse.json({ ok: true, dihapus: soal.length });
}

export async function POST(request) {
  if (!cekAdmin(request)) return salah('Kata sandi admin salah.', 401);
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
      case 'ubah': return await ubah(db, body);
      case 'ubah_stimulus': return await ubahStimulus(db, body);
      case 'hapus': return await hapusSoal(db, body);
      case 'hapus_batch': return await hapusBatch(db, body);
      default: return salah('Aksi tidak dikenal.');
    }
  } catch (e) {
    return salah('Terjadi kesalahan di server: ' + e.message, 500);
  }
}
