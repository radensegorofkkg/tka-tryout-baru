'use client';
import { useEffect, useState } from 'react';

const mini = (warna, mati) => ({
  backgroundColor: mati ? '#a0aec0' : warna, color: '#fff', border: 'none', padding: '6px 12px',
  borderRadius: '6px', cursor: mati ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px', marginRight: '6px',
});

export default function PesertaUjian({ ujianId, sandi, onKeluar }) {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('semua'); // 'semua' | 'tertentu'
  const [pilih, setPilih] = useState(new Set());
  const [cari, setCari] = useState('');
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const muat = async () => {
    try {
      const res = await fetch(`/api/admin/peserta-ujian?ujian_id=${ujianId}`, { headers: { 'x-admin-password': sandi }, cache: 'no-store' });
      if (res.status === 401) { onKeluar(); return; }
      const json = await res.json();
      if (!res.ok) { setGalat(json.pesan || 'Gagal memuat.'); return; }
      setGalat('');
      setData(json);
      setMode(json.npsn.length > 0 ? 'tertentu' : 'semua');
      setPilih(new Set(json.npsn));
    } catch {
      setGalat('Tidak bisa menghubungi server.');
    }
  };

  useEffect(() => { muat(); }, [ujianId]);

  const simpan = async () => {
    setInfo(''); setGalat(''); setSibuk(true);
    try {
      const res = await fetch('/api/admin/peserta-ujian', {
        method: 'POST',
        headers: { 'x-admin-password': sandi, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ujian_id: ujianId, npsn: mode === 'semua' ? [] : [...pilih] }),
      });
      if (res.status === 401) { onKeluar(); return; }
      const json = await res.json();
      if (!res.ok) { setGalat(json.pesan || 'Gagal menyimpan.'); return; }
      setInfo(mode === 'semua' ? 'Tersimpan: ujian terbuka untuk semua sekolah.' : `Tersimpan: ${json.jumlah} sekolah boleh ikut.`);
    } catch {
      setGalat('Tidak bisa menghubungi server. Coba lagi.');
    } finally {
      setSibuk(false);
    }
  };

  if (!data) return <div style={{ padding: '12px 16px', fontSize: '14px', color: galat ? '#c53030' : '#718096' }}>{galat || 'Memuat…'}</div>;

  const kata = cari.trim().toLowerCase();
  const tampil = data.sekolah.filter((s) => !kata || s.nama.toLowerCase().includes(kata) || s.npsn.includes(kata));
  const ubah = (npsn) => {
    const baru = new Set(pilih);
    if (baru.has(npsn)) baru.delete(npsn); else baru.add(npsn);
    setPilih(baru);
  };
  const tidakBisa = sibuk || (mode === 'tertentu' && pilih.size === 0);

  return (
    <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 16px', backgroundColor: '#faf5ff' }}>
      <div style={{ fontSize: '14px', marginBottom: '8px' }}>
        <b>Peserta ujian "{data.ujian.nama}"</b>
        {data.ujian.status === 'aktif' && <span style={{ color: '#c05621' }}> · ujian sedang aktif: perubahan berlaku untuk siswa yang belum mulai</span>}
      </div>
      <label style={{ marginRight: '16px', fontSize: '14px' }}>
        <input type="radio" checked={mode === 'semua'} onChange={() => setMode('semua')} /> Semua sekolah
      </label>
      <label style={{ fontSize: '14px' }}>
        <input type="radio" checked={mode === 'tertentu'} onChange={() => setMode('tertentu')} /> Sekolah tertentu
      </label>

      {mode === 'tertentu' && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama sekolah atau NPSN…"
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '13px', minWidth: '220px' }}
            />
            <button onClick={() => setPilih(new Set([...pilih, ...tampil.map((s) => s.npsn)]))} style={mini('#3182ce')}>Pilih yang tampil</button>
            <button onClick={() => setPilih(new Set())} style={mini('#718096')}>Kosongkan</button>
            <span style={{ fontSize: '13px', color: '#4a5568' }}>{pilih.size} dari {data.sekolah.length} sekolah dipilih</span>
          </div>
          <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#fff', padding: '6px 10px' }}>
            {tampil.length === 0 && <div style={{ fontSize: '13px', color: '#718096' }}>Tidak ada sekolah yang cocok.</div>}
            {tampil.map((s) => (
              <label key={s.npsn} style={{ display: 'block', fontSize: '13px', padding: '3px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={pilih.has(s.npsn)} onChange={() => ubah(s.npsn)} /> {s.nama} <span style={{ color: '#718096' }}>({s.npsn})</span>
              </label>
            ))}
          </div>
          {pilih.size === 0 && <div style={{ fontSize: '12px', color: '#c53030', marginTop: '6px' }}>Pilih minimal satu sekolah, atau ganti ke "Semua sekolah".</div>}
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        <button onClick={simpan} disabled={tidakBisa} style={mini('#38a169', tidakBisa)}>Simpan peserta</button>
        {galat && <span style={{ color: '#c53030', fontSize: '13px' }}>{galat}</span>}
        {info && <span style={{ color: '#276749', fontSize: '13px' }}>{info}</span>}
      </div>
      <p style={{ fontSize: '12px', color: '#718096', margin: '8px 0 0' }}>
        Siswa dari sekolah yang tidak dipilih tidak bisa login atau memulai ujian ini. Siswa yang sudah mulai tidak dikeluarkan. Peringkat, Pantau, dan Excel hanya memuat sekolah peserta.
      </p>
    </div>
  );
}
