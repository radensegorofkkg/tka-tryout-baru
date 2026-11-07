// Membaca dan memeriksa file Excel soal (template versi 1).
// Bagian "periksaData" murni (tanpa file/database) supaya mudah diuji.
import { createHash } from 'crypto';
import katex from 'katex';

export const MAPEL_SAH = ['Bahasa Indonesia', 'Matematika'];
export const TIPE_SAH = ['PG', 'PG_KOMPLEKS', 'BENAR_SALAH', 'JODOH'];
export const MAKS_SOAL = 500;

const HURUF = ['A', 'B', 'C', 'D'];
const KOLOM_SOAL = [
  'kode_stimulus', 'mapel', 'tipe', 'pertanyaan',
  'opsi_a', 'opsi_b', 'opsi_c', 'opsi_d',
  'kunci', 'pengecoh', 'pembahasan', 'skor',
];
const KOLOM_STIMULUS = ['kode', 'isi', 'url_gambar'];

/* ---------- 1. Membaca file .xlsx ---------- */

function teksSel(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined && v.result !== null) return teksSel(v.result);
    if (v.text !== undefined) return teksSel(v.text);
    if (v.hyperlink) return String(v.hyperlink);
  }
  return String(v);
}

function bacaLembar(ws, kolomWajib, namaLembar, fatal) {
  const header = {};
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, nomor) => {
    header[teksSel(cell.value).trim().toLowerCase()] = nomor;
  });
  const hilang = kolomWajib.filter((k) => !header[k]);
  if (hilang.length) {
    fatal.push(`Lembar '${namaLembar}': kolom ${hilang.join(', ')} tidak ditemukan di baris 1. Jangan mengubah nama kolom pada template.`);
    return [];
  }
  const hasil = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const o = { _baris: r };
    let ada = false;
    for (const k of kolomWajib) {
      const t = teksSel(row.getCell(header[k]).value).replace(/ /g, ' ').trim();
      o[k] = t;
      if (t) ada = true;
    }
    if (ada) hasil.push(o);
  }
  return hasil;
}

export async function bacaFile(buffer) {
  const fatal = [];
  let wb;
  try {
    const mod = await import('exceljs');
    const ExcelJS = mod.default ?? mod;
    wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
  } catch (e) {
    return { stimulusRows: [], soalRows: [], fatal: ['File tidak bisa dibaca. Pastikan formatnya .xlsx (Microsoft Excel) dan tidak rusak.'] };
  }
  const cari = (nama) => wb.worksheets.find((w) => w.name.trim().toLowerCase() === nama.toLowerCase());
  const wsSoal = cari('Soal');
  const wsStim = cari('Stimulus');
  if (!wsSoal) fatal.push("Lembar 'Soal' tidak ditemukan. Nama lembar harus persis 'Soal'.");
  if (!wsStim) fatal.push("Lembar 'Stimulus' tidak ditemukan. Nama lembar harus persis 'Stimulus' (boleh kosong).");
  const soalRows = wsSoal ? bacaLembar(wsSoal, KOLOM_SOAL, 'Soal', fatal) : [];
  const stimulusRows = wsStim ? bacaLembar(wsStim, KOLOM_STIMULUS, 'Stimulus', fatal) : [];
  return { stimulusRows, soalRows, fatal };
}

/* ---------- 2. Pemeriksaan ---------- */

function cekLatex(teks, laporkan) {
  if (!teks) return;
  const bersih = teks.replace(/\\\$/g, ''); // \$ = tanda dolar biasa
  const jumlah = (bersih.match(/\$/g) || []).length;
  if (jumlah % 2 !== 0) {
    laporkan('Tanda $ tidak berpasangan (jumlahnya ganjil). Untuk tanda dolar biasa, tulis \\$.');
    return;
  }
  for (const m of bersih.matchAll(/\$([^$]+)\$/g)) {
    try {
      katex.renderToString(m[1], { throwOnError: true, strict: 'ignore' });
    } catch (e) {
      laporkan(`Rumus tidak valid: $${m[1]}$ — ${String(e.message).replace(/^KaTeX parse error:\s*/, '')}`);
    }
  }
}

function acak(daftar) {
  const a = [...daftar];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pecahKunci = (t) => t.toUpperCase().split(/[\s,;]+/).filter(Boolean);

export function periksaData({ stimulusRows = [], soalRows = [], fatal = [] }) {
  const masalah = fatal.map((pesan) => ({ level: 'error', lembar: '-', baris: 0, pesan }));
  const err = (lembar, baris, pesan) => masalah.push({ level: 'error', lembar, baris, pesan });
  const warn = (lembar, baris, pesan) => masalah.push({ level: 'peringatan', lembar, baris, pesan });

  if (soalRows.length === 0 && fatal.length === 0) err('Soal', 0, 'Tidak ada soal yang terdeteksi di lembar Soal.');
  if (soalRows.length > MAKS_SOAL) err('Soal', 0, `Jumlah soal ${soalRows.length} melebihi batas ${MAKS_SOAL} per file.`);

  // --- Stimulus
  const stimulus = [];
  const kodeBaris = new Map();
  for (const s of stimulusRows) {
    const b = s._baris;
    const kode = s.kode.toUpperCase();
    if (!kode) { err('Stimulus', b, 'Kolom kode wajib diisi.'); continue; }
    if (kodeBaris.has(kode)) { err('Stimulus', b, `Kode '${kode}' dobel (sudah ada di baris ${kodeBaris.get(kode)}).`); continue; }
    kodeBaris.set(kode, b);
    if (!s.isi && !s.url_gambar) err('Stimulus', b, `Stimulus '${kode}' kosong: isi teks atau url_gambar harus diisi.`);
    if (s.url_gambar && !/^https:\/\/\S+$/i.test(s.url_gambar)) err('Stimulus', b, 'url_gambar harus berupa link yang diawali https:// dan tanpa spasi.');
    if (/\[[^\]]*\]/.test(s.isi)) warn('Stimulus', b, `Ada teks dalam tanda [ ] pada stimulus '${kode}'. Apakah itu sisa keterangan gambar?`);
    cekLatex(s.isi, (m) => err('Stimulus', b, m));
    stimulus.push({ kode, isi: s.isi, url_gambar: s.url_gambar || '' });
  }

  // --- Soal
  const soal = [];
  const dipakai = new Set();
  const hashBaris = new Map();

  for (const s of soalRows) {
    const b = s._baris;
    const e = (m) => err('Soal', b, m);
    const w = (m) => warn('Soal', b, m);
    const salahAwal = masalah.length;

    const mapel = MAPEL_SAH.find((m) => m.toLowerCase() === s.mapel.toLowerCase());
    if (!mapel) e(`mapel '${s.mapel}' tidak dikenal. Pilih salah satu: ${MAPEL_SAH.join(' / ')}.`);

    const tipe = s.tipe.toUpperCase().replace(/\s+/g, '_');
    if (!TIPE_SAH.includes(tipe)) {
      e(`tipe '${s.tipe}' tidak dikenal. Pilih salah satu: ${TIPE_SAH.join(' / ')}.`);
      continue;
    }
    if (!s.pertanyaan) e('pertanyaan wajib diisi.');

    const skor = Number(s.skor.replace(',', '.'));
    if (!s.skor || !Number.isFinite(skor) || skor <= 0) e('skor harus berupa angka lebih dari 0.');

    const ks = s.kode_stimulus.toUpperCase();
    if (ks) {
      if (!kodeBaris.has(ks)) e(`kode_stimulus '${s.kode_stimulus}' tidak ada di lembar Stimulus.`);
      else dipakai.add(ks);
    }

    // opsi harus terisi berurutan dari opsi_a
    const mentah = [s.opsi_a, s.opsi_b, s.opsi_c, s.opsi_d];
    let terakhir = -1;
    mentah.forEach((t, i) => { if (t) terakhir = i; });
    const opsi = mentah.slice(0, terakhir + 1);
    opsi.forEach((t, i) => { if (!t) e(`opsi_${'abcd'[i]} kosong padahal opsi sesudahnya terisi. Isi opsi berurutan mulai dari opsi_a.`); });
    const n = opsi.length;

    let opsiOut = [];
    let kunciOut = null;

    if (tipe === 'PG' || tipe === 'PG_KOMPLEKS') {
      const batas = tipe === 'PG' ? 2 : 3;
      if (n < batas) e(`${tipe} membutuhkan minimal ${batas} opsi (ditemukan ${n}).`);
      const unik = new Set(opsi.filter(Boolean));
      if (unik.size < opsi.filter(Boolean).length) e('Ada dua opsi dengan isi yang sama persis.');
      const huruf = HURUF.slice(0, n);
      const k = pecahKunci(s.kunci);
      if (tipe === 'PG') {
        if (k.length !== 1 || !huruf.includes(k[0])) e(`kunci '${s.kunci}' tidak sah. Untuk PG isi satu huruf dari ${huruf.join('/')}.`);
      } else {
        if (new Set(k).size !== k.length) e('kunci berisi huruf yang sama lebih dari sekali.');
        if (k.length < 2 || k.some((x) => !huruf.includes(x))) e(`kunci '${s.kunci}' tidak sah. Untuk PG_KOMPLEKS isi minimal 2 huruf dari ${huruf.join('/')}, dipisah koma (contoh A,C).`);
        else if (k.length === n) w('Semua opsi ditandai benar. Pastikan itu memang disengaja.');
      }
      kunciOut = k;
      opsiOut = opsi.map((teks, i) => ({ k: HURUF[i], teks }));
    }

    if (tipe === 'BENAR_SALAH') {
      if (n < 1) e('BENAR_SALAH membutuhkan minimal 1 pernyataan di kolom opsi.');
      const peta = { B: true, BENAR: true, T: true, TRUE: true, S: false, SALAH: false, F: false, FALSE: false };
      const k = pecahKunci(s.kunci);
      if (k.length !== n || k.some((x) => !(x in peta))) {
        e(`kunci '${s.kunci}' tidak sah. Harus ada ${n} nilai (satu per pernyataan), berisi B atau S, contoh ${Array.from({ length: Math.max(n, 1) }, (_, i) => (i % 2 ? 'S' : 'B')).join(',')}.`);
      }
      kunciOut = k.map((x) => peta[x]);
      opsiOut = opsi.map((teks, i) => ({ k: String(i + 1), teks }));
    }

    if (tipe === 'JODOH') {
      if (n < 2) e(`JODOH membutuhkan minimal 2 pasangan (ditemukan ${n}).`);
      if (s.kunci) w('Kolom kunci diabaikan untuk JODOH (pasangan itu sendiri adalah kuncinya).');
      const pasangan = [];
      opsi.forEach((t, i) => {
        if (!t) return;
        const pecah = t.split('::');
        if (pecah.length !== 2 || !pecah[0].trim() || !pecah[1].trim()) {
          e(`opsi_${'abcd'[i]} harus berformat 'kiri :: kanan' (tepat satu tanda ::, kedua sisi terisi).`);
          return;
        }
        pasangan.push({ kiri: pecah[0].trim(), kanan: pecah[1].trim() });
      });
      const pengecoh = s.pengecoh ? s.pengecoh.split(';;').map((x) => x.trim()).filter(Boolean) : [];
      const kananUnik = [...new Set([...pasangan.map((p) => p.kanan), ...pengecoh])];
      const kananAcak = acak(kananUnik).map((teks, i) => ({ k: 'abcdefgh'[i] ?? `x${i}`, teks }));
      const idKanan = Object.fromEntries(kananAcak.map((o) => [o.teks, o.k]));
      const kiri = pasangan.map((p, i) => ({ k: String(i + 1), teks: p.kiri }));
      kunciOut = Object.fromEntries(pasangan.map((p, i) => [String(i + 1), idKanan[p.kanan]]));
      opsiOut = { kiri, kanan: kananAcak };
    }

    // rumus LaTeX
    cekLatex(s.pertanyaan, (m) => e(`pertanyaan: ${m}`));
    opsi.forEach((t, i) => cekLatex(t, (m) => e(`opsi_${'abcd'[i]}: ${m}`)));
    cekLatex(s.pengecoh, (m) => e(`pengecoh: ${m}`));
    cekLatex(s.pembahasan, (m) => e(`pembahasan: ${m}`));
    if (!s.pembahasan) w('Pembahasan kosong.');

    // soal ganda dalam satu file
    const hash = createHash('sha256').update(JSON.stringify([tipe, s.pertanyaan, opsi])).digest('hex');
    if (hashBaris.has(hash)) w(`Soal ini sama persis dengan soal di baris ${hashBaris.get(hash)}.`);
    else hashBaris.set(hash, b);

    if (!masalah.slice(salahAwal).some((m) => m.level === 'error')) {
      soal.push({
        _baris: b,
        kode_stimulus: ks || null,
        mapel,
        tipe,
        pertanyaan: s.pertanyaan,
        opsi: opsiOut,
        kunci: kunciOut,
        pembahasan: s.pembahasan || '',
        skor,
        hash_isi: hash,
      });
    }
  }

  for (const [kode, baris] of kodeBaris) {
    if (!dipakai.has(kode)) warn('Stimulus', baris, `Stimulus '${kode}' tidak dipakai oleh soal mana pun.`);
  }

  const jumlahError = masalah.filter((m) => m.level === 'error').length;
  const hitung = (kunci) => soal.reduce((a, s) => ({ ...a, [s[kunci]]: (a[s[kunci]] || 0) + 1 }), {});
  masalah.sort((x, y) => (x.level === y.level ? 0 : x.level === 'error' ? -1 : 1) || x.baris - y.baris);

  return {
    ok: jumlahError === 0,
    ringkas: {
      jumlah_soal: soalRows.length,
      jumlah_stimulus: stimulus.length,
      per_tipe: hitung('tipe'),
      per_mapel: hitung('mapel'),
      jumlah_error: jumlahError,
      jumlah_peringatan: masalah.length - jumlahError,
    },
    masalah,
    stimulus,
    soal,
  };
}

export async function periksaFile(buffer) {
  const data = await bacaFile(buffer);
  return periksaData(data);
}
