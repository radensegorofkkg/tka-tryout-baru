import { NextResponse } from 'next/server';
import { cekAdmin } from '../../../../lib/adminAuth';
import { buatDb } from '../../../../lib/siswaAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });

/* GET ?ujian_id=N : sekolah yang dipilih (kosong = semua sekolah) dan daftar seluruh sekolah */
export async function GET(request) {
  if (!cekAdmin(request)) return salah('Kata sandi admin salah.', 401);
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap.', 500);
  const ujianId = Number(new URL(request.url).searchParams.get('ujian_id'));
  if (!Number.isInteger(ujianId)) return salah('Permintaan tidak valid.');
  try {
    const { data: u, error: eu } = await db.from('ujian').select('id, nama, status').eq('id', ujianId).maybeSingle();
    if (eu) throw new Error(eu.message);
    if (!u) return salah('Ujian tidak ditemukan.', 404);
    const { data: p, error: ep } = await db.from('ujian_peserta').select('npsn').eq('ujian_id', ujianId);
    if (ep) throw new Error(ep.message);
    const { data: sk, error: es } = await db.from('sekolah').select('npsn, nama').order('nama');
    if (es) throw new Error(es.message);
    return NextResponse.json({ ujian: u, npsn: (p || []).map((x) => x.npsn), sekolah: sk || [] });
  } catch (e) {
    return salah('Gagal membaca data: ' + e.message, 500);
  }
}

/* POST { ujian_id, npsn: [...] } : menetapkan sekolah peserta. Daftar kosong = terbuka untuk semua sekolah. */
export async function POST(request) {
  if (!cekAdmin(request)) return salah('Kata sandi admin salah.', 401);
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap.', 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return salah('Permintaan tidak valid.');
  }
  const ujianId = Number(body.ujian_id);
  if (!Number.isInteger(ujianId) || !Array.isArray(body.npsn)) return salah('Permintaan tidak valid.');
  const npsn = [...new Set(body.npsn.map((x) => String(x)))];
  if (npsn.length > 500 || !npsn.every((x) => /^[0-9]{8}$/.test(x))) return salah('Daftar sekolah tidak valid.');

  try {
    const { data: u, error: eu } = await db.from('ujian').select('id').eq('id', ujianId).maybeSingle();
    if (eu) throw new Error(eu.message);
    if (!u) return salah('Ujian tidak ditemukan.', 404);

    if (npsn.length > 0) {
      const { data: ada, error: ea } = await db.from('sekolah').select('npsn').in('npsn', npsn);
      if (ea) throw new Error(ea.message);
      if ((ada || []).length !== npsn.length) return salah('Ada sekolah yang tidak ada di daftar sekolah.');
    }

    const { error: ed } = await db.from('ujian_peserta').delete().eq('ujian_id', ujianId);
    if (ed) throw new Error(ed.message);
    if (npsn.length > 0) {
      const { error: ei } = await db.from('ujian_peserta').insert(npsn.map((n) => ({ ujian_id: ujianId, npsn: n })));
      if (ei) throw new Error(ei.message);
    }
    return NextResponse.json({ ok: true, jumlah: npsn.length });
  } catch (e) {
    return salah('Terjadi kesalahan di server: ' + e.message, 500);
  }
}
