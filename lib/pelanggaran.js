// Aturan pelanggaran ujian. Bagian murni (tanpa database) supaya mudah diuji.
// Setiap kejadian disimpan sebagai { w: waktu ISO, j: jenis, d: lama dalam detik }.
// Siswa ditandai "terdeteksi kecurangan" bila:
//   - jumlah seluruh pelanggaran mencapai batas (3 kali di laptop/PC/Chromebook, 5 kali di HP/tablet), atau
//   - ada satu kejadian tidak layar penuh selama BATAS_LAYAR_PENUH_DETIK (60 detik) atau lebih.

export const BATAS_PELANGGARAN = 3; // laptop/PC/Chromebook
export const BATAS_PELANGGARAN_HP = 5; // HP/tablet: layar sering mati sendiri sehingga dibuat lebih longgar
export const BATAS_LAYAR_PENUH_DETIK = 60;
export const MAKS_CATATAN = 200;

export const JENIS_SAH = ['keluar_halaman', 'kehilangan_fokus', 'tidak_layar_penuh'];

const NAMA = {
  keluar_halaman: (n) => `keluar dari halaman ujian atau pindah tab/aplikasi ${n} kali`,
  kehilangan_fokus: (n) => `berpindah ke jendela lain ${n} kali`,
  tidak_layar_penuh: (n) => `tidak dalam layar penuh lebih dari 1 menit ${n} kali`,
};

// Mengenali HP/tablet dari User-Agent. Chromebook dan laptop tidak termasuk.
export function perangkatHp(userAgent) {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(String(userAgent || ''));
}

export const batasUntuk = (hp) => (hp ? BATAS_PELANGGARAN_HP : BATAS_PELANGGARAN);

export function nilaiPelanggaran(log, { hp = false } = {}) {
  const daftar = Array.isArray(log) ? log : [];
  const hitung = { keluar_halaman: 0, kehilangan_fokus: 0, tidak_layar_penuh: 0 };
  let layarPanjang = 0;
  for (const e of daftar) {
    if (!e || !(e.j in hitung)) continue;
    hitung[e.j]++;
    if (e.j === 'tidak_layar_penuh' && Number(e.d) >= BATAS_LAYAR_PENUH_DETIK) layarPanjang++;
  }
  const jumlah = hitung.keluar_halaman + hitung.kehilangan_fokus + hitung.tidak_layar_penuh;
  const curang = jumlah >= batasUntuk(hp) || layarPanjang > 0;
  const bagian = JENIS_SAH.filter((j) => hitung[j] > 0).map((j) => NAMA[j](hitung[j]));
  return { jumlah, curang, alasan: curang ? bagian.join('; ') : null, hitung };
}

// Menambah satu kejadian ke catatan. Mengembalikan catatan baru (dipotong bila terlalu panjang).
export function tambahCatatan(log, jenis, detik, waktu = new Date()) {
  const lama = Array.isArray(log) ? log : [];
  const d = Math.max(0, Math.min(86400, Math.round(Number(detik) || 0)));
  const baru = [...lama, { w: waktu.toISOString(), j: jenis, d }];
  return baru.length > MAKS_CATATAN ? baru.slice(baru.length - MAKS_CATATAN) : baru;
}
