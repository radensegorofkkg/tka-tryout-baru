import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cekAdmin } from '../../../../lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });

function buatDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) return null;
  return createClient(url, kunci, { auth: { persistSession: false, autoRefreshToken: false } });
}

// POST { ujian_id, terbuka: true/false } -> membuka atau menutup peringkat publik untuk ujian itu.
export async function POST(request) {
  if (!cekAdmin(request)) return salah('Kata sandi admin salah.', 401);
  const db = buatDb();
  if (!db) return salah('Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY).', 500);

  let body;
  try { body = await request.json(); } catch { return salah('Permintaan tidak valid.'); }
  const ujianId = Number(body.ujian_id);
  if (!Number.isInteger(ujianId) || typeof body.terbuka !== 'boolean') return salah('Permintaan tidak valid.');

  const { data, error } = await db
    .from('ujian')
    .update({ peringkat_terbuka: body.terbuka })
    .eq('id', ujianId)
    .select('id');
  if (error) return salah('Gagal menyimpan: ' + error.message, 500);
  if (!data || data.length === 0) return salah('Ujian tidak ditemukan.', 404);
  return NextResponse.json({ ok: true, terbuka: body.terbuka });
}
