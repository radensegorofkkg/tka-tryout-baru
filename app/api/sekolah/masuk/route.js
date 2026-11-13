import { NextResponse } from 'next/server';
import { buatDb } from '../../../../lib/siswaAuth';
import { npsnValid, cekSandi, buatToken, BATAS_SALAH, JEDA_MENIT } from '../../../../lib/sekolahAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const salah = (pesan, status = 400) => NextResponse.json({ pesan }, { status });
const GAGAL = 'NPSN atau kata sandi salah.';

export async function POST(request) {
  const db = buatDb();
  const rahasia = process.env.SEKOLAH_RAHASIA;
  if (!db || !rahasia) return salah('Konfigurasi server belum lengkap (SEKOLAH_RAHASIA).', 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return salah('Permintaan tidak valid.');
  }
  const npsn = String(body.npsn ?? '').trim();
  const sandi = String(body.kata_sandi ?? '').trim().toUpperCase();
  if (!npsnValid(npsn) || !sandi) return salah(GAGAL, 401);

  try {
    const { data: s, error } = await db
      .from('sekolah')
      .select('npsn, nama, kata_sandi_hash, gagal_masuk, terkunci_sampai')
      .eq('npsn', npsn)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s || !s.kata_sandi_hash) return salah(GAGAL, 401);

    if (s.terkunci_sampai && new Date(s.terkunci_sampai).getTime() > Date.now()) {
      const menit = Math.ceil((new Date(s.terkunci_sampai).getTime() - Date.now()) / 60000);
      return salah(`Terlalu banyak salah. Coba lagi dalam ${menit} menit.`, 429);
    }

    if (!(await cekSandi(sandi, s.kata_sandi_hash))) {
      const gagal = (s.gagal_masuk || 0) + 1;
      const kunci = gagal >= BATAS_SALAH;
      await db
        .from('sekolah')
        .update({
          gagal_masuk: kunci ? 0 : gagal,
          terkunci_sampai: kunci ? new Date(Date.now() + JEDA_MENIT * 60000).toISOString() : null,
        })
        .eq('npsn', npsn);
      return salah(kunci ? `Terlalu banyak salah. Coba lagi dalam ${JEDA_MENIT} menit.` : GAGAL, 401);
    }

    if (s.gagal_masuk) await db.from('sekolah').update({ gagal_masuk: 0, terkunci_sampai: null }).eq('npsn', npsn);
    return NextResponse.json({ ok: true, token: buatToken(npsn, rahasia), npsn, nama: s.nama });
  } catch (e) {
    return salah('Terjadi kesalahan di server. Coba lagi.', 500);
  }
}
