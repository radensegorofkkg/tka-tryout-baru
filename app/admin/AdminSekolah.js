'use client';
import { useEffect, useState } from 'react';

const sel = { padding: '6px 10px', border: '1px solid #e2e8f0', fontSize: '13px' };
const mini = (warna, mati) => ({
  backgroundColor: mati ? '#a0aec0' : warna, color: '#fff', border: 'none', padding: '4px 8px',
  borderRadius: '4px', cursor: mati ? 'not-allowed' : 'pointer', fontSize: '12px', marginRight: '4px',
});
const waktuWib = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'medium' }) : '-');

export default function AdminSekolah({ sandi, onKeluar }) {
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [sandiBaru, setSandiBaru] = useState(null); // { npsn, nama, sandi } tampil sekali

  const basis = () => (process.env.NEXT_PUBLIC_URL_TRYOUT || window.location.origin).replace(/\/+$/, '');

  const muat = async () => {
    try {
      const res = await fetch('/api/admin/sandi-sekolah', { headers: { 'x-admin-password': sandi }, cache: 'no-store' });
      if (res.status === 401) { onKeluar(); return; }
      const json = await res.json();
      if (!res.ok) { setGalat(json.pesan || 'Gagal memuat.'); return; }
      setGalat('');
      setData(json);
    } catch {
      setGalat('Tidak bisa menghubungi server.');
    }
  };

  useEffect(() => { muat(); }, []);

  const kirim = async (body) => {
    return fetch('/api/admin/sandi-sekolah', {
      method: 'POST',
      headers: { 'x-admin-password': sandi, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const buatSemua = async () => {
    const kosong = data.sekolah.filter((s) => !s.ada_sandi).length;
    if (!confirm(`Buat kata sandi untuk ${kosong} sekolah yang belum punya? File Excel berisi kata sandi akan diunduh. Kata sandi hanya muncul sekali ini.`)) return;
    setInfo(''); setGalat(''); setSibuk(true);
    try {
      const res = await kirim({ aksi: 'buat_yang_kosong' });
      if (res.status === 401) { onKeluar(); return; }
      if (!res.ok) {
        let p = 'Gagal membuat kata sandi.';
        try { p = (await res.json()).pesan || p; } catch { /* bukan JSON */ }
        setGalat(p);
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kata-sandi-admin-sekolah.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setInfo('File kata sandi diunduh. Simpan baik-baik, kata sandi tidak bisa dilihat lagi (hanya bisa diganti).');
      await muat();
    } catch {
      setGalat('Tidak bisa menghubungi server. Coba lagi.');
    } finally {
      setSibuk(false);
    }
  };

  const ganti = async (s) => {
    if (!confirm(`${s.ada_sandi ? 'Ganti' : 'Buat'} kata sandi untuk ${s.nama}? ${s.ada_sandi ? 'Kata sandi lama langsung tidak berlaku.' : ''}`)) return;
    setInfo(''); setGalat(''); setSibuk(true);
    try {
      const res = await kirim({ aksi: 'ganti', npsn: s.npsn });
      if (res.status === 401) { onKeluar(); return; }
      const json = await res.json();
      if (!res.ok) { setGalat(json.pesan || 'Gagal.'); return; }
      setSandiBaru({ npsn: s.npsn, nama: s.nama, sandi: json.sandi });
      await muat();
    } catch {
      setGalat('Tidak bisa menghubungi server. Coba lagi.');
    } finally {
      setSibuk(false);
    }
  };

  const bukaBlokir = async (s) => {
    setInfo(''); setGalat(''); setSibuk(true);
    try {
      const res = await kirim({ aksi: 'buka_blokir', npsn: s.npsn });
      if (res.status === 401) { onKeluar(); return; }
      if (!res.ok) { setGalat('Gagal membuka blokir.'); return; }
      setInfo(`Blokir ${s.nama} dibuka.`);
      await muat();
    } finally {
      setSibuk(false);
    }
  };

  const salin = (teks) => {
    try { navigator.clipboard.writeText(teks); setInfo('Tersalin: ' + teks); } catch { /* abaikan */ }
  };

  if (!data) return <div style={{ fontSize: '14px', color: galat ? '#c53030' : '#718096' }}>{galat || 'Memuat…'}</div>;

  const kosong = data.sekolah.filter((s) => !s.ada_sandi).length;

  return (
    <div>
      <p style={{ fontSize: '14px', color: '#4a5568', marginTop: 0 }}>
        Admin sekolah hanya bisa melihat siswa sekolahnya dan mereset login (kecuali siswa yang terkunci karena kecurangan). Link masuknya
        <b> {basis()}/sekolah/NPSN</b>.
      </p>
      {galat && <div style={{ color: '#c53030', fontSize: '14px', marginBottom: '8px' }}>{galat}</div>}
      {info && <div style={{ color: '#276749', fontSize: '14px', marginBottom: '8px' }}>{info}</div>}

      {sandiBaru && (
        <div style={{ border: '2px solid #ed8936', backgroundColor: '#fffaf0', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px' }}>Kata sandi baru untuk <b>{sandiBaru.nama}</b> (hanya tampil sekali, catat sekarang):</div>
          <div style={{ fontSize: '26px', fontWeight: 'bold', letterSpacing: '3px', margin: '8px 0', fontFamily: 'monospace' }}>{sandiBaru.sandi}</div>
          <button onClick={() => salin(sandiBaru.sandi)} style={mini('#3182ce')}>Salin sandi</button>
          <button onClick={() => salin(`${basis()}/sekolah/${sandiBaru.npsn}`)} style={mini('#319795')}>Salin link</button>
          <button onClick={() => setSandiBaru(null)} style={mini('#718096')}>Tutup</button>
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        <button onClick={buatSemua} disabled={sibuk || kosong === 0} style={{ ...mini('#38a169', sibuk || kosong === 0), padding: '8px 14px', fontSize: '14px' }}>
          Buat kata sandi untuk {kosong} sekolah yang belum punya (unduh Excel)
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#edf2f7', textAlign: 'left' }}>
              <th style={sel}>Sekolah</th>
              <th style={sel}>NPSN</th>
              <th style={sel}>Kata sandi</th>
              <th style={sel}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.sekolah.map((s) => (
              <tr key={s.npsn}>
                <td style={sel}>{s.nama}</td>
                <td style={sel}>{s.npsn}</td>
                <td style={sel}>
                  {s.ada_sandi ? `Ada (${waktuWib(s.sandi_diubah_at)})` : <span style={{ color: '#c53030' }}>Belum dibuat</span>}
                  {s.diblokir && <span style={{ color: '#c53030', fontWeight: 'bold' }}> · diblokir sementara</span>}
                </td>
                <td style={sel}>
                  <button onClick={() => ganti(s)} disabled={sibuk} style={mini('#ed8936', sibuk)}>{s.ada_sandi ? 'Ganti sandi' : 'Buat sandi'}</button>
                  <button onClick={() => salin(`${basis()}/sekolah/${s.npsn}`)} style={mini('#319795')}>Salin link</button>
                  {s.diblokir && <button onClick={() => bukaBlokir(s)} disabled={sibuk} style={mini('#e53e3e', sibuk)}>Buka blokir</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: '24px', fontSize: '16px' }}>Catatan reset login (100 terakhir)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#edf2f7', textAlign: 'left' }}>
              <th style={sel}>Waktu (WIB)</th>
              <th style={sel}>Oleh</th>
              <th style={sel}>No Ujian</th>
              <th style={sel}>Siswa</th>
            </tr>
          </thead>
          <tbody>
            {data.log.length === 0 && <tr><td colSpan="4" style={{ ...sel, color: '#718096', textAlign: 'center' }}>Belum ada reset.</td></tr>}
            {data.log.map((l, i) => (
              <tr key={i}>
                <td style={sel}>{waktuWib(l.waktu)}</td>
                <td style={sel}>{l.oleh}</td>
                <td style={sel}>{l.nomor_ujian}</td>
                <td style={sel}>{l.nama}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
