'use client';
import { useEffect, useRef, useState } from 'react';

const STATUS = {
  belum_login: { teks: 'Belum login', latar: '#e2e8f0', warna: '#4a5568' },
  login: { teks: 'Sudah login', latar: '#bee3f8', warna: '#2a4365' },
  mengerjakan: { teks: 'Mengerjakan', latar: '#feebc8', warna: '#c05621' },
  waktu_habis: { teks: 'Waktu habis', latar: '#fed7d7', warna: '#9b2c2c' },
  selesai: { teks: 'Selesai', latar: '#c6f6d5', warna: '#22543d' },
};

const sel = { padding: '6px 10px', border: '1px solid #e2e8f0', fontSize: '13px' };
const mini = (warna, mati) => ({
  backgroundColor: mati ? '#a0aec0' : warna, color: '#fff', border: 'none', padding: '4px 8px',
  borderRadius: '4px', cursor: mati ? 'not-allowed' : 'pointer', fontSize: '12px', marginRight: '4px',
});

const format = (d) => `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;

export default function PantauUjian({ ujianId, sandi, onKeluar }) {
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [cari, setCari] = useState('');
  const [saring, setSaring] = useState('semua');
  const [terakhir, setTerakhir] = useState('');
  const sedangMuat = useRef(false);

  const panggil = async (metode, alamat, body) => {
    const headers = { 'x-admin-password': sandi };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(alamat, { method: metode, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    let json = {};
    try { json = await res.json(); } catch { /* respons bukan JSON */ }
    if (res.status === 401) { onKeluar(); return { res, json, keluar: true }; }
    return { res, json, keluar: false };
  };

  const muat = async () => {
    if (sedangMuat.current) return;
    sedangMuat.current = true;
    try {
      const { res, json, keluar } = await panggil('GET', `/api/admin/pantau?ujian_id=${ujianId}`);
      if (keluar) return;
      if (!res.ok) { setGalat(json.pesan || 'Gagal memuat pantauan.'); return; }
      setGalat('');
      setData(json);
      setTerakhir(new Date().toLocaleTimeString('id-ID'));
    } catch {
      setGalat('Tidak bisa menghubungi server. Mencoba lagi otomatis…');
    } finally {
      sedangMuat.current = false;
    }
  };

  useEffect(() => {
    muat();
    const t = setInterval(muat, 10000);
    return () => clearInterval(t);
  }, [ujianId]);

  const kirim = async (body, pesanSukses) => {
    setInfo(''); setGalat(''); setSibuk(true);
    try {
      const { res, json, keluar } = await panggil('POST', '/api/admin/pantau', body);
      if (keluar) return;
      if (!res.ok) { setGalat(json.pesan || 'Terjadi kesalahan.'); return; }
      setInfo(pesanSukses + (json.catatan ? ' ' + json.catatan : ''));
      await muat();
    } catch {
      setGalat('Tidak bisa menghubungi server. Perubahan belum tersimpan, silakan coba lagi.');
    } finally {
      setSibuk(false);
    }
  };

  const tutupSisa = async () => {
    if (!confirm('Tutup dan nilai semua siswa yang belum mengumpulkan? Jawaban yang sudah terkirim akan dihitung.')) return;
    setInfo(''); setGalat(''); setSibuk(true);
    try {
      const { res, json, keluar } = await panggil('POST', '/api/admin/ujian', { aksi: 'tutup_sesi', id: ujianId });
      if (keluar) return;
      if (!res.ok) { setGalat(json.pesan || 'Terjadi kesalahan.'); return; }
      setInfo(`${json.berhasil} sesi ditutup dan dinilai.` + (json.gagal ? ` ${json.gagal} gagal, silakan coba lagi.` : ''));
      await muat();
    } catch {
      setGalat('Tidak bisa menghubungi server. Silakan coba lagi.');
    } finally {
      setSibuk(false);
    }
  };

  const resetLogin = (s) => {
    if (!confirm(`Reset login untuk ${s.nama_lengkap} (${s.nomor_ujian})? Siswa ini bisa login lagi.`)) return;
    kirim({ aksi: 'reset_login', nomor_ujian: s.nomor_ujian }, `Login ${s.nama_lengkap} sudah direset.`);
  };

  const tambahWaktu = (s) => {
    const jawab = prompt(`Tambah waktu untuk ${s.nama_lengkap} (menit, 1 sampai 180):`, '10');
    if (jawab === null) return;
    kirim({ aksi: 'tambah_waktu', sesi_id: s.sesi_id, menit: Number(jawab) }, `Waktu ${s.nama_lengkap} ditambah ${Number(jawab)} menit.`);
  };

  const bukaUlang = (s) => {
    const jawab = prompt(
      `Buka ulang ujian ${s.nama_lengkap}.\nBerapa menit waktu yang diberikan? (waktu tersisa dijadikan paling sedikit sekian menit, 1 sampai 180)\nJawaban lama tetap tersimpan, dan siswa harus login ulang.`,
      '15'
    );
    if (jawab === null) return;
    kirim({ aksi: 'buka_ulang', sesi_id: s.sesi_id, menit: Number(jawab) }, `Ujian ${s.nama_lengkap} dibuka ulang.`);
  };

  if (!data) {
    return (
      <div style={{ padding: '12px 16px', fontSize: '14px', color: galat ? '#c53030' : '#718096' }}>
        {galat || 'Memuat pantauan…'}
      </div>
    );
  }

  const kata = cari.trim().toLowerCase();
  const tampil = data.siswa.filter(
    (s) =>
      (saring === 'semua' || s.status === saring) &&
      (!kata || s.nama_lengkap.toLowerCase().includes(kata) || s.nomor_ujian.toLowerCase().includes(kata))
  );
  const r = data.ringkas;
  const chip = (teks, nilai, st) => (
    <span
      key={teks}
      onClick={() => setSaring(saring === st ? 'semua' : st)}
      style={{ background: saring === st ? '#bee3f8' : '#edf2f7', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer' }}
    >
      {teks}: <b>{nilai}</b>
    </span>
  );

  return (
    <div style={{ border: '1px solid #bee3f8', backgroundColor: '#f7fbff', borderRadius: '8px', padding: '14px', marginTop: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        <b style={{ fontSize: '15px' }}>Pantauan: {data.ujian.nama}</b>
        <span style={{ fontSize: '12px', color: '#718096' }}>Diperbarui otomatis tiap 10 detik{terakhir ? ` · terakhir ${terakhir}` : ''}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
        {chip('Semua siswa', r.total, 'semua')}
        {chip('Belum login', r.belum_login, 'belum_login')}
        {chip('Sudah login', r.login, 'login')}
        {chip('Mengerjakan', r.mengerjakan, 'mengerjakan')}
        {chip('Waktu habis', r.waktu_habis, 'waktu_habis')}
        {chip('Selesai', r.selesai, 'selesai')}
      </div>

      {data.ujian.status === 'selesai' && r.mengerjakan + r.waktu_habis > 0 && (
        <div style={{ backgroundColor: '#fffaf0', border: '1px solid #fbd38d', color: '#c05621', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span>Ujian sudah ditutup, tetapi {r.mengerjakan + r.waktu_habis} siswa belum dinilai.</span>
          <button onClick={tutupSisa} disabled={sibuk} style={mini('#dd6b20', sibuk)}>Tutup &amp; Nilai Sekarang</button>
        </div>
      )}

      {galat && (
        <div style={{ backgroundColor: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>{galat}</div>
      )}
      {info && (
        <div style={{ backgroundColor: '#f0fff4', border: '1px solid #9ae6b4', color: '#22543d', padding: '8px 12px', borderRadius: '6px', marginBottom: '10px', fontSize: '13px' }}>{info}</div>
      )}

      <input
        type="text"
        placeholder="Cari nama atau nomor ujian…"
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '14px', width: '100%', maxWidth: '320px', boxSizing: 'border-box', marginBottom: '10px' }}
      />

      <div style={{ maxHeight: '480px', overflow: 'auto', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#edf2f7', textAlign: 'left', position: 'sticky', top: 0 }}>
              <th style={sel}>No Ujian</th>
              <th style={sel}>Nama</th>
              <th style={sel}>Status</th>
              <th style={sel}>Dijawab</th>
              <th style={sel}>Sisa waktu</th>
              <th style={sel}>Skor</th>
              <th style={sel}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {tampil.length === 0 && (
              <tr><td colSpan="7" style={{ ...sel, color: '#718096' }}>Tidak ada siswa yang cocok.</td></tr>
            )}
            {tampil.map((s) => {
              const l = STATUS[s.status];
              const belumKumpul = s.status === 'mengerjakan' || s.status === 'waktu_habis';
              return (
                <tr key={s.nomor_ujian}>
                  <td style={{ ...sel, fontWeight: 'bold' }}>{s.nomor_ujian}</td>
                  <td style={sel}>{s.nama_lengkap}</td>
                  <td style={sel}>
                    <span style={{ backgroundColor: l.latar, color: l.warna, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{l.teks}</span>
                  </td>
                  <td style={sel}>{s.sesi_id ? `${s.dijawab} / ${data.ujian.jumlah_soal}` : '-'}</td>
                  <td style={sel}>{s.sisa_detik !== null ? format(s.sisa_detik) : '-'}{s.tambahan_menit > 0 ? ` (+${s.tambahan_menit} mnt)` : ''}</td>
                  <td style={sel}>{s.skor !== null && s.skor !== undefined ? `${s.skor} / ${data.ujian.maks}` : '-'}</td>
                  <td style={{ ...sel, whiteSpace: 'nowrap' }}>
                    {s.is_logged_in && <button onClick={() => resetLogin(s)} disabled={sibuk} style={mini('#ed8936', sibuk)}>Reset Login</button>}
                    {belumKumpul && <button onClick={() => tambahWaktu(s)} disabled={sibuk} style={mini('#3182ce', sibuk)}>Tambah Waktu</button>}
                    {s.status === 'selesai' && <button onClick={() => bukaUlang(s)} disabled={sibuk} style={mini('#805ad5', sibuk)}>Buka Ulang</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#718096' }}>
        Klik label di atas untuk menyaring. Reset Login: siswa bisa login lagi. Buka Ulang: untuk siswa yang sudah mengumpulkan (login ikut direset, jawaban lama tetap ada).
      </p>
    </div>
  );
}
