-- 006 – mengunci tabel siswa (RLS)
-- Setelah ini data siswa TIDAK bisa dibaca atau diubah dari browser memakai kunci anon.
-- Semua akses siswa/admin sudah lewat server (service role), yang tetap berjalan normal.

alter table students enable row level security;

-- Sengaja tanpa policy: tidak ada akses langsung dari browser.
-- Kalau perlu dibatalkan (darurat): alter table students disable row level security;
