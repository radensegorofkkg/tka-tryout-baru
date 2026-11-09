// Menyusun data hasil ujian untuk diekspor ke Excel. Bagian murni (tanpa database/file) supaya mudah diuji.

const npsnDari = (nomor) => String(nomor).split('-')[0];

const bulat1 = (n) => Math.round(n * 10) / 10;

// siswa: [{nomor_ujian, nama_lengkap}]
// sesi: [{id, nomor_ujian, mulai_at, selesai_at, skor}]
// petaJawab: Map(sesi_id -> jumlah jawaban), namaSekolah: Map(npsn -> nama)
export function susunHasil({ siswa, sesi, petaJawab, namaSekolah, maks }) {
  const petaSesi = new Map(sesi.map((s) => [s.nomor_ujian, s]));
  return siswa.map((s) => {
    const se = petaSesi.get(s.nomor_ujian);
    const npsn = npsnDari(s.nomor_ujian);
    let status = 'Tidak ikut';
    if (se) status = se.selesai_at ? 'Selesai' : 'Belum selesai';
    const skor = se && se.selesai_at && se.skor !== null && se.skor !== undefined ? Number(se.skor) : null;
    return {
      nomor_ujian: s.nomor_ujian,
      nama: s.nama_lengkap,
      npsn,
      sekolah: namaSekolah.get(npsn) || '(belum ada di daftar sekolah)',
      status,
      dijawab: se ? petaJawab.get(se.id) || 0 : null,
      skor,
      nilai: skor !== null && maks > 0 ? bulat1((skor / maks) * 100) : null,
      mulai_at: se ? se.mulai_at : null,
      selesai_at: se ? se.selesai_at : null,
    };
  });
}

// Rekap per sekolah, diurutkan menurut nama sekolah.
export function rekapSekolah(hasil) {
  const peta = new Map();
  for (const h of hasil) {
    if (!peta.has(h.npsn)) peta.set(h.npsn, { npsn: h.npsn, sekolah: h.sekolah, terdaftar: 0, selesai: 0, belum: 0, tidak: 0, nilai: [] });
    const r = peta.get(h.npsn);
    r.terdaftar++;
    if (h.status === 'Selesai') { r.selesai++; if (h.nilai !== null) r.nilai.push(h.nilai); }
    else if (h.status === 'Belum selesai') r.belum++;
    else r.tidak++;
  }
  return [...peta.values()]
    .map((r) => ({
      npsn: r.npsn,
      sekolah: r.sekolah,
      terdaftar: r.terdaftar,
      selesai: r.selesai,
      belum: r.belum,
      tidak: r.tidak,
      rata: r.nilai.length ? bulat1(r.nilai.reduce((a, b) => a + b, 0) / r.nilai.length) : null,
      tertinggi: r.nilai.length ? Math.max(...r.nilai) : null,
      terendah: r.nilai.length ? Math.min(...r.nilai) : null,
    }))
    .sort((a, b) => a.sekolah.localeCompare(b.sekolah));
}

export function waktuWib(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'medium' });
}
