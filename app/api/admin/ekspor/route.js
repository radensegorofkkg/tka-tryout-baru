import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cekAdmin } from '../../../../lib/adminAuth';
import { susunHasil, rekapSekolah, waktuWib } from '../../../../lib/ekspor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });

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

const tebal = { bold: true };
const latarJudul = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

function gayaJudul(ws) {
  const baris = ws.getRow(1);
  baris.font = tebal;
  baris.fill = latarJudul;
  baris.alignment = { vertical: 'middle', wrapText: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// GET ?ujian_id=N : mengunduh hasil ujian sebagai file Excel (hasil per siswa + rekap per sekolah).
export async function GET(request) {
  if (!cekAdmin(request)) return salah('Kata sandi admin salah.', 401);
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY).', 500);

  const ujianId = Number(new URL(request.url).searchParams.get('ujian_id'));
  if (!Number.isInteger(ujianId)) return salah('Permintaan tidak valid.');

  try {
    const { data: u, error: eu } = await db.from('ujian').select('id, nama').eq('id', ujianId).maybeSingle();
    if (eu) throw new Error(eu.message);
    if (!u) return salah('Ujian tidak ditemukan.', 404);

    const { data: bs, error: eb } = await db.from('ujian_soal').select('soal(skor)').eq('ujian_id', ujianId);
    if (eb) throw new Error(eb.message);
    const jumlahSoal = bs.length;
    const maks = bs.reduce((a, b) => a + (Number(b.soal?.skor) || 0), 0);

    const siswa = await ambilSemua(() => db.from('students').select('nomor_ujian, nama_lengkap').order('nomor_ujian'));
    const sesi = await ambilSemua(() =>
      db.from('sesi_ujian').select('id, nomor_ujian, mulai_at, selesai_at, skor').eq('ujian_id', ujianId).order('id')
    );
    const ringkasan = await ambilSemua(() => db.rpc('ringkasan_sesi', { p_ujian_id: ujianId }));
    const { data: dataSekolah } = await db.from('sekolah').select('npsn, nama');

    const petaJawab = new Map(ringkasan.map((r) => [r.sesi_id, Number(r.jumlah_jawaban)]));
    const namaSekolah = new Map((dataSekolah || []).map((x) => [x.npsn, x.nama]));

    const hasil = susunHasil({ siswa, sesi, petaJawab, namaSekolah, maks });
    hasil.sort((a, b) => a.sekolah.localeCompare(b.sekolah) || a.nomor_ujian.localeCompare(b.nomor_ujian));
    const rekap = rekapSekolah(hasil);

    const mod = await import('exceljs');
    const ExcelJS = mod.default ?? mod;
    const wb = new ExcelJS.Workbook();
    wb.created = new Date();

    // Lembar 1: hasil per siswa
    const ws1 = wb.addWorksheet('Hasil Siswa');
    ws1.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'No Ujian', key: 'nomor', width: 16 },
      { header: 'Nama Lengkap', key: 'nama', width: 34 },
      { header: 'NPSN', key: 'npsn', width: 12 },
      { header: 'Sekolah', key: 'sekolah', width: 36 },
      { header: 'Status', key: 'status', width: 14 },
      { header: `Dijawab (dari ${jumlahSoal} soal)`, key: 'dijawab', width: 16 },
      { header: 'Skor', key: 'skor', width: 8 },
      { header: `Skor Maks (${maks})`, key: 'maks', width: 12 },
      { header: 'Nilai (0-100)', key: 'nilai', width: 12 },
      { header: 'Mulai (WIB)', key: 'mulai', width: 22 },
      { header: 'Selesai (WIB)', key: 'selesai', width: 22 },
    ];
    hasil.forEach((h, i) => {
      ws1.addRow({
        no: i + 1,
        nomor: h.nomor_ujian,
        nama: h.nama,
        npsn: h.npsn,
        sekolah: h.sekolah,
        status: h.status,
        dijawab: h.dijawab,
        skor: h.skor,
        maks: h.skor !== null ? maks : null,
        nilai: h.nilai,
        mulai: waktuWib(h.mulai_at),
        selesai: waktuWib(h.selesai_at),
      });
    });
    gayaJudul(ws1);
    ws1.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 12 } };

    // Lembar 2: rekap per sekolah
    const ws2 = wb.addWorksheet('Rekap Sekolah');
    ws2.columns = [
      { header: 'Sekolah', key: 'sekolah', width: 38 },
      { header: 'NPSN', key: 'npsn', width: 12 },
      { header: 'Terdaftar', key: 'terdaftar', width: 11 },
      { header: 'Selesai', key: 'selesai', width: 9 },
      { header: 'Belum selesai', key: 'belum', width: 13 },
      { header: 'Tidak ikut', key: 'tidak', width: 11 },
      { header: 'Rata-rata nilai', key: 'rata', width: 14 },
      { header: 'Nilai tertinggi', key: 'tertinggi', width: 14 },
      { header: 'Nilai terendah', key: 'terendah', width: 14 },
    ];
    rekap.forEach((r) => ws2.addRow(r));
    const jml = (k) => rekap.reduce((a, r) => a + r[k], 0);
    const semuaNilai = hasil.filter((h) => h.nilai !== null).map((h) => h.nilai);
    const totalBaris = ws2.addRow({
      sekolah: 'TOTAL',
      terdaftar: jml('terdaftar'),
      selesai: jml('selesai'),
      belum: jml('belum'),
      tidak: jml('tidak'),
      rata: semuaNilai.length ? Math.round((semuaNilai.reduce((a, b) => a + b, 0) / semuaNilai.length) * 10) / 10 : null,
      tertinggi: semuaNilai.length ? Math.max(...semuaNilai) : null,
      terendah: semuaNilai.length ? Math.min(...semuaNilai) : null,
    });
    totalBaris.font = tebal;
    gayaJudul(ws2);

    // Lembar 3: keterangan
    const ws3 = wb.addWorksheet('Keterangan');
    ws3.getColumn(1).width = 90;
    [
      `Ujian: ${u.nama}`,
      `Diunduh: ${waktuWib(new Date().toISOString())} WIB`,
      `Jumlah soal: ${jumlahSoal} · Skor maksimal: ${maks}`,
      'Nilai (0-100) = skor dibagi skor maksimal, dikali 100.',
      'Skor dan nilai hanya terisi untuk siswa berstatus Selesai.',
      'Status "Belum selesai" = sudah mulai tetapi belum dikumpulkan/dinilai. "Tidak ikut" = terdaftar tetapi belum pernah memulai ujian ini.',
      'Rata-rata, nilai tertinggi, dan terendah di Rekap Sekolah dihitung hanya dari siswa yang Selesai.',
    ].forEach((t) => ws3.addRow([t]));

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="hasil-ujian.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return salah('Gagal menyusun file hasil: ' + e.message, 500);
  }
}
