'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const STATUS = {
  belum_login: { teks: 'Belum login', latar: '#e2e8f0', warna: '#4a5568' },
  login: { teks: 'Sudah login', latar: '#bee3f8', warna: '#2a4365' },
  mengerjakan: { teks: 'Mengerjakan', latar: '#feebc8', warna: '#c05621' },
  waktu_habis: { teks: 'Waktu habis', latar: '#fed7d7', warna: '#9b2c2c' },
  selesai: { teks: 'Selesai', latar: '#c6f6d5', warna: '#22543d' },
};

const sel = { padding: '6px 10px', border: '1px solid #e2e8f0', fontSize: '13px', verticalAlign: 'top' };
const format = (d) => `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
const kartu = { maxWidth: '1000px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' };

export default function AdminSekolah() {
  const { npsn } = useParams();
  const kunci = `sekolah_token_${npsn}`;
  const [token, setToken] = useState('');
  const [siap, setSiap] = useState(false);
  const [sandi, setSandi] = useState('');
  const [galatMasuk, setGalatMasuk] = useState('');
  const [memeriksa, setMemeriksa] = useState(false);

  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [cari, setCari] = useState('');
  const [saring, setSaring] = useState('semua');
  const [terakhir, setTerakhir] = useState('');
  const sedangMuat = useRef(false);

  useEffect(() => {
    try { setToken(sessionStorage.getItem(kunci) || ''); } catch { /* abaikan */ }
    setSiap(true);
  }, [kunci]);

  const keluar = (pesan) => {
    try { sessionStorage.removeItem(kunci); } catch { /* abaikan */ }
    setToken('');
    setData(null);
    setGalatMasuk(pesan || '');
  };

  const masuk = async (e) => {
    e.preventDefault();
    setGalatMasuk('');
    setMemeriksa(true);
    try {
      const res = await fetch('/api/sekolah/masuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npsn, kata_sandi: sandi }),
      });
      let json = {};
      try { json = await res.json(); } catch { /* bukan JSON */ }
      if (!res.ok) { setGalatMasuk(json.pesan || 'Gagal masuk.'); return; }
      try { sessionStorage.setItem(kunci, json.token); } catch { /* abaikan */ }
      setToken(json.token);
      setSandi('');
    } catch {
      setGalatMasuk('Tidak bisa menghubungi server. Periksa koneksi internet.');
    } finally {
      setMemeriksa(false);
    }
  };

  const panggil = async (metode, body) => {
    const headers = { 'x-sekolah-token': token };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch('/api/sekolah/pantau', { method: metode, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    let json = {};
    try { json = await res.json(); } catch { /* bukan JSON */ }
    if (res.status === 401) { keluar('Sesi habis. Silakan masuk lagi.'); return { res, json, habis: true }; }
    return { res, json, habis: false };
  };

  const muat = async () => {
    if (sedangMuat.current || !token) return;
    sedangMuat.current = true;
    try {
      const { res, json, habis } = await panggil('GET');
      if (habis) return;
      if (!res.ok) { setGalat(json.pesan || 'Gagal memuat data.'); return; }
      setGalat('');
      setData(json);
      setTerakhir(new Date().toLocaleTimeString('id-ID'));
    } catch {
      setGalat('Tidak bisa menghubungi server. Mencoba lagi otomatis…');
    } finally {
      sedangMuat.current = false;
    }
  };

  useEffect(() => {
    if (!token) return;
    muat();
    const t = setInterval(muat, 10000);
    return () => clearInterval(t);
  }, [token]);

  const resetLogin = async (s) => {
    if (!confirm(`Reset login untuk ${s.nama_lengkap} (${s.nomor_ujian})? Siswa ini bisa login lagi.`)) return;
    setInfo(''); setGalat(''); setSibuk(true);
    try {
      const { res, json, habis } = await panggil('POST', { aksi: 'reset_login', nomor_ujian: s.nomor_ujian });
      if (habis) return;
      if (!res.ok) { setGalat(json.pesan || 'Terjadi kesalahan.'); await muat(); return; }
      setInfo(`Login ${s.nama_lengkap} sudah direset.`);
      await muat();
    } catch {
      setGalat('Tidak bisa menghubungi server. Silakan coba lagi.');
    } finally {
      setSibuk(false);
    }
  };

  if (!siap) return null;

  if (!token) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f6f9', fontFamily: 'sans-serif', padding: '16px' }}>
        <form onSubmit={masuk} style={{ width: '100%', maxWidth: '380px', backgroundColor: '#fff', padding: '28px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', color: '#1a202c' }}>Admin Sekolah</h1>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#718096' }}>Tryout TKA Kec. Banyuates · NPSN {npsn}</p>
          <input
            type="password"
            value={sandi}
            onChange={(e) => setSandi(e.target.value)}
            placeholder="Kata sandi sekolah"
            autoFocus
            required
            autoCapitalize="characters"
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e0', boxSizing: 'border-box', fontSize: '14px' }}
          />
          {galatMasuk && <div style={{ color: '#c53030', fontSize: '13px', marginTop: '8px' }}>{galatMasuk}</div>}
          <button type="submit" disabled={memeriksa} style={{ width: '100%', marginTop: '14px', backgroundColor: memeriksa ? '#a0aec0' : '#3182ce', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: memeriksa ? 'not-allowed' : 'pointer' }}>
            {memeriksa ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: '24px', fontFamily: 'sans-serif', color: galat ? '#c53030' : '#718096' }}>{galat || 'Memuat…'}</div>;
  }

  const r = data.ringkas;
  const chip = (teks, jumlah, nilai, warna) => (
    <button
      key={nilai}
      onClick={() => setSaring(nilai)}
      style={{
        border: saring === nilai ? '2px solid #2b6cb0' : '1px solid #cbd5e0', backgroundColor: warna || '#fff',
        borderRadius: '16px', padding: '4px 12px', fontSize: '13px', cursor: 'pointer', marginRight: '6px', marginBottom: '6px',
      }}
    >
      {teks}: <b>{jumlah}</b>
    </button>
  );

  const daftar = data.siswa.filter((s) => {
    const cocokStatus = saring === 'semua' || (saring === 'terkunci' ? s.terkunci : s.status === saring);
    const kata = cari.trim().toLowerCase();
    return cocokStatus && (!kata || s.nama_lengkap.toLowerCase().includes(kata) || s.nomor_ujian.toLowerCase().includes(kata));
  });

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh', padding: '16px' }}>
      <div style={kartu}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', color: '#1a202c' }}>{data.sekolah.nama}</h1>
            <div style={{ fontSize: '13px', color: '#718096' }}>
              Admin Sekolah · NPSN {data.sekolah.npsn} · {data.ujian ? `Ujian aktif: ${data.ujian.nama}` : 'Belum ada ujian aktif'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#718096' }}>Diperbarui {terakhir}</span>
            <button onClick={muat} style={{ backgroundColor: '#3182ce', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Segarkan</button>
            <button onClick={() => keluar('')} style={{ backgroundColor: '#e2e8f0', color: '#4a5568', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Keluar</button>
          </div>
        </div>

        {data.ujian && data.ikut === false && (
          <div style={{ backgroundColor: '#fffaf0', border: '1px solid #ed8936', color: '#7b341e', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '10px' }}>
            Sekolah Anda tidak ikut ujian yang sedang aktif ini.
          </div>
        )}
        {galat && <div style={{ color: '#c53030', fontSize: '14px', marginBottom: '8px' }}>{galat}</div>}
        {info && <div style={{ color: '#276749', fontSize: '14px', marginBottom: '8px' }}>{info}</div>}

        <div style={{ marginBottom: '8px' }}>
          {chip('Semua', r.total, 'semua')}
          {chip('Belum login', r.belum_login, 'belum_login')}
          {chip('Sudah login', r.login, 'login')}
          {chip('Mengerjakan', r.mengerjakan, 'mengerjakan')}
          {chip('Waktu habis', r.waktu_habis, 'waktu_habis')}
          {chip('Selesai', r.selesai, 'selesai')}
          {chip('🔒 Terkunci', r.terkunci, 'terkunci', r.terkunci ? '#fed7d7' : '#fff')}
        </div>

        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama atau nomor ujian…"
          style={{ width: '100%', maxWidth: '320px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e0', boxSizing: 'border-box', marginBottom: '10px', fontSize: '14px' }}
        />

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#edf2f7', textAlign: 'left' }}>
                <th style={sel}>No Ujian</th>
                <th style={sel}>Nama</th>
                <th style={sel}>Status</th>
                <th style={sel}>Dijawab</th>
                <th style={sel}>Sisa waktu</th>
                <th style={sel}>Pelanggaran</th>
                <th style={sel}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {daftar.length === 0 && (
                <tr><td colSpan="7" style={{ ...sel, textAlign: 'center', color: '#718096' }}>Tidak ada siswa yang cocok.</td></tr>
              )}
              {daftar.map((s) => {
                const st = STATUS[s.status];
                return (
                  <tr key={s.nomor_ujian} style={{ backgroundColor: s.terkunci ? '#fff5f5' : undefined }}>
                    <td style={sel}>{s.nomor_ujian}</td>
                    <td style={sel}>{s.nama_lengkap}</td>
                    <td style={sel}>
                      <span style={{ backgroundColor: st.latar, color: st.warna, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{st.teks}</span>
                    </td>
                    <td style={sel}>{data.ujian ? s.dijawab : '-'}</td>
                    <td style={sel}>{s.sisa_detik !== null && s.sisa_detik !== undefined ? format(s.sisa_detik) : '-'}</td>
                    <td style={sel}>
                      {s.jumlah_pelanggaran > 0 ? (
                        <span style={{ backgroundColor: s.curang ? '#fed7d7' : '#fefcbf', color: s.curang ? '#9b2c2c' : '#744210', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                          {s.curang ? '⚠ Terdeteksi ' : ''}{s.jumlah_pelanggaran}x
                        </span>
                      ) : '-'}
                      {s.curang && s.alasan_curang && (
                        <div style={{ fontSize: '11px', color: '#9b2c2c', marginTop: '2px', maxWidth: '240px' }}>Terdeteksi kecurangan karena {s.alasan_curang}</div>
                      )}
                    </td>
                    <td style={sel}>
                      {s.terkunci ? (
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#c53030', maxWidth: '200px' }}>
                          🔒 Terkunci karena kecurangan. Hubungi super admin pusat untuk membuka.
                        </div>
                      ) : s.is_logged_in ? (
                        <button onClick={() => resetLogin(s)} disabled={sibuk} style={{ backgroundColor: sibuk ? '#a0aec0' : '#ed8936', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: sibuk ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
                          Reset Login
                        </button>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '12px', color: '#718096', marginTop: '10px' }}>
          Data diperbarui otomatis tiap 10 detik. Reset Login: siswa bisa login lagi (jawaban tetap tersimpan). Siswa yang terkunci karena kecurangan hanya bisa dibuka oleh super admin pusat.
        </p>
      </div>
    </div>
  );
}
