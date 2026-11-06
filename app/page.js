'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [nama, setNama] = useState('');
  const [nomorUjian, setNomorUjian] = useState('');
  const router = useRouter();

  const handleMulai = (e) => {
    e.preventDefault();
    if (!nama || !nomorUjian) {
      alert('Mohon isi nama dan nomor ujian terlebih dahulu!');
      return;
    }
    localStorage.setItem('peserta_nama', nama);
    localStorage.setItem('peserta_nomor', nomorUjian);
    router.push('/ujian');
  };

  return (
    <main style={{ maxWidth: '400px', margin: '80px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>Login Tryout TKA</h2>
      <form onSubmit={handleMulai} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nama Lengkap:</label>
          <input 
            type="text" 
            value={nama} 
            onChange={(e) => setNama(e.target.value)} 
            placeholder="Masukkan nama kamu"
            style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nomor Ujian:</label>
          <input 
            type="text" 
            value={nomorUjian} 
            onChange={(e) => setNomorUjian(e.target.value)} 
            placeholder="Contoh: TKA-001"
            style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
          />
        </div>
        <button 
          type="submit" 
          style={{ padding: '12px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Mulai Ujian
        </button>
      </form>
    </main>
  );
}
