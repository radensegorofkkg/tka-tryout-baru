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
  const [mengunduh, setMengunduh] = useState(false);
  const [mengatur, setMengatur] = useState(false);
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

  const unduhHasil = async () => {
    setMengunduh(true);
    setGalat('');
    try {
      const res = await fetch(`/api/admin/ekspor?ujian_id=${ujianId}`, { headers: { 'x-admin-password': sandi }, cache: 'no-store' });
      if (res.status === 401) { onKeluar(); return; }
      if (!res.ok) {
        let pesan = 'Gagal mengunduh hasil.';
        try { pesan = (await res.json()).pesan || pesan; } catch { /* bukan JSON */ }
        setGalat(pesan);
        return;
      }
      const blob = await res.blob();
      const nama = String(data.ujian.nama || 'ujian').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ujian';
      const tgl = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Hasil-${nama}-${tgl}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      setInfo('File hasil berhasil diunduh.');
    } catch {
      setGalat('Tidak bisa menghubungi server. Periksa koneksi internet, lalu coba lagi.');
    } finally {
      setMengunduh(false);
    }
  };

  const aturPeringkat = async (terbuka) => {
    if (terbuka && !confirm('Buka peringkat untuk umum?\nSiapa saja yang memegang link peringkat bisa melihat nama (disamarkan), sekolah, dan nilai siswa yang sudah selesai.')) return;
    setMengatur(true);
    setInfo(''); setGalat('');
    try {
      const { res, json, keluar } = await panggil('POST', '/api/admin/peringkat', { ujian_id: ujianId, terbuka });
      if (keluar) return;
      if (!res.ok) { setGalat(json.pesan || 'Gagal mengatur peringkat.'); return; }
      setInfo(terbuka ? 'Peringkat dibuka. Salin link peringkat lalu bagikan.' : 'Peringkat ditutup.');
      await muat();
    } catch {
      setGalat('Tidak bisa menghubungi server. Periksa koneksi internet.');
    } finally {
      setMengatur(false);
    }
  };

  const salinLinkPeringkat = () => {
    const dasar = (process.env.NEXT_PUBLIC_URL_TRYOUT || window.location.origin).replace(/\/+$/, '');
    const link = `${dasar}/peringkat`;
    try { navigator.clipboard.writeText(link); } catch { /* abaikan */ }
    alert(`Link peringkat disalin:\n${link}`);
  };

  const kata = cari.trim().toLowerCase();
  const tampil = data.siswa.filter(
    (s) =>
      (saring === 'semua' || (saring === 'curang' ? s.curang : s.status === saring)) &&
      (!kata || s.nama_lengkap.toLowerCase().includes(kata) || s.nomor_ujian.toLowerCase().includes(kata) || (s.sekolah || '').toLowerCase().includes(kata))
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
        <button onClick={unduhHasil} disabled={mengunduh} style={{ ...mini('#2f855a', mengunduh), padding: '6px 12px', fontSize: '13px', fontWeight: 'bold' }}>
          {mengunduh ? 'Menyusun file…' : '📥 Unduh Hasil (Excel)'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 12px', marginBottom: '10px', fontSize: '13px' }}>
        <span>🏆 Peringkat publik: <b style={{ color: data.ujian.peringkat_terbuka ? '#22543d' : '#9b2c2c' }}>{data.ujian.peringkat_terbuka ? 'TERBUKA' : 'Tertutup'}</b></span>
        {data.ujian.peringkat_terbuka ? (
          <>
            <button onClick={salinLinkPeringkat} style={{ ...mini('#319795'), padding: '6px 12px', fontSize: '13px' }}>📋 Salin Link Peringkat</button>
            <button onClick={() => aturPeringkat(false)} disabled={mengatur} style={{ ...mini('#e53e3e', mengatur), padding: '6px 12px', fontSize: '13px' }}>Tutup Peringkat</button>
          </>
        ) : (
          <button onClick={() => aturPeringkat(true)} disabled={mengatur} style={{ ...mini('#3182ce', mengatur), padding: '6px 12px', fontSize: '13px' }}>Buka Peringkat</button>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
        {chip('Semua siswa', r.total, 'semua')}
        {chip('Belum login', r.belum_login, 'belum_login')}
        {chip('Sudah login', r.login, 'login')}
        {chip('Mengerjakan', r.mengerjakan, 'mengerjakan')}
        {chip('Waktu habis', r.waktu_habis, 'waktu_habis')}
        {chip('Selesai', r.selesai, 'selesai')}
        {chip('Terdeteksi kecurangan', r.curang || 0, 'curang')}
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
        placeholder="Cari nama, nomor ujian, atau sekolah…"
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
              <th style={sel}>Sekolah</th>
              <th style={sel}>Status</th>
              <th style={sel}>Dijawab</th>
              <th style={sel}>Sisa waktu</th>
              <th style={sel}>Skor</th>
              <th style={sel}>Pelanggaran</th>
              <th style={sel}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {tampil.length === 0 && (
              <tr><td colSpan="9" style={{ ...sel, color: '#718096' }}>Tidak ada siswa yang cocok.</td></tr>
            )}
            {tampil.map((s) => {
              const l = STATUS[s.status];
              const belumKumpul = s.status === 'mengerjakan' || s.status === 'waktu_habis';
              return (
                <tr key={s.nomor_ujian}>
                  <td style={{ ...sel, fontWeight: 'bold' }}>{s.nomor_ujian}</td>
                  <td style={sel}>{s.nama_lengkap}</td>
                  <td style={sel}>{s.sekolah || '-'}</td>
                  <td style={sel}>
                    <span style={{ backgroundColor: l.latar, color: l.warna, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{l.teks}</span>
                  </td>
                  <td style={sel}>{s.sesi_id ? `${s.dijawab} / ${data.ujian.jumlah_soal}` : '-'}</td>
                  <td style={sel}>{s.sisa_detik !== null ? format(s.sisa_detik) : '-'}{s.tambahan_menit > 0 ? ` (+${s.tambahan_menit} mnt)` : ''}</td>
                  <td style={sel}>{s.skor !== null && s.skor !== undefined ? `${s.skor} / ${data.ujian.maks}` : '-'}</td>
                  <td style={sel}>
                    {s.jumlah_pelanggaran > 0 ? (
                      <span
                        title={s.alasan_curang ? `Terdeteksi kecurangan karena: ${s.alasan_curang}` : 'Belum mencapai batas kecurangan'}
                        style={{ backgroundColor: s.curang ? '#fed7d7' : '#fefcbf', color: s.curang ? '#9b2c2c' : '#744210', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', cursor: 'help' }}
                      >
                        {s.curang ? '⚠ Terdeteksi' : ''} {s.jumlah_pelanggaran}x
                      </span>
                    ) : '-'}
                    {s.terkunci && <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#c53030', marginTop: '2px' }}>🔒 Terkunci otomatis — klik Reset Login agar bisa masuk lagi</div>}
                    {s.curang && s.alasan_curang && <div style={{ fontSize: '11px', color: '#9b2c2c', marginTop: '2px', maxWidth: '220px' }}>{s.alasan_curang}</div>}
                  </td>
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
