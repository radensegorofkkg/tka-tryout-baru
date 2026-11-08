'use client';
import { useRef, useState } from 'react';
import Teks from './Teks';

const NAMA_TIPE = {
  PG: 'Pilihan Ganda',
  PG_KOMPLEKS: 'Pilihan Ganda Kompleks',
  BENAR_SALAH: 'Benar-Salah',
  JODOH: 'Menjodohkan',
};

const kotak = { backgroundColor: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' };
const tombol = (warna, mati) => ({
  backgroundColor: mati ? '#a0aec0' : warna, color: '#fff', border: 'none', padding: '10px 18px',
  borderRadius: '6px', cursor: mati ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '14px',
});

function KartuSoal({ s, nomor, stimulus }) {
  const stim = s.kode_stimulus ? stimulus[s.kode_stimulus] : null;
  const kananTeks = s.tipe === 'JODOH' ? Object.fromEntries(s.opsi.kanan.map((o) => [o.k, o.teks])) : {};
  return (
    <details style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px', backgroundColor: '#fff' }}>
      <summary style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '14px' }}>
        <b>#{nomor}</b> · {NAMA_TIPE[s.tipe]} · {s.mapel} · skor {s.skor}
        <span style={{ color: '#a0aec0' }}> · baris Excel {s._baris}</span>
        {stim && <span style={{ color: '#2b6cb0' }}> · stimulus {s.kode_stimulus}</span>}
      </summary>
      <div style={{ padding: '4px 16px 16px', fontSize: '14px', lineHeight: 1.6 }}>
        {stim && (
          <div style={{ backgroundColor: '#f7fafc', padding: '10px 12px', borderRadius: '6px', marginBottom: '10px' }}>
            {stim.isi && <div><Teks>{stim.isi}</Teks></div>}
            {stim.url_gambar && (
              <img src={stim.url_gambar} alt={`Gambar stimulus ${stim.kode}`} style={{ maxWidth: '100%', maxHeight: '260px', marginTop: '8px', borderRadius: '4px' }} />
            )}
          </div>
        )}
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}><Teks>{s.pertanyaan}</Teks></div>

        {(s.tipe === 'PG' || s.tipe === 'PG_KOMPLEKS') &&
          s.opsi.map((o) => {
            const benar = s.kunci.includes(o.k);
            return (
              <div key={o.k} style={{ padding: '4px 10px', borderRadius: '4px', marginBottom: '3px', backgroundColor: benar ? '#c6f6d5' : 'transparent' }}>
                <b>{o.k}.</b> <Teks>{o.teks}</Teks> {benar && <b style={{ color: '#22543d' }}> ✓</b>}
              </div>
            );
          })}

        {s.tipe === 'BENAR_SALAH' &&
          s.opsi.map((o, i) => (
            <div key={o.k} style={{ padding: '4px 10px', marginBottom: '3px' }}>
              <span style={{ display: 'inline-block', minWidth: '52px', textAlign: 'center', marginRight: '8px', padding: '1px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: s.kunci[i] ? '#c6f6d5' : '#fed7d7', color: s.kunci[i] ? '#22543d' : '#9b2c2c' }}>
                {s.kunci[i] ? 'BENAR' : 'SALAH'}
              </span>
              <Teks>{o.teks}</Teks>
            </div>
          ))}

        {s.tipe === 'JODOH' && (
          <div>
            {s.opsi.kiri.map((o) => (
              <div key={o.k} style={{ padding: '4px 10px', marginBottom: '3px', backgroundColor: '#f0fff4', borderRadius: '4px' }}>
                <Teks>{o.teks}</Teks> <b>→</b> <Teks>{kananTeks[s.kunci[o.k]]}</Teks>
              </div>
            ))}
            <div style={{ color: '#718096', fontSize: '13px', marginTop: '6px' }}>
              Pilihan di sisi kanan (diacak): {s.opsi.kanan.map((o) => o.teks).join(' | ')}
            </div>
          </div>
        )}

        {s.pembahasan && (
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e0', color: '#4a5568' }}>
            <b>Pembahasan:</b> <Teks>{s.pembahasan}</Teks>
          </div>
        )}
      </div>
    </details>
  );
}

export default function ImporSoal({ sandi, onKeluar }) {
  const [file, setFile] = useState(null);
  const [tahap, setTahap] = useState('pilih'); // pilih | memeriksa | hasil | menyimpan | selesai
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState('');
  const [selesai, setSelesai] = useState(null);
  const inputRef = useRef(null);

  const kirim = async (alamat) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(alamat, { method: 'POST', headers: { 'x-admin-password': sandi }, body: fd });
    let data = {};
    try { data = await res.json(); } catch { /* respons bukan JSON */ }
    return { res, data };
  };

  const periksa = async () => {
    if (!file) { setGalat('Pilih file .xlsx terlebih dahulu.'); return; }
    setGalat(''); setHasil(null); setTahap('memeriksa');
    try {
      const { res, data } = await kirim('/api/impor-soal/periksa');
      if (res.status === 401) { onKeluar(); return; }
      if (!res.ok) { setGalat(data.pesan || 'Gagal memeriksa file.'); setTahap('pilih'); return; }
      setHasil(data); setTahap('hasil');
    } catch {
      setGalat('Tidak bisa menghubungi server. Periksa koneksi internet.'); setTahap('pilih');
    }
  };

  const simpan = async () => {
    if (!hasil || !hasil.ok) return;
    if (!confirm(`Simpan ${hasil.soal.length} soal ke bank soal?`)) return;
    setGalat(''); setTahap('menyimpan');
    try {
      const { res, data } = await kirim('/api/impor-soal/simpan');
      if (res.status === 401) { onKeluar(); return; }
      if (res.status === 422) { setHasil(data); setGalat(data.pesan || 'File masih memiliki error.'); setTahap('hasil'); return; }
      if (!res.ok) { setGalat(data.pesan || 'Gagal menyimpan.'); setTahap('hasil'); return; }
      setSelesai(data); setTahap('selesai');
    } catch {
      setGalat('Tidak bisa menghubungi server. Soal belum tersimpan, silakan coba lagi.'); setTahap('hasil');
    }
  };

  const ulang = () => {
    setFile(null); setHasil(null); setSelesai(null); setGalat(''); setTahap('pilih');
    if (inputRef.current) inputRef.current.value = '';
  };

  const stimulus = hasil ? Object.fromEntries(hasil.stimulus.map((s) => [s.kode, s])) : {};
  const sibuk = tahap === 'memeriksa' || tahap === 'menyimpan';

  if (tahap === 'selesai') {
    return (
      <div style={{ ...kotak, backgroundColor: '#f0fff4', borderColor: '#9ae6b4' }}>
        <h3 style={{ marginTop: 0, color: '#22543d' }}>✅ {selesai.jumlah_soal} soal berhasil disimpan</h3>
        <p style={{ margin: '0 0 12px', fontSize: '14px' }}>Nomor impor: <b>{selesai.batch_id}</b>. Soal sudah masuk ke bank soal.</p>
        <button onClick={ulang} style={tombol('#3182ce')}>Impor File Lain</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', backgroundColor: '#ebf8ff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #bee3f8' }}>
        <div style={{ fontSize: '14px', color: '#2b6cb0' }}>
          <b>Belum punya file soal?</b> Unduh template Excel, isi di Excel atau Google Sheets, lalu unggah di bawah.
        </div>
        <a href="/template_soal_tryout_tka.xlsx" download style={{ ...tombol('#3182ce'), textDecoration: 'none', whiteSpace: 'nowrap', fontSize: '13px' }}>
          📥 Unduh Template Soal (.xlsx)
        </a>
      </div>

      <div style={kotak}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>1. Pilih file soal</h3>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          disabled={sibuk}
          onChange={(e) => { setFile(e.target.files[0] || null); setHasil(null); setGalat(''); setTahap('pilih'); }}
          style={{ fontSize: '14px' }}
        />
        <div style={{ marginTop: '12px' }}>
          <button onClick={periksa} disabled={!file || sibuk} style={tombol('#38a169', !file || sibuk)}>
            {tahap === 'memeriksa' ? 'Memeriksa…' : 'Periksa File'}
          </button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#718096' }}>
          Pemeriksaan tidak menyimpan apa pun. Soal baru masuk ke database setelah kamu menekan tombol Simpan.
        </p>
      </div>

      {galat && (
        <div style={{ backgroundColor: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {galat}
        </div>
      )}

      {hasil && (
        <div>
          <div style={kotak}>
            <h3 style={{ marginTop: 0, fontSize: '16px' }}>2. Hasil pemeriksaan: {hasil.nama_file}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '13px', marginBottom: '8px' }}>
              <span style={{ background: '#e2e8f0', padding: '4px 10px', borderRadius: '999px' }}><b>{hasil.ringkas.jumlah_soal}</b> soal</span>
              <span style={{ background: '#e2e8f0', padding: '4px 10px', borderRadius: '999px' }}><b>{hasil.ringkas.jumlah_stimulus}</b> stimulus</span>
              {Object.entries(hasil.ringkas.per_tipe).map(([t, j]) => (
                <span key={t} style={{ background: '#e2e8f0', padding: '4px 10px', borderRadius: '999px' }}>{NAMA_TIPE[t]}: <b>{j}</b></span>
              ))}
              <span style={{ background: hasil.ringkas.jumlah_error ? '#fed7d7' : '#c6f6d5', padding: '4px 10px', borderRadius: '999px' }}><b>{hasil.ringkas.jumlah_error}</b> error</span>
              <span style={{ background: hasil.ringkas.jumlah_peringatan ? '#feebc8' : '#e2e8f0', padding: '4px 10px', borderRadius: '999px' }}><b>{hasil.ringkas.jumlah_peringatan}</b> peringatan</span>
            </div>

            {hasil.masalah.length > 0 && (
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#edf2f7', textAlign: 'left' }}>
                      <th style={{ padding: '6px 10px' }}>Jenis</th>
                      <th style={{ padding: '6px 10px' }}>Lembar</th>
                      <th style={{ padding: '6px 10px' }}>Baris</th>
                      <th style={{ padding: '6px 10px' }}>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hasil.masalah.map((m, i) => (
                      <tr key={i} style={{ backgroundColor: m.level === 'error' ? '#fff5f5' : '#fffaf0', borderTop: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 'bold', color: m.level === 'error' ? '#c53030' : '#c05621' }}>{m.level === 'error' ? 'ERROR' : 'Peringatan'}</td>
                        <td style={{ padding: '6px 10px' }}>{m.lembar}</td>
                        <td style={{ padding: '6px 10px' }}>{m.baris || '-'}</td>
                        <td style={{ padding: '6px 10px' }}>{m.pesan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '14px' }}>
              {hasil.ok ? (
                <button onClick={simpan} disabled={sibuk} style={tombol('#2b6cb0', sibuk)}>
                  {tahap === 'menyimpan' ? 'Menyimpan…' : `Simpan ${hasil.soal.length} Soal ke Bank Soal`}
                </button>
              ) : (
                <div style={{ color: '#c53030', fontSize: '14px', fontWeight: 'bold' }}>
                  Perbaiki semua ERROR di file Excel, simpan, lalu pilih file itu lagi dan tekan "Periksa File".
                </div>
              )}
            </div>
          </div>

          {hasil.soal.length > 0 && (
            <div>
              <h3 style={{ fontSize: '16px' }}>Pratinjau soal ({hasil.soal.length})</h3>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#718096' }}>
                Klik satu soal untuk melihat. Hijau = jawaban benar. Rumus ditampilkan seperti yang akan dilihat siswa.
              </p>
              {hasil.soal.map((s, i) => (
                <KartuSoal key={s._baris} s={s} nomor={i + 1} stimulus={stimulus} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
