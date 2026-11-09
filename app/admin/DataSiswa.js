'use client';
import { useEffect, useRef, useState } from 'react';

const kotak = { backgroundColor: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' };
const tombol = (warna, mati) => ({
  backgroundColor: mati ? '#a0aec0' : warna, color: '#fff', border: 'none', padding: '9px 16px',
  borderRadius: '6px', cursor: mati ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px',
});
const mini = (warna, mati) => ({
  backgroundColor: mati ? '#a0aec0' : warna, color: '#fff', border: 'none', padding: '4px 8px',
  borderRadius: '4px', cursor: mati ? 'not-allowed' : 'pointer', fontSize: '12px', marginRight: '4px',
});
const isian = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '14px', boxSizing: 'border-box' };
const sel = { padding: '6px 10px', border: '1px solid #e2e8f0', fontSize: '13px' };
const chip = { background: '#e2e8f0', padding: '4px 10px', borderRadius: '999px', fontSize: '13px' };

const npsnDari = (nomor) => String(nomor).split('-')[0];
const LABEL_STATUS = {
  baru: { teks: 'Baru', latar: '#c6f6d5', warna: '#22543d' },
  sama: { teks: 'Sudah ada', latar: '#e2e8f0', warna: '#4a5568' },
  ubah: { teks: 'Nama diperbarui', latar: '#feebc8', warna: '#c05621' },
};

export default function DataSiswa({ sandi, onKeluar }) {
  const [daftar, setDaftar] = useState(null);
  const [namaSekolah, setNamaSekolah] = useState({});
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const [file, setFile] = useState(null);
  const [tahap, setTahap] = useState('pilih'); // pilih | memeriksa | hasil | menyimpan
  const [hasil, setHasil] = useState(null);
  const [galatImpor, setGalatImpor] = useState('');
  const inputRef = useRef(null);

  const [mNpsn, setMNpsn] = useState('');
  const [mAbsen, setMAbsen] = useState('');
  const [mNama, setMNama] = useState('');

  const [cari, setCari] = useState('');
  const [sekolah, setSekolah] = useState('semua');
  const [batas, setBatas] = useState(200);

  const panggil = async (metode, alamat, isi) => {
    const headers = { 'x-admin-password': sandi };
    let body;
    if (isi instanceof FormData) body = isi;
    else if (isi) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(isi); }
    const res = await fetch(alamat, { method: metode, headers, body, cache: 'no-store' });
    let json = {};
    try { json = await res.json(); } catch { /* respons bukan JSON */ }
    if (res.status === 401) { onKeluar(); return { res, json, keluar: true }; }
    return { res, json, keluar: false };
  };

  const muat = async () => {
    try {
      const { res, json, keluar } = await panggil('GET', '/api/admin/siswa');
      if (keluar) return;
      if (!res.ok) { setGalat(json.pesan || 'Gagal memuat data siswa.'); return; }
      setDaftar(json.siswa);
      setNamaSekolah(json.sekolah || {});
    } catch {
      setGalat('Tidak bisa menghubungi server. Periksa koneksi internet.');
    }
  };

  useEffect(() => { muat(); }, []);

  /* ---------- impor dari Excel ---------- */
  const kirimFile = async (mode) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mode', mode);
    return panggil('POST', '/api/admin/siswa/impor', fd);
  };

  const periksa = async () => {
    if (!file) { setGalatImpor('Pilih file .xlsx terlebih dahulu.'); return; }
    setGalatImpor(''); setHasil(null); setInfo(''); setTahap('memeriksa');
    try {
      const { res, json, keluar } = await kirimFile('periksa');
      if (keluar) return;
      if (!res.ok) { setGalatImpor(json.pesan || 'Gagal memeriksa file.'); setTahap('pilih'); return; }
      setHasil(json); setTahap('hasil');
    } catch {
      setGalatImpor('Tidak bisa menghubungi server. Periksa koneksi internet.'); setTahap('pilih');
    }
  };

  const simpan = async () => {
    if (!hasil || !hasil.ok) return;
    const r = hasil.ringkas;
    if (!confirm(`Simpan data siswa? ${r.baru} siswa baru ditambahkan, ${r.ubah} nama diperbarui, ${r.sama} dilewati (sudah ada).`)) return;
    setGalatImpor(''); setTahap('menyimpan');
    try {
      const { res, json, keluar } = await kirimFile('simpan');
      if (keluar) return;
      if (res.status === 422) { setHasil(json); setGalatImpor(json.pesan || 'File masih memiliki error.'); setTahap('hasil'); return; }
      if (!res.ok) { setGalatImpor(json.pesan || 'Gagal menyimpan.'); setTahap('hasil'); return; }
      setInfo(`Selesai: ${json.ditambah} siswa baru ditambahkan, ${json.diperbarui} nama diperbarui, ${json.dilewati} dilewati (sudah ada).`);
      setFile(null); setHasil(null); setTahap('pilih');
      if (inputRef.current) inputRef.current.value = '';
      await muat();
    } catch {
      setGalatImpor('Tidak bisa menghubungi server. Data mungkin belum tersimpan; periksa daftar siswa, lalu coba lagi.'); setTahap('hasil');
    }
  };

  /* ---------- aksi per siswa ---------- */
  const aksi = async (body, pesan) => {
    setGalat(''); setInfo(''); setSibuk(true);
    try {
      const { res, json, keluar } = await panggil('POST', '/api/admin/siswa', body);
      if (keluar) return false;
      if (!res.ok) { setGalat(json.pesan || 'Terjadi kesalahan.'); return false; }
      setInfo(pesan);
      await muat();
      return true;
    } catch {
      setGalat('Tidak bisa menghubungi server. Perubahan belum tersimpan.');
      return false;
    } finally {
      setSibuk(false);
    }
  };

  const tambahManual = async (e) => {
    e.preventDefault();
    const ok = await aksi({ aksi: 'tambah', npsn: mNpsn, absen: mAbsen, nama: mNama }, 'Siswa berhasil ditambahkan.');
    if (ok) { setMAbsen(''); setMNama(''); }
  };

  const resetLogin = (s) => {
    if (!confirm(`Reset login ${s.nama_lengkap} (${s.nomor_ujian})? Siswa ini bisa login lagi.`)) return;
    aksi({ aksi: 'reset_login', nomor_ujian: s.nomor_ujian }, `Login ${s.nama_lengkap} sudah direset.`);
  };

  const resetSemua = async () => {
    const n = (daftar || []).filter((s) => s.is_logged_in).length;
    if (n === 0) { setInfo('Tidak ada siswa yang berstatus sudah login.'); return; }
    if (!confirm(`Reset login untuk ${n} siswa yang sedang berstatus sudah login?\n\nPakai ini hanya saat tidak ada ujian berlangsung (misalnya setelah uji coba). Siswa yang sedang mengerjakan akan keluar dari ujian dan harus login lagi.`)) return;
    aksi({ aksi: 'reset_semua' }, `Login ${n} siswa sudah direset.`);
  };

  const hapus = (s) => {
    if (!confirm(`Hapus siswa ${s.nama_lengkap} (${s.nomor_ujian})?`)) return;
    aksi({ aksi: 'hapus', nomor_ujian: s.nomor_ujian }, `Siswa ${s.nama_lengkap} dihapus.`);
  };

  /* ---------- tampilan ---------- */
  const sibukImpor = tahap === 'memeriksa' || tahap === 'menyimpan';
  const nomorPratinjau = /^\d{8}$/.test(mNpsn.trim()) && /^\d{1,3}$/.test(mAbsen.trim()) && Number(mAbsen) >= 1
    ? `${mNpsn.trim()}-${String(Number(mAbsen)).padStart(3, '0')}`
    : '';

  const semua = daftar || [];
  const hitungSekolah = {};
  for (const s of semua) hitungSekolah[npsnDari(s.nomor_ujian)] = (hitungSekolah[npsnDari(s.nomor_ujian)] || 0) + 1;
  const kata = cari.trim().toLowerCase();
  const tampil = semua.filter(
    (s) =>
      (sekolah === 'semua' || npsnDari(s.nomor_ujian) === sekolah) &&
      (!kata || s.nama_lengkap.toLowerCase().includes(kata) || s.nomor_ujian.toLowerCase().includes(kata) || (namaSekolah[npsnDari(s.nomor_ujian)] || '').toLowerCase().includes(kata))
  );
  const sudahLogin = semua.filter((s) => s.is_logged_in).length;

  return (
    <div>
      {info && (
        <div style={{ backgroundColor: '#f0fff4', border: '1px solid #9ae6b4', color: '#22543d', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{info}</div>
      )}
      {galat && (
        <div style={{ backgroundColor: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{galat}</div>
      )}

      {/* ---------- Impor ---------- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', backgroundColor: '#ebf8ff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #bee3f8' }}>
        <div style={{ fontSize: '14px', color: '#2b6cb0' }}>
          <b>Impor data siswa dari Excel.</b> Unduh template, isi di Excel atau Google Sheets (satu file untuk satu atau banyak sekolah), lalu unggah di bawah.
        </div>
        <a href="/template_data_siswa.xlsx" download style={{ ...tombol('#3182ce'), textDecoration: 'none', whiteSpace: 'nowrap', fontSize: '13px' }}>
          📥 Unduh Template Siswa (.xlsx)
        </a>
      </div>

      <div style={kotak}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>1. Pilih file data siswa</h3>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          disabled={sibukImpor}
          onChange={(e) => { setFile(e.target.files[0] || null); setHasil(null); setGalatImpor(''); setTahap('pilih'); }}
          style={{ fontSize: '14px' }}
        />
        <div style={{ marginTop: '12px' }}>
          <button onClick={periksa} disabled={!file || sibukImpor} style={tombol('#38a169', !file || sibukImpor)}>
            {tahap === 'memeriksa' ? 'Memeriksa…' : 'Periksa File'}
          </button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#718096' }}>
          Pemeriksaan tidak menyimpan apa pun. Data baru masuk setelah Anda menekan tombol Simpan.
        </p>
      </div>

      {galatImpor && (
        <div style={{ backgroundColor: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{galatImpor}</div>
      )}

      {hasil && (
        <div style={kotak}>
          <h3 style={{ marginTop: 0, fontSize: '16px' }}>2. Hasil pemeriksaan: {hasil.nama_file}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <span style={chip}><b>{hasil.ringkas.jumlah_siswa}</b> siswa valid</span>
            <span style={{ ...chip, background: '#c6f6d5' }}><b>{hasil.ringkas.baru}</b> baru</span>
            <span style={chip}><b>{hasil.ringkas.sama}</b> sudah ada</span>
            <span style={{ ...chip, background: hasil.ringkas.ubah ? '#feebc8' : '#e2e8f0' }}><b>{hasil.ringkas.ubah}</b> nama diperbarui</span>
            <span style={{ ...chip, background: hasil.ringkas.jumlah_error ? '#fed7d7' : '#c6f6d5' }}><b>{hasil.ringkas.jumlah_error}</b> error</span>
            <span style={{ ...chip, background: hasil.ringkas.jumlah_peringatan ? '#feebc8' : '#e2e8f0' }}><b>{hasil.ringkas.jumlah_peringatan}</b> peringatan</span>
          </div>
          {Object.keys(hasil.ringkas.per_sekolah).length > 0 && (
            <div style={{ fontSize: '13px', color: '#4a5568', marginBottom: '10px' }}>
              Per sekolah (NPSN):{' '}
              {Object.entries(hasil.ringkas.per_sekolah).map(([n, j]) => `${n}: ${j} siswa`).join(' · ')}
            </div>
          )}

          {hasil.masalah.length > 0 && (
            <div style={{ maxHeight: '260px', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#fff', marginBottom: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#edf2f7', textAlign: 'left' }}>
                    <th style={sel}>Jenis</th><th style={sel}>Baris</th><th style={sel}>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {hasil.masalah.map((m, i) => (
                    <tr key={i} style={{ backgroundColor: m.level === 'error' ? '#fff5f5' : '#fffaf0' }}>
                      <td style={{ ...sel, fontWeight: 'bold', color: m.level === 'error' ? '#c53030' : '#c05621' }}>{m.level === 'error' ? 'ERROR' : 'Peringatan'}</td>
                      <td style={sel}>{m.baris || '-'}</td>
                      <td style={sel}>{m.pesan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasil.siswa.length > 0 && (
            <div style={{ maxHeight: '260px', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#fff', marginBottom: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#edf2f7', textAlign: 'left' }}>
                    <th style={sel}>No Ujian</th><th style={sel}>Nama</th><th style={sel}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hasil.siswa.slice(0, 100).map((s) => {
                    const l = LABEL_STATUS[s.status];
                    return (
                      <tr key={s.nomor_ujian}>
                        <td style={{ ...sel, fontWeight: 'bold' }}>{s.nomor_ujian}</td>
                        <td style={sel}>{s.nama_lengkap}</td>
                        <td style={sel}><span style={{ backgroundColor: l.latar, color: l.warna, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{l.teks}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {hasil.siswa.length > 100 && (
                <div style={{ padding: '6px 10px', fontSize: '12px', color: '#718096' }}>Menampilkan 100 dari {hasil.siswa.length} siswa.</div>
              )}
            </div>
          )}

          {hasil.ok ? (
            <button onClick={simpan} disabled={sibukImpor} style={tombol('#2b6cb0', sibukImpor)}>
              {tahap === 'menyimpan' ? 'Menyimpan…' : `Simpan ${hasil.ringkas.jumlah_siswa} Siswa`}
            </button>
          ) : (
            <div style={{ color: '#c53030', fontSize: '14px', fontWeight: 'bold' }}>
              Perbaiki semua ERROR di file Excel, simpan, lalu pilih file itu lagi dan tekan "Periksa File".
            </div>
          )}
        </div>
      )}

      {/* ---------- Tambah manual ---------- */}
      <div style={kotak}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>Tambah 1 siswa manual</h3>
        <form onSubmit={tambahManual} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" inputMode="numeric" placeholder="NPSN (8 angka)" value={mNpsn} onChange={(e) => setMNpsn(e.target.value)} style={{ ...isian, width: '150px' }} required />
          <input type="text" inputMode="numeric" placeholder="No. absen" value={mAbsen} onChange={(e) => setMAbsen(e.target.value)} style={{ ...isian, width: '100px' }} required />
          <input type="text" placeholder="Nama lengkap" value={mNama} onChange={(e) => setMNama(e.target.value)} style={{ ...isian, flex: '1 1 220px' }} required />
          <button type="submit" disabled={sibuk} style={tombol('#4299e1', sibuk)}>Simpan Siswa</button>
        </form>
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#718096' }}>
          Nomor ujian: <b>{nomorPratinjau || '(terisi otomatis dari NPSN dan nomor absen)'}</b>
        </p>
      </div>

      {/* ---------- Daftar ---------- */}
      <h3 style={{ fontSize: '16px' }}>
        Daftar Peserta Terdaftar {daftar ? `(${semua.length} siswa · ${Object.keys(hitungSekolah).length} sekolah · ${sudahLogin} sudah login)` : ''}
      </h3>
      {daftar && sudahLogin > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <button onClick={resetSemua} disabled={sibuk} style={tombol('#dd6b20', sibuk)}>
            Reset Semua Login ({sudahLogin})
          </button>
        </div>
      )}
      {!daftar && <div style={{ fontSize: '14px', color: '#718096' }}>Memuat data siswa…</div>}
      {daftar && (
        <div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <select value={sekolah} onChange={(e) => { setSekolah(e.target.value); setBatas(200); }} style={{ ...isian, minWidth: '220px' }}>
              <option value="semua">Semua sekolah ({semua.length})</option>
              {Object.keys(hitungSekolah).sort((a, b) => (namaSekolah[a] || a).localeCompare(namaSekolah[b] || b)).map((n) => (
                <option key={n} value={n}>{namaSekolah[n] ? `${namaSekolah[n]} (${n})` : `NPSN ${n} - belum ada di daftar sekolah`} · {hitungSekolah[n]} siswa</option>
              ))}
            </select>
            <input type="text" placeholder="Cari nama, nomor ujian, atau sekolah…" value={cari} onChange={(e) => { setCari(e.target.value); setBatas(200); }} style={{ ...isian, flex: '1 1 240px' }} />
          </div>
          <div style={{ maxHeight: '520px', overflow: 'auto', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#edf2f7', textAlign: 'left', position: 'sticky', top: 0 }}>
                  <th style={sel}>No Ujian</th>
                  <th style={sel}>Nama Lengkap</th>
                  <th style={sel}>Sekolah</th>
                  <th style={sel}>Status Login</th>
                  <th style={sel}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tampil.length === 0 && (
                  <tr><td colSpan="5" style={{ ...sel, color: '#718096' }}>Tidak ada siswa yang cocok.</td></tr>
                )}
                {tampil.slice(0, batas).map((s) => (
                  <tr key={s.nomor_ujian}>
                    <td style={{ ...sel, fontWeight: 'bold' }}>{s.nomor_ujian}</td>
                    <td style={sel}>{s.nama_lengkap}</td>
                    <td style={sel}>{namaSekolah[npsnDari(s.nomor_ujian)] || `NPSN ${npsnDari(s.nomor_ujian)} (belum ada di daftar)`}</td>
                    <td style={sel}>
                      <span style={{ backgroundColor: s.is_logged_in ? '#feebc8' : '#c6f6d5', color: s.is_logged_in ? '#c05621' : '#22543d', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {s.is_logged_in ? 'Sudah login' : 'Belum login'}
                      </span>
                    </td>
                    <td style={{ ...sel, whiteSpace: 'nowrap' }}>
                      {s.is_logged_in && <button onClick={() => resetLogin(s)} disabled={sibuk} style={mini('#ed8936', sibuk)}>Reset Login</button>}
                      <button onClick={() => hapus(s)} disabled={sibuk} style={mini('#e53e3e', sibuk)}>Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tampil.length > batas && (
            <div style={{ marginTop: '8px' }}>
              <button onClick={() => setBatas(batas + 300)} style={tombol('#4a5568')}>Tampilkan lebih banyak ({tampil.length - batas} lagi)</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
