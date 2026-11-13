import { NextResponse } from 'next/server';
import { cekAdmin } from '../../../../lib/adminAuth';
import { buatDb } from '../../../../lib/siswaAuth';
import { buatSandi, hashSandi, npsnValid } from '../../../../lib/sekolahAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });
const tolak = () => salah('Kata sandi admin salah.', 401);

/* GET: daftar sekolah (status kata sandi) dan 100 reset terakhir */
export async function GET(request) {
  if (!cekAdmin(request)) return tolak();
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap.', 500);
  try {
    const { data: sk, error } = await db
      .from('sekolah')
      .select('npsn, nama, kata_sandi_hash, sandi_diubah_at, terkunci_sampai')
      .order('nama');
    if (error) throw new Error(error.message);
    const { data: lg, error: el } = await db
      .from('log_reset')
      .select('waktu, oleh, nomor_ujian, aksi')
      .order('waktu', { ascending: false })
      .limit(100);
    if (el) throw new Error(el.message);

    const nomor = [...new Set((lg || []).map((l) => l.nomor_ujian))];
    const nama = new Map();
    if (nomor.length) {
      const { data: st } = await db.from('students').select('nomor_ujian, nama_lengkap').in('nomor_ujian', nomor);
      (st || []).forEach((x) => nama.set(x.nomor_ujian, x.nama_lengkap));
    }
    const peta = new Map((sk || []).map((x) => [x.npsn, x.nama]));

    return NextResponse.json({
      sekolah: (sk || []).map((x) => ({
        npsn: x.npsn,
        nama: x.nama,
        ada_sandi: !!x.kata_sandi_hash,
        sandi_diubah_at: x.sandi_diubah_at,
        diblokir: !!x.terkunci_sampai && new Date(x.terkunci_sampai).getTime() > Date.now(),
      })),
      log: (lg || []).map((l) => ({
        waktu: l.waktu,
        oleh: l.oleh === 'super' ? 'Super admin' : peta.get(l.oleh) || l.oleh,
        nomor_ujian: l.nomor_ujian,
        nama: nama.get(l.nomor_ujian) || '',
      })),
    });
  } catch (e) {
    return salah('Gagal membaca data: ' + e.message, 500);
  }
}

/* POST:
   { aksi: 'ganti', npsn }          -> membuat kata sandi baru untuk satu sekolah, dikembalikan sekali saja (JSON)
   { aksi: 'buat_yang_kosong' }     -> membuat kata sandi untuk semua sekolah yang belum punya, dikembalikan sebagai file Excel
   { aksi: 'buka_blokir', npsn }    -> menghapus jeda salah-kata-sandi */
export async function POST(request) {
  if (!cekAdmin(request)) return tolak();
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap.', 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return salah('Permintaan tidak valid.');
  }

  try {
    if (body.aksi === 'ganti') {
      const npsn = String(body.npsn ?? '');
      if (!npsnValid(npsn)) return salah('NPSN tidak valid.');
      const sandi = buatSandi();
      const { data, error } = await db
        .from('sekolah')
        .update({ kata_sandi_hash: await hashSandi(sandi), sandi_diubah_at: new Date().toISOString(), gagal_masuk: 0, terkunci_sampai: null })
        .eq('npsn', npsn)
        .select('npsn');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return salah('Sekolah tidak ditemukan.', 404);
      return NextResponse.json({ ok: true, npsn, sandi });
    }

    if (body.aksi === 'buka_blokir') {
      const npsn = String(body.npsn ?? '');
      if (!npsnValid(npsn)) return salah('NPSN tidak valid.');
      const { error } = await db.from('sekolah').update({ gagal_masuk: 0, terkunci_sampai: null }).eq('npsn', npsn);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (body.aksi === 'buat_yang_kosong') {
      const { data: sk, error } = await db.from('sekolah').select('npsn, nama').is('kata_sandi_hash', null).order('nama');
      if (error) throw new Error(error.message);
      if (!sk || sk.length === 0) return salah('Semua sekolah sudah punya kata sandi.', 409);

      const baru = [];
      for (const x of sk) {
        const sandi = buatSandi();
        baru.push({ ...x, sandi, hash: await hashSandi(sandi) });
      }

      // File dibuat lebih dulu; kata sandi baru disimpan ke database hanya bila file berhasil disusun.
      const basis = (process.env.NEXT_PUBLIC_URL_TRYOUT || new URL(request.url).origin).replace(/\/+$/, '');
      const mod = await import('exceljs');
      const ExcelJS = mod.default ?? mod;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Admin Sekolah');
      ws.columns = [
        { header: 'No', key: 'no', width: 6 },
        { header: 'Sekolah', key: 'nama', width: 40 },
        { header: 'NPSN', key: 'npsn', width: 12 },
        { header: 'Link Admin Sekolah', key: 'link', width: 56 },
        { header: 'Kata Sandi', key: 'sandi', width: 14 },
      ];
      baru.forEach((b, i) => ws.addRow({ no: i + 1, nama: b.nama, npsn: b.npsn, link: `${basis}/sekolah/${b.npsn}`, sandi: b.sandi }));
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      const buffer = await wb.xlsx.writeBuffer();

      const waktu = new Date().toISOString();
      for (const b of baru) {
        const { error: eu } = await db
          .from('sekolah')
          .update({ kata_sandi_hash: b.hash, sandi_diubah_at: waktu, gagal_masuk: 0, terkunci_sampai: null })
          .eq('npsn', b.npsn);
        if (eu) throw new Error(eu.message);
      }

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="kata-sandi-admin-sekolah.xlsx"',
          'Cache-Control': 'no-store',
        },
      });
    }

    return salah('Aksi tidak dikenal.');
  } catch (e) {
    return salah('Terjadi kesalahan di server: ' + e.message, 500);
  }
}
