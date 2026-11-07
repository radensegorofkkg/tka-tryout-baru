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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-md border border-gray-100">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Login Tryout TKA</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nomor Ujian:
            </label>
            <input
              type="text"
              value={nomorUjian}
              onChange={(e) => setNomorUjian(e.target.value)}
              placeholder="Contoh: 20528639-001"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nama Lengkap:
            </label>
            <input
              type="text"
              value={namaLengkap}
              onChange={(e) => setNamaLengkap(e.target.value)}
              placeholder="Masukkan nama kamu"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
          >
            {loading ? 'Memeriksa...' : 'Mulai Ujian'}
          </button>
        </form>
      </div>
    </div>
  );
}
