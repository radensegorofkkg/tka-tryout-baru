// Membaca dan memeriksa file Excel data siswa.
// Format kolom (baris judul): NO UJIAN | NAMA LENGKAP | NPSN | NOMOR ABSEN
// Nomor ujian SELALU dihitung dari NPSN dan NOMOR ABSEN (NPSN-001), bukan dibaca dari kolom NO UJIAN,
// jadi file tetap benar walau rumus di kolom NO UJIAN belum terhitung.
// Bagian pemeriksaan murni (tanpa file/database) supaya mudah diuji.

export const MAKS_SISWA = 5000;

const NAMA_KOLOM = {
  nama: 'NAMA LENGKAP',
  npsn: 'NPSN',
  absen: 'NOMOR ABSEN',
  nomor: 'NO UJIAN',
};

/* ---------- penyeragaman teks ---------- */

// Menyeragamkan spasi dan tanda petik (’ ‘ ` dijadikan ') supaya nama seperti MI'ROJ konsisten.
export function rapikanNama(teks) {
  return String(teks ?? '')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function teksSel(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('formula' in v || 'sharedFormula' in v) {
      return v.result !== undefined && v.result !== null ? teksSel(v.result) : '';
    }
    if (v.text !== undefined) return teksSel(v.text);
    if (v.hyperlink) return String(v.hyperlink);
  }
  return String(v);
}

/* ---------- 1. Membaca file .xlsx ---------- */

export async function bacaFileSiswa(buffer) {
  let wb;
  try {
    const mod = await import('exceljs');
    const ExcelJS = mod.default ?? mod;
    wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
  } catch (e) {
    return { baris: [], fatal: ['File tidak bisa dibaca. Pastikan formatnya .xlsx (Microsoft Excel) dan tidak rusak.'] };
  }

  for (const ws of wb.worksheets) {
    const batas = Math.min(ws.rowCount, 10);
    for (let r = 1; r <= batas; r++) {
      const peta = {};
      ws.getRow(r).eachCell({ includeEmpty: false }, (cell, nomor) => {
        peta[teksSel(cell.value).trim().toUpperCase().replace(/\s+/g, ' ')] = nomor;
      });
      if (peta[NAMA_KOLOM.nama] && peta[NAMA_KOLOM.npsn] && peta[NAMA_KOLOM.absen]) {
        const baris = [];
        for (let i = r + 1; i <= ws.rowCount; i++) {
          const row = ws.getRow(i);
          const ambil = (kunci) => (peta[kunci] ? teksSel(row.getCell(peta[kunci]).value).replace(/ /g, ' ').trim() : '');
          const o = {
            _baris: i,
            nama: ambil(NAMA_KOLOM.nama),
            npsn: ambil(NAMA_KOLOM.npsn),
            absen: ambil(NAMA_KOLOM.absen),
            nomor: ambil(NAMA_KOLOM.nomor),
          };
          if (o.nama || o.npsn || o.absen) baris.push(o);
        }
        return { baris, fatal: [] };
      }
    }
  }
  return {
    baris: [],
    fatal: ['Kolom NAMA LENGKAP, NPSN, dan NOMOR ABSEN tidak ditemukan pada baris judul. Jangan mengubah nama kolom pada template.'],
  };
}

/* ---------- 2. Pemeriksaan satu siswa (dipakai juga oleh form tambah manual) ---------- */

export function normalisasiSiswa({ npsn, absen, nama }) {
  const galat = [];

  const n = String(npsn ?? '').trim();
  if (!/^\d{8}$/.test(n)) galat.push(`NPSN '${n}' tidak sah. NPSN harus 8 angka tanpa spasi atau tanda lain.`);

  const a = String(absen ?? '').trim();
  const angka = /^\d{1,3}$/.test(a) ? Number(a) : NaN;
  if (!Number.isInteger(angka) || angka < 1) galat.push(`NOMOR ABSEN '${a}' tidak sah. Isi angka bulat 1 sampai 999.`);

  const nm = rapikanNama(nama);
  if (!nm) galat.push('NAMA LENGKAP wajib diisi.');
  else if (nm.length > 150) galat.push('NAMA LENGKAP terlalu panjang (maksimal 150 huruf).');

  const nomor = galat.length ? '' : `${n}-${String(angka).padStart(3, '0')}`;
  return { galat, nomor, nama: nm, npsn: n, absen: angka };
}

/* ---------- 3. Pemeriksaan seluruh file ---------- */

// dbNama: Map(nomor_ujian -> nama yang sudah ada di database), atau null jika tidak dibandingkan.
export function periksaSiswa({ baris = [], fatal = [] }, dbNama = null) {
  const masalah = fatal.map((pesan) => ({ level: 'error', baris: 0, pesan }));
  const err = (b, pesan) => masalah.push({ level: 'error', baris: b, pesan });
  const warn = (b, pesan) => masalah.push({ level: 'peringatan', baris: b, pesan });

  if (baris.length === 0 && fatal.length === 0) err(0, 'Tidak ada data siswa yang terdeteksi.');
  if (baris.length > MAKS_SISWA) err(0, `Jumlah baris ${baris.length} melebihi batas ${MAKS_SISWA} per file.`);

  const hasil = [];
  const nomorBaris = new Map();
  const namaSekolah = new Map();

  for (const s of baris) {
    const b = s._baris;
    const n = normalisasiSiswa({ npsn: s.npsn, absen: s.absen, nama: s.nama });
    if (n.galat.length) {
      n.galat.forEach((g) => err(b, g));
      continue;
    }

    if (nomorBaris.has(n.nomor)) {
      err(b, `Nomor ujian ${n.nomor} dobel (sudah dipakai di baris ${nomorBaris.get(n.nomor)}). Periksa NOMOR ABSEN.`);
      continue;
    }
    nomorBaris.set(n.nomor, b);

    if (s.nomor && s.nomor !== n.nomor) {
      warn(b, `Kolom NO UJIAN berisi '${s.nomor}', tetapi dari NPSN dan NOMOR ABSEN seharusnya ${n.nomor}. Yang dipakai: ${n.nomor}.`);
    }
    if (/\d/.test(n.nama)) warn(b, `Nama '${n.nama}' mengandung angka. Apakah sudah benar?`);

    const kunciNama = `${n.npsn}|${n.nama.toUpperCase()}`;
    if (namaSekolah.has(kunciNama)) {
      warn(b, `Nama '${n.nama}' juga ada di baris ${namaSekolah.get(kunciNama)} pada sekolah yang sama. Pastikan itu dua siswa berbeda.`);
    } else {
      namaSekolah.set(kunciNama, b);
    }

    let status = 'baru';
    let namaLama = null;
    if (dbNama && dbNama.has(n.nomor)) {
      namaLama = dbNama.get(n.nomor);
      status = rapikanNama(namaLama).toUpperCase() === n.nama.toUpperCase() ? 'sama' : 'ubah';
      if (status === 'ubah') warn(b, `Nomor ${n.nomor} sudah terdaftar atas nama '${namaLama}'. Nama akan diperbarui menjadi '${n.nama}'.`);
    }

    hasil.push({ _baris: b, nomor_ujian: n.nomor, nama_lengkap: n.nama, npsn: n.npsn, status, nama_lama: namaLama });
  }

  const jumlahError = masalah.filter((m) => m.level === 'error').length;
  const perSekolah = {};
  for (const s of hasil) perSekolah[s.npsn] = (perSekolah[s.npsn] || 0) + 1;
  const hitung = (st) => hasil.filter((s) => s.status === st).length;
  masalah.sort((x, y) => (x.level === y.level ? 0 : x.level === 'error' ? -1 : 1) || x.baris - y.baris);

  return {
    ok: jumlahError === 0 && hasil.length > 0,
    ringkas: {
      jumlah_baris: baris.length,
      jumlah_siswa: hasil.length,
      baru: hitung('baru'),
      sama: hitung('sama'),
      ubah: hitung('ubah'),
      per_sekolah: perSekolah,
      jumlah_error: jumlahError,
      jumlah_peringatan: masalah.length - jumlahError,
    },
    masalah,
    siswa: hasil,
  };
}
