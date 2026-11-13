'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [nomorUjian, setNomorUjian] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/siswa/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomor_ujian: nomorUjian, nama_lengkap: namaLengkap }),
      });
      let data = {};
      try { data = await res.json(); } catch { /* respons bukan JSON */ }

      if (!res.ok) {
        alert(data.pesan || 'Terjadi kesalahan saat memproses login.');
        setLoading(false);
        return;
      }

      localStorage.setItem('peserta_nama', data.nama_lengkap);
      localStorage.setItem('peserta_nomor', data.nomor_ujian);
      localStorage.setItem('peserta_token', data.token);
      router.push('/ujian');

    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
      fontFamily: 'sans-serif',
      padding: '16px'
    }}>
      <div style={{
        fontSize: '22px',
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#1a365d',
        marginBottom: '16px',
        lineHeight: 1.3
      }}>
        Tryout TKA Kec. Banyuates
      </div>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '32px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid #f3f4f6'
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#1f2937',
          marginBottom: '24px'
        }}>
          Login Tryout TKA
        </h1>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              Nomor Ujian:
            </label>
            <input
              type="text"
              value={nomorUjian}
              onChange={(e) => setNomorUjian(e.target.value)}
              placeholder="Contoh: 20528639-001"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                fontSize: '14px'
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              Nama Lengkap:
            </label>
            <input
              type="text"
              value={namaLengkap}
              onChange={(e) => setNamaLengkap(e.target.value)}
              placeholder="Masukkan nama kamu"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                fontSize: '14px'
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#0070f3',
              color: 'white',
              fontWeight: '500',
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              marginTop: '8px'
            }}
          >
            {loading ? 'Memeriksa...' : 'Mulai Ujian'}
          </button>
        </form>
      </div>
    </div>
  );
}
