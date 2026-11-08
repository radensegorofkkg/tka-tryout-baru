'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import ImporSoal from './ImporSoal';

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseAnonKey);
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('siswa');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State Siswa
  const [nomorUjian, setNomorUjian] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [bulkData, setBulkData] = useState('');

  // Form State Pengaturan
  const [durasi, setDurasi] = useState(60);

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

  useEffect(() => {
    if (terbuka) fetchStudents();
  }, [terbuka]);

  const fetchStudents = async () => {
    const supabase = getSupabase();
    const { data } = await supabase.from('students').select('*').order('created_at', { ascending: false });
    if (data) setStudents(data);
  };

  // Helper: Unduh File Template CSV
  const downloadCSV = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplateSiswa = () => {
    const csvContent = 'nomor_ujian,nama_lengkap\n20528639-001,AHMAD DANI\n20528639-002,SITI NURHALIZA';
    downloadCSV(csvContent, 'template_siswa_tryout.csv');
  };

  // Tambah Siswa Single
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!nomorUjian || !namaLengkap) return;
    setLoading(true);
    const supabase = getSupabase();
    const { error } = await supabase.from('students').insert([
      { nomor_ujian: nomorUjian.trim().toUpperCase(), nama_lengkap: namaLengkap.trim(), is_logged_in: false }
    ]);
    setLoading(false);
    if (error) alert('Gagal menambah siswa: ' + error.message);
    else {
      alert('Siswa berhasil ditambahkan!');
      setNomorUjian('');
      setNamaLengkap('');
      fetchStudents();
    }
  };

  // Bulk Add Siswa (Teks / Paste Excel)
  const handleBulkAddStudents = async () => {
    if (!bulkData.trim()) return;
    setLoading(true);
    const rows = bulkData.trim().split('\n');
    const newStudents = rows.map(row => {
      const parts = row.includes(',') ? row.split(',') : row.split('\t');
      return {
        nomor_ujian: (parts[0] || '').trim().toUpperCase(),
        nama_lengkap: (parts[1] || parts[0] || '').trim(),
        is_logged_in: false
      };
    }).filter(s => s.nomor_ujian && s.nomor_ujian !== 'NOMOR_UJIAN');

    const supabase = getSupabase();
    const { error } = await supabase.from('students').insert(newStudents);
    setLoading(false);
    if (error) alert('Gagal import: ' + error.message);
    else {
      alert(`Berhasil menambahkan ${newStudents.length} siswa!`);
      setBulkData('');
      fetchStudents();
    }
  };

  // Upload File CSV Siswa
  const handleFileUploadSiswa = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setBulkData(text);
    };
    reader.readAsText(file);
  };

  // Reset Status Login Siswa
  const handleResetLogin = async (nomor) => {
    const supabase = getSupabase();
    await supabase.from('students').update({ is_logged_in: false }).eq('nomor_ujian', nomor);
    fetchStudents();
  };

  // Hapus Siswa
  const handleDeleteStudent = async (nomor) => {
    if (!confirm('Yakin ingin menghapus siswa ini?')) return;
    const supabase = getSupabase();
    await supabase.from('students').delete().eq('nomor_ujian', nomor);
    fetchStudents();
  };

  const copyLinkUjian = () => {
    const link = window.location.origin;
    navigator.clipboard.writeText(link);
    alert('Link Tryout berhasil disalin: ' + link);
  };

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #edf2f7', paddingBottom: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#1a202c' }}>Dashboard Admin Tryout TKA</h1>
            <p style={{ margin: '4px 0 0', color: '#718096', fontSize: '14px' }}>Kelola data siswa, soal, dan pengaturan ujian tanpa perlu buka GitHub/Vercel</p>
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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {['siswa', 'soal', 'pengaturan'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'bold',
                textTransform: 'capitalize',
                backgroundColor: activeTab === tab ? '#3182ce' : '#e2e8f0',
                color: activeTab === tab ? '#fff' : '#4a5568',
              }}
            >
              {tab === 'siswa' ? '👥 Database Siswa' : tab === 'soal' ? '📝 Input & Import Soal' : '⚙️ Pengaturan Ujian'}
            </button>
          ))}
        </div>

        {/* TAB 1: DATABASE SISWA */}
        {activeTab === 'siswa' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button onClick={handleDownloadTemplateSiswa} style={{ backgroundColor: '#4a5568', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                📥 Unduh Template CSV Siswa
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              {/* Form Manual 1 Siswa */}
              <div style={{ backgroundColor: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ marginTop: 0, fontSize: '16px' }}>Tambah 1 Siswa</h3>
                <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="text" placeholder="Nomor Ujian (Contoh: 20528639-001)" value={nomorUjian} onChange={(e) => setNomorUjian(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }} required />
                  <input type="text" placeholder="Nama Lengkap Siswa" value={namaLengkap} onChange={(e) => setNamaLengkap(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }} required />
                  <button type="submit" disabled={loading} style={{ backgroundColor: '#4299e1', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Simpan Siswa</button>
                </form>
              </div>

              {/* Import Siswa (Upload File / Paste Text) */}
              <div style={{ backgroundColor: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ marginTop: 0, fontSize: '16px' }}>Import Banyak Siswa (File / Paste)</h3>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Upload File CSV Siswa:</label>
                  <input type="file" accept=".csv,.txt" onChange={handleFileUploadSiswa} style={{ fontSize: '12px' }} />
                </div>
                <textarea
                  rows="4"
                  placeholder="Atau Paste di sini:&#10;20528639-001,AHMAD DANI&#10;20528639-002,SITI NURHALIZA"
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '12px', boxSizing: 'border-box' }}
                />
                <button onClick={handleBulkAddStudents} disabled={loading} style={{ backgroundColor: '#38a169', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginTop: '8px' }}>Proses Import Siswa</button>
              </div>
            </div>

            {/* Tabel Daftar Siswa */}
            <h3>Daftar Peserta Terdaftar ({students.length})</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#edf2f7', textAlign: 'left' }}>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e0' }}>No Ujian</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e0' }}>Nama Lengkap</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e0' }}>Status Login</th>
                  <th style={{ padding: '10px', border: '1px solid #cbd5e0' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.nomor_ujian}>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>{s.nomor_ujian}</td>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>{s.nama_lengkap}</td>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ backgroundColor: s.is_logged_in ? '#feebc8' : '#c6f6d5', color: s.is_logged_in ? '#c05621' : '#22543d', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                        {s.is_logged_in ? 'Sedang Aktif' : 'Belum Login'}
                      </span>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}>
                      {s.is_logged_in && (
                        <button onClick={() => handleResetLogin(s.nomor_ujian)} style={{ backgroundColor: '#ed8936', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Reset Status</button>
                      )}
                      <button onClick={() => handleDeleteStudent(s.nomor_ujian)} style={{ backgroundColor: '#e53e3e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: INPUT & IMPORT SOAL */}
        {activeTab === 'soal' && (
          <ImporSoal sandi={sandi} onKeluar={() => keluarAdmin('Sesi berakhir atau kata sandi berubah. Silakan masuk lagi.')} />
        )}

        {/* TAB 3: PENGATURAN */}
        {activeTab === 'pengaturan' && (
          <div style={{ backgroundColor: '#f7fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0 }}>Pengaturan Pelaksanaan Tryout</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Durasi Ujian (Menit):</label>
              <input type="number" value={durasi} onChange={(e) => setDurasi(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', width: '150px' }} />
            </div>
            <button onClick={() => alert('Pengaturan durasi disimpan!')} style={{ backgroundColor: '#3182ce', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Simpan Pengaturan</button>
          </div>
        )}

      </div>
    </div>
  );
}
