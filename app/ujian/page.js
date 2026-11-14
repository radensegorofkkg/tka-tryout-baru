'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Teks from '../admin/Teks';

const fontDasar = 'sans-serif';
const kartu = { maxWidth: '820px', margin: '24px auto', padding: '24px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontFamily: fontDasar };
const tombol = (warna, mati) => ({
  backgroundColor: mati ? '#a0aec0' : warna, color: '#fff', border: 'none', padding: '10px 20px',
  borderRadius: '8px', cursor: mati ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '15px',
});

// 'kosong' | 'sebagian' | 'penuh'
function statusJawab(soal, j) {
  if (j === null || j === undefined) return 'kosong';
  if (soal.tipe === 'PG') return j ? 'penuh' : 'kosong';
  if (soal.tipe === 'PG_KOMPLEKS') return Array.isArray(j) && j.length > 0 ? 'penuh' : 'kosong';
  const jumlah = Object.keys(j).length;
  const total = soal.tipe === 'BENAR_SALAH' ? soal.opsi.length : soal.opsi.kiri.length;
  if (jumlah === 0) return 'kosong';
  return jumlah >= total ? 'penuh' : 'sebagian';
}

const MIN_KUMPUL = 0.8; // soal yang harus terjawab sebelum tombol Kumpulkan aktif
const adalahHp = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const lapisan = (z) => ({
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: z, backgroundColor: 'rgba(26,32,44,0.95)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto',
});
const kotakPeringatan = {
  maxWidth: '460px', width: '100%', backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
  textAlign: 'center', fontFamily: fontDasar,
};

const format = (d) => {
  const m = Math.floor(d / 60);
  const s = d % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function HalamanUjian() {
  const router = useRouter();
  const [fase, setFase] = useState('memuat'); // memuat | menunggu | siap | ujian | selesai | galat
  const [pesan, setPesan] = useState('');
  const [nama, setNama] = useState('');
  const [nomor, setNomor] = useState('');
  const [info, setInfo] = useState(null);
  const [namaUjian, setNamaUjian] = useState('');
  const [soal, setSoal] = useState([]);
  const [jawaban, setJawaban] = useState({});
  const [idx, setIdx] = useState(0);
  const [sisa, setSisa] = useState(0);
  const [belum, setBelum] = useState(0);
  const [sibuk, setSibuk] = useState(false);

  const batasRef = useRef(0);
  const tertunda = useRef(new Map()); // soal_id -> jawaban terbaru yang belum tersimpan
  const sedangKirim = useRef(new Set());

  // --- anti-kecurangan ---
  const antreanLapor = useRef([]); // kejadian yang belum terkirim: { jenis, detik }
  const sedangLapor = useRef(false);
  const jumlahLokal = useRef(0);
  const [peringatan, setPeringatan] = useState(null); // { jumlah, curang, jenis }
  const [penuh, setPenuh] = useState(true); // sedang dalam layar penuh?
  const [layarPenuhGagal, setLayarPenuhGagal] = useState(false);
  const terkunciRef = useRef(false);
  const [batas, setBatas] = useState(3); // diperbarui dari server (3 di laptop/PC, 5 di HP)
  const wakeLock = useRef(null);

  /* ---------- komunikasi dengan server ---------- */
  const api = async (metode, alamat, body) => {
    let nomorLokal = '';
    let token = '';
    try {
      nomorLokal = localStorage.getItem('peserta_nomor') || '';
      token = localStorage.getItem('peserta_token') || '';
    } catch { /* penyimpanan browser tidak tersedia */ }
    const headers = { 'x-nomor-ujian': nomorLokal, 'x-sesi-token': token };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(alamat, { method: metode, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    let json = {};
    try { json = await res.json(); } catch { /* respons bukan JSON */ }
    return { res, json };
  };

  const keluarLogin = () => {
    if (terkunciRef.current) return; // layar terkunci tetap ditampilkan
    try {
      localStorage.removeItem('peserta_nama');
      localStorage.removeItem('peserta_nomor');
      localStorage.removeItem('peserta_token');
    } catch { /* abaikan */ }
    router.push('/');
  };

  const tutup = (teks) => {
    tertunda.current.clear();
    setBelum(0);
    setPesan(teks || '');
    setFase('selesai');
  };

  const kumpulSelesai = async () => {
    try {
      const { res, json } = await api('POST', '/api/siswa/kumpul');
      if (res.status === 401) { keluarLogin(); return; }
      if (res.ok) { tutup(''); return; }
      if (res.status === 403) { tutup(json.pesan || 'Akses ujian sudah ditutup.'); return; }
      setPesan(json.pesan || 'Gagal mengumpulkan ujian.');
      setFase('galat');
    } catch {
      setPesan('Tidak bisa menghubungi server. Periksa koneksi internet, lalu coba lagi.');
      setFase('galat');
    }
  };

  const muatSoal = async () => {
    try {
      const { res, json } = await api('GET', '/api/siswa/soal');
      if (res.status === 401) { keluarLogin(); return; }
      if (res.status === 403) { tutup(json.pesan || ''); return; }
      if (!res.ok) { setPesan(json.pesan || 'Gagal mengambil soal.'); setFase('galat'); return; }
      if (json.waktu_habis) { await kumpulSelesai(); return; }
      setSoal(json.soal);
      setJawaban(json.jawaban || {});
      setNamaUjian(json.ujian.nama);
      batasRef.current = Date.now() + json.sisa_detik * 1000;
      setSisa(json.sisa_detik);
      setIdx(0);
      setFase('ujian');
    } catch {
      setPesan('Tidak bisa menghubungi server. Periksa koneksi internet, lalu coba lagi.');
      setFase('galat');
    }
  };

  const muatStatus = async () => {
    try {
      const { res, json } = await api('GET', '/api/siswa/ujian');
      if (res.status === 401) { keluarLogin(); return; }
      if (!res.ok) { setPesan(json.pesan || 'Gagal memuat data ujian.'); setFase('galat'); return; }
      setInfo(json);
      if (!json.ujian) { setFase('menunggu'); return; }
      if (json.status === 'belum_mulai') setFase('siap');
      else if (json.status === 'berlangsung') await muatSoal();
      else if (json.status === 'waktu_habis') await kumpulSelesai();
      else tutup('');
    } catch {
      setPesan('Tidak bisa menghubungi server. Periksa koneksi internet, lalu coba lagi.');
      setFase('galat');
    }
  };

  const mulai = async () => {
    mintaLayarPenuh(); // harus dipanggil langsung dari klik tombol agar diizinkan browser
    setSibuk(true);
    try {
      const { res, json } = await api('POST', '/api/siswa/ujian');
      if (res.status === 401) { keluarLogin(); return; }
      if (res.status === 403) { tutup(json.pesan || ''); return; }
      if (!res.ok) { alert(json.pesan || 'Gagal memulai ujian.'); return; }
      await muatSoal();
    } catch {
      alert('Tidak bisa menghubungi server. Periksa koneksi internet.');
    } finally {
      setSibuk(false);
    }
  };

  /* ---------- menyimpan jawaban ---------- */
  const kirim = async (id) => {
    if (sedangKirim.current.has(id)) return;
    sedangKirim.current.add(id);
    try {
      while (tertunda.current.has(id)) {
        const nilai = tertunda.current.get(id);
        let hasil;
        try {
          hasil = await api('POST', '/api/siswa/jawab', { soal_id: id, jawaban: nilai });
        } catch {
          return; // koneksi bermasalah: tetap di antrean, dicoba lagi otomatis
        }
        const { res, json } = hasil;
        if (res.status === 401) { keluarLogin(); return; }
        if (res.status === 403) {
          if (json.waktu_habis) await kumpulSelesai();
          else tutup(json.pesan || 'Akses ujian sudah ditutup.');
          return;
        }
        if (res.status === 400) { tertunda.current.delete(id); return; }
        if (!res.ok) return; // kesalahan sementara: dicoba lagi otomatis
        if (tertunda.current.get(id) === nilai) tertunda.current.delete(id);
        if (typeof json.sisa_detik === 'number') batasRef.current = Date.now() + json.sisa_detik * 1000;
      }
    } finally {
      sedangKirim.current.delete(id);
      setBelum(tertunda.current.size);
    }
  };

  const simpan = (id, nilai) => {
    setJawaban((lama) => {
      const baru = { ...lama };
      if (nilai === null) delete baru[id];
      else baru[id] = nilai;
      return baru;
    });
    tertunda.current.set(id, nilai);
    setBelum(tertunda.current.size);
    kirim(id);
  };

  const kumpul = async () => {
    if (soal.filter((x) => statusJawab(x, jawaban[x.id]) !== 'kosong').length < Math.ceil(soal.length * MIN_KUMPUL)) return;
    const kosong = soal.filter((s) => statusJawab(s, jawaban[s.id]) !== 'penuh').length;
    const tanya = kosong > 0
      ? `Masih ada ${kosong} soal yang belum dijawab sepenuhnya. Yakin ingin mengumpulkan? Setelah dikumpulkan, jawaban tidak bisa diubah.`
      : 'Yakin ingin mengumpulkan jawaban? Setelah dikumpulkan, jawaban tidak bisa diubah.';
    if (!confirm(tanya)) return;
    setSibuk(true);
    try {
      for (const id of [...tertunda.current.keys()]) await kirim(id);
      if (tertunda.current.size > 0) {
        alert('Ada jawaban yang belum tersimpan karena koneksi bermasalah. Periksa internet, tunggu sebentar, lalu coba kumpulkan lagi.');
        return;
      }
      await kumpulSelesai();
    } finally {
      setSibuk(false);
    }
  };

  /* ---------- anti-kecurangan ---------- */
  const elemenPenuh = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const bisaLayarPenuh = () => {
    const el = typeof document !== 'undefined' ? document.documentElement : null;
    return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));
  };
  // Mengembalikan true bila permintaan layar penuh berhasil (atau tidak didukung perangkat, mis. iPhone).
  const mintaLayarPenuh = async () => {
    try {
      const el = document.documentElement;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!fn) return false;
      await fn.call(el);
      setLayarPenuhGagal(false);
      return true;
    } catch {
      setLayarPenuhGagal(true); // jangan memblokir siswa bila perangkat menolak layar penuh
      return false;
    }
  };

  const kunciUjian = () => {
    terkunciRef.current = true;
    antreanLapor.current = [];
    tertunda.current.clear();
    try {
      localStorage.removeItem('peserta_nama');
      localStorage.removeItem('peserta_nomor');
      localStorage.removeItem('peserta_token');
    } catch { /* abaikan */ }
    try {
      if (elemenPenuh()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } catch { /* abaikan */ }
    setPeringatan(null);
    setFase('terkunci');
  };

  const kirimLapor = async () => {
    if (sedangLapor.current) return;
    sedangLapor.current = true;
    try {
      while (antreanLapor.current.length > 0) {
        const item = antreanLapor.current[0];
        let hasil;
        try {
          hasil = await api('POST', '/api/siswa/pelanggaran', item);
        } catch {
          return; // koneksi bermasalah: dicoba lagi otomatis
        }
        const { res, json } = hasil;
        if (res.status >= 500) return; // sementara: dicoba lagi
        antreanLapor.current.shift(); // berhasil, atau ditolak permanen (401/400): jangan diulang
        if (res.ok && typeof json.batas === 'number') setBatas(json.batas);
        if (res.ok && json.terkunci) { kunciUjian(); return; }
        if (res.ok && typeof json.jumlah === 'number') {
          jumlahLokal.current = Math.max(jumlahLokal.current, json.jumlah);
          setPeringatan((p) => (p ? { ...p, jumlah: Math.max(p.jumlah, json.jumlah), curang: !!json.curang } : p));
        }
      }
    } finally {
      sedangLapor.current = false;
    }
  };

  const lapor = (jenis, detik) => {
    jumlahLokal.current += 1;
    antreanLapor.current.push({ jenis, detik: Math.round(detik) });
    kirimLapor();
  };

  /* ---------- efek ---------- */
  useEffect(() => {
    let n = '';
    let m = '';
    let t = '';
    try {
      n = localStorage.getItem('peserta_nama') || '';
      m = localStorage.getItem('peserta_nomor') || '';
      t = localStorage.getItem('peserta_token') || '';
    } catch { /* abaikan */ }
    if (!n || !m || !t) { router.push('/'); return; }
    setNama(n);
    setNomor(m);
    setBatas(adalahHp() ? 5 : 3);
    muatStatus();
  }, []);

  // Ruang tunggu: cek tiap 5 detik apakah ujian sudah dibuka admin.
  useEffect(() => {
    if (fase !== 'menunggu') return;
    const t = setInterval(muatStatus, 5000);
    return () => clearInterval(t);
  }, [fase]);

  // Hitung mundur dari jam server; otomatis dikumpulkan saat habis.
  useEffect(() => {
    if (fase !== 'ujian') return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((batasRef.current - Date.now()) / 1000));
      setSisa(s);
      if (s <= 0) { clearInterval(t); kumpulSelesai(); }
    }, 1000);
    return () => clearInterval(t);
  }, [fase]);

  // Mencoba mengirim ulang jawaban yang belum tersimpan.
  useEffect(() => {
    if (fase !== 'ujian') return;
    const t = setInterval(() => {
      for (const id of [...tertunda.current.keys()]) kirim(id);
      kirimLapor();
    }, 5000);
    return () => clearInterval(t);
  }, [fase]);

  // Deteksi keluar halaman / pindah aplikasi / kehilangan fokus. Dicatat di server dan ditampilkan sebagai peringatan.
  useEffect(() => {
    if (fase !== 'ujian') return;
    let hiddenAt = null;
    let timerBlur = null;
    let sudahLaporBlur = false;

    const saatTersembunyi = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        if (timerBlur) { clearTimeout(timerBlur); timerBlur = null; }
        sudahLaporBlur = true; // kejadian ini dihitung sebagai keluar halaman, bukan kehilangan fokus
      } else if (hiddenAt) {
        const lama = (Date.now() - hiddenAt) / 1000;
        hiddenAt = null;
        sudahLaporBlur = false;
        if (lama >= 2) {
          lapor('keluar_halaman', lama);
          setPeringatan({ jenis: 'keluar_halaman', jumlah: jumlahLokal.current, curang: false });
        }
      }
    };
    const saatBlur = () => {
      if (document.hidden || timerBlur) return;
      timerBlur = setTimeout(() => {
        timerBlur = null;
        if (document.hidden || document.hasFocus() || sudahLaporBlur) return;
        sudahLaporBlur = true;
        lapor('kehilangan_fokus', 3);
        setPeringatan({ jenis: 'kehilangan_fokus', jumlah: jumlahLokal.current, curang: false });
      }, 3000);
    };
    const saatFokus = () => {
      if (timerBlur) { clearTimeout(timerBlur); timerBlur = null; }
      if (!document.hidden) sudahLaporBlur = false;
    };

    document.addEventListener('visibilitychange', saatTersembunyi);
    window.addEventListener('blur', saatBlur);
    window.addEventListener('focus', saatFokus);
    return () => {
      document.removeEventListener('visibilitychange', saatTersembunyi);
      window.removeEventListener('blur', saatBlur);
      window.removeEventListener('focus', saatFokus);
      if (timerBlur) clearTimeout(timerBlur);
    };
  }, [fase]);

  // Layar penuh: bila keluar dari layar penuh lebih dari 1 menit, dicatat sebagai pelanggaran.
  useEffect(() => {
    if (fase !== 'ujian') return;
    const perbarui = () => setPenuh(!!elemenPenuh());
    perbarui();
    document.addEventListener('fullscreenchange', perbarui);
    document.addEventListener('webkitfullscreenchange', perbarui);
    let sejak = null;
    let sudahLapor = false;
    const t = setInterval(() => {
      const wajib = bisaLayarPenuh() && !layarPenuhGagal;
      if (document.hidden) { sejak = null; return; } // layar mati / pindah tab: dihitung di deteksi keluar halaman
      if (!wajib || elemenPenuh()) { sejak = null; sudahLapor = false; return; }
      if (sejak === null) sejak = Date.now();
      const lama = (Date.now() - sejak) / 1000;
      if (lama >= 60 && !sudahLapor) {
        sudahLapor = true;
        lapor('tidak_layar_penuh', lama);
        setPeringatan({ jenis: 'tidak_layar_penuh', jumlah: jumlahLokal.current, curang: false });
      }
    }, 1000);
    return () => {
      clearInterval(t);
      document.removeEventListener('fullscreenchange', perbarui);
      document.removeEventListener('webkitfullscreenchange', perbarui);
    };
  }, [fase, layarPenuhGagal]);

  // Menahan layar tetap menyala selama ujian (Screen Wake Lock). Tidak semua HP mendukung atau mengizinkan,
  // misalnya saat mode hemat baterai; kalau gagal, ujian tetap berjalan seperti biasa.
  useEffect(() => {
    if (fase !== 'ujian') return;
    let batal = false;
    const minta = async () => {
      try {
        if (batal || !('wakeLock' in navigator) || document.hidden || wakeLock.current) return;
        const kunci = await navigator.wakeLock.request('screen');
        if (batal) { kunci.release().catch(() => {}); return; }
        wakeLock.current = kunci;
        kunci.addEventListener('release', () => { if (wakeLock.current === kunci) wakeLock.current = null; });
      } catch { /* tidak didukung atau ditolak */ }
    };
    minta();
    const saatTampil = () => { if (!document.hidden) minta(); };
    document.addEventListener('visibilitychange', saatTampil);
    return () => {
      batal = true;
      document.removeEventListener('visibilitychange', saatTampil);
      try { if (wakeLock.current) wakeLock.current.release().catch(() => {}); } catch { /* abaikan */ }
      wakeLock.current = null;
    };
  }, [fase]);

  // Menghalangi salin, tempel, klik kanan, dan seret selama ujian.
  useEffect(() => {
    if (fase !== 'ujian') return;
    const cegah = (e) => e.preventDefault();
    const acara = ['copy', 'cut', 'paste', 'contextmenu', 'dragstart'];
    acara.forEach((a) => document.addEventListener(a, cegah));
    return () => acara.forEach((a) => document.removeEventListener(a, cegah));
  }, [fase]);

  /* ---------- tampilan ---------- */
  if (fase === 'memuat') {
    return <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: fontDasar }}>Memuat…</div>;
  }

  if (fase === 'terkunci') {
    return (
      <main style={{ ...kartu, textAlign: 'center' }}>
        <div style={{ fontSize: '48px' }}>🔒</div>
        <h2 style={{ color: '#c53030' }}>Ujian Terkunci</h2>
        <p style={{ lineHeight: 1.6 }}>
          Anda terdeteksi melakukan pelanggaran sebanyak {batas} kali (atau tidak dalam layar penuh lebih dari 1 menit).
          Ujian dikunci otomatis dan dilaporkan ke pengawas.
        </p>
        <p style={{ lineHeight: 1.6, color: '#4a5568' }}>
          Angkat tangan dan hubungi pengawas. Jawaban yang sudah tersimpan tidak hilang. Waktu ujian tetap berjalan sampai
          pengawas membuka kembali akun Anda.
        </p>
      </main>
    );
  }

  if (fase === 'galat') {
    return (
      <div style={{ ...kartu, textAlign: 'center' }}>
        <h3 style={{ marginTop: 0, color: '#c53030' }}>Terjadi kendala</h3>
        <p>{pesan}</p>
        <button onClick={() => { setPesan(''); setFase('memuat'); muatStatus(); }} style={tombol('#3182ce')}>Coba Lagi</button>
      </div>
    );
  }

  if (fase === 'menunggu') {
    return (
      <div style={{ ...kartu, textAlign: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Halo, {nama}</h2>
        <p style={{ color: '#4a5568' }}>Nomor ujian: <b>{nomor}</b></p>
        <p style={{ fontSize: '18px' }}>Ujian belum dibuka.</p>
        <p style={{ color: '#718096', fontSize: '14px' }}>Tetap di halaman ini. Halaman akan otomatis berubah saat ujian dibuka oleh admin.</p>
      </div>
    );
  }

  if (fase === 'siap') {
    return (
      <div style={{ ...kartu, textAlign: 'center' }}>
        <h2 style={{ marginTop: 0 }}>{info.ujian.nama}</h2>
        <p style={{ color: '#4a5568' }}>Peserta: <b>{nama}</b> ({nomor})</p>
        <p>Jumlah soal: <b>{info.ujian.jumlah_soal}</b> · Waktu: <b>{info.ujian.durasi_menit} menit</b></p>
        <p style={{ color: '#718096', fontSize: '14px' }}>
          Waktu mulai berjalan setelah Anda menekan tombol di bawah. Jawaban tersimpan otomatis setiap kali Anda memilih.
        </p>
        <button onClick={mulai} disabled={sibuk} style={tombol('#38a169', sibuk)}>{sibuk ? 'Memulai…' : 'Mulai Ujian'}</button>
      </div>
    );
  }

  if (fase === 'selesai') {
    return (
      <div style={{ ...kartu, textAlign: 'center' }}>
        <h2 style={{ marginTop: 0, color: '#22543d' }}>✅ Ujian selesai</h2>
        <p>Terima kasih, {nama}.</p>
        {pesan
          ? <p style={{ color: '#4a5568' }}>{pesan}</p>
          : <p style={{ color: '#4a5568' }}>Jawaban Anda sudah dikumpulkan. Anda boleh menutup halaman ini.</p>}
      </div>
    );
  }

  // fase === 'ujian'
  const s = soal[idx];
  const j = jawaban[s.id];
  const mendesak = sisa <= 300;
  const terjawab = soal.filter((x) => statusJawab(x, jawaban[x.id]) !== 'kosong').length;
  const minimal = Math.ceil(soal.length * MIN_KUMPUL);
  const cukup = terjawab >= minimal;

  const pilihPG = (k) => simpan(s.id, k);
  const pilihPK = (k) => {
    const lama = Array.isArray(j) ? j : [];
    const baru = lama.includes(k) ? lama.filter((x) => x !== k) : [...lama, k].sort();
    simpan(s.id, baru.length ? baru : null);
  };
  const pilihBS = (k, nilai) => simpan(s.id, { ...(j || {}), [k]: nilai });
  const pilihJodoh = (kiri, kanan) => {
    const baru = { ...(j || {}) };
    if (kanan) baru[kiri] = kanan;
    else delete baru[kiri];
    simpan(s.id, Object.keys(baru).length ? baru : null);
  };

  const warnaNomor = (item, i) => {
    const st = statusJawab(item, jawaban[item.id]);
    const aktif = i === idx;
    return {
      width: '38px', height: '38px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
      border: aktif ? '3px solid #2b6cb0' : '1px solid #cbd5e0',
      backgroundColor: st === 'penuh' ? '#3182ce' : st === 'sebagian' ? '#f6ad55' : '#fff',
      color: st === 'penuh' ? '#fff' : '#2d3748',
    };
  };

  const pilihanGaya = (terpilih) => ({
    display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', marginBottom: '8px', borderRadius: '8px',
    border: terpilih ? '2px solid #3182ce' : '1px solid #cbd5e0', backgroundColor: terpilih ? '#ebf8ff' : '#fff',
    cursor: 'pointer', fontSize: '16px', lineHeight: 1.5, fontFamily: fontDasar,
  });

  return (
    <main style={{ ...kartu, margin: '16px auto', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {bisaLayarPenuh() && !penuh && !layarPenuhGagal && (
        <div style={lapisan(1002)}>
          <div style={kotakPeringatan}>
            <div style={{ fontSize: '40px' }}>🖥️</div>
            <h2 style={{ margin: '8px 0' }}>Ujian harus dalam layar penuh</h2>
            <p style={{ lineHeight: 1.6, color: '#4a5568' }}>
              Anda keluar dari layar penuh. Waktu ujian tetap berjalan. Keluar dari layar penuh lebih dari 1 menit
              akan dicatat sebagai pelanggaran dan dilaporkan ke pengawas.
            </p>
            <button onClick={mintaLayarPenuh} style={tombol('#3182ce')}>Masuk Layar Penuh</button>
          </div>
        </div>
      )}
      {peringatan && (
        <div style={lapisan(1001)}>
          <div style={kotakPeringatan}>
            <div style={{ fontSize: '40px' }}>⚠️</div>
            <h2 style={{ margin: '8px 0', color: '#c53030' }}>Peringatan</h2>
            <p style={{ lineHeight: 1.6 }}>
              {peringatan.jenis === 'tidak_layar_penuh'
                ? 'Anda tidak berada dalam layar penuh lebih dari 1 menit.'
                : peringatan.jenis === 'kehilangan_fokus'
                  ? 'Anda berpindah ke jendela atau aplikasi lain.'
                  : 'Anda terdeteksi keluar dari halaman ujian.'}
              {' '}Kejadian ini tercatat dan dapat dilihat pengawas.
            </p>
            <p style={{ fontWeight: 'bold' }}>Pelanggaran tercatat: {peringatan.jumlah} dari batas {batas}</p>
            <p style={{ lineHeight: 1.6, color: peringatan.curang || peringatan.jumlah >= batas ? '#c53030' : '#4a5568', fontSize: '14px' }}>
              {peringatan.curang || peringatan.jumlah >= batas
                ? 'Ujian Anda sudah ditandai "terdeteksi kecurangan" dan dilaporkan ke pengawas.'
                : `Jika mencapai ${batas} kali, ujian Anda ditandai "terdeteksi kecurangan".`}
            </p>
            <button onClick={() => setPeringatan(null)} style={tombol('#3182ce')}>Saya mengerti, lanjutkan ujian</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #edf2f7', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ fontSize: '14px' }}>
          <b>{namaUjian}</b><br />
          <span style={{ color: '#718096' }}>{nama} ({nomor})</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: mendesak ? '#c53030' : '#2d3748' }}>⏱ {format(sisa)}</div>
          <div style={{ fontSize: '13px', color: '#718096' }}>Soal {idx + 1} dari {soal.length}</div>
        </div>
      </div>

      {belum > 0 && (
        <div style={{ backgroundColor: '#fffaf0', border: '1px solid #fbd38d', color: '#c05621', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
          Menyimpan jawaban… Jika pesan ini bertahan lama, periksa koneksi internet Anda. Jawaban akan dikirim ulang otomatis.
        </div>
      )}

      {s.stimulus && (
        <div style={{ backgroundColor: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px', fontSize: '16px', lineHeight: 1.6 }}>
          {s.stimulus.isi && <div><Teks>{s.stimulus.isi}</Teks></div>}
          {s.stimulus.url_gambar && (
            <img src={s.stimulus.url_gambar} alt="Gambar soal" style={{ maxWidth: '100%', maxHeight: '420px', marginTop: s.stimulus.isi ? '10px' : 0, borderRadius: '6px' }} />
          )}
        </div>
      )}

      <div style={{ fontSize: '17px', fontWeight: '500', lineHeight: 1.6, marginBottom: '14px' }}>
        <Teks>{s.pertanyaan}</Teks>
      </div>

      {s.tipe === 'PG' && s.opsi.map((o) => (
        <button key={o.k} onClick={() => pilihPG(o.k)} style={pilihanGaya(j === o.k)}>
          <b>{o.k}.</b> <Teks>{o.teks}</Teks>
        </button>
      ))}

      {s.tipe === 'PG_KOMPLEKS' && (
        <div>
          <div style={{ fontSize: '13px', color: '#718096', marginBottom: '8px' }}>Pilih <b>lebih dari satu</b> jawaban yang benar.</div>
          {s.opsi.map((o) => {
            const terpilih = Array.isArray(j) && j.includes(o.k);
            return (
              <button key={o.k} onClick={() => pilihPK(o.k)} style={pilihanGaya(terpilih)}>
                <span style={{ display: 'inline-block', width: '22px' }}>{terpilih ? '☑' : '☐'}</span>
                <b>{o.k}.</b> <Teks>{o.teks}</Teks>
              </button>
            );
          })}
        </div>
      )}

      {s.tipe === 'BENAR_SALAH' && (
        <div>
          <div style={{ fontSize: '13px', color: '#718096', marginBottom: '8px' }}>Tentukan setiap pernyataan <b>Benar</b> atau <b>Salah</b>.</div>
          {s.opsi.map((o) => {
            const v = j ? j[o.k] : undefined;
            return (
              <div key={o.k} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
                <div style={{ marginBottom: '8px', fontSize: '16px', lineHeight: 1.5 }}><Teks>{o.teks}</Teks></div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => pilihBS(o.k, true)} style={{ ...pilihanGaya(v === true), width: 'auto', marginBottom: 0, padding: '6px 18px' }}>Benar</button>
                  <button onClick={() => pilihBS(o.k, false)} style={{ ...pilihanGaya(v === false), width: 'auto', marginBottom: 0, padding: '6px 18px' }}>Salah</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {s.tipe === 'JODOH' && (
        <div>
          <div style={{ fontSize: '13px', color: '#718096', marginBottom: '8px' }}>Pasangkan setiap pernyataan di kiri dengan pilihan yang sesuai.</div>
          {s.opsi.kiri.map((o) => (
            <div key={o.k} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
              <div style={{ marginBottom: '8px', fontSize: '16px', lineHeight: 1.5 }}><Teks>{o.teks}</Teks></div>
              <select
                value={j && j[o.k] ? j[o.k] : ''}
                onChange={(e) => pilihJodoh(o.k, e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: '15px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              >
                <option value="">-- Pilih pasangan --</option>
                {s.opsi.kanan.map((p) => (
                  <option key={p.k} value={p.k}>{p.teks}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #edf2f7' }}>
        <button onClick={() => setIdx(idx - 1)} disabled={idx === 0} style={tombol('#4a5568', idx === 0)}>Sebelumnya</button>
        {idx < soal.length - 1
          ? <button onClick={() => setIdx(idx + 1)} style={tombol('#3182ce')}>Selanjutnya</button>
          : <button onClick={kumpul} disabled={sibuk || !cukup} style={tombol('#38a169', sibuk || !cukup)}>{sibuk ? 'Mengumpulkan…' : 'Selesai & Kumpulkan'}</button>}
      </div>
      {!cukup && (
        <div style={{ marginTop: '8px', textAlign: 'right', fontSize: '13px', color: '#c05621' }}>
          Tombol kumpul aktif setelah minimal {minimal} dari {soal.length} soal terjawab (sudah {terjawab}).
        </div>
      )}

      <div style={{ marginTop: '22px' }}>
        <div style={{ fontSize: '13px', color: '#718096', marginBottom: '8px' }}>
          Nomor soal (biru = sudah dijawab, oranye = sebagian, putih = belum):
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {soal.map((item, i) => (
            <button key={item.id} onClick={() => setIdx(i)} style={warnaNomor(item, i)}>{i + 1}</button>
          ))}
        </div>
        {idx < soal.length - 1 && (
          <div style={{ marginTop: '16px', textAlign: 'right' }}>
            <button onClick={kumpul} disabled={sibuk || !cukup} style={tombol('#38a169', sibuk || !cukup)}>Kumpulkan Ujian</button>
          </div>
        )}
      </div>
    </main>
  );
}
