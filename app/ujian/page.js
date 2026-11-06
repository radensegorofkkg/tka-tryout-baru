'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function HalamanUjian() {
  const [soalList, setSoalList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [jawaban, setJawaban] = useState({});
  const [namaPeserta, setNamaPeserta] = useState('');
  const [nomorPeserta, setNomorPeserta] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const nama = localStorage.getItem('peserta_nama');
    const nomor = localStorage.getItem('peserta_nomor');
    if (!nama || !nomor) {
      router.push('/');
      return;
    }
    setNamaPeserta(nama);
    setNomorPeserta(nomor);

    async function ambilSoal() {
      const { data, error } = await supabase.from('soal').select('*');
      if (error) {
        console.error('Gagal mengambil soal:', error);
      } else {
        setSoalList(data || []);
      }
      setLoading(false);
    }
    ambilSoal();
  }, [router]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        alert('Peringatan! Anda terdeteksi keluar dari halaman ujian.');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handlePilihOpsi = (idSoal, pilihan) => {
    setJawaban({ ...jawaban, [idSoal]: pilihan });
  };

  const handleSelesai = async () => {
    if (!confirm('Apakah Anda yakin ingin mengakhiri dan mengirimkan jawaban ujian?')) return;
    
    const { error } = await supabase.from('jawaban_peserta').insert([
      { nomor_ujian: nomorPeserta, nama: namaPeserta, detail_jawaban: jawaban }
    ]);

    if (error) {
      alert('Terjadi kesalahan saat menyimpan jawaban: ' + error.message);
    } else {
      alert('Ujian berhasil dikumpulkan! Terima kasih.');
      localStorage.clear();
      router.push('/');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>Memuat soal ujian...</div>;
  }

  if (soalList.length === 0) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h3>Belum ada soal tersedia di database Supabase.</h3>
        <p>Silakan isi tabel soal terlebih dahulu.</p>
      </div>
    );
  }

  const soalAktif = soalList[currentIndex];

  return (
    <main style={{ maxWidth: '700px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif', border: '1px solid #ddd', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
        <span>Peserta: <b>{namaPeserta}</b> ({nomorPeserta})</span>
        <span>Soal ke {currentIndex + 1} dari {soalList.length}</span>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '18px', fontWeight: '500', lineHeight: '1.5' }}>{soalAktif.pertanyaan}</p>
        
        {soalAktif.url_gambar && (
          <div style={{ margin: '15px 0' }}>
            <img src={soalAktif.url_gambar} alt="Ilustrasi Soal" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '5px' }} />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
          {['A', 'B', 'C', 'D', 'E'].map((opsi) => {
            const teksOpsi = soalAktif[`opsi_${opsi.toLowerCase()}`];
            if (!teksOpsi) return null;
            return (
              <label key={opsi} style={{ padding: '10px 15px', border: '1px solid #ccc', borderRadius: '5px', cursor: 'pointer', backgroundColor: jawaban[soalAktif.id] === opsi ? '#e6f2ff' : '#fff' }}>
                <input 
                  type="radio" 
                  name={`soal_${soalAktif.id}`} 
                  checked={jawaban[soalAktif.id] === opsi}
                  onChange={() => handlePilihOpsi(soalAktif.id, opsi)}
                  style={{ marginRight: '10px' }}
                />
                <b>{opsi}.</b> {teksOpsi}
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
        <button 
          onClick={() => setCurrentIndex(currentIndex - 1)} 
          disabled={currentIndex === 0}
          style={{ padding: '10px 20px', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer' }}
        >
          Sebelumnya
        </button>

        {currentIndex < soalList.length - 1 ? (
          <button 
            onClick={() => setCurrentIndex(currentIndex + 1)}
            style={{ padding: '10px 20px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Selanjutnya
          </button>
        ) : (
          <button 
            onClick={handleSelesai}
            style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Selesai & Kumpulkan
          </button>
        )}
      </div>
    </main>
  );
}
