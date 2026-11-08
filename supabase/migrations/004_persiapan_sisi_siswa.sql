-- 004 – persiapan sisi siswa (login lewat server, timer, tambah waktu)

-- 1. Kartu masuk siswa: dibuat server saat login, dipakai untuk memastikan
--    permintaan benar-benar dari siswa yang login (bukan orang lain).
alter table students add column if not exists sesi_token text;

-- 2. Tambahan waktu per siswa yang bisa diberikan admin (menit),
--    misalnya kalau ada kendala teknis di lapangan.
alter table sesi_ujian add column if not exists tambahan_menit int not null default 0;
