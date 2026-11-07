'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseAnonKey);
};

export default function LoginPage() {
  const [nomorUjian, setNomorUjian] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanNomorUjian = nomorUjian.trim().toUpperCase();
    const cleanNama = namaLengkap.trim();

    try {
      const supabase = getSupabase();

      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .eq('nomor_ujian', cleanNomorUjian)
        .ilike('nama_lengkap', cleanNama)
        .single();

      if (error || !student) {
        alert('Gagal Login: Nomor Ujian atau Nama Lengkap tidak terdaftar / salah ketik!');
        setLoading(false);
        return;
      }

      if (student.is_logged_in) {
        alert('Peringatan: Nomor ujian ini sedang aktif di perangkat lain! Harap hubungi pengawas.');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('students')
        .update({ is_logged_in: true })
        .eq('nomor_ujian', cleanNomorUjian);

      if (updateError) {
        alert('Terjadi kesalahan saat memproses login.');
        setLoading(false);
        return;
      }

      localStorage.setItem('peserta_nama', student.nama_lengkap);
      localStorage.setItem('peserta_nomor', student.nomor_ujian);
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
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
      fontFamily: 'sans-serif',
      padding: '16px'
    }}>
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
