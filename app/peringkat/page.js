'use client';
import { useEffect, useState } from 'react';

const sel = { padding: '8px 10px', borderBottom: '1px solid #edf2f7', fontSize: '14px' };
const isian = { padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '14px', boxSizing: 'border-box' };
const MEDALI = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Peringkat() {
  const [daftarUjian, setDaftarUjian] = useState(null);
  const [ujianId, setUjianId] = useState(null);
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  const [tab, setTab] = useState('siswa');
  const [cari, setCari] = useState('');
  const [sekolah, setSekolah] = useState('semua');
  const [batas, setBatas] = useState(100);
  const [terakhir, setTerakhir] = useState('');

  const ambil = async (alamat) => {
    const res = await fetch(alamat, { cache: 'no-store' });
    let json = {};
    try { json = await res.json(); } catch { /* bukan JSON */ }
    return { res, json };
  };

  const muatDaftar = async () => {
    try {
      const { res, json } = await ambil('/api/peringkat');
      if (!res.ok) { setGalat(json.pesan || 'Gagal memuat.'); return; }
      setGalat('');
      setDaftarUjian(json.ujian);
      setUjianId((lama) => (lama && json.ujian.some((u) => u.id === lama) ? lama : json.ujian[0]?.id ?? null));
    } catch {
      setGalat('Tidak bisa menghubungi server. Periksa koneksi internet.');
    }
  };

  const muatData = async (id) => {
    if (!id) { setData(null); return; }
    try {
      const { res, json } = await ambil(`/api/peringkat?ujian_id=${id}`);
      if (!res.ok) { setData(null); setGalat(json.pesan || 'Gagal memuat peringkat.'); return; }
      setGalat('');
      setData(json);
      setTerakhir(new Date().toLocaleTimeString('id-ID'));
    } catch {
      setGalat('Tidak bisa menghubungi server. Periksa koneksi internet.');
    }
  };

  useEffect(() => { muatDaftar(); }, []);
  useEffect(() => {
    muatData(ujianId);
    if (!ujianId) return undefined;
    const t = setInterval(() => muatData(ujianId), 60000);
    return () => clearInterval(t);
  }, [ujianId]);

  const kata = cari.trim().toLowerCase();
  const siswaTampil = (data?.peringkat || []).filter(
    (p) => (sekolah === 'semua' || p.sekolah === sekolah) && (!kata || p.nama.toLowerCase().includes(kata) || p.sekolah.toLowerCase().includes(kata))
  );
  const sekolahTampil = (data?.sekolah || []).filter((s) => !kata || s.sekolah.toLowerCase().includes(kata));
  const daftarSekolah = [...new Set((data?.peringkat || []).map((p) => p.sekolah))].sort();

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh', padding: '16px' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
        <h1 style={{ margin: 0, fontSize: '22px', color: '#1a202c' }}>🏆 Peringkat Tryout TKA</h1>
        <p style={{ margin: '4px 0 14px', color: '#718096', fontSize: '13px' }}>
          Hanya siswa yang sudah mengumpulkan ujian. Nama disamarkan untuk menjaga privasi.
        </p>

        {galat && (
          <div style={{ backgroundColor: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '14px' }}>{galat}</div>
        )}

        {daftarUjian === null && !galat && <div style={{ color: '#718096' }}>Memuat…</div>}

        {daftarUjian && daftarUjian.length === 0 && (
          <div style={{ backgroundColor: '#fffaf0', border: '1px solid #fbd38d', color: '#c05621', padding: '14px', borderRadius: '8px', fontSize: '14px' }}>
            Peringkat belum dibuka oleh admin. Silakan cek kembali nanti.
          </div>
        )}

        {daftarUjian && daftarUjian.length > 0 && (
          <>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
              {daftarUjian.length > 1 ? (
                <select value={ujianId ?? ''} onChange={(e) => { setUjianId(Number(e.target.value)); setData(null); setBatas(100); }} style={isian}>
                  {daftarUjian.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
                </select>
              ) : (
                <b style={{ fontSize: '15px' }}>{daftarUjian[0].nama}</b>
              )}
              <span style={{ fontSize: '12px', color: '#a0aec0' }}>
                {terakhir ? `Diperbarui ${terakhir}` : ''}
              </span>
              <button onClick={() => muatData(ujianId)} style={{ ...isian, cursor: 'pointer', backgroundColor: '#edf2f7', border: 'none', fontWeight: 'bold', fontSize: '13px' }}>↻ Muat ulang</button>
            </div>

            {!data && !galat && <div style={{ color: '#718096' }}>Memuat peringkat…</div>}

            {data && (
              <>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {[['siswa', `Peringkat Siswa (${data.peringkat.length})`], ['sekolah', `Rata-rata Sekolah (${data.sekolah.length})`]].map(([id, nama]) => (
                    <button key={id} onClick={() => { setTab(id); setBatas(100); }} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', backgroundColor: tab === id ? '#3182ce' : '#e2e8f0', color: tab === id ? '#fff' : '#4a5568' }}>
                      {nama}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <input type="text" value={cari} onChange={(e) => { setCari(e.target.value); setBatas(100); }} placeholder={tab === 'siswa' ? 'Cari nama atau sekolah…' : 'Cari sekolah…'} style={{ ...isian, flex: '1 1 220px' }} />
                  {tab === 'siswa' && (
                    <select value={sekolah} onChange={(e) => { setSekolah(e.target.value); setBatas(100); }} style={{ ...isian, maxWidth: '100%' }}>
                      <option value="semua">Semua sekolah</option>
                      {daftarSekolah.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  {tab === 'siswa' ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#edf2f7', textAlign: 'left' }}>
                          <th style={sel}>#</th><th style={sel}>Nama</th><th style={sel}>Sekolah</th><th style={{ ...sel, textAlign: 'right' }}>Skor</th><th style={{ ...sel, textAlign: 'right' }}>Nilai</th>
                        </tr>
                      </thead>
                      <tbody>
                        {siswaTampil.length === 0 && <tr><td colSpan="5" style={{ ...sel, color: '#718096' }}>Tidak ada data yang cocok.</td></tr>}
                        {siswaTampil.slice(0, batas).map((p, i) => (
                          <tr key={i}>
                            <td style={{ ...sel, fontWeight: 'bold' }}>{MEDALI[p.peringkat] || p.peringkat}</td>
                            <td style={sel}>{p.nama}</td>
                            <td style={{ ...sel, color: '#4a5568' }}>{p.sekolah}</td>
                            <td style={{ ...sel, textAlign: 'right' }}>{p.skor} / {data.ujian.maks}</td>
                            <td style={{ ...sel, textAlign: 'right', fontWeight: 'bold' }}>{p.nilai}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '440px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#edf2f7', textAlign: 'left' }}>
                          <th style={sel}>#</th><th style={sel}>Sekolah</th><th style={{ ...sel, textAlign: 'right' }}>Siswa</th><th style={{ ...sel, textAlign: 'right' }}>Rata-rata</th><th style={{ ...sel, textAlign: 'right' }}>Tertinggi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sekolahTampil.length === 0 && <tr><td colSpan="5" style={{ ...sel, color: '#718096' }}>Tidak ada data yang cocok.</td></tr>}
                        {sekolahTampil.slice(0, batas).map((s, i) => (
                          <tr key={s.sekolah}>
                            <td style={{ ...sel, fontWeight: 'bold' }}>{MEDALI[i + 1] || i + 1}</td>
                            <td style={sel}>{s.sekolah}</td>
                            <td style={{ ...sel, textAlign: 'right' }}>{s.jumlah}</td>
                            <td style={{ ...sel, textAlign: 'right', fontWeight: 'bold' }}>{s.rata}</td>
                            <td style={{ ...sel, textAlign: 'right' }}>{s.tertinggi}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {(tab === 'siswa' ? siswaTampil.length : sekolahTampil.length) > batas && (
                  <button onClick={() => setBatas(batas + 100)} style={{ ...isian, marginTop: '12px', cursor: 'pointer', backgroundColor: '#edf2f7', border: 'none', fontWeight: 'bold' }}>
                    Tampilkan lebih banyak
                  </button>
                )}
                <p style={{ fontSize: '12px', color: '#a0aec0', marginTop: '14px' }}>
                  Nilai = skor dibagi skor maksimal ({data.ujian.maks}) dikali 100. Skor yang sama mendapat peringkat yang sama.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
