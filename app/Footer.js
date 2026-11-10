// Footer kecil yang tampil di bawah semua halaman (siswa, ujian, admin, peringkat).
// Mengubah nama aplikasi atau pembuat: cukup ganti tulisan di bawah ini.
const NAMA_APLIKASI = 'TryoutKu TKA';
const PEMBUAT = 'yodhamahatva';

export default function Footer() {
  return (
    <footer
      style={{
        textAlign: 'center',
        padding: '20px 16px 24px',
        backgroundColor: '#f4f6f9',
        color: '#718096',
        fontFamily: 'sans-serif',
        fontSize: '13px',
        lineHeight: 1.7,
      }}
    >
      <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#a0aec0' }}>{NAMA_APLIKASI}</div>
      <div>
        Dibuat dengan <span aria-hidden="true">🍂</span> alakadarnya oleh{' '}
        <span style={{ color: '#3182ce' }}>{PEMBUAT}</span>
      </div>
      <div>© 2026 Hak Cipta Dilindungi</div>
    </footer>
  );
}
