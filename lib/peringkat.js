// Menyusun data peringkat (leaderboard) untuk halaman publik. Bagian murni (tanpa database) supaya mudah diuji.
// Nama siswa DISAMARKAN: kata pertama tampil 3 huruf awal, kata berikutnya 1 huruf awal, sisanya bintang.
// Nomor ujian tidak pernah ditampilkan.

const npsnDari = (nomor) => String(nomor).split('-')[0];
const bulat1 = (n) => Math.round(n * 10) / 10;

export function samarkanNama(nama) {
  const kata = String(nama ?? '').trim().split(/\s+/).filter(Boolean);
  return kata
    .map((k, i) => {
      const huruf = Array.from(k);
      const awal = i === 0 ? 3 : 1;
      if (huruf.length <= awal) return k;
      return huruf.slice(0, awal).join('') + '***';
    })
    .join(' ');
}

// siswa: [{nomor_ujian, nama_lengkap}], sesi: [{nomor_ujian, selesai_at, skor}], namaSekolah: Map(npsn -> nama)
export function susunPeringkat({ siswa, sesi, namaSekolah, maks }) {
  const petaSiswa = new Map(siswa.map((s) => [s.nomor_ujian, s.nama_lengkap]));
  const selesai = [];
  for (const se of sesi) {
    if (!se.selesai_at || se.skor === null || se.skor === undefined) continue;
    const nama = petaSiswa.get(se.nomor_ujian);
    if (nama === undefined) continue;
    const npsn = npsnDari(se.nomor_ujian);
    const skor = Number(se.skor);
    selesai.push({
      nama_asli: nama,
      nama: samarkanNama(nama),
      sekolah: namaSekolah.get(npsn) || '(sekolah belum terdaftar)',
      skor,
      nilai: maks > 0 ? bulat1((skor / maks) * 100) : 0,
    });
  }
  selesai.sort((a, b) => b.skor - a.skor || a.nama_asli.localeCompare(b.nama_asli));

  // Peringkat kembar: skor sama = peringkat sama (1, 2, 2, 4).
  let rank = 0;
  const peringkat = selesai.map((s, i) => {
    if (i === 0 || s.skor !== selesai[i - 1].skor) rank = i + 1;
    return { peringkat: rank, nama: s.nama, sekolah: s.sekolah, skor: s.skor, nilai: s.nilai };
  });

  const perSekolah = new Map();
  for (const s of selesai) {
    if (!perSekolah.has(s.sekolah)) perSekolah.set(s.sekolah, []);
    perSekolah.get(s.sekolah).push(s.nilai);
  }
  const sekolah = [...perSekolah.entries()]
    .map(([nama, daftar]) => ({
      sekolah: nama,
      jumlah: daftar.length,
      rata: bulat1(daftar.reduce((a, b) => a + b, 0) / daftar.length),
      tertinggi: Math.max(...daftar),
    }))
    .sort((a, b) => b.rata - a.rata || a.sekolah.localeCompare(b.sekolah));

  return { peringkat, sekolah };
}
