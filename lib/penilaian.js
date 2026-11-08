// Penilaian jawaban siswa. Aturan nilai (sudah disepakati):
//  - PG            : benar = skor penuh, salah/kosong = 0
//  - PG_KOMPLEKS   : (pilihan benar yang dipilih - pilihan salah yang dipilih) / jumlah kunci x skor, minimal 0
//  - BENAR_SALAH   : pernyataan yang dijawab benar / jumlah pernyataan x skor
//  - JODOH         : pasangan yang benar / jumlah pasangan x skor
// Pernyataan atau pasangan yang tidak dijawab dihitung salah.

const bulat = (n) => Math.round(n * 100) / 100;
const adaObjek = (j) => j !== null && typeof j === 'object' && !Array.isArray(j);

export function nilaiSoal(soal, kunci, jawab) {
  const maks = Number(soal.skor) || 0;
  if (jawab === null || jawab === undefined || kunci === null || kunci === undefined) return 0;

  if (soal.tipe === 'PG') {
    return Array.isArray(kunci) && jawab === kunci[0] ? maks : 0;
  }

  if (soal.tipe === 'PG_KOMPLEKS') {
    if (!Array.isArray(kunci) || kunci.length === 0 || !Array.isArray(jawab)) return 0;
    const benar = jawab.filter((x) => kunci.includes(x)).length;
    const salah = jawab.length - benar;
    return Math.max(0, (benar - salah) / kunci.length) * maks;
  }

  if (soal.tipe === 'BENAR_SALAH') {
    if (!Array.isArray(kunci) || kunci.length === 0 || !adaObjek(jawab)) return 0;
    let benar = 0;
    kunci.forEach((k, i) => {
      if (jawab[String(i + 1)] === k) benar++;
    });
    return (benar / kunci.length) * maks;
  }

  if (soal.tipe === 'JODOH') {
    if (!adaObjek(kunci) || !adaObjek(jawab)) return 0;
    const ks = Object.keys(kunci);
    if (ks.length === 0) return 0;
    const benar = ks.filter((k) => jawab[k] === kunci[k]).length;
    return (benar / ks.length) * maks;
  }

  return 0;
}

// Menghitung nilai satu sesi ujian dari jawaban yang sudah tersimpan di database.
export async function nilaiSesi(db, sesiId) {
  const { data: sesi, error: e1 } = await db.from('sesi_ujian').select('id, urutan').eq('id', sesiId).maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!sesi) throw new Error('Sesi tidak ditemukan.');

  const ids = Array.isArray(sesi.urutan) ? sesi.urutan : [];
  if (ids.length === 0) return { total: 0, maks: 0, dijawab: 0, rincian: [] };

  const { data: soal, error: e2 } = await db.from('soal').select('id, tipe, skor').in('id', ids);
  if (e2) throw new Error(e2.message);
  const { data: kunci, error: e3 } = await db.from('kunci_soal').select('soal_id, kunci').in('soal_id', ids);
  if (e3) throw new Error(e3.message);
  const { data: jawaban, error: e4 } = await db.from('jawaban').select('soal_id, jawaban').eq('sesi_id', sesiId);
  if (e4) throw new Error(e4.message);

  const petaKunci = new Map(kunci.map((k) => [k.soal_id, k.kunci]));
  const petaJawab = new Map(jawaban.map((j) => [j.soal_id, j.jawaban]));

  let total = 0;
  let maks = 0;
  const rincian = soal.map((s) => {
    const m = Number(s.skor) || 0;
    const p = nilaiSoal(s, petaKunci.get(s.id), petaJawab.get(s.id));
    total += p;
    maks += m;
    return { soal_id: s.id, perolehan: bulat(p), maks: m };
  });

  return { total: bulat(total), maks: bulat(maks), dijawab: petaJawab.size, rincian };
}
