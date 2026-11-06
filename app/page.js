'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function LoginUjian() {
  const [nomorPeserta, setNomorPeserta] = useState('');
  const [nama, setNama] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!nomorPeserta || !nama) {
      alert('Mohon isi Nomor Ujian dan Nama Lengkap!');
      return;
    }

    setLoading(true);
    // Simpan ke localStorage untuk dibawa ke halaman ujian
    localStorage.setItem('peserta_nomor', nomorPeserta);
    localStorage.setItem('peserta_nama', nama);

    // Cek apakah peserta terdaftar di database (opsional, langsung masuk ke ujian)
    setLoading(false);
    router.push('/ujian');
  };

  return (
    <main style={{ maxWidth: '400px', margin: '80px auto', padding: '30px', border: '1px solid #ddd', borderRadius: '8px', fontFamily: 'sans-serif', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>Login Tryout TKA</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Nomor Ujian:</label>
          <input 
            type="text" 
            value={nomorPeserta} 
            onChange={(e) => setNomorPeserta(e.target.value)} 
            placeholder="Contoh: TKA-001"
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Nama Lengkap:</label>
          <input 
            type="text" 
            value={nama} 
            onChange={(e) => setNama(e.target.value)} 
            placeholder="Masukkan nama kamu"
            style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '12px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
        >
          {loading ? 'Memproses...' : 'Mulai Ujian'}
        </button>
      </form>
    </main>
  );
}
