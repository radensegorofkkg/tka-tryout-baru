'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseAnonKey);
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('siswa');
  const [students, setStudents] = useState([]);
  const [soalList, setSoalList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State Siswa
  const [nomorUjian, setNomorUjian] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [bulkData, setBulkData] = useState('');

  // Form State Soal
  const [pertanyaan, setPertanyaan] = useState('');
  const [opsiA, setOpsiA] = useState('');
  const [opsiB, setOpsiB] = useState('');
  const [opsiC, setOpsiC] = useState('');
  const [opsiD, setOpsiD] = useState('');
  const [kunci, setKunci] = useState('A');

  // Form State Pengaturan
  const [durasi, setDurasi] = useState(60);

  useEffect(() => {
    fetchStudents();
    fetchSoal();
  }, []);

  const fetchStudents = async () => {
    const supabase = getSupabase();
    const { data } = await supabase.from('students').select('*').order('created_at', { ascending: false });
    if (data) setStudents(data);
  };

  const fetchSoal = async () => {
    const supabase = getSupabase();
    const { data } = await supabase.from('soal').select('*').order('id', { ascending: true });
    if (data) setSoalList(data);
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

  const handleDownloadTemplateSoal = () => {
    const csvContent = 'pertanyaan,opsi_a,opsi_b,opsi_c,opsi_d,kunci_jawaban\nIbu kota Indonesia saat ini adalah...,Jakarta,Surabaya,Bandung,Medan,A\nHasil dari 15 x 3 adalah...,30,45,50,60,B';
    downloadCSV(csvContent, 'template_soal_tryout.csv');
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

  // Upload File CSV Soal
  const handleFileUploadSoal = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        alert('File CSV kosong atau format tidak sesuai.');
        return;
      }

      const newSoal = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length >= 6) {
          newSoal.push({
            pertanyaan: row[0].trim(),
            opsi_a: row[1].trim(),
            opsi_b: row[2].trim(),
            opsi_c: row[3].trim(),
            opsi_d: row[4].trim(),
            kunci_jawaban: row[5].trim().toUpperCase()
          });
        }
      }

      if (newSoal.length === 0) {
        alert('Tidak ada soal valid yang terdeteksi di file.');
        return;
      }

      setLoading(true);
      const supabase = getSupabase();
      const { error } = await supabase.from('soal').insert(newSoal);
      setLoading(false);

      if (error) alert('Gagal import soal: ' + error.message);
      else {
        alert(`Berhasil mengimpor ${newSoal.length} soal!`);
        fetchSoal();
      }
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
  const handleDeleteStudent = async (id) => {
    if (!confirm('Yakin ingin menghapus siswa ini?')) return;
    const supabase = getSupabase();
    await supabase.from('students').delete().eq('id', id);
    fetchStudents();
  };

  // Tambah Soal Manual
  const handleAddSoal = async (e) => {
    e.preventDefault();
    setLoading(true);
    const supabase = getSupabase();
    const { error } = await supabase.from('soal').insert([
      {
        pertanyaan,
        opsi_a: opsiA,
        opsi_b: opsiB,
        opsi_c: opsiC,
        opsi_d: opsiD,
        kunci_jawaban: kunci
      }
    ]);
    setLoading(false);
    if (error) alert('Gagal menambah soal: ' + error.message);
    else {
      alert('Soal berhasil ditambahkan!');
      setPertanyaan(''); setOpsiA(''); setOpsiB(''); setOpsiC(''); setOpsiD('');
      fetchSoal();
    }
  };

  // Hapus Soal
  const handleDeleteSoal = async (id) => {
    if (!confirm('Yakin ingin menghapus soal ini?')) return;
    const supabase = getSupabase();
    await supabase.from('soal').delete().eq('id', id);
    fetchSoal();
  };

  const copyLinkUjian = () => {
    const link = window.location.origin;
    navigator.clipboard.writeText(link);
    alert('Link Tryout berhasil disalin: ' + link);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        
        {/* Header Dashboard */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #edf2f7', paddingBottom: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', color: '#1a202c' }}>Dashboard Admin Tryout TKA</h1>
            <p style={{ margin: '4px 0 0', color: '#718096', fontSize: '14px' }}>Kelola data siswa, soal, dan pengaturan ujian tanpa perlu buka GitHub/Vercel</p>
          </div>
          <button onClick={copyLinkUjian} style={{ backgroundColor: '#319795', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            📋 Salin Link Tryout Siswa
          </button>
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
                  <tr key={s.id}>
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
                      <button onClick={() => handleDeleteStudent(s.id)} style={{ backgroundColor: '#e53e3e', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: INPUT & IMPORT SOAL */}
        {activeTab === 'soal' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: '#ebf8ff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #bee3f8' }}>
              <div style={{ fontSize: '14px', color: '#2b6cb0' }}>
                <strong>Ingin Import Soal dari Excel/CSV?</strong> Unduh format
