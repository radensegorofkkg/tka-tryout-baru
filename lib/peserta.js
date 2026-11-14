// Aturan peserta per ujian (per sekolah). Ujian tanpa daftar sekolah = terbuka untuk semua.

export const PESAN_TIDAK_TERDAFTAR = 'Ujian ini tidak untuk sekolah Anda. Hubungi pengawas.';

export const npsnDariNomor = (nomor) => String(nomor).split('-')[0];

// true bila ujian tidak dibatasi, atau sekolah dari nomor ujian ini termasuk daftar peserta.
export async function bolehIkut(db, ujianId, nomorUjian) {
  const { data, error } = await db.from('ujian_peserta').select('npsn').eq('ujian_id', ujianId);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return true;
  const npsn = npsnDariNomor(nomorUjian);
  return data.some((x) => x.npsn === npsn);
}

// Untuk Pantau/Ekspor: kumpulan NPSN peserta, atau null bila ujian terbuka untuk semua sekolah.
export async function daftarPeserta(db, ujianId) {
  const { data, error } = await db.from('ujian_peserta').select('npsn').eq('ujian_id', ujianId);
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? new Set(data.map((x) => x.npsn)) : null;
}
