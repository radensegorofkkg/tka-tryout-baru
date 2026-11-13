'use client';
import { useState, useEffect } from 'react';
import ImporSoal from './ImporSoal';
import MenuUjian from './MenuUjian';
import DataSiswa from './DataSiswa';
import BankSoal from './BankSoal';
import AdminSekolah from './AdminSekolah';

const TAB = [
  { id: 'siswa', nama: '👥 Database Siswa' },
  { id: 'soal', nama: '📝 Input & Import Soal' },
  { id: 'bank', nama: '🗂️ Bank Soal' },
  { id: 'ujian', nama: '🗓️ Ujian' },
  { id: 'sekolah', nama: '🏫 Admin Sekolah' },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('siswa');

  // Gerbang kata sandi admin
  const [sandi, setSandi] = useState('');
  const [terbuka, setTerbuka] = useState(false);
  const [memeriksaSandi, setMemeriksaSandi] = useState(true);
  const [inputSandi, setInputSandi] = useState('');
  const [galatMasuk, setGalatMasuk] = useState('');

  const verifikasiSandi = async (s) => {
    try {
      const res = await fetch('/api/admin/cek', { method: 'POST', headers: { 'x-admin-password': s } });
      return res.ok;
    } catch {
      return false;
    }
  };

  const keluarAdmin = (pesan) => {
    try { sessionStorage.removeItem('admin_sandi'); } catch {}
    setSandi('');
    setTerbuka(false);
    setInputSandi('');
    setGalatMasuk(pesan || '');
  };

  useEffect(() => {
    let tersimpan = '';
    try { tersimpan = sessionStorage.getItem('admin_sandi') || ''; } catch {}
    if (!tersimpan) { setMemeriksaSandi(false); return; }
    verifikasiSandi(tersimpan).then((ok) => {
      if (ok) { setSandi(tersimpan); setTerbuka(true); }
      else { try { sessionStorage.removeItem('admin_sandi'); } catch {} }
      setMemeriksaSandi(false);
    });
  }, []);

  const handleMasuk = async (e) => {
    e.preventDefault();
    setGalatMasuk('');
    setMemeriksaSandi(true);
    const ok = await verifikasiSandi(inputSandi);
    setMemeriksaSandi(false);
    if (ok) {
      try { sessionStorage.setItem('admin_sandi', inputSandi); } catch {}
      setSandi(inputSandi);
      setTerbuka(true);
      setInputSandi('');
    } else {
      setGalatMasuk('Kata sandi salah.');
    }
  };

  // Link untuk siswa. Memakai NEXT_PUBLIC_URL_TRYOUT (alamat produksi) bila diisi di Vercel;
  // jika tidak, memakai alamat yang sedang dibuka.
  const copyLinkUjian = () => {
    const link = (process.env.NEXT_PUBLIC_URL_TRYOUT || window.location.origin).replace(/\/+$/, '');
    try { navigator.clipboard.writeText(link); } catch {}
    alert(`Link Tryout berhasil disalin:\n${link}\n\nPastikan link ini bisa dibuka dari HP tanpa diminta login Vercel.`);
  };

  const keluarSesi = 'Sesi berakhir atau kata sandi berubah. Silakan masuk lagi.';

  if (!terbuka) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f6f9', fontFamily: 'sans-serif', padding: '16px' }}>
        <form onSubmit={handleMasuk} style={{ width: '100%', maxWidth: '380px', backgroundColor: '#fff', padding: '28px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', color: '#1a202c' }}>Masuk Admin</h1>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#718096' }}>Dashboard Admin Tryout TKA</p>
          <input
            type="password"
            value={inputSandi}
            onChange={(e) => setInputSandi(e.target.value)}
            placeholder="Kata sandi admin"
            autoFocus
            required
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e0', boxSizing: 'border-box', fontSize: '14px' }}
          />
          {galatMasuk && <div style={{ color: '#c53030', fontSize: '13px', marginTop: '8px' }}>{galatMasuk}</div>}
          <button type="submit" disabled={memeriksaSandi} style={{ width: '100%', marginTop: '14px', backgroundColor: memeriksaSandi ? '#a0aec0' : '#3182ce', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: memeriksaSandi ? 'not-allowed' : 'pointer' }}>
            {memeriksaSandi ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>

        {/* Header Dashboard */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px', borderBottom: '2px solid #edf2f7', paddingBottom: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#1a202c' }}>Dashboard Admin Tryout TKA</h1>
            <p style={{ margin: '4px 0 0', color: '#718096', fontSize: '14px' }}>Kelola data siswa, soal, dan pelaksanaan ujian tanpa perlu buka GitHub/Vercel</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={copyLinkUjian} style={{ backgroundColor: '#319795', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              📋 Salin Link Tryout Siswa
            </button>
            <button onClick={() => keluarAdmin('')} style={{ backgroundColor: '#e2e8f0', color: '#4a5568', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              Keluar
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {TAB.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                backgroundColor: activeTab === t.id ? '#3182ce' : '#e2e8f0',
                color: activeTab === t.id ? '#fff' : '#4a5568',
              }}
            >
              {t.nama}
            </button>
          ))}
        </div>

        {activeTab === 'siswa' && <DataSiswa sandi={sandi} onKeluar={() => keluarAdmin(keluarSesi)} />}
        {activeTab === 'soal' && <ImporSoal sandi={sandi} onKeluar={() => keluarAdmin(keluarSesi)} />}
        {activeTab === 'bank' && <BankSoal sandi={sandi} onKeluar={() => keluarAdmin(keluarSesi)} />}
        {activeTab === 'sekolah' && <AdminSekolah sandi={sandi} onKeluar={() => keluarAdmin(keluarSesi)} />}
        {activeTab === 'ujian' && <MenuUjian sandi={sandi} onKeluar={() => keluarAdmin(keluarSesi)} />}

      </div>
    </div>
  );
}
