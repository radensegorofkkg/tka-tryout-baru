'use client';
import { useEffect, useState } from 'react';
import PantauUjian from './PantauUjian';

const kotak = { backgroundColor: '#f7fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' };
const tombol = (warna, mati) => ({
  backgroundColor: mati ? '#a0aec0' : warna, color: '#fff', border: 'none', padding: '8px 14px',
  borderRadius: '6px', cursor: mati ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px',
});
const isian = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '14px', boxSizing: 'border-box' };
const LENCANA = {
  draft: { teks: 'Draft', latar: '#e2e8f0', warna: '#4a5568' },
  aktif: { teks: 'AKTIF', latar: '#c6f6d5', warna: '#22543d' },
  selesai: { teks: 'Selesai', latar: '#feebc8', warna: '#c05621' },
};

export default function MenuUjian({ sandi, onKeluar }) {
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pantauId, setPantauId] = useState(null);

  const [nama, setNama] = useState('');
  const [mapelId, setMapelId] = useState('');
  const [durasi, setDurasi] = useState(60);
  const [batchDipilih, setBatchDipilih] = useState([]);

  const panggil = async (metode, body) => {
    const headers = { 'x-admin-password': sandi };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch('/api/admin/ujian', { method: metode, headers, body: body ? JSON.stringify(body) : undefined });
    let json = {};
    try { json = await res.json(); } catch { /* respons bukan JSON */ }
    if (res.status === 401) { onKeluar(); return { res, json, keluar: true }; }
    return { res, json, keluar: false };
  };

  const muat = async () => {
    try {
      const { res, json, keluar } = await panggil('GET');
      if (keluar) return;
      if (!res.ok) { setGalat(json.pesan || 'Gagal memuat data.'); return; }
      setData(json);
    } catch {
      setGalat('Tidak bisa menghubungi server. Periksa koneksi internet.');
    }
  };

  useEffect(() => { muat(); }, []);

  // Mengirim satu aksi ke server, lalu memuat ulang daftar.
  const kirim = async (body, pesanSukses) => {
    setGalat(''); setInfo(''); setSibuk(true);
    try {
      const { res, json, keluar } = await panggil('POST', body);
      if (keluar) return false;
      if (!res.ok) { setGalat(json.pesan || 'Terjadi kesalahan.'); return false; }
      if (pesanSukses) setInfo(pesanSukses(json));
      await muat();
      return true;
    } catch {
      setGalat('Tidak bisa menghubungi server. Perubahan belum tersimpan, silakan coba lagi.');
      return false;
    } finally {
      setSibuk(false);
    }
  };

  const buatUjian = async (e) => {
    e.preventDefault();
    const namaUjian = nama.trim();
    const ok = await kirim(
      { aksi: 'buat', nama: namaUjian, mapel_id: Number(mapelId), durasi_menit: Number(durasi), batch_ids: batchDipilih },
      (j) => `Ujian "${namaUjian}" dibuat dengan ${j.jumlah_soal} soal (status draft). Tekan Aktifkan kalau sudah siap dimulai.`
    );
    if (ok) { setNama(''); setBatchDipilih([]); }
  };

  const aktifkan = (u) => {
    if (!confirm(`Aktifkan ujian "${u.nama}"? Setelah aktif, siswa bisa mulai mengerjakan.`)) return;
    kirim({ aksi: 'status', id: u.id, status: 'aktif' }, () => `Ujian "${u.nama}" sekarang AKTIF.`);
  };

  const selesaikan = (u) => {
    if (!confirm(`Akhiri ujian "${u.nama}"? Akses siswa akan ditutup.`)) return;
    kirim({ aksi: 'status', id: u.id, status: 'selesai' }, () => `Ujian "${u.nama}" sudah ditutup.`);
  };

  const ubahDurasi = (u) => {
    const jawab = prompt(`Durasi baru untuk "${u.nama}" (menit, 1 sampai 600):`, String(u.durasi_menit));
    if (jawab === null) return;
    kirim({ aksi: 'durasi', id: u.id, durasi_menit: Number(jawab) }, () => `Durasi diubah menjadi ${Number(jawab)} menit.`);
  };

  const hapus = (u) => {
    if (!confirm(`Hapus ujian draft "${u.nama}"? Soal di bank soal tidak ikut terhapus.`)) return;
    kirim({ aksi: 'hapus', id: u.id }, () => `Ujian "${u.nama}" dihapus.`);
  };

  const gantiMapel = (nilai) => { setMapelId(nilai); setBatchDipilih([]); };
  const centangBatch = (id) =>
    setBatchDipilih((lama) => (lama.includes(id) ? lama.filter((x) => x !== id) : [...lama, id]));

  if (!data) {
    return (
      <div>
        {galat
          ? <div style={{ color: '#c53030', fontSize: '14px' }}>{galat}</div>
          : <div style={{ color: '#718096', fontSize: '14px' }}>Memuat data ujian…</div>}
      </div>
    );
  }

  const namaMapel = Object.fromEntries(data.mapel.map((m) => [m.id, m.nama]));
  const jumlahDi = (b) => b.per_mapel.find((x) => x.mapel_id === Number(mapelId))?.jumlah || 0;
  const batchTersedia = mapelId ? data.batch.filter((b) => jumlahDi(b) > 0) : [];
  const totalSoal = data.batch.filter((b) => batchDipilih.includes(b.id)).reduce((a, b) => a + jumlahDi(b), 0);
  const bisaBuat = nama.trim() && mapelId && Number(durasi) >= 1 && batchDipilih.length > 0 && !sibuk;
  const adaAktif = data.ujian.some((u) => u.status === 'aktif');

  return (
    <div>
      {galat && (
        <div style={{ backgroundColor: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {galat}
        </div>
      )}
      {info && (
        <div style={{ backgroundColor: '#f0fff4', border: '1px solid #9ae6b4', color: '#22543d', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
          {info}
        </div>
      )}

      <div style={kotak}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>Buat Ujian Baru</h3>
        <form onSubmit={buatUjian} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            placeholder="Nama ujian (contoh: Tryout TKA 1 - Matematika)"
            value={nama}
            maxLength={100}
            onChange={(e) => setNama(e.target.value)}
            style={isian}
          />
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <select value={mapelId} onChange={(e) => gantiMapel(e.target.value)} style={{ ...isian, minWidth: '220px' }}>
              <option value="">-- Pilih mata pelajaran --</option>
              {data.mapel.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
            <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Durasi
              <input type="number" min="1" max="600" value={durasi} onChange={(e) => setDurasi(e.target.value)} style={{ ...isian, width: '90px' }} />
              menit
            </label>
          </div>

          <div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>Ambil soal dari file impor:</div>
            {!mapelId && <div style={{ fontSize: '13px', color: '#718096' }}>Pilih mata pelajaran dulu.</div>}
            {mapelId && batchTersedia.length === 0 && (
              <div style={{ fontSize: '13px', color: '#c05621' }}>
                Belum ada soal {namaMapel[mapelId]} di bank soal. Impor soalnya dulu di tab Input &amp; Import Soal.
              </div>
            )}
            {batchTersedia.map((b) => (
              <label key={b.id} style={{ display: 'block', fontSize: '14px', padding: '6px 10px', marginBottom: '4px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={batchDipilih.includes(b.id)} onChange={() => centangBatch(b.id)} style={{ marginRight: '8px' }} />
                Impor #{b.id} · {b.nama_file} · <b>{jumlahDi(b)}</b> soal {namaMapel[mapelId]}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="submit" disabled={!bisaBuat} style={tombol('#3182ce', !bisaBuat)}>
              {sibuk ? 'Menyimpan…' : 'Buat Ujian'}
            </button>
            {batchDipilih.length > 0 && <span style={{ fontSize: '13px', color: '#4a5568' }}>Total <b>{totalSoal}</b> soal akan masuk ujian ini.</span>}
          </div>
        </form>
      </div>

      <h3 style={{ fontSize: '16px' }}>Daftar Ujian ({data.ujian.length})</h3>
      {adaAktif && (
        <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#718096' }}>
          Hanya satu ujian yang boleh aktif. Selesaikan ujian yang aktif sebelum mengaktifkan yang lain.
        </p>
      )}
      {data.ujian.length === 0 && <div style={{ fontSize: '14px', color: '#718096' }}>Belum ada ujian.</div>}
      {data.ujian.map((u) => {
        const l = LENCANA[u.status] || LENCANA.draft;
        return (
          <div key={u.id} style={{ marginBottom: '8px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                {u.nama}{' '}
                <span style={{ backgroundColor: l.latar, color: l.warna, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', marginLeft: '6px' }}>{l.teks}</span>
              </div>
              <div style={{ fontSize: '13px', color: '#718096', marginTop: '2px' }}>
                {namaMapel[u.mapel_id] || 'Mapel tidak diketahui'} · {u.jumlah_soal} soal · {u.durasi_menit} menit
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => setPantauId(pantauId === u.id ? null : u.id)} style={tombol('#2b6cb0', false)}>
                {pantauId === u.id ? 'Tutup Pantauan' : 'Pantau'}
              </button>
              {u.status !== 'aktif' && (
                <button onClick={() => aktifkan(u)} disabled={sibuk || adaAktif} style={tombol('#38a169', sibuk || adaAktif)}>
                  {u.status === 'selesai' ? 'Aktifkan Lagi' : 'Aktifkan'}
                </button>
              )}
              {u.status === 'aktif' && (
                <button onClick={() => selesaikan(u)} disabled={sibuk} style={tombol('#dd6b20', sibuk)}>Selesai</button>
              )}
              {u.status !== 'aktif' && (
                <button onClick={() => ubahDurasi(u)} disabled={sibuk} style={tombol('#4a5568', sibuk)}>Ubah Durasi</button>
              )}
              {u.status === 'draft' && (
                <button onClick={() => hapus(u)} disabled={sibuk} style={tombol('#e53e3e', sibuk)}>Hapus</button>
              )}
            </div>
          </div>
          {pantauId === u.id && (
            <PantauUjian ujianId={u.id} sandi={sandi} onKeluar={onKeluar} />
          )}
          </div>
        );
      })}
    </div>
  );
}
